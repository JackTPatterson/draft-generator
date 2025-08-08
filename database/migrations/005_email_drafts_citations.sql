-- Migration: 005_email_drafts_citations.sql
-- Description: Add email executions and drafts tables with citation support
-- Created: 2025-08-01
-- Author: Claude Code Assistant

BEGIN;

-- Check if this migration has already been applied
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_version') THEN
        IF EXISTS (SELECT 1 FROM schema_version WHERE version = '5.0.0') THEN
            RAISE EXCEPTION 'Migration 005_email_drafts_citations has already been applied';
        END IF;
    END IF;
END
$$;

-- ================================
-- EMAIL EXECUTIONS TABLE
-- ================================

CREATE TABLE IF NOT EXISTS email_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gmail_id VARCHAR(255) UNIQUE,
    thread_id VARCHAR(255),
    execution_status VARCHAR(50) DEFAULT 'pending',
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================
-- EMAIL DRAFTS TABLE
-- ================================

CREATE TABLE IF NOT EXISTS email_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gmail_id VARCHAR(255),
    draft_content TEXT NOT NULL,
    draft_id VARCHAR(255) UNIQUE DEFAULT gen_random_uuid()::text,
    model_used VARCHAR(100),
    
    -- Citation support
    citations JSONB, -- Array of citation objects with full metadata
    used_citations TEXT[], -- Array of citation IDs that were actually used
    
    -- AI generation metadata
    generation_prompt TEXT,
    custom_prompt TEXT,
    knowledge_sources_count INTEGER DEFAULT 0,
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'draft', -- draft, accepted, rejected
    accepted_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key to executions
    CONSTRAINT fk_email_drafts_gmail_id 
        FOREIGN KEY (gmail_id) REFERENCES email_executions(gmail_id)
        ON DELETE CASCADE
);

-- ================================
-- INDEXES FOR PERFORMANCE
-- ================================

-- Email executions indexes
CREATE INDEX IF NOT EXISTS idx_email_executions_gmail_id ON email_executions(gmail_id);
CREATE INDEX IF NOT EXISTS idx_email_executions_thread_id ON email_executions(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_executions_status ON email_executions(execution_status);
CREATE INDEX IF NOT EXISTS idx_email_executions_processed_at ON email_executions(processed_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_executions_created_at ON email_executions(created_at DESC);

-- Email drafts indexes
CREATE INDEX IF NOT EXISTS idx_email_drafts_gmail_id ON email_drafts(gmail_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_draft_id ON email_drafts(draft_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_status ON email_drafts(status);
CREATE INDEX IF NOT EXISTS idx_email_drafts_created_at ON email_drafts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_drafts_citations ON email_drafts USING gin(citations);
CREATE INDEX IF NOT EXISTS idx_email_drafts_used_citations ON email_drafts USING gin(used_citations);
CREATE INDEX IF NOT EXISTS idx_email_drafts_model_used ON email_drafts(model_used);

-- ================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ================================

-- Update timestamps for email_executions
CREATE TRIGGER IF NOT EXISTS update_email_executions_updated_at 
    BEFORE UPDATE ON email_executions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================
-- USEFUL FUNCTIONS
-- ================================

-- Function to get drafts with citation metadata
CREATE OR REPLACE FUNCTION get_drafts_with_citations(p_gmail_id VARCHAR)
RETURNS TABLE (
    id UUID,
    draft_content TEXT,
    draft_id VARCHAR,
    model_used VARCHAR,
    citations JSONB,
    used_citations TEXT[],
    citations_count INTEGER,
    used_citations_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.draft_content,
        d.draft_id,
        d.model_used,
        d.citations,
        d.used_citations,
        COALESCE(jsonb_array_length(d.citations), 0) as citations_count,
        COALESCE(array_length(d.used_citations, 1), 0) as used_citations_count,
        d.created_at
    FROM email_drafts d
    WHERE d.gmail_id = p_gmail_id
    ORDER BY d.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to extract citation references from text
CREATE OR REPLACE FUNCTION extract_citation_references(content TEXT)
RETURNS TEXT[] AS $$
DECLARE
    citations TEXT[];
BEGIN
    -- Extract citations in [Source N] or [Ref N] format
    SELECT ARRAY_AGG(DISTINCT matches[1])
    INTO citations
    FROM (
        SELECT regexp_matches(content, '\[(Source|Ref)\s+(\d+)\]', 'gi') as matches
    ) subquery;
    
    RETURN COALESCE(citations, '{}');
END;
$$ LANGUAGE plpgsql;

-- Function to validate citations in content
CREATE OR REPLACE FUNCTION validate_draft_citations(
    content TEXT,
    available_citations JSONB
)
RETURNS JSONB AS $$
DECLARE
    found_refs TEXT[];
    available_ids TEXT[];
    result JSONB;
    invalid_refs TEXT[];
BEGIN
    -- Extract references from content
    found_refs := extract_citation_references(content);
    
    -- Extract available citation IDs
    SELECT ARRAY_AGG(citation->>'id')
    INTO available_ids
    FROM jsonb_array_elements(available_citations) as citation;
    
    -- Find invalid references
    SELECT ARRAY_AGG(ref)
    INTO invalid_refs
    FROM unnest(found_refs) as ref
    WHERE ref NOT = ANY(COALESCE(available_ids, '{}'));
    
    result := jsonb_build_object(
        'valid', COALESCE(array_length(invalid_refs, 1), 0) = 0,
        'found_references', found_refs,
        'available_citations', available_ids,
        'invalid_references', COALESCE(invalid_refs, '{}'),
        'total_references', COALESCE(array_length(found_refs, 1), 0),
        'total_available', COALESCE(array_length(available_ids, 1), 0)
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- VIEWS FOR EASY ACCESS
-- ================================

-- View combining executions with their drafts
CREATE OR REPLACE VIEW execution_summary AS
SELECT 
    e.id as execution_id,
    e.gmail_id,
    e.thread_id,
    e.execution_status,
    e.processed_at,
    e.created_at as execution_created_at,
    e.updated_at as execution_updated_at,
    COUNT(d.id) as draft_count,
    MAX(d.created_at) as latest_draft_at,
    COALESCE(
        JSONB_AGG(
            jsonb_build_object(
                'id', d.id,
                'draft_id', d.draft_id,
                'content_preview', LEFT(d.draft_content, 100),
                'citations_count', COALESCE(jsonb_array_length(d.citations), 0),
                'used_citations_count', COALESCE(array_length(d.used_citations, 1), 0),
                'model_used', d.model_used,
                'status', d.status,
                'created_at', d.created_at
            ) ORDER BY d.created_at DESC
        ) FILTER (WHERE d.id IS NOT NULL),
        '[]'::jsonb
    ) as drafts
FROM email_executions e
LEFT JOIN email_drafts d ON d.gmail_id = e.gmail_id
GROUP BY e.id, e.gmail_id, e.thread_id, e.execution_status, 
         e.processed_at, e.created_at, e.updated_at;

-- ================================
-- SAMPLE DATA FOR TESTING
-- ================================

-- Insert a sample execution and draft with citations (for testing)
INSERT INTO email_executions (gmail_id, thread_id, execution_status, processed_at)
VALUES ('sample-email-123', 'thread-456', 'completed', NOW())
ON CONFLICT (gmail_id) DO NOTHING;

INSERT INTO email_drafts (
    gmail_id, 
    draft_content, 
    model_used, 
    citations, 
    used_citations,
    knowledge_sources_count
) VALUES (
    'sample-email-123',
    'Thank you for your inquiry about our data privacy practices. According to our company policy [Source 1], we maintain strict security measures. Our GDPR compliance guidelines [Source 2] ensure proper data handling.',
    'gpt-4',
    '[
        {
            "id": "source-1",
            "label": "Source 1", 
            "title": "Data Privacy Policy",
            "category": "Legal Documents",
            "type": "document",
            "relevanceScore": 0.94
        },
        {
            "id": "source-2",
            "label": "Source 2",
            "title": "GDPR Compliance Guidelines", 
            "category": "Legal Documents",
            "type": "document",
            "relevanceScore": 0.89
        }
    ]'::jsonb,
    ARRAY['source-1', 'source-2'],
    2
) ON CONFLICT (draft_id) DO NOTHING;

-- ================================
-- COMMENTS FOR DOCUMENTATION
-- ================================

COMMENT ON TABLE email_executions IS 'Tracks email processing executions with status and metadata';
COMMENT ON TABLE email_drafts IS 'Stores AI-generated email drafts with citation support';
COMMENT ON COLUMN email_drafts.citations IS 'JSONB array of citation objects with full metadata';
COMMENT ON COLUMN email_drafts.used_citations IS 'Array of citation IDs that were referenced in the draft content';
COMMENT ON FUNCTION get_drafts_with_citations IS 'Retrieve drafts for an email with citation counts';
COMMENT ON FUNCTION extract_citation_references IS 'Extract citation references from draft content';
COMMENT ON FUNCTION validate_draft_citations IS 'Validate that citations in content match available sources';

-- Record migration
INSERT INTO schema_version (version, description) 
VALUES ('5.0.0', 'Email executions and drafts with citation support')
ON CONFLICT (version) DO NOTHING;

COMMIT;
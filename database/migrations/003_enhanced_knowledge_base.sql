-- Migration: 003_enhanced_knowledge_base.sql
-- Description: Enhanced knowledge base with document upload and AI integration
-- Created: 2025-01-31
-- Author: Claude Code Assistant

BEGIN;

-- Check if this migration has already been applied
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_version') THEN
        IF EXISTS (SELECT 1 FROM schema_version WHERE version = '3.0.0') THEN
            RAISE EXCEPTION 'Migration 003_enhanced_knowledge_base has already been applied';
        END IF;
    END IF;
END
$$;

-- ================================
-- DOCUMENT STORAGE AND MANAGEMENT
-- ================================

-- Create enum for document types
CREATE TYPE document_type AS ENUM (
    'pdf', 'docx', 'txt', 'md', 'html', 'json', 'csv', 'xlsx'
);

-- Create enum for document status
CREATE TYPE document_status AS ENUM (
    'uploading', 'processing', 'processed', 'failed', 'archived'
);

-- Enhanced knowledge documents table
CREATE TABLE knowledge_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id text NOT NULL,
    
    -- Document metadata
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_type document_type NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100),
    
    -- Storage information
    file_path TEXT, -- Local file path or cloud storage URL
    file_hash VARCHAR(64), -- SHA-256 hash for deduplication
    
    -- Processing status
    status document_status DEFAULT 'uploading',
    processing_error TEXT,
    
    -- Extracted content
    extracted_text TEXT,
    page_count INTEGER,
    word_count INTEGER,
    
    -- Document organization
    title VARCHAR(500),
    description TEXT,
    category VARCHAR(100),
    tags TEXT[] DEFAULT '{}',
    
    -- AI processing
    summary TEXT, -- AI-generated summary
    key_topics TEXT[], -- AI-extracted key topics
    business_context JSONB, -- Structured business information
    
    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    
    -- Status flags
    is_active BOOLEAN DEFAULT TRUE,
    is_searchable BOOLEAN DEFAULT TRUE,
    
    -- Full-text search
    search_vector tsvector,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    
    -- Ensure filename uniqueness per user
    UNIQUE(user_id, filename)
);

-- ================================
-- KNOWLEDGE CHUNKS FOR VECTOR SEARCH
-- ================================

-- Table for storing document chunks for better AI retrieval
CREATE TABLE knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    user_id text NOT NULL,
    
    -- Chunk content
    chunk_text TEXT NOT NULL,
    chunk_index INTEGER NOT NULL, -- Order within document
    
    -- Chunk metadata
    page_number INTEGER,
    section_title TEXT,
    chunk_type VARCHAR(50) DEFAULT 'paragraph', -- 'paragraph', 'heading', 'list', 'table'
    
    -- Vector embeddings (for future AI enhancement)
    embedding_vector JSONB, -- Store embeddings as JSON array
    
    -- Context
    context_before TEXT, -- Text before this chunk
    context_after TEXT, -- Text after this chunk
    
    -- Search
    search_vector tsvector,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================
-- BUSINESS KNOWLEDGE CATEGORIES
-- ================================

-- Predefined business knowledge categories
CREATE TABLE business_knowledge_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id text NOT NULL,
    
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    color VARCHAR(7), -- Hex color
    
    -- AI prompts for this category
    ai_prompt_template TEXT,
    extraction_rules JSONB, -- Rules for extracting specific information
    
    -- Organization
    parent_category_id UUID REFERENCES business_knowledge_categories(id),
    sort_order INTEGER DEFAULT 0,
    
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, name)
);

-- ================================
-- AI KNOWLEDGE EXTRACTION LOGS
-- ================================

-- Track AI processing and extraction
CREATE TABLE knowledge_extraction_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    user_id text NOT NULL,
    
    -- Processing details
    extraction_type VARCHAR(50), -- 'summary', 'topics', 'entities', 'business_info'
    model_used VARCHAR(100),
    prompt_used TEXT,
    
    -- Results
    extracted_data JSONB,
    confidence_score DECIMAL(3,2),
    
    -- Performance metrics
    processing_time_ms INTEGER,
    tokens_used INTEGER,
    cost_estimate DECIMAL(8,4),
    
    -- Status
    status VARCHAR(20) DEFAULT 'completed', -- 'completed', 'failed', 'partial'
    error_message TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================
-- INDEXES FOR PERFORMANCE
-- ================================

-- Knowledge documents indexes
CREATE INDEX idx_knowledge_documents_user_id ON knowledge_documents(user_id);
CREATE INDEX idx_knowledge_documents_status ON knowledge_documents(status);
CREATE INDEX idx_knowledge_documents_file_type ON knowledge_documents(file_type);
CREATE INDEX idx_knowledge_documents_category ON knowledge_documents(category);
CREATE INDEX idx_knowledge_documents_file_hash ON knowledge_documents(file_hash);
CREATE INDEX idx_knowledge_documents_search_vector ON knowledge_documents USING gin(search_vector);
CREATE INDEX idx_knowledge_documents_tags ON knowledge_documents USING gin(tags);
CREATE INDEX idx_knowledge_documents_key_topics ON knowledge_documents USING gin(key_topics);
CREATE INDEX idx_knowledge_documents_is_searchable ON knowledge_documents(is_searchable);

-- Knowledge chunks indexes
CREATE INDEX idx_knowledge_chunks_document_id ON knowledge_chunks(document_id);
CREATE INDEX idx_knowledge_chunks_user_id ON knowledge_chunks(user_id);
CREATE INDEX idx_knowledge_chunks_chunk_index ON knowledge_chunks(chunk_index);
CREATE INDEX idx_knowledge_chunks_search_vector ON knowledge_chunks USING gin(search_vector);
CREATE INDEX idx_knowledge_chunks_chunk_type ON knowledge_chunks(chunk_type);

-- Business categories indexes
CREATE INDEX idx_business_knowledge_categories_user_id ON business_knowledge_categories(user_id);
CREATE INDEX idx_business_knowledge_categories_parent ON business_knowledge_categories(parent_category_id);
CREATE INDEX idx_business_knowledge_categories_sort_order ON business_knowledge_categories(sort_order);

-- Extraction logs indexes
CREATE INDEX idx_knowledge_extraction_logs_document_id ON knowledge_extraction_logs(document_id);
CREATE INDEX idx_knowledge_extraction_logs_user_id ON knowledge_extraction_logs(user_id);
CREATE INDEX idx_knowledge_extraction_logs_created_at ON knowledge_extraction_logs(created_at DESC);

-- ================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ================================

-- Update timestamps
CREATE TRIGGER update_knowledge_documents_updated_at BEFORE UPDATE ON knowledge_documents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_knowledge_categories_updated_at BEFORE UPDATE ON business_knowledge_categories 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update search vectors for documents
CREATE OR REPLACE FUNCTION update_knowledge_document_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.summary, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.extracted_text, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'D') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(NEW.key_topics, ' '), '')), 'D');
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_knowledge_documents_search_vector 
    BEFORE INSERT OR UPDATE ON knowledge_documents 
    FOR EACH ROW EXECUTE FUNCTION update_knowledge_document_search_vector();

-- Update search vectors for chunks
CREATE OR REPLACE FUNCTION update_knowledge_chunk_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.section_title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.chunk_text, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.context_before, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(NEW.context_after, '')), 'C');
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_knowledge_chunks_search_vector 
    BEFORE INSERT OR UPDATE ON knowledge_chunks 
    FOR EACH ROW EXECUTE FUNCTION update_knowledge_chunk_search_vector();

-- Update usage count when document is accessed
CREATE OR REPLACE FUNCTION update_document_usage_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE knowledge_documents 
    SET 
        usage_count = usage_count + 1,
        last_accessed_at = NOW(),
        updated_at = NOW()
    WHERE id = NEW.document_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ================================
-- UTILITY FUNCTIONS
-- ================================

-- Function to search knowledge base with ranking
CREATE OR REPLACE FUNCTION search_knowledge_base(
    p_user_id text,
    p_query text,
    p_category text DEFAULT NULL,
    p_limit integer DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    title VARCHAR(500),
    description TEXT,
    category VARCHAR(100),
    relevance_score REAL,
    snippet TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        kd.id,
        kd.title,
        kd.description,
        kd.category,
        ts_rank(kd.search_vector, plainto_tsquery('english', p_query)) as relevance_score,
        ts_headline('english', 
            COALESCE(kd.summary, LEFT(kd.extracted_text, 500)), 
            plainto_tsquery('english', p_query),
            'MaxWords=50, MinWords=10'
        ) as snippet
    FROM knowledge_documents kd
    WHERE kd.user_id = p_user_id
        AND kd.is_active = true
        AND kd.is_searchable = true
        AND kd.search_vector @@ plainto_tsquery('english', p_query)
        AND (p_category IS NULL OR kd.category = p_category)
    ORDER BY relevance_score DESC
    LIMIT p_limit;
END;
$$ language 'plpgsql';

-- Function to get relevant chunks for AI context
CREATE OR REPLACE FUNCTION get_relevant_chunks(
    p_user_id text,
    p_query text,
    p_limit integer DEFAULT 5
)
RETURNS TABLE (
    chunk_text TEXT,
    document_title VARCHAR(500),
    section_title TEXT,
    relevance_score REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        kc.chunk_text,
        kd.title as document_title,
        kc.section_title,
        ts_rank(kc.search_vector, plainto_tsquery('english', p_query)) as relevance_score
    FROM knowledge_chunks kc
    JOIN knowledge_documents kd ON kc.document_id = kd.id
    WHERE kc.user_id = p_user_id
        AND kd.is_active = true
        AND kd.is_searchable = true
        AND kc.search_vector @@ plainto_tsquery('english', p_query)
    ORDER BY relevance_score DESC
    LIMIT p_limit;
END;
$$ language 'plpgsql';

-- ================================
-- SAMPLE BUSINESS CATEGORIES
-- ================================

-- Insert default business knowledge categories
INSERT INTO business_knowledge_categories (user_id, name, description, icon, color, ai_prompt_template, sort_order) 
VALUES 
    ('demo-user', 'Company Policies', 'Internal company policies and procedures', 'shield', '#10B981', 'Extract key policy points and compliance requirements', 1),
    ('demo-user', 'Product Information', 'Product specifications, features, and documentation', 'package', '#3B82F6', 'Summarize product features, benefits, and use cases', 2),
    ('demo-user', 'Customer Service', 'Customer service guidelines and FAQ responses', 'headphones', '#F59E0B', 'Extract customer service procedures and standard responses', 3),
    ('demo-user', 'Legal Documents', 'Contracts, agreements, and legal documentation', 'scale', '#EF4444', 'Identify key legal terms, obligations, and important clauses', 4),
    ('demo-user', 'Marketing Materials', 'Marketing campaigns, brand guidelines, and messaging', 'megaphone', '#8B5CF6', 'Extract key messaging, brand voice, and marketing strategies', 5),
    ('demo-user', 'Technical Documentation', 'Technical specifications, API docs, and guides', 'code', '#6B7280', 'Summarize technical requirements, procedures, and specifications', 6);

-- ================================
-- VIEWS FOR KNOWLEDGE BASE
-- ================================

-- Comprehensive knowledge base view
CREATE VIEW knowledge_base_summary AS
SELECT 
    kd.id,
    kd.user_id,
    kd.title,
    kd.description,
    kd.category,
    kd.file_type,
    kd.status,
    kd.usage_count,
    kd.word_count,
    kd.page_count,
    kd.tags,
    kd.key_topics,
    kd.created_at,
    kd.updated_at,
    -- Category information
    bkc.color as category_color,
    bkc.icon as category_icon,
    -- Chunk count
    COUNT(kc.id) as chunk_count
FROM knowledge_documents kd
LEFT JOIN business_knowledge_categories bkc ON bkc.user_id = kd.user_id AND bkc.name = kd.category
LEFT JOIN knowledge_chunks kc ON kc.document_id = kd.id
WHERE kd.is_active = true
GROUP BY kd.id, kd.user_id, kd.title, kd.description, kd.category, kd.file_type, 
         kd.status, kd.usage_count, kd.word_count, kd.page_count, kd.tags, 
         kd.key_topics, kd.created_at, kd.updated_at, bkc.color, bkc.icon;

-- ================================
-- CONSTRAINTS
-- ================================

-- Ensure positive file sizes and counts
ALTER TABLE knowledge_documents ADD CONSTRAINT check_positive_file_size 
    CHECK (file_size > 0);

ALTER TABLE knowledge_documents ADD CONSTRAINT check_positive_word_count 
    CHECK (word_count IS NULL OR word_count >= 0);

ALTER TABLE knowledge_chunks ADD CONSTRAINT check_positive_chunk_index 
    CHECK (chunk_index >= 0);

-- ================================
-- COMMENTS FOR DOCUMENTATION
-- ================================

COMMENT ON TABLE knowledge_documents IS 'Uploaded business documents with AI processing and search capabilities';
COMMENT ON TABLE knowledge_chunks IS 'Document chunks for granular search and AI context retrieval';
COMMENT ON TABLE business_knowledge_categories IS 'Categories for organizing business knowledge with AI processing rules';
COMMENT ON TABLE knowledge_extraction_logs IS 'Audit trail for AI knowledge extraction and processing';

-- Record migration
INSERT INTO schema_version (version, description) 
VALUES ('3.0.0', 'Enhanced knowledge base with document upload and AI integration');

COMMIT;
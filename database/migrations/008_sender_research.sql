-- Migration: Add sender research functionality
-- Generated: 2025-01-04

-- ================================
-- SENDER RESEARCH TABLES
-- ================================

-- Create enum for research confidence levels
CREATE TYPE research_confidence AS ENUM ('low', 'medium', 'high');

-- Create enum for research data sources
CREATE TYPE research_source AS ENUM (
    'domain_lookup', 'google_search', 'linkedin_search', 'clearbit_free', 
    'hunter_free', 'manual', 'cached', 'company_website'
);

-- Main sender research table
CREATE TABLE sender_research (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Email identifier (can be used across multiple emails from same sender)
    sender_email VARCHAR(255) NOT NULL,
    sender_name VARCHAR(255),
    sender_domain VARCHAR(255) NOT NULL,
    
    -- Research data
    linkedin_url TEXT,
    linkedin_profile_data JSONB, -- Full LinkedIn profile data
    company_name VARCHAR(255),
    company_domain VARCHAR(255),
    job_title VARCHAR(255),
    industry VARCHAR(100),
    location VARCHAR(255),
    
    -- Company information
    company_info JSONB, -- Full company data (size, industry, description, etc.)
    company_logo_url TEXT,
    company_website TEXT,
    
    -- Additional context
    bio TEXT,
    experience_summary TEXT,
    education_summary TEXT,
    mutual_connections INTEGER DEFAULT 0,
    recent_activity JSONB, -- Recent posts, achievements, etc.
    
    -- Research metadata
    confidence research_confidence DEFAULT 'low',
    data_sources research_source[] DEFAULT '{}',
    research_notes TEXT,
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(sender_email)
);

-- Research attempts log (for rate limiting and debugging)
CREATE TABLE research_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_email VARCHAR(255) NOT NULL,
    research_source research_source NOT NULL,
    success BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    response_data JSONB,
    api_cost_cents INTEGER DEFAULT 0, -- Track API costs
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Link emails to sender research
ALTER TABLE emails ADD COLUMN sender_research_id UUID REFERENCES sender_research(id);

-- ================================
-- INDEXES FOR PERFORMANCE
-- ================================

-- Sender research indexes
CREATE INDEX idx_sender_research_email ON sender_research(sender_email);
CREATE INDEX idx_sender_research_domain ON sender_research(sender_domain);
CREATE INDEX idx_sender_research_company ON sender_research(company_name);
CREATE INDEX idx_sender_research_confidence ON sender_research(confidence);
CREATE INDEX idx_sender_research_updated_at ON sender_research(last_updated_at DESC);

-- Research attempts indexes
CREATE INDEX idx_research_attempts_email ON research_attempts(sender_email);
CREATE INDEX idx_research_attempts_source ON research_attempts(research_source);
CREATE INDEX idx_research_attempts_created_at ON research_attempts(created_at DESC);
CREATE INDEX idx_research_attempts_success ON research_attempts(success);

-- Email-research link index
CREATE INDEX idx_emails_sender_research_id ON emails(sender_research_id);

-- ================================
-- TRIGGERS
-- ================================

-- Update timestamp trigger for sender_research
CREATE TRIGGER update_sender_research_updated_at 
    BEFORE UPDATE ON sender_research 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================
-- UTILITY FUNCTIONS
-- ================================

-- Function to get or create sender research record
CREATE OR REPLACE FUNCTION get_or_create_sender_research(
    p_sender_email VARCHAR(255),
    p_sender_name VARCHAR(255) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    research_id UUID;
    sender_domain VARCHAR(255);
BEGIN
    -- Extract domain from email
    sender_domain := SPLIT_PART(p_sender_email, '@', 2);
    
    -- Check if research already exists
    SELECT id INTO research_id 
    FROM sender_research 
    WHERE sender_email = p_sender_email;
    
    -- Create new research record if not exists
    IF research_id IS NULL THEN
        INSERT INTO sender_research (
            sender_email, 
            sender_name, 
            sender_domain
        ) VALUES (
            p_sender_email, 
            p_sender_name, 
            sender_domain
        ) RETURNING id INTO research_id;
    END IF;
    
    RETURN research_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check if research needs updating (older than 7 days)
CREATE OR REPLACE FUNCTION research_needs_update(p_sender_email VARCHAR(255))
RETURNS BOOLEAN AS $$
DECLARE
    last_update TIMESTAMP WITH TIME ZONE;
    needs_update BOOLEAN := TRUE;
BEGIN
    SELECT last_updated_at INTO last_update
    FROM sender_research 
    WHERE sender_email = p_sender_email;
    
    IF last_update IS NOT NULL AND last_update > NOW() - INTERVAL '7 days' THEN
        needs_update := FALSE;
    END IF;
    
    RETURN needs_update;
END;
$$ LANGUAGE plpgsql;

-- Function to log research attempts
CREATE OR REPLACE FUNCTION log_research_attempt(
    p_sender_email VARCHAR(255),
    p_source research_source,
    p_success BOOLEAN,
    p_error_message TEXT DEFAULT NULL,
    p_response_data JSONB DEFAULT NULL,
    p_api_cost_cents INTEGER DEFAULT 0
)
RETURNS UUID AS $$
DECLARE
    attempt_id UUID;
BEGIN
    INSERT INTO research_attempts (
        sender_email,
        research_source,
        success,
        error_message,
        response_data,
        api_cost_cents
    ) VALUES (
        p_sender_email,
        p_source,
        p_success,
        p_error_message,
        p_response_data,
        p_api_cost_cents
    ) RETURNING id INTO attempt_id;
    
    RETURN attempt_id;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- USEFUL VIEWS
-- ================================

-- View for emails with sender research
CREATE VIEW emails_with_research AS
SELECT 
    e.*,
    sr.linkedin_url,
    sr.company_name,
    sr.job_title,
    sr.industry,
    sr.location,
    sr.confidence as research_confidence,
    sr.data_sources,
    sr.last_updated_at as research_updated_at
FROM emails e
LEFT JOIN sender_research sr ON e.sender_research_id = sr.id;

-- Research statistics view
CREATE VIEW research_stats AS
SELECT 
    COUNT(*) as total_research_records,
    COUNT(*) FILTER (WHERE confidence = 'high') as high_confidence,
    COUNT(*) FILTER (WHERE confidence = 'medium') as medium_confidence,
    COUNT(*) FILTER (WHERE confidence = 'low') as low_confidence,
    COUNT(*) FILTER (WHERE linkedin_url IS NOT NULL) as with_linkedin,
    COUNT(*) FILTER (WHERE company_name IS NOT NULL) as with_company,
    AVG(EXTRACT(EPOCH FROM (NOW() - last_updated_at))/86400) as avg_age_days
FROM sender_research;

-- ================================
-- SAMPLE DATA (OPTIONAL)
-- ================================

-- Insert sample research data for testing
/*
INSERT INTO sender_research (
    sender_email, 
    sender_name, 
    sender_domain,
    company_name,
    job_title,
    industry,
    confidence
) VALUES 
('john.doe@acme.com', 'John Doe', 'acme.com', 'Acme Corp', 'Sales Manager', 'Technology', 'medium'),
('jane.smith@startup.io', 'Jane Smith', 'startup.io', 'Startup Inc', 'CEO', 'Software', 'high');
*/

-- ================================
-- CLEANUP FUNCTIONS
-- ================================

-- Function to clean old research attempts
CREATE OR REPLACE FUNCTION cleanup_old_research_attempts(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM research_attempts 
    WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- COMMENTS
-- ================================

COMMENT ON TABLE sender_research IS 'LinkedIn and professional research data for email senders';
COMMENT ON TABLE research_attempts IS 'Log of all research API calls for debugging and rate limiting';
COMMENT ON COLUMN sender_research.confidence IS 'Confidence level of research data accuracy';
COMMENT ON COLUMN sender_research.data_sources IS 'Array of sources used to gather this research data';
COMMENT ON COLUMN research_attempts.api_cost_cents IS 'Cost in cents for API calls to track spending';

-- Update schema version
INSERT INTO schema_version (version, description) 
VALUES ('1.1.0', 'Added sender research and LinkedIn integration tables')
ON CONFLICT (version) DO UPDATE SET
    applied_at = NOW(),
    description = EXCLUDED.description;
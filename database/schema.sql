-- Fluxyn Email Automation PostgreSQL Schema
-- Generated for comprehensive email management and automation

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ================================
-- CORE USER AND AUTHENTICATION
-- ================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    profile_picture_url TEXT,
    gmail_connected BOOLEAN DEFAULT FALSE,
    
    -- OAuth tokens (encrypted in production)
    google_access_token TEXT,
    google_refresh_token TEXT,
    google_token_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- User preferences
    timezone VARCHAR(50) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'en',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- ================================
-- EMAIL MANAGEMENT
-- ================================

CREATE TYPE email_status AS ENUM (
    'inbox', 'sent', 'draft', 'spam', 'trash', 'archive', 'starred'
);

CREATE TYPE email_priority AS ENUM (
    'low', 'normal', 'high', 'urgent'
);

CREATE TABLE emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Gmail integration
    gmail_message_id VARCHAR(255),
    gmail_thread_id VARCHAR(255),
    gmail_label_ids TEXT[], -- Array of Gmail label IDs
    
    -- Email content
    subject TEXT,
    body_text TEXT,
    body_html TEXT,
    snippet TEXT, -- Short preview
    
    -- Sender/recipient info
    from_email VARCHAR(255),
    from_name VARCHAR(255),
    to_emails JSONB, -- Array of recipient objects
    cc_emails JSONB,
    bcc_emails JSONB,
    reply_to_email VARCHAR(255),
    
    -- Metadata
    status email_status DEFAULT 'inbox',
    priority email_priority DEFAULT 'normal',
    is_read BOOLEAN DEFAULT FALSE,
    is_important BOOLEAN DEFAULT FALSE,
    is_starred BOOLEAN DEFAULT FALSE,
    
    -- Dates
    sent_at TIMESTAMP WITH TIME ZONE,
    received_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Full-text search
    search_vector tsvector,
    
    -- n8n webhook source
    webhook_source VARCHAR(50), -- 'n8n', 'manual', 'gmail'
    webhook_data JSONB -- Original webhook payload
);

-- ================================
-- EMAIL TEMPLATES
-- ================================

-- Create enum for template types
CREATE TYPE template_type AS ENUM (
    'reply', 'forward', 'new_email', 'auto_response', 'follow_up', 'meeting_request'
);

-- Create enum for template tones
CREATE TYPE template_tone AS ENUM (
    'professional', 'friendly', 'casual', 'formal', 'enthusiastic', 'apologetic', 'urgent'
);

CREATE TABLE email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Template info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100), -- e.g., 'Finance', 'Business Development', 'General'
    type template_type DEFAULT 'reply',
    tone template_tone DEFAULT 'professional',
    
    -- Content
    subject_template TEXT,
    body_template TEXT NOT NULL,
    
    -- AI-specific fields
    template_ai_instructions TEXT[] DEFAULT '{}', -- Array of AI instructions for template variables (instructions1, instructions2, etc.)
    ai_instructions TEXT
    -- Variable management
    variables JSONB DEFAULT '[]', -- Array of variable definitions with metadata
    
    -- Tagging and organization
    tags TEXT[] DEFAULT '{}', -- Array of tags for filtering/searching
    
    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_public BOOLEAN DEFAULT FALSE, -- For shared templates
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure template name is unique per user
    UNIQUE(user_id, name)
);

-- ================================
-- CAMPAIGNS AND AUTOMATION
-- ================================

CREATE TYPE campaign_status AS ENUM (
    'draft', 'active', 'paused', 'completed', 'cancelled'
);

CREATE TYPE campaign_type AS ENUM (
    'email_sequence', 'auto_responder', 'newsletter', 'drip_campaign'
);

-- ================================
-- KNOWLEDGE BASE
-- ================================

CREATE TYPE knowledge_item_type AS ENUM (
    'faq', 'guide', 'template', 'snippet', 'contact'
);

CREATE TABLE knowledge_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Content
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    type knowledge_item_type DEFAULT 'guide',
    
    -- Organization
    tags TEXT[],
    category VARCHAR(100),
    
    -- Usage
    usage_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_public BOOLEAN DEFAULT FALSE,
    
    -- Search
    search_vector tsvector,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Setting info
    key VARCHAR(100) NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, key)
);

-- ================================
-- AUDIT AND ACTIVITY LOGS
-- ================================

CREATE TYPE activity_type AS ENUM (
    'login', 'logout', 'email_sent', 'email_received', 'template_created', 
    'template_used', 'campaign_started', 'campaign_stopped', 'settings_changed'
);


-- ================================
-- INDEXES FOR PERFORMANCE
-- ================================

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_gmail_connected ON users(gmail_connected);

-- Emails
CREATE INDEX idx_emails_user_id ON emails(user_id);
CREATE INDEX idx_emails_status ON emails(status);
CREATE INDEX idx_emails_gmail_message_id ON emails(gmail_message_id);
CREATE INDEX idx_emails_gmail_thread_id ON emails(gmail_thread_id);
CREATE INDEX idx_emails_received_at ON emails(received_at DESC);
CREATE INDEX idx_emails_sent_at ON emails(sent_at DESC);
CREATE INDEX idx_emails_is_read ON emails(is_read);
CREATE INDEX idx_emails_is_important ON emails(is_important);
CREATE INDEX idx_emails_from_email ON emails(from_email);
CREATE INDEX idx_emails_search_vector ON emails USING gin(search_vector);
CREATE INDEX idx_emails_user_status ON emails(user_id, status);



-- Templates
CREATE INDEX idx_templates_user_id ON email_templates(user_id);
CREATE INDEX idx_templates_type ON email_templates(type);
CREATE INDEX idx_templates_is_active ON email_templates(is_active);
CREATE INDEX idx_templates_usage_count ON email_templates(usage_count DESC);

-- Knowledge Base
CREATE INDEX idx_knowledge_user_id ON knowledge_items(user_id);
CREATE INDEX idx_knowledge_type ON knowledge_items(type);
CREATE INDEX idx_knowledge_tags ON knowledge_items USING gin(tags);
CREATE INDEX idx_knowledge_search_vector ON knowledge_items USING gin(search_vector);
CREATE INDEX idx_knowledge_category ON knowledge_items(category);

-- Integrations
CREATE INDEX idx_integrations_user_id ON integrations(user_id);
CREATE INDEX idx_integrations_type ON integrations(type);
CREATE INDEX idx_integrations_is_active ON integrations(is_active);

-- Webhook Logs
CREATE INDEX idx_webhook_logs_integration_id ON webhook_logs(integration_id);
CREATE INDEX idx_webhook_logs_processed_at ON webhook_logs(processed_at DESC);
CREATE INDEX idx_webhook_logs_status_code ON webhook_logs(status_code);

-- Settings
CREATE INDEX idx_settings_user_id ON user_settings(user_id);
CREATE INDEX idx_settings_key ON user_settings(key);

-- ================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ================================

-- Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_emails_updated_at BEFORE UPDATE ON emails 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON email_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_knowledge_updated_at BEFORE UPDATE ON knowledge_items 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON integrations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON user_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================
-- FULL-TEXT SEARCH TRIGGERS
-- ================================

-- Update search vector for emails
CREATE OR REPLACE FUNCTION update_email_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.subject, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.body_text, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.from_email, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(NEW.from_name, '')), 'C');
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_emails_search_vector 
    BEFORE INSERT OR UPDATE ON emails 
    FOR EACH ROW EXECUTE FUNCTION update_email_search_vector();

-- Update search vector for knowledge items
CREATE OR REPLACE FUNCTION update_knowledge_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.summary, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'D');
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_knowledge_search_vector 
    BEFORE INSERT OR UPDATE ON knowledge_items 
    FOR EACH ROW EXECUTE FUNCTION update_knowledge_search_vector();

-- ================================
-- INITIAL DATA AND CONSTRAINTS
-- ================================

-- Add some constraints
ALTER TABLE emails ADD CONSTRAINT check_email_dates 
    CHECK (received_at IS NULL OR sent_at IS NULL OR received_at >= sent_at);

ALTER TABLE campaign_steps ADD CONSTRAINT check_positive_delay 
    CHECK (delay_days >= 0 AND delay_hours >= 0 AND delay_minutes >= 0);

ALTER TABLE email_attachments ADD CONSTRAINT check_positive_file_size 
    CHECK (file_size IS NULL OR file_size >= 0);

-- ================================
-- USEFUL VIEWS
-- ================================

-- Email summary view
CREATE VIEW email_summary AS
SELECT 
    e.id,
    e.user_id,
    e.subject,
    e.from_email,
    e.from_name,
    e.status,
    e.is_read,
    e.is_important,
    e.is_starred,
    e.received_at,
    e.sent_at,
    COUNT(ea.id) as attachment_count
FROM emails e
LEFT JOIN email_attachments ea ON e.id = ea.email_id
GROUP BY e.id, e.user_id, e.subject, e.from_email, e.from_name, 
         e.status, e.is_read, e.is_important, e.is_starred, 
         e.received_at, e.sent_at;

-- Campaign performance view
CREATE VIEW campaign_performance AS
SELECT 
    c.id,
    c.user_id,
    c.name,
    c.status,
    c.total_sent,
    c.total_delivered,
    c.total_opened,
    c.total_clicked,
    c.total_replied,
    CASE 
        WHEN c.total_sent > 0 THEN ROUND((c.total_opened::DECIMAL / c.total_sent) * 100, 2)
        ELSE 0 
    END as open_rate,
    CASE 
        WHEN c.total_sent > 0 THEN ROUND((c.total_clicked::DECIMAL / c.total_sent) * 100, 2)
        ELSE 0 
    END as click_rate,
    CASE 
        WHEN c.total_sent > 0 THEN ROUND((c.total_replied::DECIMAL / c.total_sent) * 100, 2)
        ELSE 0 
    END as reply_rate
FROM campaigns c;

-- ================================
-- SAMPLE DATA (OPTIONAL)
-- ================================

-- Insert a sample user (uncomment if needed)
/*
INSERT INTO users (email, name, gmail_connected) 
VALUES ('demo@fluxyn.com', 'Demo User', true);
*/

-- ================================
-- DATABASE MAINTENANCE
-- ================================

-- Function to clean old webhook logs (run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_logs(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM webhook_logs 
    WHERE processed_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ language 'plpgsql';

-- Function to clean old activity logs
CREATE OR REPLACE FUNCTION cleanup_old_activity_logs(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM activity_logs 
    WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ language 'plpgsql';

-- ================================
-- COMMENTS FOR DOCUMENTATION
-- ================================

COMMENT ON TABLE users IS 'Core user accounts with OAuth integration';
COMMENT ON TABLE emails IS 'Email messages with full-text search and Gmail integration';
COMMENT ON TABLE email_templates IS 'Reusable email templates for automation';
COMMENT ON TABLE campaigns IS 'Email marketing campaigns and automation sequences';
COMMENT ON TABLE knowledge_items IS 'Knowledge base for AI assistance and user reference';
COMMENT ON TABLE integrations IS 'Third-party integrations including n8n webhooks';
COMMENT ON TABLE email_interactions IS 'Email engagement tracking and analytics';
COMMENT ON TABLE webhook_logs IS 'Audit trail for webhook processing';

-- Schema version tracking
CREATE TABLE schema_version (
    version VARCHAR(20) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    description TEXT
);

INSERT INTO schema_version (version, description) 
VALUES ('1.0.0', 'Initial Fluxyn email automation schema');
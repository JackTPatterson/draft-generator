-- Migration: 002_enhanced_templating.sql
-- Description: Enhanced templating schema with AI instructions, variables, and categories
-- Created: 2025-01-31
-- Author: Claude Code Assistant

BEGIN;

-- Check if this migration has already been applied
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_version') THEN
        IF EXISTS (SELECT 1 FROM schema_version WHERE version = '2.0.0') THEN
            RAISE EXCEPTION 'Migration 002_enhanced_templating has already been applied';
        END IF;
    END IF;
END
$$;

-- ================================
-- ENHANCED EMAIL TEMPLATES SCHEMA
-- ================================

-- First, check if the original email_templates table exists and drop it if needed
-- This assumes we're enhancing the existing structure
DROP TABLE IF EXISTS email_templates CASCADE;

-- Create enum for template types
CREATE TYPE template_type AS ENUM (
    'reply', 'forward', 'new_email', 'auto_response', 'follow_up', 'meeting_request'
);

-- Create enum for template tones
CREATE TYPE template_tone AS ENUM (
    'professional', 'friendly', 'casual', 'formal', 'enthusiastic', 'apologetic', 'urgent'
);

-- Enhanced email templates table
CREATE TABLE email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Basic template information
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100), -- e.g., 'Finance', 'Business Development', 'General'
    type template_type DEFAULT 'reply',
    tone template_tone DEFAULT 'professional',
    
    -- Template content
    subject_template TEXT, -- Template for email subject with variables
    body_template TEXT NOT NULL, -- Main template content with variables
    
    -- AI-specific fields
    ai_instructions TEXT, -- Instructions for AI when using this template
    
    -- Variable management
    variables JSONB DEFAULT '[]', -- Array of variable definitions with metadata
    -- Example: [{"name": "NAME", "type": "text", "required": true, "description": "Recipient name"}]
    
    -- Tagging and organization
    tags TEXT[] DEFAULT '{}', -- Array of tags for filtering/searching
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure template name is unique per user
    UNIQUE(user_id, name)
);

-- ================================
-- TEMPLATE CATEGORIES TABLE
-- ================================

-- Separate table for managing template categories
CREATE TABLE template_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(7), -- Hex color code for UI
    icon VARCHAR(50), -- Icon name for UI
    
    -- Display order
    sort_order INTEGER DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, name)
);

-- ================================
-- INDEXES FOR PERFORMANCE
-- ================================

-- Email templates indexes
CREATE INDEX idx_email_templates_user_id ON email_templates(user_id);
CREATE INDEX idx_email_templates_category ON email_templates(category);
CREATE INDEX idx_email_templates_type ON email_templates(type);
CREATE INDEX idx_email_templates_tone ON email_templates(tone);
CREATE INDEX idx_email_templates_is_active ON email_templates(is_active);
CREATE INDEX idx_email_templates_is_favorite ON email_templates(is_favorite);
CREATE INDEX idx_email_templates_usage_count ON email_templates(usage_count DESC);
CREATE INDEX idx_email_templates_last_used ON email_templates(last_used_at DESC);
CREATE INDEX idx_email_templates_tags ON email_templates USING gin(tags);
CREATE INDEX idx_email_templates_variables ON email_templates USING gin(variables);
CREATE INDEX idx_email_templates_user_active ON email_templates(user_id, is_active);

-- Template categories indexes
CREATE INDEX idx_template_categories_user_id ON template_categories(user_id);
CREATE INDEX idx_template_categories_sort_order ON template_categories(sort_order);
CREATE INDEX idx_template_categories_is_active ON template_categories(is_active);

-- Template usage logs indexes
CREATE INDEX idx_template_usage_logs_template_id ON template_usage_logs(template_id);
CREATE INDEX idx_template_usage_logs_user_id ON template_usage_logs(user_id);
CREATE INDEX idx_template_usage_logs_used_at ON template_usage_logs(used_at DESC);
CREATE INDEX idx_template_usage_logs_context ON template_usage_logs(context);

-- Template shares indexes
CREATE INDEX idx_template_shares_template_id ON template_shares(template_id);
CREATE INDEX idx_template_shares_shared_by ON template_shares(shared_by_user_id);
CREATE INDEX idx_template_shares_share_code ON template_shares(share_code);
CREATE INDEX idx_template_shares_is_active ON template_shares(is_active);

-- ================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ================================

-- Update timestamps for email_templates
CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON email_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update timestamps for template_categories
CREATE TRIGGER update_template_categories_updated_at BEFORE UPDATE ON template_categories 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update timestamps for template_shares
CREATE TRIGGER update_template_shares_updated_at BEFORE UPDATE ON template_shares 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update usage count and last_used_at when template is used
CREATE OR REPLACE FUNCTION update_template_usage_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE email_templates 
    SET 
        usage_count = usage_count + 1,
        last_used_at = NOW(),
        updated_at = NOW()
    WHERE id = NEW.template_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_template_usage_stats_trigger
    AFTER INSERT ON template_usage_logs
    FOR EACH ROW EXECUTE FUNCTION update_template_usage_stats();

-- ================================
-- USEFUL VIEWS FOR TEMPLATING
-- ================================

-- Template summary view with category and usage stats
CREATE VIEW template_summary AS
SELECT 
    t.id,
    t.user_id,
    t.name,
    t.description,
    t.category,
    t.type,
    t.tone,
    t.tags,
    t.usage_count,
    t.last_used_at,
    t.is_active,
    t.is_favorite,
    t.is_public,
    t.created_at,
    t.updated_at,
    -- Category information
    tc.color as category_color,
    tc.icon as category_icon,
    -- Usage analytics
    COUNT(tul.id) as total_usage_logs,
    AVG(tul.user_satisfaction_rating) as avg_satisfaction_rating,
    -- Variable count
    JSONB_ARRAY_LENGTH(COALESCE(t.variables, '[]')) as variable_count
FROM email_templates t
LEFT JOIN template_categories tc ON tc.user_id = t.user_id AND tc.name = t.category
LEFT JOIN template_usage_logs tul ON tul.template_id = t.id
GROUP BY t.id, t.user_id, t.name, t.description, t.category, t.type, t.tone, 
         t.tags, t.usage_count, t.last_used_at, t.is_active, t.is_favorite, 
         t.is_public, t.created_at, t.updated_at, tc.color, tc.icon, t.variables;

-- Most popular templates view
CREATE VIEW popular_templates AS
SELECT 
    t.*,
    tc.color as category_color,
    tc.icon as category_icon
FROM email_templates t
LEFT JOIN template_categories tc ON tc.user_id = t.user_id AND tc.name = t.category
WHERE t.is_active = TRUE
ORDER BY t.usage_count DESC, t.last_used_at DESC;

-- ================================
-- SAMPLE DATA FOR TEMPLATE CATEGORIES
-- ================================

-- Insert some default template categories (these would be per-user in production)
INSERT INTO template_categories (user_id, name, description, color, icon, sort_order) 
SELECT 
    u.id,
    unnest(ARRAY['General', 'Finance', 'Business Development', 'Customer Support', 'HR', 'Marketing']),
    unnest(ARRAY[
        'General purpose templates',
        'Financial and budget related templates', 
        'Business partnerships and development',
        'Customer service and support',
        'Human resources communications',
        'Marketing and promotional content'
    ]),
    unnest(ARRAY['#6B7280', '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444']),
    unnest(ARRAY['mail', 'dollar-sign', 'handshake', 'headphones', 'users', 'megaphone']),
    unnest(ARRAY[1, 2, 3, 4, 5, 6])
FROM users u
WHERE u.email = 'demo@fluxyn.com'; -- Only for demo user, remove in production

-- ================================
-- FUNCTIONS FOR TEMPLATE MANAGEMENT
-- ================================

-- Function to extract variables from template content
CREATE OR REPLACE FUNCTION extract_template_variables(template_content TEXT)
RETURNS TEXT[] AS $$
DECLARE
    variables TEXT[];
BEGIN
    -- Extract variables in [VARIABLE_NAME] format
    SELECT ARRAY_AGG(DISTINCT matches[1])
    INTO variables
    FROM (
        SELECT regexp_matches(template_content, '\[([A-Z_][A-Z0-9_]*)\]', 'g') as matches
    ) subquery;
    
    RETURN COALESCE(variables, '{}');
END;
$$ language 'plpgsql';

-- Function to validate template syntax
CREATE OR REPLACE FUNCTION validate_template_syntax(template_content TEXT)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    variable_count INTEGER;
    unclosed_brackets INTEGER;
BEGIN
    -- Count variables
    SELECT COUNT(*)
    INTO variable_count
    FROM (
        SELECT regexp_matches(template_content, '\[([A-Z_][A-Z0-9_]*)\]', 'g')
    ) subquery;
    
    -- Check for unclosed brackets
    SELECT (LENGTH(template_content) - LENGTH(REPLACE(template_content, '[', ''))) - 
           (LENGTH(template_content) - LENGTH(REPLACE(template_content, ']', '')))
    INTO unclosed_brackets;
    
    result := jsonb_build_object(
        'is_valid', CASE WHEN unclosed_brackets = 0 THEN true ELSE false END,
        'variable_count', variable_count,
        'unclosed_brackets', unclosed_brackets,
        'variables', extract_template_variables(template_content)
    );
    
    RETURN result;
END;
$$ language 'plpgsql';

-- ================================
-- CONSTRAINTS AND VALIDATIONS
-- ================================

-- Ensure template shares don't exceed max uses
ALTER TABLE template_shares ADD CONSTRAINT check_template_shares_uses 
    CHECK (current_uses <= COALESCE(max_uses, current_uses));

-- Ensure satisfaction ratings are valid
ALTER TABLE template_usage_logs ADD CONSTRAINT check_satisfaction_rating
    CHECK (user_satisfaction_rating IS NULL OR (user_satisfaction_rating >= 1 AND user_satisfaction_rating <= 5));

-- Ensure positive usage counts
ALTER TABLE email_templates ADD CONSTRAINT check_positive_usage_count 
    CHECK (usage_count >= 0);

-- ================================
-- COMMENTS FOR DOCUMENTATION
-- ================================

COMMENT ON TABLE email_templates IS 'Enhanced email templates with AI instructions, variables, and advanced features';
COMMENT ON TABLE template_categories IS 'User-defined categories for organizing templates';
COMMENT ON TABLE template_usage_logs IS 'Detailed logging of template usage for analytics';
COMMENT ON TABLE template_shares IS 'Template sharing and collaboration features';

COMMENT ON COLUMN email_templates.variables IS 'JSONB array of variable definitions with metadata (name, type, required, description)';
COMMENT ON COLUMN email_templates.ai_instructions IS 'Instructions for AI when generating emails from this template';
COMMENT ON COLUMN email_templates.tone IS 'Tone of voice for the template (professional, friendly, etc.)';

-- Record migration
INSERT INTO schema_version (version, description) 
VALUES ('2.0.0', 'Enhanced templating schema with AI instructions, variables, and categories');

COMMIT;
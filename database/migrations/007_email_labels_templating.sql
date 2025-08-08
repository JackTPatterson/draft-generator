-- Migration: 007_email_labels_templating.sql
-- Description: Add email labels and template associations for automated categorization
-- Created: 2025-08-01
-- Author: Claude Code Assistant

BEGIN;

-- Check if this migration has already been applied
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_version') THEN
        IF EXISTS (SELECT 1 FROM schema_version WHERE version = '7.0.0') THEN
            RAISE EXCEPTION 'Migration 007_email_labels_templating has already been applied';
        END IF;
    END IF;
END
$$;

-- ================================
-- EMAIL LABELS SYSTEM
-- ================================

-- Create enum for label types
CREATE TYPE email_label_type AS ENUM (
    'system',     -- Built-in system labels (inbox, sent, spam, etc.)
    'category',   -- User-defined categories (Finance, Support, etc.)
    'priority',   -- Priority labels (urgent, important, etc.)
    'project',    -- Project-based labels
    'custom'      -- Other custom labels
);

-- Email labels table
CREATE TABLE email_labels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Label information
    name VARCHAR(100) NOT NULL,
    description TEXT,
    type email_label_type DEFAULT 'custom',
    
    -- Visual properties
    color VARCHAR(7) DEFAULT '#6B7280', -- Hex color code
    icon VARCHAR(50), -- Icon name for UI
    
    -- n8n automation properties
    n8n_trigger_keywords TEXT[], -- Keywords that trigger this label
    n8n_sender_patterns TEXT[], -- Email sender patterns that trigger this label
    n8n_subject_patterns TEXT[], -- Subject patterns that trigger this label
    
    -- Display and sorting
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    is_system BOOLEAN DEFAULT FALSE, -- System labels cannot be deleted
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique label names per user
    UNIQUE(user_id, name)
);

-- Email-label associations (many-to-many)
CREATE TABLE email_label_associations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES email_labels(id) ON DELETE CASCADE,
    
    -- Association metadata
    assigned_by VARCHAR(50) DEFAULT 'manual', -- 'manual', 'n8n', 'ai', 'rule'
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confidence_score DECIMAL(3,2), -- For AI/automated assignments (0.00-1.00)
    
    -- Prevent duplicate associations
    UNIQUE(email_id, label_id)
);

-- ================================
-- TEMPLATE-LABEL ASSOCIATIONS
-- ================================

-- Template-label associations for automatic template selection
CREATE TABLE template_label_associations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES email_templates(id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES email_labels(id) ON DELETE CASCADE,
    
    -- Association strength (higher = more preferred for this label)
    priority_score INTEGER DEFAULT 1,
    
    -- Auto-selection behavior
    auto_suggest BOOLEAN DEFAULT TRUE, -- Suggest this template for emails with this label
    auto_apply BOOLEAN DEFAULT FALSE,  -- Automatically apply this template (use carefully)
    
    -- Conditions for template application
    sender_conditions JSONB, -- Additional sender conditions
    subject_conditions JSONB, -- Additional subject conditions
    content_conditions JSONB, -- Additional content conditions
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate associations
    UNIQUE(template_id, label_id)
);

-- ================================
-- N8N WORKFLOW INTEGRATION
-- ================================

-- n8n automation rules for email processing
CREATE TABLE n8n_email_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Rule information
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- n8n workflow details
    n8n_workflow_id VARCHAR(100), -- n8n workflow ID
    n8n_webhook_url TEXT, -- Webhook URL for triggering
    
    -- Rule conditions
    conditions JSONB NOT NULL, -- JSON conditions for email matching
    -- Example: {
    --   "sender_patterns": [".*@finance\.company\.com"],
    --   "subject_keywords": ["invoice", "payment", "budget"],
    --   "body_keywords": ["approval", "review"]
    -- }
    
    -- Actions to perform
    actions JSONB NOT NULL, -- JSON actions to execute
    -- Example: {
    --   "assign_labels": ["finance", "requires-approval"],
    --   "suggest_templates": ["budget-review-response"],
    --   "auto_apply_template": "finance-acknowledgment",
    --   "set_priority": "high"
    -- }
    
    -- Rule status
    is_active BOOLEAN DEFAULT TRUE,
    execution_count INTEGER DEFAULT 0,
    last_executed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================
-- INDEXES FOR PERFORMANCE
-- ================================

-- Email labels indexes
CREATE INDEX idx_email_labels_user_id ON email_labels(user_id);
CREATE INDEX idx_email_labels_type ON email_labels(type);
CREATE INDEX idx_email_labels_is_active ON email_labels(is_active);
CREATE INDEX idx_email_labels_sort_order ON email_labels(sort_order);
CREATE INDEX idx_email_labels_n8n_keywords ON email_labels USING gin(n8n_trigger_keywords);
CREATE INDEX idx_email_labels_n8n_senders ON email_labels USING gin(n8n_sender_patterns);
CREATE INDEX idx_email_labels_n8n_subjects ON email_labels USING gin(n8n_subject_patterns);

-- Email-label associations indexes
CREATE INDEX idx_email_label_assoc_email_id ON email_label_associations(email_id);
CREATE INDEX idx_email_label_assoc_label_id ON email_label_associations(label_id);
CREATE INDEX idx_email_label_assoc_assigned_by ON email_label_associations(assigned_by);
CREATE INDEX idx_email_label_assoc_confidence ON email_label_associations(confidence_score DESC);

-- Template-label associations indexes
CREATE INDEX idx_template_label_assoc_template_id ON template_label_associations(template_id);
CREATE INDEX idx_template_label_assoc_label_id ON template_label_associations(label_id);
CREATE INDEX idx_template_label_assoc_priority ON template_label_associations(priority_score DESC);
CREATE INDEX idx_template_label_assoc_auto_suggest ON template_label_associations(auto_suggest);

-- n8n rules indexes
CREATE INDEX idx_n8n_rules_user_id ON n8n_email_rules(user_id);
CREATE INDEX idx_n8n_rules_is_active ON n8n_email_rules(is_active);
CREATE INDEX idx_n8n_rules_workflow_id ON n8n_email_rules(n8n_workflow_id);
CREATE INDEX idx_n8n_rules_conditions ON n8n_email_rules USING gin(conditions);
CREATE INDEX idx_n8n_rules_actions ON n8n_email_rules USING gin(actions);

-- ================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ================================

-- Update timestamps
CREATE TRIGGER update_email_labels_updated_at BEFORE UPDATE ON email_labels 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_template_label_assoc_updated_at BEFORE UPDATE ON template_label_associations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_n8n_rules_updated_at BEFORE UPDATE ON n8n_email_rules 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================
-- USEFUL VIEWS AND FUNCTIONS
-- ================================

-- View for email labels with association counts
CREATE VIEW email_labels_summary AS
SELECT 
    el.*,
    COUNT(ela.email_id) as email_count,
    COUNT(tla.template_id) as template_count,
    COUNT(CASE WHEN ela.assigned_by = 'n8n' THEN 1 END) as n8n_assigned_count
FROM email_labels el
LEFT JOIN email_label_associations ela ON el.id = ela.label_id
LEFT JOIN template_label_associations tla ON el.id = tla.label_id
GROUP BY el.id, el.user_id, el.name, el.description, el.type, el.color, 
         el.icon, el.n8n_trigger_keywords, el.n8n_sender_patterns, 
         el.n8n_subject_patterns, el.sort_order, el.is_active, 
         el.is_system, el.created_at, el.updated_at;

-- Function to get suggested templates for an email based on its labels
CREATE OR REPLACE FUNCTION get_suggested_templates(email_id_param UUID)
RETURNS TABLE (
    template_id UUID,
    template_name VARCHAR(255),
    template_description TEXT,
    template_category VARCHAR(100),
    priority_score INTEGER,
    label_name VARCHAR(100),
    auto_suggest BOOLEAN,
    auto_apply BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        et.id as template_id,
        et.name as template_name,
        et.description as template_description,
        et.category as template_category,
        tla.priority_score,
        el.name as label_name,
        tla.auto_suggest,
        tla.auto_apply
    FROM email_label_associations ela
    JOIN email_labels el ON ela.label_id = el.id
    JOIN template_label_associations tla ON el.id = tla.label_id
    JOIN email_templates et ON tla.template_id = et.id
    WHERE ela.email_id = email_id_param
        AND el.is_active = TRUE
        AND et.is_active = TRUE
        AND tla.auto_suggest = TRUE
    ORDER BY tla.priority_score DESC, et.usage_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to apply n8n email rules
CREATE OR REPLACE FUNCTION apply_n8n_email_rules(
    email_id_param UUID,
    email_from VARCHAR(255),
    email_subject TEXT,
    email_body TEXT
) RETURNS JSONB AS $$
DECLARE
    rule_record RECORD;
    applied_rules JSONB[] := '{}';
    rule_result JSONB;
BEGIN
    -- Loop through active n8n rules
    FOR rule_record IN 
        SELECT * FROM n8n_email_rules 
        WHERE is_active = TRUE 
        ORDER BY id
    LOOP
        -- Check if email matches rule conditions
        -- This is a simplified version - in production, implement full condition matching
        IF (
            rule_record.conditions->'sender_patterns' IS NULL OR
            email_from ~ ANY(ARRAY(SELECT jsonb_array_elements_text(rule_record.conditions->'sender_patterns')))
        ) AND (
            rule_record.conditions->'subject_keywords' IS NULL OR
            email_subject ~* ANY(ARRAY(SELECT jsonb_array_elements_text(rule_record.conditions->'subject_keywords')))
        ) THEN
            -- Apply rule actions
            rule_result := jsonb_build_object(
                'rule_id', rule_record.id,
                'rule_name', rule_record.name,
                'actions_applied', rule_record.actions,
                'applied_at', NOW()
            );
            
            applied_rules := applied_rules || rule_result;
            
            -- Update rule execution count
            UPDATE n8n_email_rules 
            SET execution_count = execution_count + 1,
                last_executed_at = NOW()
            WHERE id = rule_record.id;
        END IF;
    END LOOP;
    
    RETURN jsonb_build_object('applied_rules', applied_rules);
END;
$$ LANGUAGE plpgsql;

-- ================================
-- DEFAULT DATA
-- ================================

-- Insert default system labels
INSERT INTO email_labels (user_id, name, description, type, color, icon, is_system, sort_order) 
SELECT 
    u.id,
    unnest(ARRAY['Inbox', 'Sent', 'Draft', 'Spam', 'Trash', 'Archive', 'Starred', 'Important']),
    unnest(ARRAY[
        'Incoming emails',
        'Sent emails', 
        'Draft emails',
        'Spam emails',
        'Deleted emails',
        'Archived emails',
        'Starred emails',
        'Important emails'
    ]),
    'system',
    unnest(ARRAY['#6B7280', '#10B981', '#F59E0B', '#EF4444', '#6B7280', '#8B5CF6', '#F59E0B', '#DC2626']),
    unnest(ARRAY['inbox', 'send', 'file-text', 'shield', 'trash-2', 'archive', 'star', 'alert-circle']),
    TRUE,
    unnest(ARRAY[1, 2, 3, 4, 5, 6, 7, 8])
FROM users u
WHERE u.email = 'demo@fluxyn.com'; -- Only for demo user, adjust as needed

-- Insert default category labels  
INSERT INTO email_labels (user_id, name, description, type, color, icon, sort_order) 
SELECT 
    u.id,
    unnest(ARRAY['Finance', 'Business Development', 'Customer Support', 'HR', 'Marketing', 'Legal', 'Operations']),
    unnest(ARRAY[
        'Financial matters, invoices, budgets',
        'Business partnerships and deals',
        'Customer service inquiries',
        'Human resources communications',
        'Marketing campaigns and content',
        'Legal matters and compliance',
        'Day-to-day operations'
    ]),
    'category',
    unnest(ARRAY['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444', '#374151', '#6366F1']),
    unnest(ARRAY['dollar-sign', 'handshake', 'headphones', 'users', 'megaphone', 'scale', 'settings']),
    unnest(ARRAY[10, 11, 12, 13, 14, 15, 16])
FROM users u
WHERE u.email = 'demo@fluxyn.com'; -- Only for demo user, adjust as needed

-- ================================
-- CONSTRAINTS AND VALIDATIONS
-- ================================

-- Ensure priority scores are positive
ALTER TABLE template_label_associations ADD CONSTRAINT check_positive_priority_score 
    CHECK (priority_score > 0);

-- Ensure confidence scores are valid percentages
ALTER TABLE email_label_associations ADD CONSTRAINT check_valid_confidence_score
    CHECK (confidence_score IS NULL OR (confidence_score >= 0.00 AND confidence_score <= 1.00));

-- ================================
-- COMMENTS FOR DOCUMENTATION
-- ================================

COMMENT ON TABLE email_labels IS 'User-defined and system labels for categorizing emails';
COMMENT ON TABLE email_label_associations IS 'Many-to-many associations between emails and labels';
COMMENT ON TABLE template_label_associations IS 'Associates email templates with labels for automated suggestions';
COMMENT ON TABLE n8n_email_rules IS 'n8n automation rules for processing incoming emails';

COMMENT ON COLUMN email_labels.n8n_trigger_keywords IS 'Keywords that trigger n8n workflow to assign this label';
COMMENT ON COLUMN email_labels.n8n_sender_patterns IS 'Email sender regex patterns for n8n automation';
COMMENT ON COLUMN email_labels.n8n_subject_patterns IS 'Email subject regex patterns for n8n automation';

-- Record migration
INSERT INTO schema_version (version, description) 
VALUES ('7.0.0', 'Email labels and template associations for automated categorization');

COMMIT;
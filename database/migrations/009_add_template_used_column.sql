-- ================================
-- MIGRATION: Add template_used column to email_drafts
-- ================================
-- Add template_used column to track which template was used to generate each draft

-- Add the template_used column to email_drafts table
ALTER TABLE email_drafts 
ADD COLUMN IF NOT EXISTS template_used UUID REFERENCES email_templates(id);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_email_drafts_template_used ON email_drafts(template_used);

-- Add comment for documentation
COMMENT ON COLUMN email_drafts.template_used IS 'Reference to the email template used to generate this draft';
-- ================================
-- MIGRATION: Template AI Instructions Array
-- ================================
-- Add template_ai_instructions column as TEXT[] to support multiple instruction prompts
-- for template variables like {{instructions1}}, {{instructions2}}, etc.
-- Keep original ai_instructions as TEXT for general template instructions.

-- Add the new template_ai_instructions column
ALTER TABLE email_templates 
ADD COLUMN template_ai_instructions TEXT[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN email_templates.template_ai_instructions IS 'Array of AI instructions for template variables (instructions1, instructions2, etc.)';
COMMENT ON COLUMN email_templates.ai_instructions IS 'General AI instructions for the template';
-- ================================
-- DATABASE CLEANUP: Remove Unused Tables
-- ================================
-- This script removes tables that are not used by the email automation application
-- These are primarily n8n-specific tables and other unused entities

-- IMPORTANT: This will permanently delete these tables and all their data
-- Make sure to backup your database before running this script

BEGIN;

-- Drop n8n-specific tables
DROP TABLE IF EXISTS credentials_entity CASCADE;
DROP TABLE IF EXISTS execution_annotation_tags CASCADE;
DROP TABLE IF EXISTS execution_annotations CASCADE;
DROP TABLE IF EXISTS execution_data CASCADE;
DROP TABLE IF EXISTS execution_entity CASCADE;
DROP TABLE IF EXISTS execution_metadata CASCADE;
DROP TABLE IF EXISTS folder CASCADE;
DROP TABLE IF EXISTS folder_tag CASCADE;
DROP TABLE IF EXISTS insights_by_period CASCADE;
DROP TABLE IF EXISTS insights_raw CASCADE;
DROP TABLE IF EXISTS installed_nodes CASCADE;
DROP TABLE IF EXISTS installed_packages CASCADE;
DROP TABLE IF EXISTS invalid_auth_token CASCADE;
DROP TABLE IF EXISTS migrations CASCADE;
DROP TABLE IF EXISTS processed_data CASCADE;
DROP TABLE IF EXISTS project CASCADE;
DROP TABLE IF EXISTS project_relation CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS shared_credentials CASCADE;
DROP TABLE IF EXISTS shared_workflow CASCADE;
DROP TABLE IF EXISTS tag_entity CASCADE;
DROP TABLE IF EXISTS test_case_execution CASCADE;
DROP TABLE IF EXISTS test_run CASCADE;
DROP TABLE IF EXISTS "user" CASCADE;
DROP TABLE IF EXISTS user_api_keys CASCADE;
DROP TABLE IF EXISTS variables CASCADE;
DROP TABLE IF EXISTS webhook_entity CASCADE;
DROP TABLE IF EXISTS workflow_entity CASCADE;
DROP TABLE IF EXISTS workflow_history CASCADE;
DROP TABLE IF EXISTS workflow_statistics CASCADE;
DROP TABLE IF EXISTS workflows_tags CASCADE;

-- Drop unused application tables
DROP TABLE IF EXISTS template_categories CASCADE;
DROP TABLE IF EXISTS knowledge_items CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;
DROP TABLE IF EXISTS embedding_metadata CASCADE;

-- Verify remaining tables
SELECT 'Remaining tables after cleanup:' as info;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

COMMIT;

-- Expected remaining tables (16 total):
-- business_knowledge_categories
-- email_drafts  
-- email_executions
-- email_label_associations
-- email_labels
-- email_templates
-- emails
-- gmail_tokens
-- knowledge_chunks
-- knowledge_documents
-- n8n_email_rules
-- research_attempts
-- schema_version
-- sender_research
-- template_label_associations
-- users
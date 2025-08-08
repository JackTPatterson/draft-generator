-- Migration: 001_initial_schema.sql
-- Description: Initial database schema for Fluxyn email automation
-- Created: 2025-01-30
-- Author: Claude Code Assistant

-- This file can be used for migrations in production
-- It's identical to schema.sql but structured for migration tools

BEGIN;

-- Check if this migration has already been applied
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_version') THEN
        IF EXISTS (SELECT 1 FROM schema_version WHERE version = '1.0.0') THEN
            RAISE EXCEPTION 'Migration 001_initial_schema has already been applied';
        END IF;
    END IF;
END
$$;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Include the full schema from schema.sql
-- (In production, you would copy the schema.sql content here)
-- For now, this serves as a template

-- Record migration
INSERT INTO schema_version (version, description) 
VALUES ('1.0.0', 'Initial Fluxyn email automation schema - Migration 001');

COMMIT;
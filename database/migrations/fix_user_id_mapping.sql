-- Fix user ID mapping between better-auth and microservice
-- better-auth uses non-UUID format IDs, but our microservice expects UUIDs

-- Create a mapping table to bridge better-auth user IDs with UUID user IDs
CREATE TABLE IF NOT EXISTS user_id_mapping (
    better_auth_id VARCHAR(255) PRIMARY KEY,
    uuid_user_id UUID NOT NULL DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique index to ensure one-to-one mapping
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_id_mapping_uuid ON user_id_mapping(uuid_user_id);

-- Insert existing better-auth users into mapping table
-- This will create UUIDs for any existing better-auth users
INSERT INTO user_id_mapping (better_auth_id) 
SELECT DISTINCT "userId" 
FROM account 
WHERE "userId" IS NOT NULL 
ON CONFLICT (better_auth_id) DO NOTHING;

-- Function to get or create UUID for better-auth user ID
CREATE OR REPLACE FUNCTION get_or_create_uuid_for_user(p_better_auth_id VARCHAR(255))
RETURNS UUID AS $$
DECLARE
    v_uuid_id UUID;
BEGIN
    -- Try to get existing mapping
    SELECT uuid_user_id INTO v_uuid_id 
    FROM user_id_mapping 
    WHERE better_auth_id = p_better_auth_id;
    
    -- If not found, create new mapping
    IF v_uuid_id IS NULL THEN
        INSERT INTO user_id_mapping (better_auth_id) 
        VALUES (p_better_auth_id) 
        RETURNING uuid_user_id INTO v_uuid_id;
    END IF;
    
    RETURN v_uuid_id;
END;
$$ LANGUAGE plpgsql;

-- Update the users table to include both ID types if it doesn't exist
-- This allows the microservice to find users by UUID
DO $$ 
BEGIN
    -- Check if we need to add better_auth_id column to users table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'better_auth_id') THEN
        ALTER TABLE users ADD COLUMN better_auth_id VARCHAR(255) UNIQUE;
    END IF;
END $$;

-- Create or update users in the main users table based on better-auth data
-- This ensures the microservice can find users
INSERT INTO users (id, better_auth_id, email, name, created_at)
SELECT 
    m.uuid_user_id,
    m.better_auth_id,
    u.email,
    u.name,
    COALESCE(u."createdAt", NOW())
FROM user_id_mapping m
JOIN "user" u ON u.id = m.better_auth_id
ON CONFLICT (id) DO UPDATE SET
    better_auth_id = EXCLUDED.better_auth_id,
    email = EXCLUDED.email,
    name = EXCLUDED.name;

COMMENT ON TABLE user_id_mapping IS 'Maps better-auth user IDs to UUID format for microservice compatibility';
COMMENT ON FUNCTION get_or_create_uuid_for_user(VARCHAR) IS 'Gets or creates a UUID for a better-auth user ID';
-- Fix existing user mapping and handle duplicate email constraints

-- Function to sync better-auth users to main users table
CREATE OR REPLACE FUNCTION sync_better_auth_users()
RETURNS INTEGER AS $$
DECLARE
    sync_count INTEGER := 0;
    user_rec RECORD;
BEGIN
    -- Loop through all mapped users that need syncing
    FOR user_rec IN 
        SELECT 
            m.better_auth_id,
            m.uuid_user_id,
            u.email,
            u.name,
            u."createdAt"
        FROM user_id_mapping m
        JOIN "user" u ON u.id = m.better_auth_id
        LEFT JOIN users existing_u ON existing_u.id = m.uuid_user_id
        WHERE existing_u.id IS NULL -- Only users not already in main users table
    LOOP
        -- Check if a user with this email already exists
        UPDATE users 
        SET 
            id = user_rec.uuid_user_id,
            better_auth_id = user_rec.better_auth_id,
            updated_at = NOW()
        WHERE email = user_rec.email;
        
        -- If no user was updated, insert new user
        IF NOT FOUND THEN
            INSERT INTO users (
                id, 
                better_auth_id, 
                email, 
                name, 
                created_at, 
                updated_at
            ) VALUES (
                user_rec.uuid_user_id,
                user_rec.better_auth_id,
                user_rec.email,
                user_rec.name,
                COALESCE(user_rec."createdAt", NOW()),
                NOW()
            )
            ON CONFLICT (email) DO UPDATE SET
                id = EXCLUDED.id,
                better_auth_id = EXCLUDED.better_auth_id,
                updated_at = NOW();
        END IF;
        
        sync_count := sync_count + 1;
    END LOOP;
    
    RETURN sync_count;
END;
$$ LANGUAGE plpgsql;

-- Run the sync function
SELECT sync_better_auth_users() as synced_users;

-- Clean up
DROP FUNCTION sync_better_auth_users();

COMMENT ON FUNCTION get_or_create_uuid_for_user(VARCHAR) IS 'Gets or creates a UUID for a better-auth user ID and ensures user exists in main users table';
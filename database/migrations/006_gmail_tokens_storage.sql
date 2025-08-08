-- Migration: Gmail Token Storage for Persistent Authentication
-- This table stores Gmail OAuth tokens with automatic refresh capability

CREATE TABLE IF NOT EXISTS gmail_tokens (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) UNIQUE NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type VARCHAR(50) DEFAULT 'Bearer',
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_gmail_tokens_user_id ON gmail_tokens(user_id);

-- Index for checking expired tokens
CREATE INDEX IF NOT EXISTS idx_gmail_tokens_expires_at ON gmail_tokens(expires_at);

-- Add a comment explaining the table purpose
COMMENT ON TABLE gmail_tokens IS 'Stores Gmail OAuth tokens for persistent authentication and automatic refresh';
COMMENT ON COLUMN gmail_tokens.user_id IS 'Unique identifier for the user (can be email or system user ID)';
COMMENT ON COLUMN gmail_tokens.access_token IS 'Current Gmail access token (expires every hour)';
COMMENT ON COLUMN gmail_tokens.refresh_token IS 'Long-lived refresh token for generating new access tokens';
COMMENT ON COLUMN gmail_tokens.expires_at IS 'When the current access token expires (used for automatic refresh)';

-- Insert default system user if needed
INSERT INTO gmail_tokens (user_id, access_token, refresh_token, expires_at)
VALUES ('default_user', 'placeholder', 'placeholder', NOW())
ON CONFLICT (user_id) DO NOTHING;
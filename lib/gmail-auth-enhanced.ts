import { google } from 'googleapis';
import pool from './database';

// Environment variables (server-side only)
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = `${process.env.NEXTAUTH_URL}/api/auth/callback/google`;

// Validate environment variables
if (!CLIENT_ID || !CLIENT_SECRET || !process.env.NEXTAUTH_URL) {
  console.error('Missing required environment variables:', {
    CLIENT_ID: !!CLIENT_ID,
    CLIENT_SECRET: !!CLIENT_SECRET,
    NEXTAUTH_URL: !!process.env.NEXTAUTH_URL
  });
}

export const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

export const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send', 
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

export function getAuthUrl(): string {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('OAuth client not properly configured. Check environment variables.');
  }

  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // This is crucial for refresh tokens
    scope: SCOPES,
    prompt: 'consent', // Forces refresh token generation
    include_granted_scopes: true
  });
}

export async function exchangeCodeForTokens(code: string) {
  if (!code) {
    throw new Error('Authorization code is required');
  }
  
  const { tokens } = await oauth2Client.getToken(code);
  
  // Store tokens in database for persistence
  if (tokens.refresh_token) {
    await storeTokens('default_user', tokens);
    console.log('Tokens stored successfully with refresh token');
  } else {
    console.warn('No refresh token received. You may need to re-consent.');
  }
  
  return tokens;
}

// Store tokens in database
async function storeTokens(userId: string, tokens: any) {
  const client = await pool.connect();
  try {
    const expiresAt = tokens.expiry_date 
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600000); // Default 1 hour

    await client.query(`
      INSERT INTO gmail_tokens (user_id, access_token, refresh_token, token_type, expires_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        access_token = $2,
        refresh_token = COALESCE($3, gmail_tokens.refresh_token),
        token_type = $4,
        expires_at = $5,
        updated_at = NOW()
    `, [
      userId,
      tokens.access_token,
      tokens.refresh_token,
      tokens.token_type || 'Bearer',
      expiresAt
    ]);

    console.log(`Tokens updated for user ${userId}, expires at ${expiresAt.toISOString()}`);
  } catch (error) {
    console.error('Error storing tokens:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Get stored tokens and refresh if needed
export async function getValidTokens(userId: string = 'default_user') {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM gmail_tokens WHERE user_id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('No stored tokens found. Please re-authenticate via /api/auth/gmail');
    }
    
    const tokenData = result.rows[0];
    const tokens = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_type: tokenData.token_type,
      expiry_date: new Date(tokenData.expires_at).getTime()
    };
    
    // Check if token is expired or will expire in next 5 minutes
    const expiresIn = tokens.expiry_date - Date.now();
    const isExpiring = expiresIn < 300000; // 5 minutes
    
    if (isExpiring && tokens.refresh_token) {
      console.log(`Token expiring in ${Math.round(expiresIn / 1000)} seconds, refreshing...`);
      return await refreshTokens(userId, tokens);
    } else if (isExpiring && !tokens.refresh_token) {
      throw new Error('Token expired and no refresh token available. Please re-authenticate.');
    }
    
    console.log(`Using valid token, expires in ${Math.round(expiresIn / 1000)} seconds`);
    return tokens;
  } finally {
    client.release();
  }
}

// Refresh expired tokens
async function refreshTokens(userId: string, tokens: any) {
  oauth2Client.setCredentials({
    refresh_token: tokens.refresh_token
  });
  
  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    // Merge with existing tokens (preserve refresh_token if not returned)
    const updatedTokens = {
      ...tokens,
      ...credentials,
      refresh_token: credentials.refresh_token || tokens.refresh_token
    };
    
    // Store refreshed tokens
    await storeTokens(userId, updatedTokens);
    
    console.log('Tokens refreshed successfully');
    return updatedTokens;
  } catch (error) {
    console.error('Failed to refresh tokens:', error);
    
    // If refresh fails, the refresh token might be invalid
    // User needs to re-authenticate
    throw new Error('Token refresh failed. Please re-authenticate via /api/auth/gmail');
  }
}

export function setCredentials(tokens: any) {
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
}

export async function getGmailClient(userId: string = 'default_user') {
  try {
    const tokens = await getValidTokens(userId);
    const authClient = setCredentials(tokens);
    return google.gmail({ version: 'v1', auth: authClient });
  } catch (error) {
    console.error('Failed to get Gmail client:', error);
    throw error;
  }
}

export async function getUserProfile(userId: string = 'default_user') {
  try {
    const tokens = await getValidTokens(userId);
    const authClient = setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: authClient });
    const { data } = await oauth2.userinfo.get();
    return data;
  } catch (error) {
    console.error('Failed to get user profile:', error);
    throw error;
  }
}

// Helper function to check if authentication is valid
export async function checkAuthStatus(userId: string = 'default_user') {
  try {
    await getValidTokens(userId);
    return { isAuthenticated: true, requiresReauth: false };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const requiresReauth = errorMessage.includes('re-authenticate');
    
    return { 
      isAuthenticated: false, 
      requiresReauth,
      error: errorMessage
    };
  }
}

// Helper function for n8n webhook integration
export async function getTokensForN8N(userId: string = 'default_user') {
  try {
    const tokens = await getValidTokens(userId);
    return {
      success: true,
      accessToken: tokens.access_token,
      tokenType: tokens.token_type,
      expiresAt: new Date(tokens.expiry_date).toISOString()
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      requiresReauth: true
    };
  }
}
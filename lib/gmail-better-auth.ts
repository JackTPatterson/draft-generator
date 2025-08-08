import pool from './database'
import { auth } from '@/app/auth'

/**
 * Get Gmail tokens from better-auth account and sync to gmail_tokens table
 */
export async function syncGmailTokensFromAccount(userId: string) {
  try {
    const client = await pool.connect()
    
    // Get Google account from better-auth
    const googleAccount = await client.query(`
      SELECT "accessToken", "refreshToken", "accessTokenExpiresAt", "refreshTokenExpiresAt"
      FROM account 
      WHERE "userId" = $1 AND "providerId" = 'google'
      ORDER BY "createdAt" DESC
      LIMIT 1
    `, [userId])

    if (googleAccount.rows.length === 0) {
      client.release()
      return null
    }

    const account = googleAccount.rows[0]
    
    // Sync to gmail_tokens table
    await client.query(`
      INSERT INTO gmail_tokens (
        user_id, access_token, refresh_token, token_type, 
        expires_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (user_id) 
      DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()
    `, [
      userId,
      account.accessToken,
      account.refreshToken,
      'Bearer',
      account.accessTokenExpiresAt
    ])

    client.release()
    
    return {
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
      expires_at: account.accessTokenExpiresAt
    }
  } catch (error) {
    console.error('Error syncing Gmail tokens from account:', error)
    return null
  }
}

/**
 * Check if user has Gmail connected via better-auth
 */
export async function hasGmailConnected(userId: string): Promise<boolean> {
  try {
    const client = await pool.connect()
    
    const result = await client.query(`
      SELECT id FROM account 
      WHERE "userId" = $1 AND "providerId" = 'google'
      LIMIT 1
    `, [userId])

    client.release()
    return result.rows.length > 0
  } catch (error) {
    console.error('Error checking Gmail connection:', error)
    return false
  }
}

/**
 * Get Gmail connection status for a user
 */
export async function getGmailConnectionStatus(userId: string) {
  try {
    const client = await pool.connect()
    
    // Check better-auth Google account
    const accountResult = await client.query(`
      SELECT 
        "accessToken", 
        "refreshToken",
        "accessTokenExpiresAt",
        "createdAt"
      FROM account 
      WHERE "userId" = $1 AND "providerId" = 'google'
      ORDER BY "createdAt" DESC
      LIMIT 1
    `, [userId])

    // Check gmail_tokens table
    const tokenResult = await client.query(`
      SELECT expires_at, updated_at
      FROM gmail_tokens 
      WHERE user_id = $1
      LIMIT 1
    `, [userId])

    client.release()

    const hasAccount = accountResult.rows.length > 0
    const hasTokens = tokenResult.rows.length > 0
    const account = hasAccount ? accountResult.rows[0] : null
    const tokens = hasTokens ? tokenResult.rows[0] : null

    // Always check backend microservice as fallback when no frontend tokens exist
    // This ensures we detect OAuth connections made directly to the backend
    if (!hasAccount || !hasTokens) {
      console.log('Checking backend microservice for Gmail connection...')
      try {
        const { getMappedUserId } = await import('@/lib/user-mapping')
        const mappedUserId = await getMappedUserId(userId)
        
        const EMAIL_MONITOR_BASE_URL = process.env.EMAIL_MONITOR_BASE_URL || 'http://localhost:3003'
        const backendResponse = await fetch(`${EMAIL_MONITOR_BASE_URL}/api/users/${mappedUserId}/email-monitoring`)
        
        if (backendResponse.ok) {
          const backendData = await backendResponse.json()
          console.log('Backend Gmail status:', backendData.gmail_connected)
          
          // If backend shows connected, return that status
          if (backendData.gmail_connected) {
            return {
              connected: true,
              synced: false, // Not synced to frontend yet
              needsSync: true, // Indicate sync is needed
              expires_at: backendData.token_expires_at || null,
              last_updated: null,
              connected_at: null
            }
          }
        }
      } catch (backendError) {
        console.log('Backend check failed:', backendError.message)
      }
    }

    return {
      connected: hasAccount,
      synced: hasTokens,
      needsSync: hasAccount && !hasTokens,
      expires_at: account?.accessTokenExpiresAt || tokens?.expires_at,
      last_updated: tokens?.updated_at,
      connected_at: account?.createdAt
    }
  } catch (error) {
    console.error('Error getting Gmail connection status:', error)
    return {
      connected: false,
      synced: false,
      needsSync: false,
      expires_at: null,
      last_updated: null,
      connected_at: null
    }
  }
}

/**
 * Disconnect Gmail account and remove all tokens
 */
export async function disconnectGmailAccount(userId: string) {
  try {
    const client = await pool.connect()
    
    // Remove from better-auth account table
    await client.query(`
      DELETE FROM account 
      WHERE "userId" = $1 AND "providerId" = 'google'
    `, [userId])

    // Remove from gmail_tokens table
    await client.query(`
      DELETE FROM gmail_tokens 
      WHERE user_id = $1
    `, [userId])

    client.release()
    
    return { success: true }
  } catch (error) {
    console.error('Error disconnecting Gmail account:', error)
    return { success: false, error: error.message }
  }
}
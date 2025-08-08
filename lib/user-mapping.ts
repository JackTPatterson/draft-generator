import pool from '@/lib/database'

/**
 * Helper function to get or create UUID for better-auth user ID
 * Maps better-auth user IDs (non-UUID format) to UUIDs for microservice compatibility
 */
export async function getMappedUserId(betterAuthId: string): Promise<string> {
  if (!betterAuthId) {
    throw new Error('betterAuthId is required')
  }

  let client
  try {
    client = await pool.connect()
    console.log('Connected to database for user mapping')
    
    // Get or create UUID mapping (in main database)
    const result = await client.query(
      'SELECT get_or_create_uuid_for_user($1) as uuid_id',
      [betterAuthId]
    )

    if (!result.rows || result.rows.length === 0) {
      throw new Error('No result from get_or_create_uuid_for_user function')
    }
    
    const uuidId = result.rows[0].uuid_id
    
    if (!uuidId) {
      throw new Error('UUID mapping function returned null/undefined')
    }
    // Note: User should be manually created in microservice database
    // or automatically synced via a background process
    return uuidId
  } catch (error) {
    console.error('Error in getMappedUserId:', error)
    throw error
  } finally {
    if (client) {
      client.release()
    }
  }
}
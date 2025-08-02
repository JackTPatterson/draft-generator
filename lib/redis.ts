import { createClient, RedisClientType } from 'redis'

export interface ExecutionStatusUpdate {
  id: string
  gmail_id?: string
  thread_id?: string
  execution_status: 'pending' | 'running' | 'completed' | 'failed'
  processed_at?: string
  error_message?: string
  metadata?: any
}

class RedisService {
  private client: RedisClientType | null = null
  private publisher: RedisClientType | null = null
  private subscriber: RedisClientType | null = null

  async connect(): Promise<void> {
    try {
      // Main client for general operations
      this.client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      })

      // Separate clients for pub/sub (Redis requirement)
      this.publisher = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      })
      
      this.subscriber = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      })

      await Promise.all([
        this.client.connect(),
        this.publisher.connect(),
        this.subscriber.connect()
      ])

      console.log('Redis connected successfully')
    } catch (error) {
      console.error('Redis connection failed:', error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    try {
      await Promise.all([
        this.client?.disconnect(),
        this.publisher?.disconnect(),
        this.subscriber?.disconnect()
      ])
      console.log('Redis disconnected')
    } catch (error) {
      console.error('Redis disconnection error:', error)
    }
  }

  // Publish execution status updates
  async publishExecutionUpdate(update: ExecutionStatusUpdate): Promise<void> {
    if (!this.publisher) {
      throw new Error('Redis publisher not connected')
    }

    const channel = 'execution_updates'
    
    // Clean and validate the update data before JSON stringification
    const cleanedUpdate = {
      ...update,
      timestamp: new Date().toISOString()
    }
    
    // Sanitize potential problematic fields
    if (cleanedUpdate.error_message) {
      cleanedUpdate.error_message = cleanedUpdate.error_message.replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    }
    
    let message: string
    try {
      message = JSON.stringify(cleanedUpdate)
      
      // Validate that the JSON can be parsed back
      JSON.parse(message)
    } catch (stringifyError) {
      console.error('Failed to stringify execution update:', stringifyError)
      console.error('Problematic update:', update)
      throw new Error(`Invalid data for Redis publication: ${stringifyError instanceof Error ? stringifyError.message : 'Unknown error'}`)
    }

    try {
      console.log('Publishing to Redis:', { channel, message })
      console.log('Message length:', message.length)
      await this.publisher.publish(channel, message)
      console.log('Published execution update successfully:', update)
    } catch (error) {
      console.error('Failed to publish execution update:', error)
      throw error
    }
  }

  // Subscribe to execution status updates (creates new subscriber client to avoid conflicts)
  async createSubscriber(callback: (update: ExecutionStatusUpdate & { timestamp: string }) => void): Promise<RedisClientType> {
    const subscriber = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    })

    await subscriber.connect()
    
    const channel = 'execution_updates'

    try {
      await subscriber.subscribe(channel, (message) => {
        try {
          const update = JSON.parse(message)
          callback(update)
        } catch (error) {
          console.error('Failed to parse execution update:', error)
        }
      })

      console.log(`New subscriber created for ${channel}`)
      return subscriber
    } catch (error) {
      console.error('Failed to subscribe to execution updates:', error)
      await subscriber.disconnect()
      throw error
    }
  }

  // Legacy method - kept for backward compatibility but not recommended for multiple connections
  async subscribeToExecutionUpdates(
    callback: (update: ExecutionStatusUpdate & { timestamp: string }) => void
  ): Promise<void> {
    if (!this.subscriber) {
      throw new Error('Redis subscriber not connected')
    }

    const channel = 'execution_updates'

    try {
      await this.subscriber.subscribe(channel, (message) => {
        try {
          const update = JSON.parse(message)
          callback(update)
        } catch (error) {
          console.error('Failed to parse execution update:', error)
        }
      })

      console.log(`Subscribed to ${channel}`)
    } catch (error) {
      console.error('Failed to subscribe to execution updates:', error)
      throw error
    }
  }

  // Cache execution data with expiration
  async cacheExecution(executionId: string, data: any, ttlSeconds: number = 3600): Promise<void> {
    if (!this.client) {
      throw new Error('Redis client not connected')
    }

    const key = `execution:${executionId}`
    
    try {
      await this.client.setEx(key, ttlSeconds, JSON.stringify(data))
    } catch (error) {
      console.error('Failed to cache execution:', error)
      throw error
    }
  }

  // Get cached execution data
  async getCachedExecution(executionId: string): Promise<any | null> {
    if (!this.client) {
      throw new Error('Redis client not connected')
    }

    const key = `execution:${executionId}`
    
    try {
      const data = await this.client.get(key)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error('Failed to get cached execution:', error)
      return null
    }
  }

  // Store active WebSocket connections for broadcasting
  async addActiveConnection(connectionId: string, userId?: string): Promise<void> {
    if (!this.client) {
      throw new Error('Redis client not connected')
    }

    const key = 'active_connections'
    const connectionData = JSON.stringify({
      connectionId,
      userId,
      connectedAt: new Date().toISOString()
    })

    try {
      await this.client.hSet(key, connectionId, connectionData)
    } catch (error) {
      console.error('Failed to add active connection:', error)
    }
  }

  // Remove WebSocket connection
  async removeActiveConnection(connectionId: string): Promise<void> {
    if (!this.client) {
      throw new Error('Redis client not connected')
    }

    const key = 'active_connections'
    
    try {
      await this.client.hDel(key, connectionId)
    } catch (error) {
      console.error('Failed to remove active connection:', error)
    }
  }

  // Get all active connections
  async getActiveConnections(): Promise<Array<{ connectionId: string; userId?: string; connectedAt: string }>> {
    if (!this.client) {
      throw new Error('Redis client not connected')
    }

    const key = 'active_connections'
    
    try {
      const connections = await this.client.hGetAll(key)
      return Object.values(connections).map(conn => JSON.parse(conn))
    } catch (error) {
      console.error('Failed to get active connections:', error)
      return []
    }
  }

  // Health check
  async ping(): Promise<boolean> {
    try {
      if (!this.client) return false
      const result = await this.client.ping()
      return result === 'PONG'
    } catch (error) {
      console.error('Redis ping failed:', error)
      return false
    }
  }
}

// Singleton instance
export const redisService = new RedisService()

// Initialize Redis connection on startup
if (typeof window === 'undefined') {
  // Only run on server side
  redisService.connect().catch(console.error)
}

export default redisService
import { Server as SocketIOServer } from 'socket.io'
import { createServer } from 'http'
import redisService, { ExecutionStatusUpdate } from './redis'

export class WebSocketManager {
  private io: SocketIOServer | null = null
  private httpServer: any = null

  initialize(httpServer?: any): SocketIOServer {
    if (this.io) return this.io

    // Create Socket.IO server
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? [process.env.NEXT_PUBLIC_APP_URL] 
          : ['http://localhost:3000'],
        methods: ['GET', 'POST']
      },
      path: '/api/socket.io'
    })

    this.setupEventHandlers()
    this.setupRedisSubscription()

    console.log('WebSocket server initialized')
    return this.io
  }

  private setupEventHandlers(): void {
    if (!this.io) return

    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id)

      // Handle client joining a room (e.g., user-specific updates)
      socket.on('join', (data: { userId?: string }) => {
        const { userId } = data
        if (userId) {
          socket.join(`user:${userId}`)
          console.log(`Client ${socket.id} joined room user:${userId}`)
        }
        
        // Join general execution updates room
        socket.join('executions')
        console.log(`Client ${socket.id} joined executions room`)

        // Store connection in Redis
        redisService.addActiveConnection(socket.id, userId).catch(console.error)
      })

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id)
        redisService.removeActiveConnection(socket.id).catch(console.error)
      })

      // Handle manual refresh request
      socket.on('refresh_executions', () => {
        socket.emit('executions_refresh_needed')
      })
    })
  }

  private setupRedisSubscription(): void {
    // Subscribe to Redis pub/sub for execution updates
    redisService.subscribeToExecutionUpdates((update) => {
      this.broadcastExecutionUpdate(update)
    }).catch(console.error)
  }

  broadcastExecutionUpdate(update: ExecutionStatusUpdate & { timestamp: string }): void {
    if (!this.io) return

    console.log('Broadcasting execution update:', update)

    // Broadcast to all clients in executions room
    this.io.to('executions').emit('execution_update', update)

    // If there's a user-specific update, send to their room too
    if (update.metadata?.userId) {
      this.io.to(`user:${update.metadata.userId}`).emit('execution_update', update)
    }
  }

  // Method to send updates from other parts of the application
  sendExecutionUpdate(update: ExecutionStatusUpdate): void {
    // Publish to Redis, which will trigger the broadcast
    redisService.publishExecutionUpdate(update).catch(console.error)
  }

  getConnectedClients(): number {
    return this.io ? this.io.engine.clientsCount : 0
  }
}

// Singleton instance
export const wsManager = new WebSocketManager()

export default wsManager
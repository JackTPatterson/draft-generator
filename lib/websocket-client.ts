'use client'

export interface ExecutionStatusUpdate {
  id: string
  gmail_id?: string
  thread_id?: string
  execution_status: 'pending' | 'running' | 'completed' | 'failed'
  processed_at?: string
  error_message?: string
  metadata?: any
}

export interface WebSocketClientCallbacks {
  onExecutionUpdate?: (update: ExecutionStatusUpdate & { timestamp: string }) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: any) => void
  onRefreshNeeded?: () => void
}

export class WebSocketClient {
  private eventSource: EventSource | null = null
  private callbacks: WebSocketClientCallbacks = {}
  private isConnecting = false

  constructor(callbacks: WebSocketClientCallbacks = {}) {
    this.callbacks = callbacks
  }

  connect(userId?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.eventSource && this.eventSource.readyState === EventSource.OPEN) {
        resolve()
        return
      }

      if (this.isConnecting) {
        setTimeout(() => {
          if (this.eventSource && this.eventSource.readyState === EventSource.OPEN) {
            resolve()
          } else {
            reject(new Error('Connection timeout'))
          }
        }, 5000)
        return
      }

      this.isConnecting = true

      try {
        this.setupServerSentEvents(userId)
        resolve()
      } catch (error) {
        this.isConnecting = false
        reject(error)
      }
    })
  }


  private setupServerSentEvents(userId?: string): void {
    // Close existing connection if any
    if (this.eventSource) {
      this.eventSource.close()
    }

    this.eventSource = new EventSource(`/api/events/execution-updates${userId ? `?userId=${userId}` : ''}`)
    
    this.eventSource.onopen = () => {
      console.log('SSE connection opened')
      this.isConnecting = false
      this.callbacks.onConnect?.()
    }

    this.eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        console.log('Received SSE message:', message)
        
        // Handle different message types
        if (message.type === 'execution_update') {
          // This is a Redis execution update
          this.callbacks.onExecutionUpdate?.(message)
        } else if (message.type === 'connected') {
          console.log('SSE connection confirmed:', message.message)
        } else if (message.type === 'keepalive') {
          // Keepalive message, no action needed
          console.log('SSE keepalive received')
        } else if (message.type === 'error') {
          console.error('SSE error message:', message.message)
          this.callbacks.onError?.(new Error(message.message))
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error)
      }
    }

    this.eventSource.onerror = (error) => {
      console.error('SSE error:', error)
      
      // Only call onDisconnect if we were previously connected
      if (this.eventSource?.readyState === EventSource.CLOSED) {
        this.callbacks.onDisconnect?.()
        
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          if (!this.eventSource || this.eventSource.readyState === EventSource.CLOSED) {
            console.log('Attempting to reconnect SSE...')
            this.setupServerSentEvents(userId)
          }
        }, 5000)
      } else {
        this.callbacks.onError?.(error)
      }
    }
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
    // Don't call onDisconnect here as this is manual cleanup
  }

  // Method to manually request execution refresh
  requestRefresh(): void {
    // Trigger a manual refresh via callback
    this.callbacks.onRefreshNeeded?.()
  }

  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN
  }
}

// Singleton for app-wide use
let globalWebSocketClient: WebSocketClient | null = null

export function getWebSocketClient(callbacks?: WebSocketClientCallbacks): WebSocketClient {
  if (!globalWebSocketClient) {
    globalWebSocketClient = new WebSocketClient(callbacks)
  } else if (callbacks) {
    // Update callbacks if provided
    globalWebSocketClient.callbacks = { ...globalWebSocketClient.callbacks, ...callbacks }
  }
  
  return globalWebSocketClient
}

export default WebSocketClient
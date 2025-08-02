import { NextRequest, NextResponse } from 'next/server'
import redisService, { ExecutionStatusUpdate } from '@/lib/redis'

// Server-Sent Events endpoint for real-time execution updates
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  // Set up Server-Sent Events headers
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  })

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      console.log('SSE connection started for user:', userId)

      // Send initial connection message
      const welcome = `data: ${JSON.stringify({
        type: 'connected',
        message: 'Real-time updates connected',
        timestamp: new Date().toISOString()
      })}\n\n`
      
      controller.enqueue(new TextEncoder().encode(welcome))

      // Set up Redis subscription for this connection
      let isSubscribed = false
      let subscriptionCleanup: (() => void) | null = null
      
      const subscribeToUpdates = async () => {
        if (isSubscribed) return
        
        try {
          // Create a new Redis subscriber client for this connection
          const { createClient } = await import('redis')
          const subscriber = createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379'
          })
          
          await subscriber.connect()
          
          // Set up subscription
          await subscriber.subscribe('execution_updates', (message) => {
            try {
              console.log('Raw Redis message received:', JSON.stringify(message))
              console.log('Message type:', typeof message)
              console.log('Message length:', message.length)

              // Defensive JSON parsing - handle potential issues
              let update
              try {
                // Trim whitespace and check for valid JSON
                const trimmedMessage = message.trim()
                if (!trimmedMessage) {
                  console.warn('Empty message received, skipping')
                  return
                }

                // Check if message starts with valid JSON characters
                if (!trimmedMessage.startsWith('{') && !trimmedMessage.startsWith('[')) {
                  console.error('Invalid JSON format - does not start with { or [')
                  console.error('First 50 chars:', trimmedMessage.substring(0, 50))
                  return
                }

                update = JSON.parse(trimmedMessage)
                console.log('Parsed Redis update successfully:', update)
              } catch (jsonError) {
                console.error('JSON parsing failed:', jsonError)
                console.error('Message substring (first 200 chars):', message.substring(0, 200))
                console.error('Message hex dump (first 50 bytes):', Buffer.from(message.substring(0, 50)).toString('hex'))
                console.error('Character codes:', message.substring(0, 20).split('').map(c => c.charCodeAt(0)))
                
                // Try to extract valid JSON if message contains multiple parts
                const lines = message.split('\n')
                for (const line of lines) {
                  const trimmedLine = line.trim()
                  if (trimmedLine.startsWith('{')) {
                    try {
                      update = JSON.parse(trimmedLine)
                      console.log('Recovered JSON from line:', update)
                      break
                    } catch (lineError) {
                      console.error('Line parsing also failed:', lineError)
                      console.error('Problematic line:', JSON.stringify(trimmedLine))
                      console.error('Line hex dump:', Buffer.from(trimmedLine.substring(0, 30)).toString('hex'))
                      console.error('Line character codes:', trimmedLine.substring(0, 10).split('').map(c => c.charCodeAt(0)))
                    }
                  }
                }
                
                if (!update) {
                  console.error('Could not recover valid JSON from message')
                  console.error('Full message analysis:')
                  console.error('- Length:', message.length)
                  console.error('- First 10 char codes:', message.substring(0, 10).split('').map(c => `${c}(${c.charCodeAt(0)})`).join(' '))
                  console.error('- Ends with:', message.substring(Math.max(0, message.length - 10)))
                  console.error('- Contains newlines:', message.includes('\n'))
                  console.error('- Contains carriage returns:', message.includes('\r'))
                  return
                }
              }
              
              // Filter updates by user if userId is provided
              if (userId && update.metadata?.userId !== userId) {
                return
              }

              const sseMessage = `data: ${JSON.stringify({
                type: 'execution_update',
                ...update
              })}\n\n`
              
              try {
                controller.enqueue(new TextEncoder().encode(sseMessage))
              } catch (error) {
                console.error('Error sending SSE message:', error)
              }
            } catch (parseError) {
              console.error('Error parsing Redis message:', parseError)
              console.error('Problematic message:', JSON.stringify(message))
              console.error('Message preview:', message.substring(0, 100))
            }
          })
          
          // Set up cleanup function
          subscriptionCleanup = async () => {
            try {
              await subscriber.unsubscribe('execution_updates')
              await subscriber.disconnect()
            } catch (error) {
              console.error('Error cleaning up Redis subscription:', error)
            }
          }
          
          isSubscribed = true
          console.log('Subscribed to Redis updates for SSE connection')
        } catch (error) {
          console.error('Failed to subscribe to Redis updates:', error)
          
          // Send error message to client
          const errorMessage = `data: ${JSON.stringify({
            type: 'error',
            message: 'Failed to connect to real-time updates',
            timestamp: new Date().toISOString()
          })}\n\n`
          
          controller.enqueue(new TextEncoder().encode(errorMessage))
        }
      }

      // Subscribe to updates
      subscribeToUpdates()

      // Send keepalive messages every 30 seconds
      const keepAliveInterval = setInterval(() => {
        try {
          const keepAlive = `data: ${JSON.stringify({
            type: 'keepalive',
            timestamp: new Date().toISOString()
          })}\n\n`
          
          controller.enqueue(new TextEncoder().encode(keepAlive))
        } catch (error) {
          console.error('Error sending keepalive:', error)
          clearInterval(keepAliveInterval)
        }
      }, 30000)

      // Handle client disconnect
      const cleanup = async () => {
        console.log('SSE connection closed for user:', userId)
        clearInterval(keepAliveInterval)
        
        // Clean up Redis subscription
        if (subscriptionCleanup) {
          await subscriptionCleanup()
        }
        
        try {
          controller.close()
        } catch (error) {
          console.error('Error closing SSE controller:', error)
        }
      }

      // Set up cleanup on stream abort
      request.signal?.addEventListener('abort', cleanup)
      
      // Cleanup after 1 hour to prevent memory leaks
      setTimeout(cleanup, 60 * 60 * 1000)
    },

    cancel() {
      console.log('SSE stream cancelled')
    }
  })

  return new NextResponse(stream, { headers })
}

// Health check for SSE endpoint
export async function POST() {
  try {
    const redisHealthy = await redisService.ping()
    
    return NextResponse.json({
      status: 'SSE endpoint ready',
      redis: redisHealthy ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('SSE health check error:', error)
    return NextResponse.json(
      { error: 'SSE service unavailable' },
      { status: 500 }
    )
  }
}
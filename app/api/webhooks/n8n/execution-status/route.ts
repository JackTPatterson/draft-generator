import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import redisService, { ExecutionStatusUpdate } from '@/lib/redis'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

export interface N8nExecutionWebhook {
  executionId: string
  workflowId: string
  status: 'started' | 'running' | 'completed' | 'failed' | 'cancelled'
  startedAt?: string
  finishedAt?: string
  error?: {
    message: string
    stack?: string
  }
  data?: {
    gmail_id?: string
    thread_id?: string
    user_id?: string
    [key: string]: any
  }
}

async function updateExecutionInDatabase(
  executionId: string,
  status: string,
  processedAt?: string,
  errorMessage?: string
): Promise<void> {
  const client = await pool.connect()
  try {
    const query = `
      UPDATE email_executions 
      SET 
        execution_status = $1,
        processed_at = $2,
        updated_at = NOW()
      WHERE id = $3
      RETURNING gmail_id, thread_id
    `


    const result = await client.query(query, [
      status,
      processedAt ? new Date(processedAt) : null,
      executionId
    ])

    if (result.rows.length === 0) {
      // If no existing record, create one
      const insertQuery = `
        INSERT INTO email_executions (id, execution_status, processed_at, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          execution_status = EXCLUDED.execution_status,
          processed_at = EXCLUDED.processed_at,
          updated_at = NOW()
        RETURNING gmail_id, thread_id
      `
      
      await client.query(insertQuery, [
        executionId,
        status,
        processedAt ? new Date(processedAt) : null
      ])
    }

    console.log(`Updated execution ${executionId} to status: ${status}`)
  } finally {
    client.release()
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: N8nExecutionWebhook = await request.json()
    
    console.log('Received n8n execution webhook:', body)

    const {
      executionId,
      workflowId,
      status,
      startedAt,
      finishedAt,
      error,
      data
    } = body

    // Validate required fields
    if (!executionId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: executionId, status' },
        { status: 400 }
      )
    }

    // Map n8n status to our execution status
    let executionStatus: string
    switch (status) {
      case 'started':
      case 'running':
        executionStatus = 'running'
        break
      case 'completed':
        executionStatus = 'completed'
        break
      case 'failed':
      case 'cancelled':
        executionStatus = 'failed'
        break
      default:
        executionStatus = 'pending'
    }

    // Update database
    await updateExecutionInDatabase(
      executionId,
      executionStatus,
      finishedAt || (status === 'started' ? startedAt : undefined),
      error?.message
    )

    // Prepare Redis update
    const redisUpdate: ExecutionStatusUpdate = {
      id: executionId,
      gmail_id: data?.gmail_id,
      thread_id: data?.thread_id,
      execution_status: executionStatus as any,
      processed_at: finishedAt || (status === 'started' ? startedAt : undefined),
      error_message: error?.message,
      metadata: {
        workflowId,
        originalStatus: status,
        userId: data?.user_id,
        ...data
      }
    }

    // Publish to Redis for real-time updates
    await redisService.publishExecutionUpdate(redisUpdate)

    // Cache the execution data
    await redisService.cacheExecution(executionId, {
      ...redisUpdate,
      updatedAt: new Date().toISOString()
    }, 3600) // Cache for 1 hour

    console.log(`Processed n8n webhook for execution ${executionId}: ${status} -> ${executionStatus}`)

    return NextResponse.json({
      success: true,
      executionId,
      status: executionStatus,
      message: 'Execution status updated successfully'
    })

  } catch (error) {
    console.error('Error processing n8n execution webhook:', error)
    
    return NextResponse.json(
      {
        error: 'Failed to process execution webhook',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Health check endpoint
export async function GET() {
  try {
    const redisHealthy = await redisService.ping()
    const dbHealthy = await pool.query('SELECT 1').then(() => true).catch(() => false)

    return NextResponse.json({
      status: 'healthy',
      services: {
        redis: redisHealthy ? 'connected' : 'disconnected',
        database: dbHealthy ? 'connected' : 'disconnected'
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Health check failed' },
      { status: 500 }
    )
  }
}
import { NextResponse } from 'next/server'
import { getEmailExecutions } from '@/lib/database'

export async function GET() {
  try {
    const executions = await getEmailExecutions()
    return NextResponse.json(executions)
  } catch (error) {
    console.error('Failed to fetch executions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch executions from database' },
      { status: 500 }
    )
  }
}
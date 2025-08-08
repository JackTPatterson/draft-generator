import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { auth } from '@/app/auth';
import { headers } from 'next/headers';
import { getMappedUserId } from '@/lib/user-mapping';

const db = new Pool({
  connectionString: 'postgresql://postgres:changeme@localhost:5435/fluxyn_email_automation',
  user: 'postgres',
  password: 'changeme'
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Map better-auth user ID to UUID
    const mappedUserId = await getMappedUserId(session.user.id);

    // Get email processing statistics
    const result = await db.query(`
      WITH daily_stats AS (
        SELECT 
          DATE(processed_at) as date,
          COUNT(*) as total_processed,
          COUNT(CASE WHEN processing_result = 'success' THEN 1 END) as successful,
          COUNT(CASE WHEN processing_result = 'failed' THEN 1 END) as failed,
          COUNT(CASE WHEN webhook_response_code BETWEEN 200 AND 299 THEN 1 END) as webhook_success
        FROM email_processing_logs 
        WHERE user_id = $1 
          AND processed_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(processed_at)
        ORDER BY date DESC
      )
      SELECT 
        date,
        total_processed,
        successful,
        failed,
        webhook_success
      FROM daily_stats
    `, [mappedUserId]);

    // Get recent processed emails
    const recentEmailsResult = await db.query(`
      SELECT 
        epl.processed_at,
        epl.processing_result,
        epl.webhook_response_code,
        epl.processing_time_ms,
        e.subject,
        e.from_email,
        e.from_name,
        epl.error_message
      FROM email_processing_logs epl
      LEFT JOIN emails e ON epl.email_id = e.id
      WHERE epl.user_id = $1
      ORDER BY epl.processed_at DESC
      LIMIT 50
    `, [mappedUserId]);

    // Get summary statistics
    const summaryResult = await db.query(`
      SELECT 
        COUNT(*) as total_emails_processed,
        COUNT(CASE WHEN processing_result = 'success' THEN 1 END) as total_successful,
        COUNT(CASE WHEN processing_result = 'failed' THEN 1 END) as total_failed,
        AVG(processing_time_ms) as avg_processing_time,
        COUNT(CASE WHEN processed_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as processed_today
      FROM email_processing_logs 
      WHERE user_id = $1
    `, [mappedUserId]);

    return NextResponse.json({
      daily_stats: result.rows,
      recent_emails: recentEmailsResult.rows,
      summary: summaryResult.rows[0] || {
        total_emails_processed: 0,
        total_successful: 0,
        total_failed: 0,
        avg_processing_time: 0,
        processed_today: 0
      }
    });

  } catch (error) {
    console.error('Error fetching email stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
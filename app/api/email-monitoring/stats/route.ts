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

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '7d'; // 24h, 7d, 30d
    const includeDetails = searchParams.get('details') === 'true';

    let dateFilter = '';
    switch (period) {
      case '24h':
        dateFilter = "AND ms.date >= CURRENT_DATE";
        break;
      case '7d':
        dateFilter = "AND ms.date >= CURRENT_DATE - INTERVAL '7 days'";
        break;
      case '30d':
        dateFilter = "AND ms.date >= CURRENT_DATE - INTERVAL '30 days'";
        break;
      default:
        dateFilter = "AND ms.date >= CURRENT_DATE - INTERVAL '7 days'";
    }

    // Get aggregated statistics
    const statsResult = await db.query(`
      SELECT 
        SUM(ms.emails_checked) as total_emails_checked,
        SUM(ms.emails_processed) as total_emails_processed,
        SUM(ms.emails_skipped) as total_emails_skipped,
        SUM(ms.emails_failed) as total_emails_failed,
        AVG(ms.avg_processing_time_ms) as avg_processing_time_ms,
        MAX(ms.max_processing_time_ms) as max_processing_time_ms,
        SUM(ms.webhook_calls) as total_webhook_calls,
        SUM(ms.webhook_successes) as total_webhook_successes,
        SUM(ms.webhook_failures) as total_webhook_failures,
        SUM(ms.total_errors) as total_errors
      FROM monitoring_stats ms
      WHERE ms.user_id = $1 ${dateFilter}
    `, [mappedUserId]);

    // Get daily breakdown
    const dailyResult = await db.query(`
      SELECT 
        ms.date,
        ms.emails_checked,
        ms.emails_processed,
        ms.emails_skipped,
        ms.emails_failed,
        ms.avg_processing_time_ms,
        ms.webhook_calls,
        ms.webhook_successes,
        ms.webhook_failures,
        ms.total_errors
      FROM monitoring_stats ms
      WHERE ms.user_id = $1 ${dateFilter}
      ORDER BY ms.date DESC
    `, [mappedUserId]);

    // Get current status
    const statusResult = await db.query(`
      SELECT 
        uem.monitoring_status,
        uem.gmail_last_checked,
        uem.consecutive_errors,
        uem.last_error_message,
        uem.last_error_at,
        COUNT(epj.id) as pending_jobs,
        COUNT(CASE WHEN epj.status = 'processing' THEN 1 END) as processing_jobs
      FROM user_email_monitoring uem
      LEFT JOIN email_processing_jobs epj ON uem.user_id = epj.user_id AND epj.status IN ('pending', 'processing')
      WHERE uem.user_id = $1
      GROUP BY uem.user_id, uem.monitoring_status, uem.gmail_last_checked, 
               uem.consecutive_errors, uem.last_error_message, uem.last_error_at
    `, [mappedUserId]);

    const stats = statsResult.rows[0] || {};
    const status = statusResult.rows[0] || {};

    const response = {
      period,
      summary: {
        emails_checked: parseInt(stats.total_emails_checked || '0'),
        emails_processed: parseInt(stats.total_emails_processed || '0'),
        emails_skipped: parseInt(stats.total_emails_skipped || '0'),
        emails_failed: parseInt(stats.total_emails_failed || '0'),
        success_rate: stats.total_emails_checked > 0 
          ? Math.round((stats.total_emails_processed / stats.total_emails_checked) * 100) 
          : 0,
        avg_processing_time_ms: Math.round(parseFloat(stats.avg_processing_time_ms || '0')),
        max_processing_time_ms: parseInt(stats.max_processing_time_ms || '0'),
        webhook_calls: parseInt(stats.total_webhook_calls || '0'),
        webhook_success_rate: stats.total_webhook_calls > 0
          ? Math.round((stats.total_webhook_successes / stats.total_webhook_calls) * 100)
          : 0,
        total_errors: parseInt(stats.total_errors || '0')
      },
      current_status: {
        monitoring_status: status.monitoring_status || 'disabled',
        last_checked: status.gmail_last_checked,
        consecutive_errors: parseInt(status.consecutive_errors || '0'),
        last_error: status.last_error_message,
        last_error_at: status.last_error_at,
        pending_jobs: parseInt(status.pending_jobs || '0'),
        processing_jobs: parseInt(status.processing_jobs || '0')
      },
      daily_breakdown: dailyResult.rows.map(row => ({
        date: row.date,
        emails_checked: row.emails_checked,
        emails_processed: row.emails_processed,
        emails_skipped: row.emails_skipped,
        emails_failed: row.emails_failed,
        success_rate: row.emails_checked > 0 
          ? Math.round((row.emails_processed / row.emails_checked) * 100) 
          : 0,
        avg_processing_time_ms: Math.round(parseFloat(row.avg_processing_time_ms || '0')),
        webhook_calls: row.webhook_calls,
        webhook_success_rate: row.webhook_calls > 0
          ? Math.round((row.webhook_successes / row.webhook_calls) * 100)
          : 0,
        total_errors: row.total_errors
      }))
    };

    // Include detailed logs if requested
    if (includeDetails) {
      const logsResult = await db.query(`
        SELECT 
          epl.id,
          epl.gmail_message_id,
          epl.processing_result,
          epl.processing_time_ms,
          epl.webhook_url,
          epl.webhook_response_code,
          epl.error_message,
          epl.processed_at,
          e.subject,
          e.from_email
        FROM email_processing_logs epl
        LEFT JOIN emails e ON epl.email_id = e.id
        WHERE epl.user_id = $1
        AND epl.processed_at >= NOW() - INTERVAL '24 hours'
        ORDER BY epl.processed_at DESC
        LIMIT 100
      `, [mappedUserId]);

      response.recent_logs = logsResult.rows;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching monitoring stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
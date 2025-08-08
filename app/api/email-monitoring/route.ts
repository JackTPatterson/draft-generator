import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { auth } from '@/app/auth';
import { headers } from 'next/headers';
import { createEmailMonitorClient } from '@/lib/email-monitor-client';
import { getMappedUserId } from '@/lib/user-mapping';

const db = new Pool({
  connectionString: 'postgresql://postgres:changeme@localhost:5435/fluxyn_email_automation',
  user: 'postgres',
  password: 'changeme'
});

const emailMonitorClient = createEmailMonitorClient(
  process.env.EMAIL_MONITOR_BASE_URL || 'http://localhost:3003'
);

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

    // Get user's email monitoring configuration
    const result = await db.query(`
      SELECT 
        uem.*,
        u.email as user_email,
        u.gmail_connected,
        (
          SELECT COUNT(*) 
          FROM email_processing_jobs epj 
          WHERE epj.user_id = uem.user_id 
          AND epj.status = 'pending'
        ) as pending_jobs,
        ms.emails_processed as emails_today,
        ms.emails_failed as errors_today,
        ms.webhook_calls as webhook_calls_today
      FROM user_email_monitoring uem
      LEFT JOIN users u ON uem.user_id = u.id
      LEFT JOIN monitoring_stats ms ON uem.user_id = ms.user_id AND ms.date = CURRENT_DATE
      WHERE uem.user_id = $1
    `, [mappedUserId]);

    if (result.rows.length === 0) {
      // No monitoring config exists, but check backend for Gmail connection
      let gmailConnected = false;
      try {
        const EMAIL_MONITOR_BASE_URL = process.env.EMAIL_MONITOR_BASE_URL || 'http://localhost:3003'
        const backendResponse = await fetch(`${EMAIL_MONITOR_BASE_URL}/api/users/${mappedUserId}/email-monitoring`)
        
        if (backendResponse.ok) {
          const backendData = await backendResponse.json()
          gmailConnected = backendData.gmail_connected || false
          console.log('Backend Gmail status for email-monitoring:', gmailConnected)
        }
      } catch (error) {
        console.log('Failed to check backend Gmail status:', error)
      }
      
      return NextResponse.json({
        monitoring_enabled: false,
        gmail_connected: gmailConnected
      });
    }

    const config = result.rows[0];
    return NextResponse.json({
      monitoring_enabled: true,
      monitoring_status: config.monitoring_status,
      check_interval_minutes: config.check_interval_minutes,
      max_emails_per_check: config.max_emails_per_check,
      gmail_last_checked: config.gmail_last_checked,
      consecutive_errors: config.consecutive_errors,
      last_error_message: config.last_error_message,
      n8n_webhook_url: config.n8n_webhook_url ? '[CONFIGURED]' : null, // Don't expose the actual URL
      gmail_connected: config.gmail_connected,
      pending_jobs: config.pending_jobs || 0,
      stats: {
        emails_today: config.emails_today || 0,
        errors_today: config.errors_today || 0,
        webhook_calls_today: config.webhook_calls_today || 0
      }
    });

  } catch (error) {
    console.error('Error fetching email monitoring config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...config } = body;

    // Map better-auth user ID to UUID
    const mappedUserId = await getMappedUserId(session.user.id);

    switch (action) {
      case 'enable':
        return await enableMonitoring(mappedUserId, config);
      case 'disable':
        return await disableMonitoring(mappedUserId);
      case 'update':
        return await updateConfiguration(mappedUserId, config);
      case 'test_webhook':
        return await testWebhook(mappedUserId, config.webhook_url);
      case 'reset_errors':
        return await resetErrors(mappedUserId);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error updating email monitoring config:', error);
    // Return the error message in development for easier debugging
    return NextResponse.json({ error: error instanceof Error ? error.stack || error.message : String(error) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Map better-auth user ID to UUID
    const mappedUserId = await getMappedUserId(session.user.id);

    // Disable monitoring and clean up jobs
    await db.query('BEGIN');

    try {
      // Delete monitoring configuration
      await db.query(
        'DELETE FROM user_email_monitoring WHERE user_id = $1',
        [mappedUserId]
      );

      // Cancel pending jobs
      await db.query(
        'UPDATE email_processing_jobs SET status = \'cancelled\'::job_status WHERE user_id = $1 AND status = \'pending\'::job_status',
        [mappedUserId]
      );

      await db.query('COMMIT');

      return NextResponse.json({ success: true });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error deleting email monitoring config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function enableMonitoring(userId: string, config: any) {
  // Validate required fields
  if (!config.n8n_webhook_url) {
    return NextResponse.json({ error: 'Webhook URL is required' }, { status: 400 });
  }

  // Get user email from session since we need it for microservice
  const session = await auth.api.getSession({
    headers: await headers()
  });
  
  const userEmail = session?.user?.email;
  const userName = session?.user?.name;
  if (!userEmail) {
    return NextResponse.json({ error: 'User email not found in session' }, { status: 400 });
  }

  // Ensure user exists in frontend database before creating monitoring config
  try {
    await db.query(`
      INSERT INTO users (id, email, name, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        updated_at = NOW()
    `, [userId, userEmail, userName || 'User']);
    console.log('User synced to frontend database:', userId, userEmail);
  } catch (syncError) {
    console.error('Failed to sync user to frontend database:', syncError);
    return NextResponse.json({ error: 'Failed to sync user data' }, { status: 500 });
  }

  // Check if user has Gmail connected and get user email
  const userResult = await db.query(
    'SELECT email, gmail_connected FROM users WHERE id = $1',
    [userId]
  );

  let gmailConnected = false;

  if (userResult.rows.length > 0) {
    gmailConnected = userResult.rows[0].gmail_connected;
  }

  // If not connected in frontend DB, check backend microservice
  if (!gmailConnected) {
    try {
      const EMAIL_MONITOR_BASE_URL = process.env.EMAIL_MONITOR_BASE_URL || 'http://localhost:3003'
      const monitoringResponse = await fetch(`${EMAIL_MONITOR_BASE_URL}/api/users/${userId}/email-monitoring`)
      if (monitoringResponse.ok) {
        const monitoringData = await monitoringResponse.json()
        gmailConnected = monitoringData.gmail_connected || false
        console.log('Checked backend Gmail connection for monitoring enable:', gmailConnected)
      }
    } catch (error) {
      console.log('Failed to check backend Gmail status for monitoring enable:', error)
    }
  }

  if (!gmailConnected) {
    return NextResponse.json({ error: 'Gmail must be connected first' }, { status: 400 });
  }

  try {
    // Register with email monitoring microservice
    const microserviceConfig = {
      email: userEmail,
      n8n_webhook_url: config.n8n_webhook_url,
      check_interval_minutes: config.check_interval_minutes || 5,
      enabled: true,
      labels_to_monitor: config.labels_to_monitor || [],
      filter_criteria: config.filter_criteria || {},
      notification_settings: {
        email_notifications: config.email_notifications || false,
        webhook_notifications: true,
        max_notifications_per_hour: config.max_notifications_per_hour || 60
      }
    };

    await emailMonitorClient.addEmailMonitoring(userId, microserviceConfig);

    // Also update local database for backward compatibility
    await db.query(`
      INSERT INTO user_email_monitoring (
        user_id, 
        gmail_watch_enabled, 
        monitoring_status,
        check_interval_minutes,
        max_emails_per_check,
        n8n_webhook_url,
        n8n_webhook_secret
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id) 
      DO UPDATE SET
        gmail_watch_enabled = $2,
        monitoring_status = $3,
        check_interval_minutes = $4,
        max_emails_per_check = $5,
        n8n_webhook_url = $6,
        n8n_webhook_secret = $7,
        consecutive_errors = 0,
        updated_at = NOW()
    `, [
      userId,
      true,
      'active',
      config.check_interval_minutes || 5,
      config.max_emails_per_check || 50,
      config.n8n_webhook_url,
      config.n8n_webhook_secret || null
    ]);

    // Trigger initial check via microservice
    await emailMonitorClient.triggerEmailCheck(userId);

    return NextResponse.json({ 
      success: true,
      message: 'Email monitoring enabled successfully',
      microservice_enabled: true
    });

  } catch (microserviceError) {
    console.warn('Microservice registration failed, falling back to local processing:', microserviceError);
    
    // Fallback to local database processing
    await db.query(`
      INSERT INTO user_email_monitoring (
        user_id, 
        gmail_watch_enabled, 
        monitoring_status,
        check_interval_minutes,
        max_emails_per_check,
        n8n_webhook_url,
        n8n_webhook_secret
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id) 
      DO UPDATE SET
        gmail_watch_enabled = $2,
        monitoring_status = $3,
        check_interval_minutes = $4,
        max_emails_per_check = $5,
        n8n_webhook_url = $6,
        n8n_webhook_secret = $7,
        consecutive_errors = 0,
        updated_at = NOW()
    `, [
      userId,
      true,
      'active',
      config.check_interval_minutes || 5,
      config.max_emails_per_check || 50,
      config.n8n_webhook_url,
      config.n8n_webhook_secret || null
    ]);

    // Schedule job in local database
    await db.query(`
      INSERT INTO email_processing_jobs (user_id, job_type, payload, priority)
      VALUES ($1, 'check_emails', '{}', 10)
    `, [userId]);

    return NextResponse.json({ 
      success: true,
      message: 'Email monitoring enabled with local processing',
      microservice_enabled: false
    });
  }
}

async function disableMonitoring(userId: string) {
  await db.query('BEGIN');

  try {
    // Update monitoring status
    await db.query(
      'UPDATE user_email_monitoring SET monitoring_status = \'disabled\', updated_at = NOW() WHERE user_id = $1',
      [userId]
    );

    // Cancel pending jobs
    await db.query(
      'UPDATE email_processing_jobs SET status = \'cancelled\'::job_status WHERE user_id = $1 AND status = \'pending\'::job_status',
      [userId]
    );

    await db.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: 'Email monitoring disabled successfully'
    });
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

async function updateConfiguration(userId: string, config: any) {
  console.log('updateConfiguration called with:', { userId, config })
  
  // Handle parameter name mapping
  const normalizedConfig = {
    ...config,
    n8n_webhook_url: config.n8n_webhook_url || config.webhook_url,
    check_interval_minutes: config.check_interval_minutes || config.check_interval
  };
  
  const updates = [];
  const values = [userId];
  let valueIndex = 2;

  if (normalizedConfig.check_interval_minutes !== undefined) {
    updates.push(`check_interval_minutes = $${valueIndex}`);
    values.push(normalizedConfig.check_interval_minutes);
    valueIndex++;
  }

  if (normalizedConfig.max_emails_per_check !== undefined) {
    updates.push(`max_emails_per_check = $${valueIndex}`);
    values.push(normalizedConfig.max_emails_per_check);
    valueIndex++;
  }

  if (normalizedConfig.n8n_webhook_url !== undefined) {
    updates.push(`n8n_webhook_url = $${valueIndex}`);
    values.push(normalizedConfig.n8n_webhook_url);
    valueIndex++;
  }

  if (normalizedConfig.n8n_webhook_secret !== undefined) {
    updates.push(`n8n_webhook_secret = $${valueIndex}`);
    values.push(normalizedConfig.n8n_webhook_secret);
    valueIndex++;
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
  }

  updates.push('updated_at = NOW()');

  // Use a simpler UPSERT approach
  try {
    const result = await db.query(
      `UPDATE user_email_monitoring 
       SET ${updates.join(', ')}
       WHERE user_id = $1`,
      values
    );

    // If no rows were updated, insert a new record
    if (result.rowCount === 0) {
      await db.query(
        `INSERT INTO user_email_monitoring (
          user_id, 
          check_interval_minutes, 
          n8n_webhook_url, 
          monitoring_status, 
          gmail_watch_enabled,
          max_emails_per_check,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, 'disabled', false, 50, NOW(), NOW())`,
        [
          userId,
          normalizedConfig.check_interval_minutes || 5,
          normalizedConfig.n8n_webhook_url || null
        ]
      );
    }

    console.log('Update result:', result.rowCount, 'rows affected')

    return NextResponse.json({
      success: true,
      message: 'Configuration updated successfully'
    });
  } catch (error) {
    console.error('Database update error:', error);
    throw error;
  }
}

async function testWebhook(userId: string, webhookUrl: string) {
  if (!webhookUrl) {
    return NextResponse.json({ error: 'Webhook URL is required' }, { status: 400 });
  }

  try {
    const testPayload = {
      test: true,
      user_id: userId,
      message: 'This is a test webhook call from Fluxyn email monitoring service',
      timestamp: new Date().toISOString()
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Fluxyn-Email-Monitor/1.0'
      },
      body: JSON.stringify(testPayload),
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    const responseText = await response.text();

    return NextResponse.json({
      success: response.ok,
      status_code: response.status,
      response_body: responseText.substring(0, 1000), // Limit response size
      message: response.ok ? 'Webhook test successful' : 'Webhook test failed'
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Webhook test failed'
    });
  }
}

async function resetErrors(userId: string) {
  await db.query(`
    UPDATE user_email_monitoring 
    SET 
      consecutive_errors = 0,
      last_error_message = NULL,
      last_error_at = NULL,
      monitoring_status = CASE 
        WHEN monitoring_status = 'error' THEN 'active' 
        ELSE monitoring_status 
      END,
      updated_at = NOW()
    WHERE user_id = $1
  `, [userId]);

  return NextResponse.json({
    success: true,
    message: 'Error count reset successfully'
  });
}
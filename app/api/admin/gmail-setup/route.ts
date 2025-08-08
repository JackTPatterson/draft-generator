import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

// Admin endpoint for setting up Gmail credentials directly (bypassing OAuth)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      userId, 
      email, 
      accessToken, 
      refreshToken, 
      expiryDate,
      adminKey 
    } = body;

    // Simple admin key check (in production, use proper authentication)
    const expectedAdminKey = process.env.ADMIN_SETUP_KEY || 'admin-setup-key-123';
    if (adminKey !== expectedAdminKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!userId || !email || !accessToken || !refreshToken) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, email, accessToken, refreshToken' },
        { status: 400 }
      );
    }

    const db = new Pool({
      connectionString: 'postgresql://postgres:changeme@localhost:5435/fluxyn_email_automation',
      user: 'postgres',
      password: 'changeme'
    });

    try {
      // First ensure user exists
      const userCheck = await db.query('SELECT id FROM users WHERE id = $1', [userId]);
      
      if (userCheck.rows.length === 0) {
        console.log('Creating user for Gmail setup...');
        await db.query(`
          INSERT INTO users (id, email, name, custom_id, created_at, updated_at)
          VALUES ($1, $2, $3, $4, NOW(), NOW())
        `, [userId, email, 'Gmail Backend User', userId]);
      }

      // Update user with Gmail tokens
      console.log('Setting Gmail credentials for user:', userId);
      const result = await db.query(`
        UPDATE users SET 
          gmail_access_token = $1,
          gmail_refresh_token = $2,
          gmail_token_expires_at = $3,
          gmail_connected = true,
          updated_at = NOW()
        WHERE id = $4
      `, [
        accessToken,
        refreshToken,
        expiryDate ? new Date(parseInt(expiryDate)) : null,
        userId
      ]);

      if (result.rowCount === 0) {
        return NextResponse.json(
          { error: 'User not found or update failed' },
          { status: 404 }
        );
      }

      // Enable email monitoring
      await db.query(`
        INSERT INTO user_email_monitoring (
          user_id, email, enabled, monitoring_status, 
          check_interval_minutes, n8n_webhook_url, created_at, updated_at
        ) VALUES ($1, $2, true, 'active', 5, $3, NOW(), NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          enabled = true,
          monitoring_status = 'active',
          updated_at = NOW()
      `, [
        userId, 
        email,
        process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/email-processing'
      ]);

      return NextResponse.json({
        success: true,
        message: 'Gmail credentials configured successfully',
        userId: userId,
        email: email
      });

    } finally {
      await db.end();
    }

  } catch (error) {
    console.error('Failed to setup Gmail credentials:', error);
    return NextResponse.json(
      { error: 'Failed to setup Gmail credentials' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Gmail Setup API',
    description: 'POST endpoint for configuring Gmail credentials server-side',
    required_fields: ['userId', 'email', 'accessToken', 'refreshToken', 'adminKey'],
    optional_fields: ['expiryDate'],
    example: {
      userId: 'e7422713-673c-48fe-989b-cceb5158cef0',
      email: 'your-email@gmail.com',
      accessToken: 'ya29.a0AfH6SMC...',
      refreshToken: '1//04...',
      expiryDate: '1640995200000',
      adminKey: 'your-admin-key'
    }
  });
}
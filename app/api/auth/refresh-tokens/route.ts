import { NextResponse } from 'next/server';
import { getValidTokens, checkAuthStatus } from '@/lib/gmail-auth-enhanced';

export async function GET() {
  try {
    const status = await checkAuthStatus('default_user');
    
    if (status.isAuthenticated) {
      const tokens = await getValidTokens('default_user');
      return NextResponse.json({ 
        success: true,
        isAuthenticated: true,
        expiresAt: new Date(tokens.expiry_date).toISOString(),
        expiresIn: Math.round((tokens.expiry_date - Date.now()) / 1000)
      });
    } else {
      return NextResponse.json({
        success: false,
        isAuthenticated: false,
        requiresReauth: status.requiresReauth,
        error: status.error,
        authUrl: '/api/auth/gmail'
      }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        requiresReauth: true,
        authUrl: '/api/auth/gmail'
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    // Force token refresh
    const tokens = await getValidTokens('default_user');
    return NextResponse.json({ 
      success: true,
      message: 'Tokens refreshed successfully',
      expiresAt: new Date(tokens.expiry_date).toISOString(),
      expiresIn: Math.round((tokens.expiry_date - Date.now()) / 1000)
    });
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Token refresh failed',
        requiresReauth: true,
        authUrl: '/api/auth/gmail'
      },
      { status: 401 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, getUserProfile } from '@/lib/gmail-auth';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    console.error('OAuth error:', error);
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/?error=oauth_error`);
  }

  if (!code) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/?error=no_code`);
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);
    
    if (!tokens.access_token) {
      throw new Error('No access token received');
    }

    // Get user profile
    const userProfile = await getUserProfile(tokens);

    // In a real app, you would store these tokens securely (database, encrypted cookies, etc.)
    // For now, we'll store them in a cookie (this is not production-ready)
    const response = NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?connected=gmail`);
    
    // Store tokens in httpOnly cookies (more secure than localStorage)
    response.cookies.set('gmail_access_token', tokens.access_token || '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600, // 1 hour
    });

    if (tokens.refresh_token) {
      response.cookies.set('gmail_refresh_token', tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    }

    // Store user info
    response.cookies.set('gmail_user_email', userProfile.email || '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/?error=token_exchange_failed`);
  }
}
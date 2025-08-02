import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const gmailAccessToken = cookieStore.get('gmail_access_token');
    const gmailUserEmail = cookieStore.get('gmail_user_email');

    const isAuthenticated = !!(gmailAccessToken?.value && gmailUserEmail?.value);

    return NextResponse.json({
      isAuthenticated,
      provider: isAuthenticated ? 'gmail' : null,
      email: gmailUserEmail?.value || null,
    });
  } catch (error) {
    console.error('Error checking auth status:', error);
    return NextResponse.json({
      isAuthenticated: false,
      provider: null,
      email: null,
    });
  }
}

export async function DELETE() {
  try {
    const response = NextResponse.json({ success: true });
    
    // Clear all Gmail-related cookies
    response.cookies.delete('gmail_access_token');
    response.cookies.delete('gmail_refresh_token');
    response.cookies.delete('gmail_user_email');

    return response;
  } catch (error) {
    console.error('Error during logout:', error);
    return NextResponse.json(
      { error: 'Failed to logout' },
      { status: 500 }
    );
  }
}
import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/gmail-auth';

export async function GET() {
  try {
    const authUrl = getAuthUrl();
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/callback/google`;
    
    return NextResponse.json({
      authUrl,
      clientId: clientId ? clientId.substring(0, 10) + '...' : 'undefined',
      redirectUri,
      nextAuthUrl: process.env.NEXTAUTH_URL,
    });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json({
      error: 'Failed to generate auth URL',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
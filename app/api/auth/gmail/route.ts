import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/gmail-auth';

export async function GET() {
  try {
    console.log('Environment variables check:', {
      CLIENT_ID: !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      CLIENT_SECRET: !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL
    });

    const authUrl = getAuthUrl();
    console.log('Generated auth URL:', authUrl);
    
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate auth URL',
        details: error instanceof Error ? error.message : 'Unknown error',
        env: {
          hasClientId: !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
          hasClientSecret: !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET,
          nextAuthUrl: process.env.NEXTAUTH_URL
        }
      },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';

// This endpoint proxies user email monitoring stats requests to the microservice
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    
    // Get microservice URL from environment
    const microserviceUrl = process.env.EMAIL_MONITOR_BASE_URL || 'http://localhost:3003';
    
    // Forward request to microservice
    const response = await fetch(`${microserviceUrl}/api/users/${userId}/email-monitoring/stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Microservice error: ${errorText}` },
        { status: response.status }
      );
    }
    
    const result = await response.json();
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Failed to get user email monitoring stats:', error);
    return NextResponse.json(
      { error: 'Failed to get user email monitoring stats' },
      { status: 500 }
    );
  }
}
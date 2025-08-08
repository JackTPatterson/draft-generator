import { NextRequest, NextResponse } from 'next/server';

// This endpoint proxies queue stats requests to the microservice
export async function GET(request: NextRequest) {
  try {
    // Get microservice URL from environment
    const microserviceUrl = process.env.EMAIL_MONITOR_BASE_URL || 'http://localhost:3003';
    
    // Forward request to microservice
    const response = await fetch(`${microserviceUrl}/api/queue/stats`, {
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
    console.error('Failed to get queue stats:', error);
    return NextResponse.json(
      { error: 'Failed to get queue stats' },
      { status: 500 }
    );
  }
}
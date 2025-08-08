import { NextRequest, NextResponse } from 'next/server';

// This endpoint proxies job trigger requests to the microservice
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const body = await request.json();
    
    // Get microservice URL from environment
    const microserviceUrl = process.env.EMAIL_MONITOR_BASE_URL || 'http://localhost:3003';
    
    // Forward request to microservice
    const response = await fetch(`${microserviceUrl}/api/jobs/trigger/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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
    console.error('Failed to trigger job:', error);
    return NextResponse.json(
      { error: 'Failed to trigger job' },
      { status: 500 }
    );
  }
}

// GET method not supported by microservice
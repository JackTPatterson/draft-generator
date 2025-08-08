import { NextRequest, NextResponse } from 'next/server';

// This endpoint proxies user email monitoring requests to the microservice
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    
    // Get microservice URL from environment
    const microserviceUrl = process.env.EMAIL_MONITOR_BASE_URL || 'http://localhost:3003';
    
    // Forward request to microservice
    const response = await fetch(`${microserviceUrl}/api/users/${userId}/email-monitoring`, {
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
    console.error('Failed to get user email monitoring:', error);
    return NextResponse.json(
      { error: 'Failed to get user email monitoring' },
      { status: 500 }
    );
  }
}

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
    const response = await fetch(`${microserviceUrl}/api/users/${userId}/email-monitoring`, {
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
    console.error('Failed to configure user email monitoring:', error);
    return NextResponse.json(
      { error: 'Failed to configure user email monitoring' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const body = await request.json();
    
    // Get microservice URL from environment
    const microserviceUrl = process.env.EMAIL_MONITOR_BASE_URL || 'http://localhost:3003';
    
    // Forward request to microservice
    const response = await fetch(`${microserviceUrl}/api/users/${userId}/email-monitoring`, {
      method: 'PATCH',
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
    console.error('Failed to update user email monitoring:', error);
    return NextResponse.json(
      { error: 'Failed to update user email monitoring' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    
    // Get microservice URL from environment
    const microserviceUrl = process.env.EMAIL_MONITOR_BASE_URL || 'http://localhost:3003';
    
    // Forward request to microservice
    const response = await fetch(`${microserviceUrl}/api/users/${userId}/email-monitoring`, {
      method: 'DELETE',
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
    console.error('Failed to delete user email monitoring:', error);
    return NextResponse.json(
      { error: 'Failed to delete user email monitoring' },
      { status: 500 }
    );
  }
}
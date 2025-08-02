import { NextRequest, NextResponse } from 'next/server';

interface EmailData {
  id?: string;
  threadId?: string;
  subject?: string;
  from?: string;
  to?: string;
  body?: string;
  timestamp?: string;
  attachments?: Array<{
    filename: string;
    mimeType: string;
    data: string;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    // Verify the request is from n8n (basic security)
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.N8N_WEBHOOK_TOKEN;
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    console.log('Received webhook from n8n:', body);

    // Process the email data
    const emailData: EmailData = {
      id: body.id || body.messageId,
      threadId: body.threadId,
      subject: body.subject,
      from: body.from || body.sender,
      to: body.to || body.recipient,
      body: body.body || body.content || body.text,
      timestamp: body.timestamp || body.date || new Date().toISOString(),
      attachments: body.attachments || []
    };

    // Here you can add your email processing logic
    // For example:
    // - Store email in database
    // - Trigger automated responses
    // - Process attachments
    // - Apply business logic

    console.log('Processed email data:', emailData);

    // For now, just acknowledge receipt
    return NextResponse.json({
      success: true,
      message: 'Email webhook processed successfully',
      emailId: emailData.id,
      processed: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error processing n8n webhook:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process webhook',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Optional: Handle GET requests for webhook verification
export async function GET() {
  return NextResponse.json({
    message: 'n8n Email Webhook Endpoint',
    status: 'active',
    timestamp: new Date().toISOString()
  });
}
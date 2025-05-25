import { NextRequest, NextResponse } from 'next/server';

// Import the same maps from the QR route (in a real app, you'd use a shared store)
const clientStatus = new Map<string, 'connecting' | 'qr' | 'ready' | 'disconnected'>();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId') || 'default';

  const status = clientStatus.get(sessionId) || 'disconnected';
  
  return NextResponse.json({ 
    sessionId,
    status,
    timestamp: new Date().toISOString()
  });
} 
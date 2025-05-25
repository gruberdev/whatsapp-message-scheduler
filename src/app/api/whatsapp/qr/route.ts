import { NextRequest, NextResponse } from 'next/server';

interface QRResponse {
  status: 'connecting' | 'qr' | 'ready' | 'disconnected';
  qrCode?: string;
  sessionId?: string;
  message?: string;
  error?: string;
}

// Simple in-memory storage for demo purposes
const sessions = new Map<string, {
  status: 'connecting' | 'qr' | 'ready' | 'disconnected';
  qrCode?: string;
  client?: any;
}>();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId') || 'default';

  try {
    // Try to dynamically import whatsapp-web.js only on server side
    let Client, LocalAuth, QRCode;
    
    try {
      const whatsappModule = await import('whatsapp-web.js');
      Client = whatsappModule.Client;
      LocalAuth = whatsappModule.LocalAuth;
      
      const qrcodeModule = await import('qrcode');
      QRCode = qrcodeModule.default;
    } catch (importError) {
      console.error('Failed to import WhatsApp modules:', importError);
      return NextResponse.json({
        error: 'WhatsApp modules not available',
        status: 'disconnected',
        sessionId
      } as QRResponse, { status: 500 });
    }

    // Check existing session
    let session = sessions.get(sessionId);
    
    if (!session) {
      // Create new session
      session = {
        status: 'connecting'
      };
      sessions.set(sessionId, session);

      try {
        const client = new Client({
          authStrategy: new LocalAuth({
            clientId: sessionId
          }),
          puppeteer: {
            headless: true,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-accelerated-2d-canvas',
              '--no-first-run',
              '--no-zygote',
              '--single-process',
              '--disable-gpu'
            ]
          }
        });

        session.client = client;

        // Set up event listeners
        client.on('qr', async (qr: string) => {
          try {
            const qrCodeDataUrl = await QRCode.toDataURL(qr, {
              width: 280,
              margin: 2,
              color: {
                dark: '#000000',
                light: '#FFFFFF'
              }
            });
            
            if (session) {
              session.qrCode = qrCodeDataUrl;
              session.status = 'qr';
            }
            
            console.log(`QR Code generated for session: ${sessionId}`);
          } catch (error) {
            console.error('Error generating QR code:', error);
          }
        });

        client.on('ready', () => {
          console.log(`WhatsApp client ready for session: ${sessionId}`);
          if (session) {
            session.status = 'ready';
            session.qrCode = undefined;
          }
        });

        client.on('authenticated', () => {
          console.log(`WhatsApp client authenticated for session: ${sessionId}`);
        });

        client.on('auth_failure', (msg: any) => {
          console.error(`Authentication failed for session ${sessionId}:`, msg);
          if (session) {
            session.status = 'disconnected';
            session.qrCode = undefined;
          }
        });

        client.on('disconnected', (reason: any) => {
          console.log(`WhatsApp client disconnected for session ${sessionId}:`, reason);
          sessions.delete(sessionId);
        });

        // Initialize the client
        await client.initialize();

      } catch (clientError) {
        console.error('Error creating WhatsApp client:', clientError);
        session.status = 'disconnected';
      }
    }

    const response: QRResponse = { 
      status: session.status,
      sessionId 
    };

    if (session.status === 'qr' && session.qrCode) {
      response.qrCode = session.qrCode;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in WhatsApp QR endpoint:', error);
    return NextResponse.json({
      error: 'Failed to initialize WhatsApp client',
      status: 'disconnected',
      sessionId
    } as QRResponse, { status: 500 });
  }
} 
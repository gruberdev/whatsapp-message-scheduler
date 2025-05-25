// Only import whatsapp-web.js on the server side
let Client: any;
let LocalAuth: any;
let QRCode: any;

// Dynamic imports to avoid issues with Next.js
const initializeModules = async () => {
  if (typeof window === 'undefined') {
    // Server-side only
    try {
      const whatsappModule = await import('whatsapp-web.js');
      Client = whatsappModule.Client;
      LocalAuth = whatsappModule.LocalAuth;
      
      const qrcodeModule = await import('qrcode');
      QRCode = qrcodeModule.default;
    } catch (error) {
      console.error('Failed to load WhatsApp modules:', error);
      throw error;
    }
  }
};

export interface WhatsAppSession {
  client: any;
  status: 'connecting' | 'qr' | 'ready' | 'disconnected';
  qrCode?: string;
  lastActivity: Date;
}

class WhatsAppService {
  private sessions = new Map<string, WhatsAppSession>();
  private initialized = false;

  async initialize() {
    if (!this.initialized) {
      await initializeModules();
      this.initialized = true;
    }
  }

  async getOrCreateSession(sessionId: string): Promise<WhatsAppSession> {
    await this.initialize();

    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!;
    }

    if (!Client || !LocalAuth) {
      throw new Error('WhatsApp modules not loaded');
    }

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

    const session: WhatsAppSession = {
      client,
      status: 'connecting',
      lastActivity: new Date()
    };

    // Set up event listeners
    client.on('qr', async (qr: string) => {
      try {
        if (!QRCode) {
          throw new Error('QRCode module not loaded');
        }

        const qrCodeDataUrl = await QRCode.toDataURL(qr, {
          width: 280,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        
        session.qrCode = qrCodeDataUrl;
        session.status = 'qr';
        session.lastActivity = new Date();
        
        console.log(`QR Code generated for session: ${sessionId}`);
      } catch (error) {
        console.error('Error generating QR code:', error);
      }
    });

    client.on('ready', () => {
      console.log(`WhatsApp client ready for session: ${sessionId}`);
      session.status = 'ready';
      session.qrCode = undefined;
      session.lastActivity = new Date();
    });

    client.on('authenticated', () => {
      console.log(`WhatsApp client authenticated for session: ${sessionId}`);
      session.lastActivity = new Date();
    });

    client.on('auth_failure', (msg: any) => {
      console.error(`Authentication failed for session ${sessionId}:`, msg);
      session.status = 'disconnected';
      session.qrCode = undefined;
      session.lastActivity = new Date();
    });

    client.on('disconnected', (reason: any) => {
      console.log(`WhatsApp client disconnected for session ${sessionId}:`, reason);
      session.status = 'disconnected';
      session.qrCode = undefined;
      session.lastActivity = new Date();
      this.sessions.delete(sessionId);
    });

    this.sessions.set(sessionId, session);
    
    // Initialize the client
    client.initialize();

    return session;
  }

  getSession(sessionId: string): WhatsAppSession | undefined {
    return this.sessions.get(sessionId);
  }

  async sendMessage(sessionId: string, to: string, message: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    
    if (!session || session.status !== 'ready') {
      throw new Error('WhatsApp client not ready');
    }

    try {
      await session.client.sendMessage(to, message);
      session.lastActivity = new Date();
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  // Clean up inactive sessions
  cleanupInactiveSessions(maxAgeMinutes: number = 30) {
    const now = new Date();
    for (const [sessionId, session] of this.sessions.entries()) {
      const ageMinutes = (now.getTime() - session.lastActivity.getTime()) / (1000 * 60);
      if (ageMinutes > maxAgeMinutes && session.status === 'disconnected') {
        this.sessions.delete(sessionId);
        console.log(`Cleaned up inactive session: ${sessionId}`);
      }
    }
  }
}

export const whatsappService = new WhatsAppService(); 
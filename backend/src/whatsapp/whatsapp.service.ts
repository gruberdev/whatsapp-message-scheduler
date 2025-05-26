import { Injectable, Logger } from '@nestjs/common';
import { Client, LocalAuth } from 'whatsapp-web.js';
import * as QRCode from 'qrcode';

export interface WhatsAppSession {
  id: string;
  status: 'connecting' | 'qr' | 'authenticating' | 'ready' | 'disconnected';
  client?: Client;
  qrCode?: string;
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private sessions = new Map<string, WhatsAppSession>();

  async createSession(sessionId: string): Promise<WhatsAppSession> {
    this.logger.log(`Creating WhatsApp session: ${sessionId}`);

    // Check if session already exists
    if (this.sessions.has(sessionId)) {
      const existingSession = this.sessions.get(sessionId);
      this.logger.log(`Returning existing session: ${sessionId} with status: ${existingSession.status}`);
      return existingSession;
    }

    // Create new session
    const session: WhatsAppSession = {
      id: sessionId,
      status: 'connecting'
    };

    this.sessions.set(sessionId, session);

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
          
          session.qrCode = qrCodeDataUrl;
          session.status = 'qr';
          
          this.logger.log(`QR Code generated for session: ${sessionId}`);
        } catch (error) {
          this.logger.error('Error generating QR code:', error);
        }
      });

      client.on('ready', () => {
        this.logger.log(`WhatsApp client ready for session: ${sessionId}`);
        session.status = 'ready';
        session.qrCode = undefined;
      });

      client.on('authenticated', () => {
        this.logger.log(`WhatsApp client authenticated for session: ${sessionId}`);
        session.status = 'authenticating';
        session.qrCode = undefined; // Clear QR code once authenticated
      });

      client.on('auth_failure', (msg: any) => {
        this.logger.error(`Authentication failed for session ${sessionId}:`, msg);
        session.status = 'disconnected';
        session.qrCode = undefined;
      });

      client.on('disconnected', (reason: any) => {
        this.logger.log(`WhatsApp client disconnected for session ${sessionId}:`, reason);
        this.sessions.delete(sessionId);
      });

      // Initialize the client
      await client.initialize();

      // Check if client is already authenticated (for session restoration)
      if (client.info) {
        this.logger.log(`Session ${sessionId} restored from existing authentication`);
        session.status = 'ready';
      }

    } catch (error) {
      this.logger.error('Error creating WhatsApp client:', error);
      session.status = 'disconnected';
    }

    return session;
  }

  getSession(sessionId: string): WhatsAppSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): WhatsAppSession[] {
    return Array.from(this.sessions.values());
  }

  async sendMessage(sessionId: string, to: string, message: string): Promise<any> {
    const session = this.sessions.get(sessionId);
    
    if (!session || !session.client || session.status !== 'ready') {
      throw new Error('WhatsApp session not ready');
    }

    try {
      // Format phone number (ensure it has country code)
      const formattedNumber = to.includes('@c.us') ? to : `${to}@c.us`;
      
      const result = await session.client.sendMessage(formattedNumber, message);
      this.logger.log(`Message sent successfully to ${to}`);
      return result;
    } catch (error) {
      this.logger.error(`Error sending message to ${to}:`, error);
      throw error;
    }
  }

  async disconnectSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    
    if (session && session.client) {
      try {
        await session.client.destroy();
        this.logger.log(`Session ${sessionId} disconnected`);
      } catch (error) {
        this.logger.error(`Error disconnecting session ${sessionId}:`, error);
      }
    }
    
    this.sessions.delete(sessionId);
  }

  async disconnectAllSessions(): Promise<void> {
    const sessionIds = Array.from(this.sessions.keys());
    
    for (const sessionId of sessionIds) {
      await this.disconnectSession(sessionId);
    }
  }
}

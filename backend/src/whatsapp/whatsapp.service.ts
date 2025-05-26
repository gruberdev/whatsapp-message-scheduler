import { Injectable, Logger } from '@nestjs/common';
import { Client, LocalAuth, Chat, Message } from 'whatsapp-web.js';
import * as QRCode from 'qrcode';

export interface WhatsAppSession {
  id: string;
  status: 'connecting' | 'qr' | 'authenticating' | 'ready' | 'disconnected';
  client?: Client;
  qrCode?: string;
}

export interface WhatsAppChat {
  id: string;
  name: string;
  isGroup: boolean;
  lastMessage?: {
    body: string;
    timestamp: number;
    fromMe: boolean;
  };
  unreadCount: number;
  profilePicUrl?: string;
}

export interface WhatsAppMessage {
  id: string;
  body: string;
  timestamp: number;
  fromMe: boolean;
  author?: string;
  type: string;
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private sessions = new Map<string, WhatsAppSession>();
  private lastSeenMessages = new Map<string, Map<string, number>>(); // sessionId -> chatId -> timestamp
  private chatCache = new Map<string, { chats: any[], timestamp: number }>(); // sessionId -> cached chats

  constructor() {}

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

      // Simple message logging (no WebSocket broadcasting)
      client.on('message', async (message: any) => {
        this.logger.log(`New message received in session ${sessionId} from ${message.from}`);
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
      
      // Invalidate chat cache since we sent a message
      this.chatCache.delete(sessionId);
      
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

  async forceCleanupSession(sessionId: string): Promise<void> {
    this.logger.log(`Force cleaning up session: ${sessionId}`);
    const session = this.sessions.get(sessionId);
    
    if (session && session.client) {
      try {
        // Force destroy without waiting
        session.client.destroy();
      } catch (error) {
        this.logger.error(`Error force destroying session ${sessionId}:`, error);
      }
    }
    
    this.sessions.delete(sessionId);
    this.chatCache.delete(sessionId); // Clear cache too
    this.logger.log(`Session ${sessionId} force cleaned up`);
  }

  // Method to refresh chat cache
  refreshChatCache(sessionId: string): void {
    this.chatCache.delete(sessionId);
    this.logger.log(`Chat cache refreshed for session: ${sessionId}`);
  }

  async disconnectAllSessions(): Promise<void> {
    const sessionIds = Array.from(this.sessions.keys());
    
    for (const sessionId of sessionIds) {
      await this.disconnectSession(sessionId);
    }
  }

  async getChats(sessionId: string, offset: number = 0, limit: number = 20): Promise<{ chats: WhatsAppChat[], hasMore: boolean, total: number }> {
    const session = this.sessions.get(sessionId);
    
    if (!session || !session.client || session.status !== 'ready') {
      throw new Error('WhatsApp session not ready');
    }

    try {
      this.logger.log(`Getting chats for session ${sessionId} (offset: ${offset}, limit: ${limit})`);
      
      let allChats: any[];
      const cacheKey = sessionId;
      const cached = this.chatCache.get(cacheKey);
      const cacheAge = cached ? Date.now() - cached.timestamp : Infinity;
      const CACHE_DURATION = 30000; // 30 seconds cache
      
      // Use cache if it's fresh, otherwise fetch new data
      if (cached && cacheAge < CACHE_DURATION) {
        this.logger.log(`Using cached chats for session ${sessionId} (age: ${Math.round(cacheAge/1000)}s)`);
        allChats = cached.chats;
      } else {
        this.logger.log(`Fetching fresh chats for session ${sessionId}`);
        allChats = await session.client.getChats();
        this.logger.log(`Fetched ${allChats.length} total chats from WhatsApp`);
        
        // Sort and cache
        allChats.sort((a, b) => {
          const aTime = a.lastMessage?.timestamp || 0;
          const bTime = b.lastMessage?.timestamp || 0;
          return bTime - aTime;
        });
        
        // Cache the sorted chats
        this.chatCache.set(cacheKey, {
          chats: allChats,
          timestamp: Date.now()
        });
      }

      // Apply pagination efficiently
      const paginatedChats = allChats.slice(offset, offset + limit);
      
      // Initialize lastSeenMessages for this session if it doesn't exist
      if (!this.lastSeenMessages.has(sessionId)) {
        this.lastSeenMessages.set(sessionId, new Map());
      }

      const formattedChats: WhatsAppChat[] = paginatedChats.map((chat: Chat) => {
        const chatId = chat.id._serialized;
        const sessionLastSeen = this.lastSeenMessages.get(sessionId);
        const lastSeenTimestamp = sessionLastSeen?.get(chatId) || 0; // Default to 0 for new chats
        
        // Simple unread detection: if last message is not from me and newer than last seen
        let unreadCount = 0;
        if (chat.lastMessage && !chat.lastMessage.fromMe) {
          const lastMessageTimestamp = chat.lastMessage.timestamp * 1000;
          if (lastMessageTimestamp > lastSeenTimestamp) {
            unreadCount = 1; // Show at least 1 unread message indicator
          }
        }
        
        return {
          id: chatId,
          name: chat.name || chat.id.user,
          isGroup: chat.isGroup,
          lastMessage: chat.lastMessage ? {
            body: chat.lastMessage.body,
            timestamp: chat.lastMessage.timestamp * 1000, // Convert to milliseconds
            fromMe: chat.lastMessage.fromMe
          } : undefined,
          unreadCount,
          profilePicUrl: undefined // We'll load this lazily on the frontend
        };
      });

      const hasMore = offset + limit < allChats.length;
      
      this.logger.log(`Returning ${formattedChats.length} chats (${offset}-${offset + formattedChats.length} of ${allChats.length})`);
      
      return {
        chats: formattedChats,
        hasMore,
        total: allChats.length
      };
    } catch (error) {
      this.logger.error(`Error getting chats for session ${sessionId}:`, error);
      throw error;
    }
  }

  async getMessages(sessionId: string, chatId: string, limit: number = 50): Promise<WhatsAppMessage[]> {
    const session = this.sessions.get(sessionId);
    
    if (!session || !session.client || session.status !== 'ready') {
      throw new Error('WhatsApp session not ready');
    }

    try {
      const chat = await session.client.getChatById(chatId);
      const messages = await chat.fetchMessages({ limit });

      const formattedMessages: WhatsAppMessage[] = messages.map((message: Message) => ({
        id: message.id._serialized,
        body: message.body,
        timestamp: message.timestamp * 1000, // Convert to milliseconds
        fromMe: message.fromMe,
        author: message.author || message.from,
        type: message.type
      }));

      // fetchMessages returns newest first, but we want newest at bottom for chat display
      // So we keep the reverse to show oldest first, then newest at bottom
      // Actually, let's sort properly: oldest first (bottom of array = newest messages)
      formattedMessages.sort((a, b) => a.timestamp - b.timestamp);

      this.logger.log(`Retrieved ${formattedMessages.length} messages for chat ${chatId} in session: ${sessionId}`);
      return formattedMessages;
    } catch (error) {
      this.logger.error(`Error getting messages for chat ${chatId} in session ${sessionId}:`, error);
      throw error;
    }
  }

  async getProfilePicture(sessionId: string, chatId: string): Promise<string | null> {
    const session = this.sessions.get(sessionId);
    
    if (!session || !session.client || session.status !== 'ready') {
      throw new Error('WhatsApp session not ready');
    }

    try {
      const profilePicUrl = await session.client.getProfilePicUrl(chatId);
      return profilePicUrl || null;
    } catch (error) {
      // Profile pic might not be available
      this.logger.debug(`No profile picture available for chat ${chatId}`);
      return null;
    }
  }

  async markChatAsRead(sessionId: string, chatId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    
    if (!session || !session.client || session.status !== 'ready') {
      throw new Error('WhatsApp session not ready');
    }

    try {
      const chat = await session.client.getChatById(chatId);
      await chat.sendSeen();
      
      // Track the last seen timestamp for this chat
      if (!this.lastSeenMessages.has(sessionId)) {
        this.lastSeenMessages.set(sessionId, new Map());
      }
      
      const sessionLastSeen = this.lastSeenMessages.get(sessionId);
      const currentTime = Date.now();
      sessionLastSeen.set(chatId, currentTime);
      

      
      this.logger.log(`Marked chat ${chatId} as read in session: ${sessionId}`);
    } catch (error) {
      this.logger.error(`Error marking chat ${chatId} as read in session ${sessionId}:`, error);
      throw error;
    }
  }

  // Test method removed - using polling instead of WebSocket

  // Debug method to check client state
  debugClientState(sessionId: string): any {
    const session = this.sessions.get(sessionId);
    
    if (!session || !session.client) {
      return { error: 'Session or client not found' };
    }

    const client = session.client;
    
    return {
      sessionId,
      status: session.status,
      clientInfo: client.info ? {
        wid: client.info.wid,
        pushname: client.info.pushname,
        platform: client.info.platform
      } : null,
      isReady: client.info ? true : false,
      pupPage: client.pupPage ? 'exists' : 'null',
      pupBrowser: client.pupBrowser ? 'exists' : 'null'
    };
  }
}

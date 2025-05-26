import { Injectable, Logger } from '@nestjs/common';
import { Client, LocalAuth, Chat, Message, MessageTypes } from 'whatsapp-web.js';
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
  authorName?: string; // Display name for group messages
  authorNumber?: string; // Formatted phone number (only for non-contacts)
  isContact?: boolean; // Whether the author is in user's contacts
  type: string;
  mediaData?: {
    data: string; // Base64 encoded media data
    mimetype: string;
    filename?: string;
  };
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private sessions = new Map<string, WhatsAppSession>();
  private lastSeenMessages = new Map<string, Map<string, number>>(); // sessionId -> chatId -> timestamp
  private chatCache = new Map<string, { chats: any[], timestamp: number }>(); // sessionId -> cached chats
  private lastFetchTime = new Map<string, number>(); // sessionId -> last fetch timestamp for rate limiting

  constructor() {}

  private formatPhoneNumber(rawNumber: string): string {
    // Remove any non-digit characters
    const digits = rawNumber.replace(/\D/g, '');
    
    // Add + prefix if not present
    if (!digits.startsWith('+')) {
      return `+${digits}`;
    }
    
    return digits;
  }

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
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-extensions',
            '--disable-default-apps',
            '--use-gl=swiftshader',
            '--mute-audio'
          ],
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser'
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
          
          this.logger.log(`QR Code generated for session: ${sessionId}`, {
            qrLength: qrCodeDataUrl.length,
            status: session.status,
            hasQR: !!session.qrCode
          });
        } catch (error) {
          this.logger.error('Error generating QR code:', error);
          // Set a fallback QR code status without the actual QR
          session.status = 'qr';
          session.qrCode = null;
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

      client.on('loading_screen', (percent, message) => {
        this.logger.log(`Loading screen for session ${sessionId}: ${percent}% - ${message}`);
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
      this.logger.log(`Initializing WhatsApp client for session: ${sessionId}`);
      this.logger.debug('Current session state:', {
        sessionId,
        status: session.status,
        hasQR: !!session.qrCode,
        hasClient: !!session.client
      });
      
      // Set a timeout to prevent getting stuck in connecting state
      const initTimeout = setTimeout(() => {
        if (session.status === 'connecting') {
          this.logger.warn(`Session ${sessionId} stuck in connecting state, forcing QR generation`);
          session.status = 'qr';
        }
      }, 30000); // 30 seconds timeout

      // Clear timeout when status changes
      const originalStatus = session.status;
      const checkStatusChange = setInterval(() => {
        if (session.status !== originalStatus && session.status !== 'connecting') {
          clearTimeout(initTimeout);
          clearInterval(checkStatusChange);
        }
      }, 1000);

      await client.initialize();

      // The status will be updated by the event listeners
      // No need to manually check client.info here as it may not be immediately available

    } catch (error) {
      this.logger.error('Error creating WhatsApp client:', error);
      session.status = 'disconnected';
    }

    return session;
  }

  getSession(sessionId: string): WhatsAppSession | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      return {
        id: session.id,
        status: session.status,
        qrCode: session.qrCode
      };
    }
    return undefined;
  }

  getAllSessions(): WhatsAppSession[] {
    return Array.from(this.sessions.values()).map(session => ({
      id: session.id,
      status: session.status,
      qrCode: session.qrCode
    }));
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
    this.chatCache.delete(sessionId); // Clear cache
    this.lastFetchTime.delete(sessionId); // Clear rate limiting data
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
    this.lastFetchTime.delete(sessionId); // Clear rate limiting data
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

  async getChats(sessionId: string, offset: number = 0, limit: number = 20, archived: boolean = false): Promise<{ chats: WhatsAppChat[], hasMore: boolean, total: number }> {
    const session = this.sessions.get(sessionId);
    
    if (!session || !session.client || session.status !== 'ready') {
      throw new Error('WhatsApp session not ready');
    }

    try {
      this.logger.log(`Getting chats for session ${sessionId} (offset: ${offset}, limit: ${limit})`);
      
      let allChats: any[];
      const cacheKey = `${sessionId}-${archived ? 'archived' : 'normal'}`;
      const cached = this.chatCache.get(cacheKey);
      const cacheAge = cached ? Date.now() - cached.timestamp : Infinity;
      const CACHE_DURATION = 120000; // 2 minutes cache to reduce WhatsApp API calls
      
      // Rate limiting: enforce minimum 30 seconds between fresh fetches
      const lastFetch = this.lastFetchTime.get(sessionId) || 0;
      const timeSinceLastFetch = Date.now() - lastFetch;
      const MIN_FETCH_INTERVAL = 30000; // 30 seconds minimum between fetches
      
      // Use cache if it's fresh OR if we're being rate limited
      if (cached && (cacheAge < CACHE_DURATION || timeSinceLastFetch < MIN_FETCH_INTERVAL)) {
        const reason = cacheAge < CACHE_DURATION ? 'fresh cache' : 'rate limiting';
        this.logger.log(`Using cached chats for session ${sessionId} (${reason}, age: ${Math.round(cacheAge/1000)}s, last fetch: ${Math.round(timeSinceLastFetch/1000)}s ago)`);
        allChats = cached.chats;
      } else {
        this.logger.log(`Fetching fresh chats for session ${sessionId} (cache age: ${Math.round(cacheAge/1000)}s, last fetch: ${Math.round(timeSinceLastFetch/1000)}s ago)`);
        
        // Check if the client is still valid before making the call
        if (!session.client.pupPage || session.client.pupPage.isClosed()) {
          this.logger.error(`Session ${sessionId} has invalid or closed browser page`);
          await this.forceCleanupSession(sessionId);
          throw new Error('WhatsApp session has been disconnected. Please reconnect.');
        }
        
        // Update last fetch time BEFORE making the request to prevent concurrent requests
        this.lastFetchTime.set(sessionId, Date.now());
        
        // Add timeout to prevent hanging
        const FETCH_TIMEOUT = 15000; // Increased to 15 seconds to give WhatsApp more time
        
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Timeout: WhatsApp took too long to respond. Please try again.'));
          }, FETCH_TIMEOUT);
        });
        
        try {
          this.logger.log(`Starting to fetch ${archived ? 'archived' : 'normal'} chats for session ${sessionId}...`);
          const fetchChatsPromise = archived ? 
            session.client.getChats().then((chats: any[]) => chats.filter((chat: any) => chat.archived)) :
            session.client.getChats().then((chats: any[]) => chats.filter((chat: any) => !chat.archived));
          
          allChats = await Promise.race([fetchChatsPromise, timeoutPromise]) as any[];
          this.logger.log(`Successfully fetched ${allChats.length} total ${archived ? 'archived' : 'normal'} chats from WhatsApp`);
          
          // Reset rate limiting on successful fetch
          this.lastFetchTime.set(sessionId, Date.now());
        } catch (timeoutError) {
          this.logger.error(`Timeout fetching chats for session ${sessionId}:`, timeoutError.message);
          
          // Implement exponential backoff - increase the minimum interval for this session
          const currentInterval = MIN_FETCH_INTERVAL;
          const backoffInterval = Math.min(currentInterval * 2, 300000); // Max 5 minutes
          this.lastFetchTime.set(sessionId, Date.now() + backoffInterval - MIN_FETCH_INTERVAL);
          this.logger.warn(`Applied exponential backoff for session ${sessionId}: ${Math.round(backoffInterval/1000)}s`);
          
          // If it's a timeout, try to use cached data if available
          if (cached) {
            this.logger.log(`Using stale cached chats due to timeout for session ${sessionId} (age: ${Math.round(cacheAge/1000)}s)`);
            allChats = cached.chats;
          } else {
            throw new Error('WhatsApp is rate limiting requests. Please wait a few minutes before trying again.');
          }
        }
        
        // Sort and cache only if we got fresh data
        if (!cached || allChats !== cached.chats) {
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
      }

      // Apply pagination efficiently
      const paginatedChats = allChats.slice(offset, offset + limit);
      
      // Initialize lastSeenMessages for this session if it doesn't exist
      if (!this.lastSeenMessages.has(sessionId)) {
        this.lastSeenMessages.set(sessionId, new Map());
      }

      const sessionLastSeen = this.lastSeenMessages.get(sessionId);
      const formattedChats: WhatsAppChat[] = paginatedChats.map((chat: Chat) => {
        const chatId = chat.id._serialized;
        
        // Use WhatsApp's built-in unread count, but allow manual override from markChatAsRead
        let unreadCount = chat.unreadCount || 0;
        
        // If we have manually marked this chat as read, override the unread count
        const lastSeenTimestamp = sessionLastSeen?.get(chatId);
        if (lastSeenTimestamp && chat.lastMessage && !chat.lastMessage.fromMe) {
          const lastMessageTimestamp = chat.lastMessage.timestamp * 1000;
          if (lastMessageTimestamp <= lastSeenTimestamp) {
            unreadCount = 0; // Override to 0 if we've manually marked as read
          }
        }
        
        // Format last message body for different types (keep simple for chat list)
        let lastMessageBody = chat.lastMessage?.body || '';
        if (chat.lastMessage) {
          if (chat.lastMessage.type === MessageTypes.STICKER) {
            lastMessageBody = 'Sticker';
          } else if (chat.lastMessage.type === MessageTypes.IMAGE) {
            lastMessageBody = lastMessageBody || 'Image';
          } else if (chat.lastMessage.type === MessageTypes.VIDEO) {
            lastMessageBody = lastMessageBody || 'Video';
          } else if (chat.lastMessage.type === MessageTypes.AUDIO || chat.lastMessage.type === MessageTypes.VOICE) {
            lastMessageBody = lastMessageBody || 'Audio';
          } else if (chat.lastMessage.type === MessageTypes.DOCUMENT) {
            lastMessageBody = lastMessageBody || 'Document';
          } else if (chat.lastMessage.type === MessageTypes.LOCATION) {
            lastMessageBody = lastMessageBody || 'Location';
          } else if (chat.lastMessage.type === MessageTypes.CONTACT_CARD || chat.lastMessage.type === MessageTypes.CONTACT_CARD_MULTI) {
            lastMessageBody = lastMessageBody || 'Contact';
          }
        }

        return {
          id: chatId,
          name: chat.name || chat.id.user,
          isGroup: chat.isGroup,
          lastMessage: chat.lastMessage ? {
            body: lastMessageBody,
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
      
      // Check if this is a session closed error
      if (error.message && error.message.includes('Session closed')) {
        this.logger.warn(`Detected closed session ${sessionId}, cleaning up`);
        await this.forceCleanupSession(sessionId);
        throw new Error('WhatsApp session has been disconnected. Please reconnect.');
      }
      
      throw error;
    }
  }

  async getMessages(sessionId: string, chatId: string, limit: number = 50, includeMedia: boolean = true): Promise<WhatsAppMessage[]> {
    const session = this.sessions.get(sessionId);
    
    if (!session || !session.client || session.status !== 'ready') {
      throw new Error('WhatsApp session not ready');
    }

    try {
      // Check if the client is still valid before making the call
      if (!session.client.pupPage || session.client.pupPage.isClosed()) {
        this.logger.error(`Session ${sessionId} has invalid or closed browser page`);
        await this.forceCleanupSession(sessionId);
        throw new Error('WhatsApp session has been disconnected. Please reconnect.');
      }

      const chat = await session.client.getChatById(chatId);
      
      // Add timeout to prevent hanging when fetching messages
      const FETCH_TIMEOUT = 5000; // Reduced to 5 seconds timeout for faster UX
      const fetchMessagesPromise = chat.fetchMessages({ limit });
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Timeout: WhatsApp took too long to fetch messages. Please try again.'));
        }, FETCH_TIMEOUT);
      });
      
      const messages = await Promise.race([fetchMessagesPromise, timeoutPromise]) as any[];

      const formattedMessages: WhatsAppMessage[] = await Promise.all(
        messages.map(async (message: Message) => {
          let authorName: string | undefined;
          let authorNumber: string | undefined;
          
          // For group messages that are not from me, get the contact name and number
          if (chat.isGroup && !message.fromMe && message.author) {
            try {
              const contact = await session.client.getContactById(message.author);
              const rawNumber = message.author.replace('@c.us', '');
              const formattedNumber = this.formatPhoneNumber(rawNumber);
              
              // Check if this person is in contacts (has a saved name)
              const isInContacts = !!(contact.name || contact.pushname);
              
              if (isInContacts) {
                // Person is in contacts - show just their contact name
                const contactName = contact.name || contact.pushname;
                authorName = contactName;
                authorNumber = undefined; // Don't show separate number line
              } else {
                // Person is NOT in contacts - show "~ pushname +number" format like official WhatsApp
                const pushname = contact.pushname || 'Unknown';
                authorName = `~ ${pushname} ${formattedNumber}`;
                authorNumber = undefined; // Don't show separate number line
              }
            } catch (error) {
              // If we can't get contact info, treat as non-contact
              const rawNumber = message.author.replace('@c.us', '');
              const formattedNumber = this.formatPhoneNumber(rawNumber);
              authorName = formattedNumber;
              authorNumber = undefined;
            }
          }

          // Handle different message types and media
          let displayBody = message.body;
          let mediaData = null;
          
          // For media messages, try to get the media data (only if requested)
          if (includeMedia && (message.type === MessageTypes.STICKER || 
              message.type === MessageTypes.IMAGE || 
              message.type === MessageTypes.VIDEO)) {
            try {
              if (message.hasMedia) {
                const media = await message.downloadMedia();
                if (media) {
                  mediaData = {
                    data: media.data,
                    mimetype: media.mimetype,
                    filename: media.filename
                  };
                }
              }
            } catch (error) {
              this.logger.warn(`Failed to download media for message ${message.id._serialized}:`, error.message);
            }
          }
          
          // Set display text for different message types
          if (message.type === MessageTypes.STICKER) {
            displayBody = mediaData ? '' : '🎭 Sticker'; // Empty body if we have media data
          } else if (message.type === MessageTypes.IMAGE) {
            displayBody = displayBody || '📷 Image';
          } else if (message.type === MessageTypes.VIDEO) {
            displayBody = displayBody || '🎥 Video';
          } else if (message.type === MessageTypes.AUDIO || message.type === MessageTypes.VOICE) {
            displayBody = displayBody || '🎵 Audio';
          } else if (message.type === MessageTypes.DOCUMENT) {
            displayBody = displayBody || '📄 Document';
          } else if (message.type === MessageTypes.LOCATION) {
            displayBody = displayBody || '📍 Location';
          } else if (message.type === MessageTypes.CONTACT_CARD || message.type === MessageTypes.CONTACT_CARD_MULTI) {
            displayBody = displayBody || '👤 Contact';
          }

          return {
            id: message.id._serialized,
            body: displayBody,
            timestamp: message.timestamp * 1000, // Convert to milliseconds
            fromMe: message.fromMe,
            author: message.author || message.from,
            authorName,
            authorNumber,
            type: message.type,
            mediaData
          };
        })
      );

      // fetchMessages returns newest first, but we want newest at bottom for chat display
      // So we keep the reverse to show oldest first, then newest at bottom
      // Actually, let's sort properly: oldest first (bottom of array = newest messages)
      formattedMessages.sort((a, b) => a.timestamp - b.timestamp);

      this.logger.log(`Retrieved ${formattedMessages.length} messages for chat ${chatId} in session: ${sessionId}`);
      return formattedMessages;
    } catch (error) {
      this.logger.error(`Error getting messages for chat ${chatId} in session ${sessionId}:`, error);
      
      // Check if this is a session closed error
      if (error.message && error.message.includes('Session closed')) {
        this.logger.warn(`Detected closed session ${sessionId}, cleaning up`);
        await this.forceCleanupSession(sessionId);
        throw new Error('WhatsApp session has been disconnected. Please reconnect.');
      }
      
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

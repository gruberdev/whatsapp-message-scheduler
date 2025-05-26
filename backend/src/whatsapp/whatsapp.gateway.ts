import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';

@WebSocketGateway({
  cors: {
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://localhost:3002', // In case frontend runs on different port
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class WhatsappGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WhatsappGateway.name);

  constructor(
    @Inject(forwardRef(() => WhatsappService))
    private readonly whatsappService: WhatsappService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-session')
  async handleJoinSession(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { sessionId } = data;
    this.logger.log(`Client ${client.id} joining session: ${sessionId}`);
    
    // Join the client to a room for this session
    await client.join(`session-${sessionId}`);
    
    // Send current session status
    const session = this.whatsappService.getSession(sessionId);
    if (session) {
      client.emit('session-status', {
        sessionId,
        status: session.status,
        qrCode: session.qrCode,
      });
    }

    // Send a test event to confirm connection
    client.emit('connection-test', {
      message: 'Socket.IO connection established',
      sessionId,
      timestamp: Date.now(),
    });
  }

  @SubscribeMessage('leave-session')
  async handleLeaveSession(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { sessionId } = data;
    this.logger.log(`Client ${client.id} leaving session: ${sessionId}`);
    
    await client.leave(`session-${sessionId}`);
  }

  @SubscribeMessage('get-session-status')
  async handleGetSessionStatus(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { sessionId } = data;
    const session = this.whatsappService.getSession(sessionId);
    
    client.emit('session-status', {
      sessionId,
      status: session?.status || 'disconnected',
      qrCode: session?.qrCode,
    });
  }

  // Method to broadcast session updates to all clients in a session room
  broadcastSessionUpdate(sessionId: string, status: string, qrCode?: string) {
    this.server.to(`session-${sessionId}`).emit('session-status', {
      sessionId,
      status,
      qrCode,
    });
  }

  // Method to broadcast message status updates
  broadcastMessageStatus(sessionId: string, messageId: string, status: string) {
    this.server.to(`session-${sessionId}`).emit('message-status', {
      sessionId,
      messageId,
      status,
    });
  }

  // Method to broadcast new messages in real-time
  broadcastNewMessage(sessionId: string, message: any) {
    this.logger.log(`Broadcasting new message for session ${sessionId} in chat ${message.chatId}`);
    this.server.to(`session-${sessionId}`).emit('new-message', {
      sessionId,
      message,
    });
  }

  // Method to broadcast chat list updates
  broadcastChatListUpdate(sessionId: string) {
    this.logger.log(`Broadcasting chat list update for session ${sessionId}`);
    this.server.to(`session-${sessionId}`).emit('chat-list-update', {
      sessionId,
    });
  }
}

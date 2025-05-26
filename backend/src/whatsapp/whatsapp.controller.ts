import { Controller, Get, Post, Body, Query, HttpException, HttpStatus } from '@nestjs/common';
import { WhatsappService, WhatsAppSession, WhatsAppChat, WhatsAppMessage } from './whatsapp.service';

interface QRResponse {
  status: 'connecting' | 'qr' | 'authenticating' | 'ready' | 'disconnected';
  qrCode?: string;
  sessionId: string;
  message?: string;
  error?: string;
}

interface SendMessageDto {
  sessionId: string;
  to: string;
  message: string;
}

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get('qr')
  async getQRCode(@Query('sessionId') sessionId?: string): Promise<QRResponse> {
    const id = sessionId || 'default';
    
    try {
      let session = this.whatsappService.getSession(id);
      
      if (!session) {
        session = await this.whatsappService.createSession(id);
      }

      const response: QRResponse = {
        status: session.status,
        sessionId: id
      };

      if (session.status === 'qr' && session.qrCode) {
        response.qrCode = session.qrCode;
      }

      return response;
    } catch (error) {
      throw new HttpException({
        error: 'Failed to initialize WhatsApp client',
        status: 'disconnected',
        sessionId: id
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('status')
  async getStatus(@Query('sessionId') sessionId?: string): Promise<QRResponse> {
    const id = sessionId || 'default';
    const session = this.whatsappService.getSession(id);

    if (!session) {
      return {
        status: 'disconnected',
        sessionId: id,
        message: 'Session not found'
      };
    }

    const response: QRResponse = {
      status: session.status,
      sessionId: id
    };

    if (session.status === 'qr' && session.qrCode) {
      response.qrCode = session.qrCode;
    }

    return response;
  }

  @Get('sessions')
  async getAllSessions(): Promise<WhatsAppSession[]> {
    return this.whatsappService.getAllSessions();
  }

  @Post('send')
  async sendMessage(@Body() sendMessageDto: SendMessageDto) {
    const { sessionId, to, message } = sendMessageDto;

    if (!sessionId || !to || !message) {
      throw new HttpException(
        'Missing required fields: sessionId, to, message',
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      const result = await this.whatsappService.sendMessage(sessionId, to, message);
      return {
        success: true,
        messageId: result.id?.id || result.id,
        message: 'Message sent successfully!'
      };
    } catch (error) {
      throw new HttpException({
        error: 'Failed to send message',
        details: error.message
      }, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('disconnect')
  async disconnectSession(@Body('sessionId') sessionId: string) {
    if (!sessionId) {
      throw new HttpException(
        'Missing sessionId',
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      await this.whatsappService.disconnectSession(sessionId);
      return {
        success: true,
        message: `Session ${sessionId} disconnected successfully`
      };
    } catch (error) {
      throw new HttpException({
        error: 'Failed to disconnect session',
        details: error.message
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('chats')
  async getChats(
    @Query('sessionId') sessionId?: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string
  ): Promise<{ chats: WhatsAppChat[], hasMore: boolean, total: number }> {
    const id = sessionId || 'default';
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    
    try {
      return await this.whatsappService.getChats(id, offsetNum, limitNum);
    } catch (error) {
      throw new HttpException({
        error: 'Failed to get chats',
        details: error.message
      }, HttpStatus.BAD_REQUEST);
    }
  }

  @Get('messages')
  async getMessages(
    @Query('sessionId') sessionId?: string,
    @Query('chatId') chatId?: string,
    @Query('limit') limit?: string
  ): Promise<WhatsAppMessage[]> {
    const id = sessionId || 'default';
    
    if (!chatId) {
      throw new HttpException(
        'Missing chatId parameter',
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      const messageLimit = limit ? parseInt(limit, 10) : 50;
      return await this.whatsappService.getMessages(id, chatId, messageLimit);
    } catch (error) {
      throw new HttpException({
        error: 'Failed to get messages',
        details: error.message
      }, HttpStatus.BAD_REQUEST);
    }
  }

  @Get('profile-picture')
  async getProfilePicture(
    @Query('sessionId') sessionId?: string,
    @Query('chatId') chatId?: string
  ): Promise<{ profilePicUrl: string | null }> {
    const id = sessionId || 'default';
    
    if (!chatId) {
      throw new HttpException(
        'Missing chatId parameter',
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      const profilePicUrl = await this.whatsappService.getProfilePicture(id, chatId);
      return { profilePicUrl };
    } catch (error) {
      throw new HttpException({
        error: 'Failed to get profile picture',
        details: error.message
      }, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('mark-read')
  async markChatAsRead(@Body() body: { sessionId: string; chatId: string }) {
    const { sessionId, chatId } = body;

    if (!sessionId || !chatId) {
      throw new HttpException(
        'Missing required fields: sessionId, chatId',
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      await this.whatsappService.markChatAsRead(sessionId, chatId);
      return {
        success: true,
        message: 'Chat marked as read successfully'
      };
    } catch (error) {
      throw new HttpException({
        error: 'Failed to mark chat as read',
        details: error.message
      }, HttpStatus.BAD_REQUEST);
    }
  }



  @Get('debug-state')
  async debugClientState(@Query('sessionId') sessionId?: string) {
    const id = sessionId || 'default';
    
    try {
      const debugInfo = this.whatsappService.debugClientState(id);
      return debugInfo;
    } catch (error) {
      throw new HttpException({
        error: 'Failed to get debug info',
        details: error.message
      }, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('force-cleanup')
  async forceCleanupSession(@Body('sessionId') sessionId: string) {
    if (!sessionId) {
      throw new HttpException(
        'Missing sessionId',
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      await this.whatsappService.forceCleanupSession(sessionId);
      return {
        success: true,
        message: `Session ${sessionId} force cleaned up`
      };
    } catch (error) {
      throw new HttpException({
        error: 'Failed to force cleanup session',
        details: error.message
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('refresh-cache')
  async refreshChatCache(@Body('sessionId') sessionId: string) {
    if (!sessionId) {
      throw new HttpException(
        'Missing sessionId',
        HttpStatus.BAD_REQUEST
      );
    }

    try {
      this.whatsappService.refreshChatCache(sessionId);
      return {
        success: true,
        message: `Chat cache refreshed for session ${sessionId}`
      };
    } catch (error) {
      throw new HttpException({
        error: 'Failed to refresh cache',
        details: error.message
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}

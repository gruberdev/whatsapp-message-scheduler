import { Controller, Get, Post, Body, Query, HttpException, HttpStatus } from '@nestjs/common';
import { WhatsappService, WhatsAppSession } from './whatsapp.service';

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
}

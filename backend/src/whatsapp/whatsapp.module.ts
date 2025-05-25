import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappGateway } from './whatsapp.gateway';

@Module({
  providers: [WhatsappService, WhatsappGateway],
  controllers: [WhatsappController]
})
export class WhatsappModule {}

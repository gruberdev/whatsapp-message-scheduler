import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Enable CORS for frontend communication
  const allowedOrigins = [
    'http://localhost:3000',
    'https://whatsapp-message-scheduler-frontend.vercel.app',
    process.env.FRONTEND_URL
  ].filter(Boolean); // Remove any undefined values

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Set global prefix for all routes
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3001;
  await app.listen(port);
  
  logger.log(`🚀 WhatsApp Message Scheduler Backend running on: http://localhost:${port}/api`);
}
bootstrap();

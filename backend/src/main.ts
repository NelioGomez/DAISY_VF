import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { RealtimeAdapter } from './realtime/realtime.adapter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api/v1');
  const origins = config.getOrThrow<string>('CORS_ORIGIN').split(',').map((o) => o.trim());
  app.enableCors({ origin: origins, credentials: true });
  app.useWebSocketAdapter(new RealtimeAdapter(app, origins));
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.enableShutdownHooks();

  const swagger = new DocumentBuilder()
    .setTitle('NORCOR Fueling System API')
    .setDescription('API REST — gestión comercial, administrativa y de inventario')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  new Logger('Bootstrap').log(`API en http://localhost:${port}/api/v1 — Swagger en /api/docs — WebSocket en /socket.io`);
}

void bootstrap();

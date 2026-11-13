import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { UPLOADS_PREFIX, uploadsRoot } from './products/product-images';
import { RealtimeAdapter } from './realtime/realtime.adapter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api/v1');
    // IP real del cliente detrás de un proxy (va en X-Forwarded-For).
  // Sin TRUST_PROXY (local / SmarterASP): solo se confía en el proxy local ('loopback').
  // En Render: TRUST_PROXY=true, si no todos los usuarios comparten el límite de peticiones.
  const trustProxy = process.env.TRUST_PROXY?.trim();
  app.set(
    'trust proxy',
    !trustProxy ? 'loopback' : trustProxy === 'true' ? true : /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy,
  );
  // Fotos de productos subidas desde el sistema (mejora n.° 4): archivos estáticos públicos para
  // que el catálogo web también las muestre. Nombres únicos: se pueden guardar en caché.
  app.useStaticAssets(uploadsRoot(), {
    prefix: UPLOADS_PREFIX,
    index: false,
    dotfiles: 'deny',
    maxAge: '30d',
    immutable: true,
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  });
  serveFrontend(app);
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
  // 0.0.0.0: acepta conexiones de fuera del contenedor (Docker / Railway).
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`API en http://localhost:${port}/api/v1 — Swagger en /api/docs — WebSocket en /socket.io`);
}

/** Despliegue en un solo sitio (SmarterASP.NET u otro hosting): si existe la carpeta del frontend
    compilado (FRONTEND_DIR o ./public con index.html), la API también sirve la aplicación web.
    Los archivos con hash de /assets se guardan en caché un año; index.html nunca, para que cada
    publicación se vea de inmediato. Cualquier ruta GET que no sea de la API ni un archivo devuelve
    index.html (rutas de React Router como /app/ventas o /catalogo). En desarrollo no hay carpeta y
    el frontend lo sirve Vite como siempre. */
function serveFrontend(app: NestExpressApplication): void {
  const dir = resolve(process.env.FRONTEND_DIR || join(process.cwd(), 'public'));
  const index = join(dir, 'index.html');
  if (!existsSync(index)) return;
  app.useStaticAssets(dir, {
    index: false,
    dotfiles: 'deny',
    setHeaders: (res, path) =>
      res.setHeader('Cache-Control', /[\\/]assets[\\/]/.test(path) ? 'public, max-age=31536000, immutable' : 'no-cache'),
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || /^\/(api|socket\.io)(\/|$)/.test(req.path) || /\.[a-z0-9]+$/i.test(req.path)) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(index);
  });
  new Logger('Bootstrap').log(`Sirviendo el frontend desde ${dir}`);
}

void bootstrap();

import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import type { AuthUser } from '../interfaces/auth-user.interface';

export type HttpLogMode = 'off' | 'changes' | 'all';

/**
 * Una línea por petición en la terminal, al terminar la respuesta:
 *   POST /api/v1/sales → 201 · @jflores · 84 ms
 *
 * LOG_HTTP=changes (por defecto): solo POST/PATCH/PUT/DELETE y cualquier error.
 * LOG_HTTP=all: también las consultas GET.  LOG_HTTP=off: nada.
 * Nunca se registra el cuerpo de la petición (contraseñas, datos de clientes).
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');
  private readonly mode: HttpLogMode;

  constructor(config: ConfigService) {
    this.mode = config.get<HttpLogMode>('LOG_HTTP', 'changes');
  }

  use(req: Request, res: Response, next: NextFunction): void {
    if (this.mode === 'off' || req.method === 'OPTIONS') return next();
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const status = res.statusCode;
      const isChange = req.method !== 'GET' && req.method !== 'HEAD';
      if (this.mode === 'changes' && !isChange && status < 400) return;

      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      const user = (req as Request & { user?: AuthUser }).user;
      const who = user ? `@${user.username}` : 'anónimo';
      const path = req.originalUrl.split('?')[0];
      const line = `${req.method} ${path} → ${status} · ${who} · ${ms.toFixed(0)} ms`;

      if (status >= 500) this.logger.error(line);
      else if (status >= 400) this.logger.warn(line);
      else this.logger.log(line);
    });
    next();
  }
}

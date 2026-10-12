import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

interface ErrorItem {
  field?: string;
  message: string;
}

/** Respuesta de error uniforme: { success:false, message, errors[] } sin stack traces. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error interno del servidor';
    let errors: ErrorItem[] = [];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else {
        const b = body as { message?: string | string[] };
        if (Array.isArray(b.message)) {
          message = 'Error de validación';
          errors = b.message.map((m) => ({ message: m }));
          if (status === HttpStatus.BAD_REQUEST) status = HttpStatus.UNPROCESSABLE_ENTITY;
        } else if (b.message) {
          message = b.message;
        }
      }
    } else {
      this.logger.error(
        exception instanceof Error ? exception.message : 'Excepción desconocida',
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    res.status(status).json({ success: false, message, errors });
  }
}

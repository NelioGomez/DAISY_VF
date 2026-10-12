import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

/**
 * Envuelve las respuestas exitosas en { success:true, data }.
 * Si el servicio ya devuelve { data, pagination } se respeta esa forma.
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((payload: unknown) => {
        if (payload && typeof payload === 'object' && 'data' in payload) {
          return { success: true, ...(payload as object) };
        }
        return { success: true, data: payload ?? null };
      }),
    );
  }
}

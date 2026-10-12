import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** IP del cliente (para auditoría). */
export const ClientIp = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined =>
    ctx.switchToHttp().getRequest<{ ip?: string }>().ip,
);

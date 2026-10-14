import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  userId?: string | null;
  username?: string | null;
  module: string;
  action: string;
  entity?: string;
  entityId?: string;
  description?: string;
  ip?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

/**
 * Registro de auditoría. En la Fase 17 se agregará la consulta (GET /audit);
 * por ahora solo escribe. Un fallo de auditoría nunca debe romper la operación.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId ?? null,
          username: entry.username ?? null,
          module: entry.module,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId,
          description: entry.description,
          ip: entry.ip,
          metadata: entry.metadata,
        },
      });
    } catch (error) {
      this.logger.error(
        `No se pudo registrar auditoría (${entry.module}/${entry.action})`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
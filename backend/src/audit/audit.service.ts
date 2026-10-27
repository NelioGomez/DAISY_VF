import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

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

/** Nombre corto de cada módulo para la terminal. */
const MODULE_LABEL: Record<string, string> = {
  auth: 'Sesión',
  users: 'Usuarios',
  roles: 'Roles',
  products: 'Productos',
  categories: 'Categorías',
  brands: 'Marcas',
  inventory: 'Inventario',
  customers: 'Clientes',
  suppliers: 'Proveedores',
  quotations: 'Cotizaciones',
  sales: 'Ventas',
  payments: 'Pagos',
  'service-orders': 'Órdenes OPI',
  inquiries: 'Consultas web',
  reports: 'Reportes',
  audit: 'Auditoría',
};

/** Acciones que conviene resaltar en amarillo (posibles intentos de abuso). */
const WARN_ACTIONS = new Set(['LOGIN_FAILED', 'LOGIN_BLOCKED', 'DEACTIVATE', 'VOID']);

/**
 * Registro de auditoría. Por cada operación:
 *  1. la guarda en la bitácora (tabla audit_logs),
 *  2. la muestra en la terminal del servidor (contexto [Actividad]),
 *  3. avisa por WebSocket a los usuarios que deben ver el cambio.
 * Un fallo en cualquiera de los tres nunca rompe la operación de negocio.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly activity = new Logger('Actividad');

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly realtime?: RealtimeGateway,
  ) {}

  async log(entry: AuditEntry): Promise<void> {
    let at = new Date();
    try {
      const saved = await this.prisma.auditLog.create({
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
        select: { createdAt: true },
      });
      if (saved?.createdAt) at = saved.createdAt;
    } catch (error) {
      this.logger.error(
        `No se pudo registrar auditoría (${entry.module}/${entry.action})`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    this.print(entry);

    try {
      this.realtime?.broadcast({
        module: entry.module,
        action: entry.action,
        at: at.toISOString(),
        entity: entry.entity ?? null,
        entityId: entry.entityId ?? null,
        description: entry.description ?? null,
        username: entry.username ?? null,
        userId: entry.userId ?? null,
      });
    } catch (error) {
      this.logger.error('No se pudo avisar el cambio por WebSocket', error instanceof Error ? error.stack : undefined);
    }
  }

  /** Ej.: "Ventas · CREATE · @jflores · Factura FAC-000007 por C$ 3323.5 (CREDIT)" */
  private print(e: AuditEntry): void {
    const who = e.username ? `@${e.username}` : 'público';
    const parts = [MODULE_LABEL[e.module] ?? e.module, e.action, who];
    if (e.description) parts.push(e.description);
    if (e.ip && (e.action.startsWith('LOGIN') || !e.username)) parts.push(`IP ${e.ip}`);
    const line = parts.join(' · ');
    if (WARN_ACTIONS.has(e.action)) this.activity.warn(line);
    else this.activity.log(line);
  }
}

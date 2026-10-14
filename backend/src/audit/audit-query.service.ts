import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { toCsv } from '../common/utils/csv';
import { dateRange } from '../common/utils/dates';
import { buildPagination } from '../common/utils/pagination';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';
import { FilterAuditDto } from './dto/audit.dto';

const EXPORT_MAX_ROWS = 50_000;

const AUDIT_SELECT = {
  id: true,
  userId: true,
  username: true,
  module: true,
  action: true,
  entity: true,
  entityId: true,
  description: true,
  ip: true,
  metadata: true,
  createdAt: true,
} as const;

interface AuditRow {
  id: string;
  userId: string | null;
  username: string | null;
  module: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  description: string | null;
  ip: string | null;
  metadata: unknown;
  createdAt: Date;
}

/**
 * Solo lectura: la bitácora no se edita ni se elimina desde la API (no existen esas rutas).
 * La escritura vive en AuditService.
 */
@Injectable()
export class AuditQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(f: FilterAuditDto) {
    const { page, limit } = f;
    const where = this.buildWhere(f);
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        select: AUDIT_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { data: rows as AuditRow[], pagination: buildPagination(page, limit, total) };
  }

  async findOne(id: string) {
    const row = (await this.prisma.auditLog.findUnique({ where: { id }, select: AUDIT_SELECT })) as AuditRow | null;
    if (!row) throw new NotFoundException('Registro de auditoría no encontrado');
    return row;
  }

  /** Valores existentes de módulo y acción, para llenar los selectores de filtro. */
  async filters() {
    const [modules, actions] = await Promise.all([
      this.prisma.auditLog.groupBy({ by: ['module'], orderBy: { module: 'asc' } }),
      this.prisma.auditLog.groupBy({ by: ['action'], orderBy: { action: 'asc' } }),
    ]);
    return {
      modules: (modules as unknown as { module: string }[]).map((m) => m.module),
      actions: (actions as unknown as { action: string }[]).map((a) => a.action),
    };
  }

  /** CSV con los mismos filtros (sin paginar, hasta 50.000 filas). La exportación también se audita. */
  async exportCsv(f: FilterAuditDto, actor: AuthUser, ip?: string): Promise<string> {
    const rows = (await this.prisma.auditLog.findMany({
      where: this.buildWhere(f),
      select: AUDIT_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: EXPORT_MAX_ROWS,
    })) as AuditRow[];

    await this.audit.log({
      userId: actor.id,
      username: actor.username,
      module: 'audit',
      action: 'EXPORT',
      entity: 'AuditLog',
      description: `Exportación de ${rows.length} registros de auditoría a CSV`,
      ip,
    });

    return toCsv(rows, [
      { header: 'Fecha y hora (UTC)', value: (r) => r.createdAt },
      { header: 'Usuario', value: (r) => r.username },
      { header: 'Módulo', value: (r) => r.module },
      { header: 'Acción', value: (r) => r.action },
      { header: 'Entidad', value: (r) => r.entity },
      { header: 'Id de entidad', value: (r) => r.entityId },
      { header: 'Descripción', value: (r) => r.description },
      { header: 'IP', value: (r) => r.ip },
      { header: 'Metadatos', value: (r) => (r.metadata ? JSON.stringify(r.metadata) : null) },
    ]);
  }

  private buildWhere(f: FilterAuditDto): Prisma.AuditLogWhereInput {
    const range = dateRange(f.from, f.to);
    return {
      ...(f.userId && { userId: f.userId }),
      ...(f.username && { username: { contains: f.username, mode: 'insensitive' as const } }),
      ...(f.module && { module: f.module }),
      ...(f.action && { action: f.action }),
      ...(f.entity && { entity: f.entity }),
      ...(f.entityId && { entityId: f.entityId }),
      ...(range && { createdAt: range }),
      ...(f.search && { description: { contains: f.search, mode: 'insensitive' as const } }),
    };
  }
}

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { SortOrder } from '../common/dto/sort-order.enum';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { decimalToNumber } from '../common/utils/decimal';
import { buildPagination } from '../common/utils/pagination';
import { isForeignKeyViolation, isUniqueViolation } from '../common/utils/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCustomerDto,
  CustomerSortField,
  FilterCustomerDto,
  UpdateCustomerDto,
} from './dto/customer.dto';

const CUSTOMER_SELECT = {
  id: true,
  name: true,
  ruc: true,
  contactName: true,
  phone: true,
  email: true,
  address: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

interface CustomerRow {
  id: string;
  name: string;
  ruc: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface SalesTotals {
  customerId: string;
  _count: { _all: number };
  _sum: { total: { toString(): string } | null; balance: { toString(): string } | null };
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(filter: FilterCustomerDto) {
    const { page, limit } = filter;
    const where = this.buildWhere(filter);
    const dir: 'asc' | 'desc' = filter.sortOrder === SortOrder.DESC ? 'desc' : 'asc';
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        select: CUSTOMER_SELECT,
        orderBy: filter.sortBy === CustomerSortField.CREATED_AT ? { createdAt: dir } : { name: dir },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    const stats = await this.salesTotals((rows as CustomerRow[]).map((r) => r.id));
    return {
      data: (rows as CustomerRow[]).map((c) => this.toDto(c, stats.get(c.id))),
      pagination: buildPagination(page, limit, total),
    };
  }

  async findOne(id: string) {
    const c = (await this.prisma.customer.findUnique({ where: { id }, select: CUSTOMER_SELECT })) as CustomerRow | null;
    if (!c) throw new NotFoundException('Cliente no encontrado');
    const stats = await this.salesTotals([id]);
    return this.toDto(c, stats.get(id));
  }

  async create(dto: CreateCustomerDto, actor: AuthUser, ip?: string) {
    await this.assertRucFree(dto.ruc);
    try {
      const created = (await this.prisma.customer.create({
        data: {
          name: dto.name,
          ruc: dto.ruc ?? null,
          contactName: dto.contactName ?? null,
          phone: dto.phone ?? null,
          email: dto.email ?? null,
          address: dto.address ?? null,
        },
        select: CUSTOMER_SELECT,
      })) as CustomerRow;
      await this.log(actor, 'CREATE', created.id, `Cliente "${created.name}" creado`, ip);
      return this.toDto(created);
    } catch (error) {
      if (isUniqueViolation(error)) await this.assertRucFree(dto.ruc);
      throw error;
    }
  }

  async update(id: string, dto: UpdateCustomerDto, actor: AuthUser, ip?: string) {
    const existing = await this.findOne(id);
    if (dto.ruc && dto.ruc !== existing.ruc) await this.assertRucFree(dto.ruc, id);

    const updated = (await this.prisma.customer.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.ruc !== undefined && { ruc: dto.ruc }),
        ...(dto.contactName !== undefined && { contactName: dto.contactName }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.address !== undefined && { address: dto.address }),
      },
      select: CUSTOMER_SELECT,
    })) as CustomerRow;
    await this.log(actor, 'UPDATE', id, `Cliente "${updated.name}" modificado`, ip);
    return this.toDto(updated);
  }

  async setStatus(id: string, isActive: boolean, actor: AuthUser, ip?: string) {
    await this.findOne(id);
    const updated = (await this.prisma.customer.update({
      where: { id },
      data: { isActive },
      select: CUSTOMER_SELECT,
    })) as CustomerRow;
    await this.log(actor, isActive ? 'ACTIVATE' : 'DEACTIVATE', id, `Cliente "${updated.name}" ${isActive ? 'activado' : 'desactivado'}`, ip);
    return this.toDto(updated);
  }

  /** Solo se elimina un cliente sin cotizaciones, ventas ni órdenes de servicio. */
  async remove(id: string, actor: AuthUser, ip?: string): Promise<void> {
    const c = await this.prisma.customer.findUnique({
      where: { id },
      select: { name: true, _count: { select: { quotations: true, sales: true, serviceOrders: true } } },
    });
    if (!c) throw new NotFoundException('Cliente no encontrado');
    if (c._count.quotations + c._count.sales + c._count.serviceOrders > 0) throw this.inUse();
    try {
      await this.prisma.customer.delete({ where: { id } });
    } catch (error) {
      if (isForeignKeyViolation(error)) throw this.inUse();
      throw error;
    }
    await this.log(actor, 'DELETE', id, `Cliente "${c.name}" eliminado`, ip);
  }

  // ───────────────────────── helpers ─────────────────────────

  private inUse() {
    return new ConflictException(
      'El cliente tiene cotizaciones, ventas u órdenes de servicio y no puede eliminarse. Desactívelo en su lugar.',
    );
  }

  private buildWhere(f: FilterCustomerDto) {
    return {
      ...(f.isActive !== undefined && { isActive: f.isActive }),
      ...(f.search && {
        OR: ['name', 'ruc', 'contactName', 'phone', 'email'].map((field) => ({
          [field]: { contains: f.search, mode: 'insensitive' as const },
        })),
      }),
    };
  }

  private async assertRucFree(ruc?: string | null, excludeId?: string) {
    if (!ruc) return;
    const clash = await this.prisma.customer.findFirst({
      where: { ruc, ...(excludeId && { NOT: { id: excludeId } }) },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException({
        message: 'No fue posible registrar el cliente',
        errors: [{ field: 'ruc', message: 'Ya existe un cliente con ese RUC' }],
      });
    }
  }

  /** Total comprado y saldo pendiente (solo ventas vigentes). */
  private async salesTotals(ids: string[]) {
    const map = new Map<string, { salesCount: number; totalPurchases: number; pendingBalance: number }>();
    if (!ids.length) return map;
    const groups = (await this.prisma.sale.groupBy({
      by: ['customerId'],
      orderBy: { customerId: 'asc' },
      where: { customerId: { in: ids }, status: 'ACTIVE' },
      _count: { _all: true },
      _sum: { total: true, balance: true },
    })) as unknown as SalesTotals[];
    for (const g of groups) {
      map.set(g.customerId, {
        salesCount: g._count._all,
        totalPurchases: g._sum.total ? decimalToNumber(g._sum.total) : 0,
        pendingBalance: g._sum.balance ? decimalToNumber(g._sum.balance) : 0,
      });
    }
    return map;
  }

  private toDto(c: CustomerRow, stats?: { salesCount: number; totalPurchases: number; pendingBalance: number }) {
    return {
      ...c,
      salesCount: stats?.salesCount ?? 0,
      totalPurchases: stats?.totalPurchases ?? 0,
      pendingBalance: stats?.pendingBalance ?? 0,
    };
  }

  private log(actor: AuthUser, action: string, entityId: string, description: string, ip?: string) {
    return this.audit.log({
      userId: actor.id,
      username: actor.username,
      module: 'customers',
      action,
      entity: 'Customer',
      entityId,
      description,
      ip,
    });
  }
}
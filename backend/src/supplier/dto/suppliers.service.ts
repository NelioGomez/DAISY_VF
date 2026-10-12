import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { SortOrder } from '../../common/dto/sort-order.enum';
import type { AuthUser } from '../../common/interfaces/auth-user.interface';
import { buildPagination } from '../../common/utils/pagination';
import { isForeignKeyViolation, isUniqueViolation } from '../../common/utils/prisma-errors';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateSupplierDto,
  FilterSupplierDto,
  SupplierSortField,
  UpdateSupplierDto,
} from '../dto/supplier.dto';

const SUPPLIER_SELECT = {
  id: true,
  name: true,
  taxId: true,
  country: true,
  isInternational: true,
  contactName: true,
  phone: true,
  email: true,
  address: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

interface SupplierRow {
  id: string;
  name: string;
  taxId: string | null;
  country: string | null;
  isInternational: boolean;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Proveedor internacional = país indicado distinto de Nicaragua. */
export function inferInternational(country?: string | null): boolean {
  if (!country) return false;
  return country.trim().toLowerCase() !== 'nicaragua';
}

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(filter: FilterSupplierDto) {
    const { page, limit } = filter;
    const where = this.buildWhere(filter);
    const dir: 'asc' | 'desc' = filter.sortOrder === SortOrder.DESC ? 'desc' : 'asc';
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.supplier.count({ where }),
      this.prisma.supplier.findMany({
        where,
        select: SUPPLIER_SELECT,
        orderBy: filter.sortBy === SupplierSortField.CREATED_AT ? { createdAt: dir } : { name: dir },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { data: rows as SupplierRow[], pagination: buildPagination(page, limit, total) };
  }

  async findOne(id: string) {
    const s = (await this.prisma.supplier.findUnique({ where: { id }, select: SUPPLIER_SELECT })) as SupplierRow | null;
    if (!s) throw new NotFoundException('Proveedor no encontrado');
    return s;
  }

  async create(dto: CreateSupplierDto, actor: AuthUser, ip?: string) {
    await this.assertTaxIdFree(dto.taxId);
    try {
      const created = (await this.prisma.supplier.create({
        data: {
          name: dto.name,
          taxId: dto.taxId ?? null,
          country: dto.country ?? null,
          isInternational: dto.isInternational ?? inferInternational(dto.country),
          contactName: dto.contactName ?? null,
          phone: dto.phone ?? null,
          email: dto.email ?? null,
          address: dto.address ?? null,
        },
        select: SUPPLIER_SELECT,
      })) as SupplierRow;
      await this.log(actor, 'CREATE', created.id, `Proveedor "${created.name}" creado`, ip);
      return created;
    } catch (error) {
      if (isUniqueViolation(error)) await this.assertTaxIdFree(dto.taxId);
      throw error;
    }
  }

  async update(id: string, dto: UpdateSupplierDto, actor: AuthUser, ip?: string) {
    const existing = await this.findOne(id);
    if (dto.taxId && dto.taxId !== existing.taxId) await this.assertTaxIdFree(dto.taxId, id);

    // Si cambia el país y no se indica explícitamente, se recalcula nacional/internacional.
    const international =
      dto.isInternational !== undefined
        ? dto.isInternational
        : dto.country !== undefined
          ? inferInternational(dto.country)
          : undefined;

    const updated = (await this.prisma.supplier.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.taxId !== undefined && { taxId: dto.taxId }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(international !== undefined && { isInternational: international }),
        ...(dto.contactName !== undefined && { contactName: dto.contactName }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.address !== undefined && { address: dto.address }),
      },
      select: SUPPLIER_SELECT,
    })) as SupplierRow;
    await this.log(actor, 'UPDATE', id, `Proveedor "${updated.name}" modificado`, ip);
    return updated;
  }

  async setStatus(id: string, isActive: boolean, actor: AuthUser, ip?: string) {
    await this.findOne(id);
    const updated = (await this.prisma.supplier.update({
      where: { id },
      data: { isActive },
      select: SUPPLIER_SELECT,
    })) as SupplierRow;
    await this.log(actor, isActive ? 'ACTIVATE' : 'DEACTIVATE', id, `Proveedor "${updated.name}" ${isActive ? 'activado' : 'desactivado'}`, ip);
    return updated;
  }

  /** Solo se elimina un proveedor sin entradas de inventario asociadas. */
  async remove(id: string, actor: AuthUser, ip?: string): Promise<void> {
    const s = await this.prisma.supplier.findUnique({
      where: { id },
      select: { name: true, _count: { select: { movements: true } } },
    });
    if (!s) throw new NotFoundException('Proveedor no encontrado');
    if (s._count.movements > 0) throw this.inUse();
    try {
      await this.prisma.supplier.delete({ where: { id } });
    } catch (error) {
      if (isForeignKeyViolation(error)) throw this.inUse();
      throw error;
    }
    await this.log(actor, 'DELETE', id, `Proveedor "${s.name}" eliminado`, ip);
  }

  // ───────────────────────── helpers ─────────────────────────

  private inUse() {
    return new ConflictException(
      'El proveedor tiene movimientos de inventario y no puede eliminarse. Desactívelo en su lugar.',
    );
  }

  private buildWhere(f: FilterSupplierDto) {
    return {
      ...(f.isActive !== undefined && { isActive: f.isActive }),
      ...(f.isInternational !== undefined && { isInternational: f.isInternational }),
      ...(f.search && {
        OR: ['name', 'taxId', 'country', 'contactName', 'email'].map((field) => ({
          [field]: { contains: f.search, mode: 'insensitive' as const },
        })),
      }),
    };
  }

  private async assertTaxIdFree(taxId?: string | null, excludeId?: string) {
    if (!taxId) return;
    const clash = await this.prisma.supplier.findFirst({
      where: { taxId, ...(excludeId && { NOT: { id: excludeId } }) },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException({
        message: 'No fue posible registrar el proveedor',
        errors: [{ field: 'taxId', message: 'Ya existe un proveedor con ese identificador fiscal' }],
      });
    }
  }

  private log(actor: AuthUser, action: string, entityId: string, description: string, ip?: string) {
    return this.audit.log({
      userId: actor.id,
      username: actor.username,
      module: 'suppliers',
      action,
      entity: 'Supplier',
      entityId,
      description,
      ip,
    });
  }
}
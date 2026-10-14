import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { buildPagination } from '../common/utils/pagination';
import { isForeignKeyViolation, isUniqueViolation } from '../common/utils/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBrandDto, FilterBrandDto, UpdateBrandDto } from './dto/brand.dto';

const BRAND_SELECT = {
  id: true,
  name: true,
  isActive: true,
  _count: { select: { products: true } },
} as const;

@Injectable()
export class BrandsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(filter: FilterBrandDto) {
    const { page, limit, search, isActive } = filter;
    const where = {
      ...(isActive !== undefined && { isActive }),
      ...(search && { name: { contains: search, mode: 'insensitive' as const } }),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.brand.count({ where }),
      this.prisma.brand.findMany({
        where,
        select: BRAND_SELECT,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { data: rows.map((b) => this.toDto(b)), pagination: buildPagination(page, limit, total) };
  }

  async findOne(id: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id }, select: BRAND_SELECT });
    if (!brand) throw new NotFoundException('Marca no encontrada');
    return this.toDto(brand);
  }

  async create(dto: CreateBrandDto, actor: AuthUser, ip?: string) {
    await this.assertNameFree(dto.name);
    try {
      const created = await this.prisma.brand.create({
        data: { name: dto.name },
        select: BRAND_SELECT,
      });
      await this.log(actor, 'CREATE', created.id, `Marca "${created.name}" creada`, ip);
      return this.toDto(created);
    } catch (error) {
      if (isUniqueViolation(error)) await this.assertNameFree(dto.name);
      throw error;
    }
  }

  async update(id: string, dto: UpdateBrandDto, actor: AuthUser, ip?: string) {
    await this.findOne(id);
    if (dto.name) await this.assertNameFree(dto.name, id);
    const updated = await this.prisma.brand.update({
      where: { id },
      data: { ...(dto.name !== undefined && { name: dto.name }) },
      select: BRAND_SELECT,
    });
    await this.log(actor, 'UPDATE', id, `Marca "${updated.name}" modificada`, ip);
    return this.toDto(updated);
  }

  async setStatus(id: string, isActive: boolean, actor: AuthUser, ip?: string) {
    await this.findOne(id);
    const updated = await this.prisma.brand.update({
      where: { id },
      data: { isActive },
      select: BRAND_SELECT,
    });
    await this.log(
      actor,
      isActive ? 'ACTIVATE' : 'DEACTIVATE',
      id,
      `Marca "${updated.name}" ${isActive ? 'activada' : 'desactivada'}`,
      ip,
    );
    return this.toDto(updated);
  }

  async remove(id: string, actor: AuthUser, ip?: string): Promise<void> {
    const brand = await this.findOne(id);
    if (brand.productCount > 0) throw this.inUse();
    try {
      await this.prisma.brand.delete({ where: { id } });
    } catch (error) {
      if (isForeignKeyViolation(error)) throw this.inUse();
      throw error;
    }
    await this.log(actor, 'DELETE', id, `Marca "${brand.name}" eliminada`, ip);
  }

  private inUse() {
    return new ConflictException('La marca tiene productos asociados. Desactívela en lugar de eliminarla.');
  }

  private async assertNameFree(name: string, excludeId?: string) {
    const clash = await this.prisma.brand.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        ...(excludeId && { NOT: { id: excludeId } }),
      },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException({
        message: 'No fue posible guardar la marca',
        errors: [{ field: 'name', message: 'Ya existe una marca con ese nombre' }],
      });
    }
  }

  private toDto(b: { id: string; name: string; isActive: boolean; _count: { products: number } }) {
    return { id: b.id, name: b.name, isActive: b.isActive, productCount: b._count.products };
  }

  private log(actor: AuthUser, action: string, entityId: string, description: string, ip?: string) {
    return this.audit.log({
      userId: actor.id,
      username: actor.username,
      module: 'brands',
      action,
      entity: 'Brand',
      entityId,
      description,
      ip,
    });
  }
}
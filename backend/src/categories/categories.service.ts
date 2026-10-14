import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { buildPagination } from '../common/utils/pagination';
import { isForeignKeyViolation, isUniqueViolation } from '../common/utils/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, FilterCategoryDto, UpdateCategoryDto } from './dto/category.dto';

const CATEGORY_SELECT = {
  id: true,
  name: true,
  description: true,
  isActive: true,
  _count: { select: { products: true } },
} as const;

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(filter: FilterCategoryDto) {
    const { page, limit, search, isActive } = filter;
    const where = {
      ...(isActive !== undefined && { isActive }),
      ...(search && { name: { contains: search, mode: 'insensitive' as const } }),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.category.count({ where }),
      this.prisma.category.findMany({
        where,
        select: CATEGORY_SELECT,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { data: rows.map((c) => this.toDto(c)), pagination: buildPagination(page, limit, total) };
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id }, select: CATEGORY_SELECT });
    if (!category) throw new NotFoundException('Categoría no encontrada');
    return this.toDto(category);
  }

  async create(dto: CreateCategoryDto, actor: AuthUser, ip?: string) {
    await this.assertNameFree(dto.name);
    try {
      const created = await this.prisma.category.create({
        data: { name: dto.name, description: dto.description },
        select: CATEGORY_SELECT,
      });
      await this.log(actor, 'CREATE', created.id, `Categoría "${created.name}" creada`, ip);
      return this.toDto(created);
    } catch (error) {
      if (isUniqueViolation(error)) await this.assertNameFree(dto.name);
      throw error;
    }
  }

  async update(id: string, dto: UpdateCategoryDto, actor: AuthUser, ip?: string) {
    await this.findOne(id);
    if (dto.name) await this.assertNameFree(dto.name, id);
    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
      select: CATEGORY_SELECT,
    });
    await this.log(actor, 'UPDATE', id, `Categoría "${updated.name}" modificada`, ip);
    return this.toDto(updated);
  }

  async setStatus(id: string, isActive: boolean, actor: AuthUser, ip?: string) {
    await this.findOne(id);
    const updated = await this.prisma.category.update({
      where: { id },
      data: { isActive },
      select: CATEGORY_SELECT,
    });
    await this.log(
      actor,
      isActive ? 'ACTIVATE' : 'DEACTIVATE',
      id,
      `Categoría "${updated.name}" ${isActive ? 'activada' : 'desactivada'}`,
      ip,
    );
    return this.toDto(updated);
  }

  async remove(id: string, actor: AuthUser, ip?: string): Promise<void> {
    const category = await this.findOne(id);
    if (category.productCount > 0) throw this.inUse();
    try {
      await this.prisma.category.delete({ where: { id } });
    } catch (error) {
      if (isForeignKeyViolation(error)) throw this.inUse();
      throw error;
    }
    await this.log(actor, 'DELETE', id, `Categoría "${category.name}" eliminada`, ip);
  }

  private inUse() {
    return new ConflictException(
      'La categoría tiene productos asociados. Desactívela en lugar de eliminarla.',
    );
  }

  private async assertNameFree(name: string, excludeId?: string) {
    const clash = await this.prisma.category.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        ...(excludeId && { NOT: { id: excludeId } }),
      },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException({
        message: 'No fue posible guardar la categoría',
        errors: [{ field: 'name', message: 'Ya existe una categoría con ese nombre' }],
      });
    }
  }

  private toDto(c: {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
    _count: { products: number };
  }) {
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      isActive: c.isActive,
      productCount: c._count.products,
    };
  }

  private log(actor: AuthUser, action: string, entityId: string, description: string, ip?: string) {
    return this.audit.log({
      userId: actor.id,
      username: actor.username,
      module: 'categories',
      action,
      entity: 'Category',
      entityId,
      description,
      ip,
    });
  }
}
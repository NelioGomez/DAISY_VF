import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { dateRange } from '../common/utils/dates';
import { buildPagination } from '../common/utils/pagination';
import { InquiryStatus } from '../generated/prisma/client';
import type { Prisma } from '../generated/prisma/client';
import { CreateInquiryDto } from '../public/dto/public.dto';
import { PrismaService } from '../prisma/prisma.service';
import { FilterInquiryDto } from './dto/inquiry.dto';
import { canMoveInquiry } from './inquiry-status';

const INQUIRY_SELECT = {
  id: true,
  name: true,
  contact: true,
  productInterest: true,
  message: true,
  status: true,
  createdAt: true,
} as const;

interface InquiryRow {
  id: string;
  name: string;
  contact: string;
  productInterest: string | null;
  message: string | null;
  status: InquiryStatus;
  createdAt: Date;
}

@Injectable()
export class InquiriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Alta desde el catálogo público ("Solicitar cotización"). No requiere sesión. */
  async createPublic(dto: CreateInquiryDto, ip?: string): Promise<{ received: true }> {
    // Campo trampa: los bots lo llenan, las personas no lo ven. Se responde "ok" sin guardar.
    if (dto.website) return { received: true };

    const created = (await this.prisma.webInquiry.create({
      data: {
        name: dto.name,
        contact: dto.contact,
        productInterest: dto.productInterest || null,
        message: dto.message || null,
      },
      select: { id: true },
    })) as { id: string };

    await this.audit.log({
      module: 'inquiries',
      action: 'PUBLIC_CREATE',
      entity: 'WebInquiry',
      entityId: created.id,
      description: 'Nueva consulta recibida desde el catálogo público',
      ip,
    });
    return { received: true };
  }

  async findAll(f: FilterInquiryDto) {
    const { page, limit } = f;
    const range = dateRange(f.from, f.to);
    const where: Prisma.WebInquiryWhereInput = {
      ...(f.status && { status: f.status }),
      ...(range && { createdAt: range }),
      ...(f.search && {
        OR: ['name', 'contact', 'productInterest', 'message'].map((field) => ({
          [field]: { contains: f.search, mode: 'insensitive' as const },
        })),
      }),
    };
    const [total, rows, groups] = await this.prisma.$transaction([
      this.prisma.webInquiry.count({ where }),
      this.prisma.webInquiry.findMany({
        where,
        select: INQUIRY_SELECT,
        // Las nuevas primero, luego las más recientes.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.webInquiry.groupBy({ by: ['status'], orderBy: { status: 'asc' }, _count: { _all: true } }),
    ]);
    const summary: Record<InquiryStatus, number> = { NEW: 0, ATTENDED: 0, CLOSED: 0 };
    for (const g of groups as unknown as { status: InquiryStatus; _count: { _all: number } }[]) {
      summary[g.status] = g._count._all;
    }
    return { data: rows as InquiryRow[], pagination: buildPagination(page, limit, total), summary };
  }

  async findOne(id: string) {
    const row = (await this.prisma.webInquiry.findUnique({ where: { id }, select: INQUIRY_SELECT })) as InquiryRow | null;
    if (!row) throw new NotFoundException('Consulta no encontrada');
    return row;
  }

  async setStatus(id: string, to: InquiryStatus, actor: AuthUser, ip?: string) {
    const current = await this.findOne(id);
    if (!canMoveInquiry(current.status, to)) {
      throw new ConflictException(`No se puede pasar una consulta de ${current.status} a ${to}`);
    }
    // updateMany con el estado esperado: si otra persona la cambió a la vez, no se pisa.
    const res = await this.prisma.webInquiry.updateMany({
      where: { id, status: current.status },
      data: { status: to },
    });
    if (res.count === 0) throw new ConflictException('La consulta cambió de estado; recargue e intente de nuevo');

    await this.audit.log({
      userId: actor.id,
      username: actor.username,
      module: 'inquiries',
      action: 'STATUS_CHANGE',
      entity: 'WebInquiry',
      entityId: id,
      description: `Consulta de ${current.name}: ${current.status} → ${to}`,
      ip,
    });
    return { ...current, status: to };
  }
}
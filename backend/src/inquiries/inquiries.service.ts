import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { dateRange } from '../common/utils/dates';
import { buildPagination } from '../common/utils/pagination';
import { InquiryStatus, InquiryType } from '../generated/prisma/client';
import type { Prisma } from '../generated/prisma/client';
import { DocumentSequenceService } from '../documents/document-sequence.service';
import { CreateInquiryDto } from '../public/dto/public.dto';
import { PrismaService } from '../prisma/prisma.service';
import { FilterInquiryDto } from './dto/inquiry.dto';
import { canMoveInquiry } from './inquiry-status';

export const INQUIRY_SELECT = {
  id: true,
  code: true,
  name: true,
  contact: true,
  productInterest: true,
  message: true,
  type: true,
  status: true,
  statusChangedAt: true,
  customerId: true,
  customerAccountId: true,
  assignedToId: true,
  createdAt: true,
  customer: { select: { id: true, name: true, ruc: true } },
  assignedTo: { select: { id: true, username: true } },
  items: {
    orderBy: { id: 'asc' as const },
    select: {
      productId: true,
      quantity: true,
      note: true,
      product: { select: { sku: true, name: true, salePrice: true, stock: true, minStock: true, isActive: true } },
    },
  },
  // Cadena SOL → COT → FAC: la cotización generada y, si ya se convirtió, su factura.
  quotation: { select: { id: true, code: true, status: true, total: true, sale: { select: { id: true, invoiceNumber: true } } } },
  // Servicio técnico o reclamo atendido con una orden de servicio (mejora n.° 60).
  serviceOrder: { select: { id: true, code: true, status: true, underWarranty: true } },
} as const;

interface InquiryRow {
  id: string;
  code: string;
  name: string;
  contact: string;
  productInterest: string | null;
  message: string | null;
  type: InquiryType;
  status: InquiryStatus;
  statusChangedAt: Date;
  customerId: string | null;
  customerAccountId: string | null;
  assignedToId: string | null;
  createdAt: Date;
  customer: { id: string; name: string; ruc: string | null } | null;
  assignedTo: { id: string; username: string } | null;
  items: {
    productId: string;
    quantity: number;
    note: string | null;
    product: { sku: string; name: string; salePrice: { toString(): string }; stock: number; minStock: number; isActive: boolean };
  }[];
  quotation: {
    id: string;
    code: string;
    status: string;
    total: { toString(): string };
    sale: { id: string; invoiceNumber: string } | null;
  } | null;
  serviceOrder: { id: string; code: string; status: string; underWarranty: boolean } | null;
}

/** Forma pública de una solicitud (sin decimales de Prisma; disponibilidad orientativa por línea). */
export function inquiryToDto(r: InquiryRow) {
  return {
    ...r,
    source: r.customerAccountId ? ('PORTAL' as const) : ('WEB_FORM' as const),
    items: r.items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      note: i.note,
      product: {
        sku: i.product.sku,
        name: i.product.name,
        salePrice: Number(i.product.salePrice.toString()),
        stock: i.product.stock,
        minStock: i.product.minStock,
        isActive: i.product.isActive,
      },
    })),
    quotation: r.quotation ? { ...r.quotation, total: Number(r.quotation.total.toString()) } : null,
  };
}

@Injectable()
export class InquiriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sequence: DocumentSequenceService,
  ) {}

  /** Alta desde el catálogo público ("Solicitar cotización"). No requiere sesión. */
  async createPublic(dto: CreateInquiryDto, ip?: string): Promise<{ received: true; code?: string }> {
    // Campo trampa: los bots lo llenan, las personas no lo ven. Se responde "ok" sin guardar.
    if (dto.website) return { received: true };

    const created = (await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const code = await this.sequence.next(tx, 'INQUIRY', 'SOL');
      return tx.webInquiry.create({
        data: {
          code,
          name: dto.name,
          contact: dto.contact,
          productInterest: dto.productInterest || null,
          message: dto.message || null,
          type: dto.type ?? InquiryType.QUOTE,
        },
        select: { id: true, code: true },
      });
    })) as { id: string; code: string };

    await this.audit.log({
      module: 'inquiries',
      action: 'PUBLIC_CREATE',
      entity: 'WebInquiry',
      entityId: created.id,
      description: `Solicitud ${created.code} recibida desde el catálogo público`,
      ip,
    });
    return { received: true, code: created.code };
  }

  async findAll(f: FilterInquiryDto) {
    const { page, limit } = f;
    const range = dateRange(f.from, f.to);
    const where: Prisma.WebInquiryWhereInput = {
      ...(f.status && { status: f.status }),
      ...(f.type && { type: f.type }),
      ...(range && { createdAt: range }),
      ...(f.search && {
        OR: ['code', 'name', 'contact', 'productInterest', 'message'].map((field) => ({
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
    const summary: Record<InquiryStatus, number> = { NEW: 0, IN_REVIEW: 0, QUOTED: 0, CLOSED: 0, CANCELLED: 0 };
    for (const g of groups as unknown as { status: InquiryStatus; _count: { _all: number } }[]) {
      summary[g.status] = g._count._all;
    }
    return { data: (rows as unknown as InquiryRow[]).map(inquiryToDto), pagination: buildPagination(page, limit, total), summary };
  }

  async findOne(id: string) {
    const row = (await this.prisma.webInquiry.findUnique({ where: { id }, select: INQUIRY_SELECT })) as unknown as InquiryRow | null;
    if (!row) throw new NotFoundException('Consulta no encontrada');
    return inquiryToDto(row);
  }

  /**
   * Corrige el motivo que eligió el cliente (p. ej. escribió en «Otra consulta» pero pide precios).
   * Solo mientras está Nueva o En revisión; una lista de productos siempre es de cotización.
   */
  async setType(id: string, to: InquiryType, actor: AuthUser, ip?: string) {
    const current = await this.findOne(id);
    if (current.type === to) return current;
    if (current.status !== InquiryStatus.NEW && current.status !== InquiryStatus.IN_REVIEW) {
      throw new ConflictException('El motivo solo se cambia mientras la solicitud está Nueva o En revisión');
    }
    if (current.items.length && to !== InquiryType.QUOTE) {
      throw new ConflictException('Una lista de productos siempre es un pedido de cotización');
    }
    const res = await this.prisma.webInquiry.updateMany({ where: { id, type: current.type, status: current.status }, data: { type: to } });
    if (res.count === 0) throw new ConflictException('La solicitud cambió; recargue e intente de nuevo');
    await this.audit.log({
      userId: actor.id,
      username: actor.username,
      module: 'inquiries',
      action: 'TYPE_CHANGE',
      entity: 'WebInquiry',
      entityId: id,
      description: `Solicitud ${current.code}: motivo ${current.type} → ${to}`,
      ip,
    });
    return { ...current, type: to };
  }

  async setStatus(id: string, to: InquiryStatus, actor: AuthUser, ip?: string) {
    const current = await this.findOne(id);
    if (!canMoveInquiry(current.status, to)) {
      throw new ConflictException(`No se puede pasar una consulta de ${current.status} a ${to}`);
    }
    // updateMany con el estado esperado: si otra persona la cambió a la vez, no se pisa.
    const res = await this.prisma.webInquiry.updateMany({
      where: { id, status: current.status },
      data: { status: to, statusChangedAt: new Date() },
    });
    if (res.count === 0) throw new ConflictException('La consulta cambió de estado; recargue e intente de nuevo');

    await this.audit.log({
      userId: actor.id,
      username: actor.username,
      module: 'inquiries',
      action: 'STATUS_CHANGE',
      entity: 'WebInquiry',
      entityId: id,
      description: `Solicitud ${current.code} de ${current.name}: ${current.status} → ${to}`,
      ip,
    });
    return { ...current, status: to };
  }
}
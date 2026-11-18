import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { decimalToNumber } from '../common/utils/decimal';
import { DocumentSequenceService } from '../documents/document-sequence.service';
import { QuotationStatus } from '../generated/prisma/client';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { availabilityOf } from '../public/public-catalog.service';
import { expireOverdueQuotations } from '../quotations/quotation-expiry';
import type { PortalCustomer } from './customer-auth.guard';
import { CreatePortalContactDto, CreatePortalInquiryDto } from './dto/portal.dto';

type Dec = { toString(): string };

const INQUIRY_SELECT = {
  id: true,
  code: true,
  status: true,
  statusChangedAt: true,
  message: true,
  productInterest: true,
  type: true,
  createdAt: true,
  items: {
    orderBy: { id: 'asc' as const },
    select: { productId: true, quantity: true, note: true, product: { select: { sku: true, name: true, stock: true, minStock: true } } },
  },
  quotation: { select: { id: true, code: true, status: true, total: true, validUntil: true } },
  // Servicio técnico o reclamo atendido con una orden de servicio (mejora n.° 60).
  serviceOrder: { select: { code: true, status: true, underWarranty: true, warrantyUntil: true } },
} as const;

interface InquiryRow {
  id: string;
  code: string;
  status: string;
  statusChangedAt: Date;
  message: string | null;
  productInterest: string | null;
  type: string;
  createdAt: Date;
  items: { productId: string; quantity: number; note: string | null; product: { sku: string; name: string; stock: number; minStock: number } }[];
  quotation: { id: string; code: string; status: QuotationStatus; total: Dec; validUntil: Date } | null;
  serviceOrder: { code: string; status: string; underWarranty: boolean; warrantyUntil: Date | null } | null;
}

const QUOTATION_SELECT = {
  id: true,
  code: true,
  status: true,
  issuedAt: true,
  validUntil: true,
  statusChangedAt: true,
  subtotal: true,
  taxRate: true,
  tax: true,
  total: true,
  notes: true,
  seller: { select: { firstName: true, lastName: true, email: true } },
  inquiry: { select: { id: true, code: true } },
  sale: { select: { invoiceNumber: true } },
  items: { orderBy: { id: 'asc' as const }, select: { quantity: true, unitPrice: true, subtotal: true, product: { select: { sku: true, name: true } } } },
} as const;

interface QuotationRow {
  id: string;
  code: string;
  status: QuotationStatus;
  issuedAt: Date;
  validUntil: Date;
  statusChangedAt: Date;
  subtotal: Dec;
  taxRate: Dec;
  tax: Dec;
  total: Dec;
  notes: string | null;
  seller: { firstName: string; lastName: string; email: string };
  inquiry: { id: string; code: string } | null;
  sale: { invoiceNumber: string } | null;
  items?: { quantity: number; unitPrice: Dec; subtotal: Dec; product: { sku: string; name: string } }[];
}

/**
 * Portal del cliente (mejoras n.° 37 y 43): enviar la lista de solicitud desde el catálogo y
 * consultar Mis solicitudes y Mis cotizaciones. Todo se filtra por el cliente de la sesión; nunca
 * se exponen costos, stock exacto ni notas internas. Los borradores de cotización no se muestran.
 */
@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequence: DocumentSequenceService,
    private readonly audit: AuditService,
  ) {}

  // ───────────────────────── solicitudes ─────────────────────────

  async createInquiry(c: PortalCustomer, dto: CreatePortalInquiryDto, ip?: string) {
    const ids = dto.items.map((i) => i.productId);
    const errors: { field: string; message: string }[] = [];
    if (new Set(ids).size !== ids.length) {
      errors.push({ field: 'items', message: 'Hay productos repetidos en la lista: sume las cantidades' });
    }
    // Solo productos publicados en el catálogo (activos y con precio comercial).
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids }, isActive: true, salePrice: { gt: 0 } },
      select: { id: true, name: true },
    });
    const known = new Map(products.map((p) => [p.id, p.name]));
    dto.items.forEach((it, i) => {
      if (!known.has(it.productId)) errors.push({ field: `items[${i}].productId`, message: 'El producto ya no está disponible en el catálogo' });
    });
    if (errors.length) throw new BadRequestException({ message: 'La lista de solicitud no es válida', errors });

    const account = await this.prisma.customerAccount.findUniqueOrThrow({
      where: { id: c.accountId },
      select: { email: true, phone: true, contactName: true },
    });
    const names = dto.items.map((i) => known.get(i.productId)!);
    const interest = names.length === 1 ? names[0] : `${names[0]} y ${names.length - 1} producto(s) más`;

    const created = (await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const code = await this.sequence.next(tx, 'INQUIRY', 'SOL');
      return tx.webInquiry.create({
        data: {
          code,
          name: c.customerName,
          contact: account.phone ? `${account.email} · ${account.phone}`.slice(0, 150) : account.email,
          productInterest: interest.slice(0, 200),
          message: dto.message || null,
          customerId: c.customerId,
          customerAccountId: c.accountId,
          items: { create: dto.items.map((i) => ({ productId: i.productId, quantity: i.quantity, note: i.note || null })) },
        },
        select: INQUIRY_SELECT,
      });
    })) as unknown as InquiryRow;

    // Módulo "inquiries": el personal de ventas recibe el aviso en tiempo real.
    await this.audit.log({
      module: 'inquiries',
      action: 'PORTAL_CREATE',
      entity: 'WebInquiry',
      entityId: created.id,
      description: `Solicitud ${created.code} de ${c.customerName} desde el portal (${dto.items.length} producto(s))`,
      ip,
    });
    return this.inquiryDto(created);
  }

  /**
   * Mensaje del formulario de Contacto enviado con la sesión del cliente (mejora n.° 59): queda
   * enlazado a su ficha y su cuenta, con el motivo que eligió (cotización, servicio, cuenta…).
   */
  async createContact(c: PortalCustomer, dto: CreatePortalContactDto, ip?: string) {
    const account = await this.prisma.customerAccount.findUniqueOrThrow({
      where: { id: c.accountId },
      select: { email: true, phone: true },
    });
    const created = (await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const code = await this.sequence.next(tx, 'INQUIRY', 'SOL');
      return tx.webInquiry.create({
        data: {
          code,
          name: c.customerName,
          contact: account.phone ? `${account.email} · ${account.phone}`.slice(0, 150) : account.email,
          productInterest: dto.productInterest || null,
          message: dto.message,
          type: dto.type,
          customerId: c.customerId,
          customerAccountId: c.accountId,
        },
        select: INQUIRY_SELECT,
      });
    })) as unknown as InquiryRow;
    await this.audit.log({
      module: 'inquiries',
      action: 'PORTAL_CREATE',
      entity: 'WebInquiry',
      entityId: created.id,
      description: `Mensaje ${created.code} de ${c.customerName} desde Contacto (${dto.type})`,
      ip,
    });
    return this.inquiryDto(created);
  }

  async inquiries(c: PortalCustomer) {
    const rows = (await this.prisma.webInquiry.findMany({
      where: { customerId: c.customerId },
      select: INQUIRY_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    })) as unknown as InquiryRow[];
    return rows.map((r) => this.inquiryDto(r));
  }

  async inquiry(c: PortalCustomer, id: string) {
    const row = (await this.prisma.webInquiry.findFirst({
      where: { id, customerId: c.customerId },
      select: INQUIRY_SELECT,
    })) as unknown as InquiryRow | null;
    if (!row) throw new NotFoundException('Solicitud no encontrada');
    return this.inquiryDto(row);
  }

  // ───────────────────────── cotizaciones ─────────────────────────

  async quotations(c: PortalCustomer) {
    await expireOverdueQuotations(this.prisma);
    const rows = (await this.prisma.quotation.findMany({
      where: { customerId: c.customerId, status: { not: QuotationStatus.DRAFT } },
      select: { ...QUOTATION_SELECT, items: false },
      orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }],
      take: 100,
    })) as unknown as QuotationRow[];
    return rows.map((q) => this.quotationDto(q));
  }

  async quotation(c: PortalCustomer, id: string) {
    await expireOverdueQuotations(this.prisma);
    const q = (await this.prisma.quotation.findFirst({
      where: { id, customerId: c.customerId, status: { not: QuotationStatus.DRAFT } },
      select: QUOTATION_SELECT,
    })) as unknown as QuotationRow | null;
    if (!q) throw new NotFoundException('Cotización no encontrada');
    return this.quotationDto(q);
  }

  // ───────────────────────── helpers ─────────────────────────

  private inquiryDto(r: InquiryRow) {
    // Una cotización en borrador todavía no se le muestra al cliente.
    const q = r.quotation && r.quotation.status !== QuotationStatus.DRAFT ? r.quotation : null;
    return {
      id: r.id,
      code: r.code,
      status: r.status,
      statusChangedAt: r.statusChangedAt,
      message: r.message,
      productInterest: r.productInterest,
      type: r.type,
      createdAt: r.createdAt,
      items: r.items.map((i) => ({
        productId: i.productId,
        sku: i.product.sku,
        name: i.product.name,
        quantity: i.quantity,
        note: i.note,
        availability: availabilityOf(i.product.stock, i.product.minStock),
      })),
      quotation: q ? { id: q.id, code: q.code, status: q.status, total: decimalToNumber(q.total), validUntil: q.validUntil } : null,
      quotationInProgress: !!r.quotation && !q,
      serviceOrder: r.serviceOrder,
    };
  }

  private quotationDto(q: QuotationRow) {
    return {
      id: q.id,
      code: q.code,
      status: q.status,
      issuedAt: q.issuedAt,
      validUntil: q.validUntil,
      statusChangedAt: q.statusChangedAt,
      subtotal: decimalToNumber(q.subtotal),
      taxRate: decimalToNumber(q.taxRate),
      tax: decimalToNumber(q.tax),
      total: decimalToNumber(q.total),
      notes: q.notes,
      seller: { name: [q.seller.firstName, q.seller.lastName].filter(Boolean).join(' '), email: q.seller.email },
      inquiry: q.inquiry,
      invoiceNumber: q.sale?.invoiceNumber ?? null,
      ...(q.items && {
        items: q.items.map((i) => ({
          sku: i.product.sku,
          name: i.product.name,
          quantity: i.quantity,
          unitPrice: decimalToNumber(i.unitPrice),
          subtotal: decimalToNumber(i.subtotal),
        })),
      }),
    };
  }
}

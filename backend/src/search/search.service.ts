import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { decimalToNumber } from '../common/utils/decimal';
import { UserRole } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type SearchType =
  | 'PRODUCT'
  | 'CUSTOMER'
  | 'SUPPLIER'
  | 'SALE'
  | 'QUOTATION'
  | 'INQUIRY'
  | 'PURCHASE'
  | 'SERVICE_ORDER'
  | 'PRODUCTION_ORDER'
  | 'PRODUCTION_LOT';

export interface SearchHit {
  type: SearchType;
  id: string;
  /** Código o número del documento (SKU, FAC-…, COT-…). */
  code: string | null;
  title: string;
  subtitle: string | null;
  status?: string;
  amount?: number;
}

const can = (u: AuthUser, perm: string) => u.role === UserRole.ADMIN || u.permissions.includes(perm);

/**
 * Búsqueda global (mejora n.° 7): un solo cuadro para productos, clientes, proveedores, ventas,
 * cotizaciones, solicitudes, compras, órdenes OPI, órdenes de producción y lotes. Cada grupo
 * aparece solo si el usuario puede leer ese módulo; un técnico solo encuentra sus propias órdenes.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(actor: AuthUser, q: string, limit: number) {
    const has = { contains: q, mode: 'insensitive' as const };
    const take = limit;
    const groups = await Promise.all([
      can(actor, 'products:read')
        ? this.prisma.product
            .findMany({
              where: { OR: [{ name: has }, { sku: has }, { barcode: has }] },
              select: { id: true, sku: true, name: true, stock: true, isActive: true, category: { select: { name: true } } },
              orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
              take,
            })
            .then((rows) =>
              rows.map<SearchHit>((p) => ({
                type: 'PRODUCT', id: p.id, code: p.sku, title: p.name,
                subtitle: [p.category?.name, `${p.stock} en stock`, p.isActive ? null : 'inactivo'].filter(Boolean).join(' · '),
              })),
            )
        : [],
      can(actor, 'customers:read')
        ? this.prisma.customer
            .findMany({
              where: { OR: [{ name: has }, { ruc: has }, { email: has }, { contactName: has }, { phone: has }] },
              select: { id: true, name: true, ruc: true, contactName: true, phone: true },
              orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
              take,
            })
            .then((rows) =>
              rows.map<SearchHit>((c) => ({
                type: 'CUSTOMER', id: c.id, code: c.ruc, title: c.name,
                subtitle: [c.contactName, c.phone].filter(Boolean).join(' · ') || null,
              })),
            )
        : [],
      can(actor, 'suppliers:read')
        ? this.prisma.supplier
            .findMany({
              where: { OR: [{ name: has }, { email: has }, { contactName: has }] },
              select: { id: true, name: true, contactName: true, phone: true },
              orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
              take,
            })
            .then((rows) =>
              rows.map<SearchHit>((s) => ({
                type: 'SUPPLIER', id: s.id, code: null, title: s.name,
                subtitle: [s.contactName, s.phone].filter(Boolean).join(' · ') || null,
              })),
            )
        : [],
      can(actor, 'sales:read')
        ? this.prisma.sale
            .findMany({
              where: { OR: [{ invoiceNumber: has }, { customer: { name: has } }] },
              select: { id: true, invoiceNumber: true, total: true, status: true, paymentStatus: true, soldAt: true, customer: { select: { name: true } } },
              orderBy: { soldAt: 'desc' },
              take,
            })
            .then((rows) =>
              rows.map<SearchHit>((s) => ({
                type: 'SALE', id: s.id, code: s.invoiceNumber, title: s.customer.name, subtitle: null,
                status: s.status === 'VOIDED' ? 'VOIDED' : s.paymentStatus, amount: decimalToNumber(s.total),
              })),
            )
        : [],
      can(actor, 'quotations:read')
        ? this.prisma.quotation
            .findMany({
              where: { OR: [{ code: has }, { customer: { name: has } }] },
              select: { id: true, code: true, total: true, status: true, customer: { select: { name: true } } },
              orderBy: { issuedAt: 'desc' },
              take,
            })
            .then((rows) =>
              rows.map<SearchHit>((x) => ({
                type: 'QUOTATION', id: x.id, code: x.code, title: x.customer.name, subtitle: null, status: x.status, amount: decimalToNumber(x.total),
              })),
            )
        : [],
      can(actor, 'inquiries:read')
        ? this.prisma.webInquiry
            .findMany({
              where: { OR: [{ code: has }, { name: has }, { contact: has }] },
              select: { id: true, code: true, name: true, contact: true, status: true },
              orderBy: { createdAt: 'desc' },
              take,
            })
            .then((rows) =>
              rows.map<SearchHit>((i) => ({ type: 'INQUIRY', id: i.id, code: i.code, title: i.name, subtitle: i.contact, status: i.status })),
            )
        : [],
      can(actor, 'purchases:read')
        ? this.prisma.purchase
            .findMany({
              where: { OR: [{ code: has }, { supplier: { name: has } }] },
              select: { id: true, code: true, total: true, status: true, supplier: { select: { name: true } } },
              orderBy: { createdAt: 'desc' },
              take,
            })
            .then((rows) =>
              rows.map<SearchHit>((p) => ({
                type: 'PURCHASE', id: p.id, code: p.code, title: p.supplier.name, subtitle: null, status: p.status, amount: decimalToNumber(p.total),
              })),
            )
        : [],
      can(actor, 'service-orders:read')
        ? this.prisma.serviceOrder
            .findMany({
              where: {
                ...(actor.role === UserRole.TECHNICIAN && { technicianId: actor.id }),
                OR: [{ code: has }, { description: has }, { customer: { name: has } }],
              },
              select: { id: true, code: true, description: true, status: true, customer: { select: { name: true } } },
              orderBy: { registeredAt: 'desc' },
              take,
            })
            .then((rows) =>
              rows.map<SearchHit>((o) => ({
                type: 'SERVICE_ORDER', id: o.id, code: o.code, title: o.customer.name, subtitle: o.description.slice(0, 80), status: o.status,
              })),
            )
        : [],
      can(actor, 'production:read')
        ? this.prisma.productionOrder
            .findMany({
              where: { OR: [{ code: has }, { product: { name: has } }, { product: { sku: has } }] },
              select: { id: true, code: true, quantity: true, status: true, product: { select: { sku: true, name: true } } },
              orderBy: { createdAt: 'desc' },
              take,
            })
            .then((rows) =>
              rows.map<SearchHit>((o) => ({
                type: 'PRODUCTION_ORDER', id: o.id, code: o.code, title: o.product.name, subtitle: `${o.quantity} u. · ${o.product.sku}`, status: o.status,
              })),
            )
        : [],
      can(actor, 'production:read')
        ? this.prisma.productionLot
            .findMany({
              where: { OR: [{ code: has }, { order: { code: has } }] },
              select: { id: true, code: true, quantity: true, releasedQuantity: true, status: true, order: { select: { code: true } }, product: { select: { name: true } } },
              orderBy: { producedAt: 'desc' },
              take,
            })
            .then((rows) =>
              rows.map<SearchHit>((l) => ({
                type: 'PRODUCTION_LOT', id: l.id, code: l.code, title: l.product.name, subtitle: `${l.order.code} · ${l.releasedQuantity} de ${l.quantity} liberadas`, status: l.status,
              })),
            )
        : [],
    ]);
    const results = groups.flat();
    return { query: q, total: results.length, results };
  }
}

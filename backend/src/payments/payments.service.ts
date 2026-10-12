import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { dateRange } from '../common/utils/dates';
import { decimalToNumber } from '../common/utils/decimal';
import { lockSale, TX_OPTIONS } from '../common/utils/locks';
import { Decimal, fixed2, money } from '../common/utils/money';
import { buildPagination } from '../common/utils/pagination';
import { PaymentMethod, SaleStatus } from '../generated/prisma/client';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { derivePaymentStatus } from '../sales/payment-status';
import { CreatePaymentDto, FilterPaymentDto, FilterReceivableDto } from './dto/payment.dto';

type Dec = { toString(): string };

const PAYMENT_INCLUDE = {
  sale: {
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      customer: { select: { id: true, name: true } },
    },
  },
  user: { select: { id: true, username: true } },
} as const;

interface PaymentRow {
  id: string;
  saleId: string;
  paidAt: Date;
  amount: Dec;
  method: PaymentMethod;
  reference: string | null;
  sale?: { id: string; invoiceNumber: string; status: SaleStatus; customer: { id: string; name: string } };
  user?: { id: string; username: string };
}

interface ReceivableRow {
  id: string;
  invoiceNumber: string;
  soldAt: Date;
  dueDate: Date | null;
  total: Dec;
  balance: Dec;
  paymentStatus: string;
  customer: { id: string; name: string; phone: string | null };
}

const DAY_MS = 86_400_000;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Registra un abono. La fila de la venta se bloquea para que dos abonos simultáneos
   * no sobrepasen el saldo; el saldo se recalcula siempre como total − suma de pagos.
   */
  async create(dto: CreatePaymentDto, actor: AuthUser, ip?: string) {
    if (dto.method === PaymentMethod.TRANSFER && !dto.reference) {
      throw new BadRequestException({
        message: 'Datos de pago inválidos',
        errors: [{ field: 'reference', message: 'Indique la referencia de la transferencia' }],
      });
    }
    const amount = money(dto.amount);

    const result = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await lockSale(tx, dto.saleId);
      const sale = await tx.sale.findUnique({
        where: { id: dto.saleId },
        select: { invoiceNumber: true, status: true, total: true, balance: true },
      });
      if (!sale) throw new NotFoundException('Venta no encontrada');
      if (sale.status === SaleStatus.VOIDED) throw new ConflictException('La venta está anulada');

      const balance = new Decimal(sale.balance.toString());
      if (balance.lessThanOrEqualTo(0)) throw new ConflictException('La venta ya está saldada');
      if (amount.greaterThan(balance)) {
        throw new ConflictException({
          message: 'El abono supera el saldo pendiente',
          errors: [{ field: 'amount', message: `El saldo pendiente es C$ ${balance.toFixed(2)}` }],
        });
      }

      const payment = await tx.payment.create({
        data: {
          saleId: dto.saleId,
          amount: fixed2(amount),
          method: dto.method,
          reference: dto.reference || null,
          userId: actor.id,
        },
        include: PAYMENT_INCLUDE,
      });

      const paid = await tx.payment.aggregate({ where: { saleId: dto.saleId }, _sum: { amount: true } });
      const total = new Decimal(sale.total.toString());
      const newBalance = Decimal.max(total.minus(paid._sum.amount?.toString() ?? '0'), 0);
      const status = derivePaymentStatus(total, newBalance);
      await tx.sale.update({
        where: { id: dto.saleId },
        data: { balance: fixed2(newBalance), paymentStatus: status },
      });
      return { payment: payment as PaymentRow, invoiceNumber: sale.invoiceNumber, balance: newBalance, status };
    }, TX_OPTIONS);

    await this.audit.log({
      userId: actor.id,
      username: actor.username,
      module: 'payments',
      action: 'CREATE',
      entity: 'Payment',
      entityId: result.payment.id,
      description: `Abono de C$ ${amount.toFixed(2)} (${dto.method}) a ${result.invoiceNumber}; saldo C$ ${result.balance.toFixed(2)}`,
      ip,
    });

    return {
      payment: this.toDto(result.payment),
      sale: {
        id: dto.saleId,
        invoiceNumber: result.invoiceNumber,
        balance: Number(result.balance.toFixed(2)),
        paymentStatus: result.status,
      },
    };
  }

  async findAll(filter: FilterPaymentDto) {
    const { page, limit } = filter;
    const range = dateRange(filter.from, filter.to);
    const where: Prisma.PaymentWhereInput = {
      ...(filter.saleId && { saleId: filter.saleId }),
      ...(filter.userId && { userId: filter.userId }),
      ...(filter.method && { method: filter.method }),
      ...(filter.customerId && { sale: { customerId: filter.customerId } }),
      ...(range && { paidAt: range }),
    };
    const [total, rows, agg] = await this.prisma.$transaction([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        include: PAYMENT_INCLUDE,
        orderBy: [{ paidAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payment.aggregate({ where, _sum: { amount: true } }),
    ]);
    return {
      data: (rows as PaymentRow[]).map((p) => this.toDto(p)),
      pagination: buildPagination(page, limit, total),
      summary: { totalAmount: agg._sum.amount ? decimalToNumber(agg._sum.amount) : 0 },
    };
  }

  /** Cuentas por cobrar: ventas vigentes con saldo, las más antiguas por vencer primero. */
  async receivables(filter: FilterReceivableDto) {
    const { page, limit } = filter;
    const now = new Date();
    const base: Prisma.SaleWhereInput = {
      status: SaleStatus.ACTIVE,
      balance: { gt: 0 },
      ...(filter.customerId && { customerId: filter.customerId }),
      ...(filter.search && {
        OR: [
          { invoiceNumber: { contains: filter.search, mode: 'insensitive' as const } },
          { customer: { name: { contains: filter.search, mode: 'insensitive' as const } } },
        ],
      }),
    };
    const overdueWhere: Prisma.SaleWhereInput = { ...base, dueDate: { lt: now } };
    const where: Prisma.SaleWhereInput =
      filter.overdue === true
        ? overdueWhere
        : filter.overdue === false
          ? { ...base, OR: [{ dueDate: null }, { dueDate: { gte: now } }] }
          : base;

    const [total, rows, all, overdue] = await this.prisma.$transaction([
      this.prisma.sale.count({ where }),
      this.prisma.sale.findMany({
        where,
        select: {
          id: true,
          invoiceNumber: true,
          soldAt: true,
          dueDate: true,
          total: true,
          balance: true,
          paymentStatus: true,
          customer: { select: { id: true, name: true, phone: true } },
        },
        orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { soldAt: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.sale.aggregate({ where: base, _count: { _all: true }, _sum: { balance: true } }),
      this.prisma.sale.aggregate({ where: overdueWhere, _count: { _all: true }, _sum: { balance: true } }),
    ]);

    return {
      data: (rows as ReceivableRow[]).map((s) => {
        const daysOverdue = s.dueDate && s.dueDate.getTime() < now.getTime()
          ? Math.floor((now.getTime() - s.dueDate.getTime()) / DAY_MS)
          : 0;
        return {
          saleId: s.id,
          invoiceNumber: s.invoiceNumber,
          customer: s.customer,
          soldAt: s.soldAt,
          dueDate: s.dueDate,
          total: decimalToNumber(s.total),
          balance: decimalToNumber(s.balance),
          paymentStatus: s.paymentStatus,
          isOverdue: !!s.dueDate && s.dueDate.getTime() < now.getTime(),
          daysOverdue,
        };
      }),
      pagination: buildPagination(page, limit, total),
      summary: {
        count: all._count._all,
        totalReceivable: all._sum.balance ? decimalToNumber(all._sum.balance) : 0,
        overdueCount: overdue._count._all,
        overdueAmount: overdue._sum.balance ? decimalToNumber(overdue._sum.balance) : 0,
      },
    };
  }

  /** Saldo pendiente agrupado por cliente (mayor deuda primero). */
  async receivablesByCustomer() {
    const now = new Date();
    const base: Prisma.SaleWhereInput = { status: SaleStatus.ACTIVE, balance: { gt: 0 } };
    const [groups, overdueGroups] = await Promise.all([
      this.prisma.sale.groupBy({
        by: ['customerId'],
        orderBy: { customerId: 'asc' },
        where: base,
        _count: { _all: true },
        _sum: { balance: true },
      }),
      this.prisma.sale.groupBy({
        by: ['customerId'],
        orderBy: { customerId: 'asc' },
        where: { ...base, dueDate: { lt: now } },
        _sum: { balance: true },
      }),
    ]);
    type G = { customerId: string; _count?: { _all: number }; _sum: { balance: Dec | null } };
    const overdueMap = new Map((overdueGroups as unknown as G[]).map((g) => [g.customerId, g._sum.balance]));
    const sorted = (groups as unknown as G[])
      .map((g) => ({
        customerId: g.customerId,
        openSales: g._count?._all ?? 0,
        balance: g._sum.balance ? decimalToNumber(g._sum.balance) : 0,
        overdueBalance: overdueMap.get(g.customerId) ? decimalToNumber(overdueMap.get(g.customerId)!) : 0,
      }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 200);

    const customers = (await this.prisma.customer.findMany({
      where: { id: { in: sorted.map((g) => g.customerId) } },
      select: { id: true, name: true, phone: true },
    })) as { id: string; name: string; phone: string | null }[];
    const byId = new Map(customers.map((c) => [c.id, c]));
    return {
      data: sorted.map((g) => ({ ...g, customer: byId.get(g.customerId) ?? null })),
    };
  }

  private toDto(p: PaymentRow) {
    return {
      id: p.id,
      saleId: p.saleId,
      sale: p.sale,
      paidAt: p.paidAt,
      amount: decimalToNumber(p.amount),
      method: p.method,
      reference: p.reference,
      user: p.user,
    };
  }
}
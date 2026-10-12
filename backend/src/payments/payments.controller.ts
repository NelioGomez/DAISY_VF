import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { CreatePaymentDto, FilterPaymentDto, FilterReceivableDto } from './dto/payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  @Permissions('payments:read')
  @ApiOperation({ summary: 'Historial de pagos con filtros, total y paginación' })
  findAll(@Query() filter: FilterPaymentDto) {
    return this.payments.findAll(filter);
  }

  @Get('receivables')
  @Permissions('payments:read')
  @ApiOperation({ summary: 'Cuentas por cobrar: ventas con saldo, vencidas primero, con resumen' })
  receivables(@Query() filter: FilterReceivableDto) {
    return this.payments.receivables(filter);
  }

  @Get('receivables/by-customer')
  @Permissions('payments:read')
  @ApiOperation({ summary: 'Saldo pendiente y vencido agrupado por cliente' })
  receivablesByCustomer() {
    return this.payments.receivablesByCustomer();
  }

  @Post()
  @Permissions('payments:write')
  @ApiOperation({ summary: 'Registra un abono: actualiza saldo y estado de pago de la venta' })
  @ApiResponse({ status: 409, description: 'Venta anulada, saldada o abono mayor al saldo' })
  create(@Body() dto: CreatePaymentDto, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    return this.payments.create(dto, actor, ip);
  }
}
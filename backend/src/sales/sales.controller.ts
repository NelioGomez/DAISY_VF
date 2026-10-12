import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { CreateSaleDto, FilterSaleDto, VoidSaleDto } from './dto/sale.dto';
import { SalesService } from './sales.service';

@ApiTags('Sales')
@ApiBearerAuth()
@Controller('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get()
  @Permissions('sales:read')
  @ApiOperation({ summary: 'Lista ventas/facturas con filtros, totales y paginación' })
  findAll(@Query() filter: FilterSaleDto) {
    return this.sales.findAll(filter);
  }

  @Get(':id')
  @Permissions('sales:read')
  @ApiOperation({ summary: 'Detalle de la venta: líneas, pagos, saldo y vencimiento' })
  @ApiResponse({ status: 404, description: 'Venta no encontrada' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.sales.findOne(id);
  }

  @Post()
  @Permissions('sales:write')
  @ApiOperation({
    summary: 'Registra una venta directa: descuenta inventario, calcula IVA y cobra según la forma de pago',
  })
  @ApiResponse({ status: 409, description: 'Stock insuficiente (detalle por línea en errors)' })
  create(@Body() dto: CreateSaleDto, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    return this.sales.create(dto, actor, ip);
  }

  @Post(':id/void')
  @Permissions('sales:void')
  @ApiOperation({ summary: 'Anula una venta: devuelve el stock y deja el saldo en 0 (exige motivo)' })
  voidSale(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidSaleDto,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip?: string,
  ) {
    return this.sales.voidSale(id, dto, actor, ip);
  }
}
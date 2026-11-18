import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  CancelPurchaseDto,
  CreatePurchaseDto,
  FilterPurchaseDto,
  FilterRestockDto,
  PostponeRestockDto,
  ReceivePurchaseDto,
  UpdatePurchaseDto,
} from './dto/purchase.dto';
import { PurchasesService } from './purchases.service';
import { RestockService } from './restock.service';

@ApiTags('Purchases')
@ApiBearerAuth()
@Controller('purchases')
export class PurchasesController {
  constructor(
    private readonly purchases: PurchasesService,
    private readonly restock: RestockService,
  ) {}

  @Get()
  @Permissions('purchases:read')
  @ApiOperation({ summary: 'Órdenes de compra con filtros, conteo por estado y monto comprado en 30 días' })
  findAll(@Query() filter: FilterPurchaseDto) {
    return this.purchases.findAll(filter);
  }

  // ───────────── Reabastecimiento (antes de ':id' para que "restock" no se lea como un id) ─────────────

  @Get('restock')
  @Permissions('purchases:read')
  @ApiOperation({ summary: 'Productos en stock crítico con cantidad sugerida, proveedor preferente y compras en camino' })
  restockSuggestions(@Query() filter: FilterRestockDto) {
    return this.restock.suggestions(filter);
  }

  @Post('restock/:productId/postpone')
  @HttpCode(HttpStatus.OK)
  @Permissions('purchases:write')
  @ApiOperation({ summary: 'Pospone la sugerencia de compra de un producto (1 a 90 días)' })
  postpone(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: PostponeRestockDto,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip?: string,
  ) {
    return this.restock.postpone(productId, dto, actor, ip);
  }

  @Delete('restock/:productId/postpone')
  @HttpCode(HttpStatus.OK)
  @Permissions('purchases:write')
  @ApiOperation({ summary: 'Vuelve a mostrar el producto en el panel de reabastecimiento' })
  resume(@Param('productId', ParseUUIDPipe) productId: string, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    return this.restock.resume(productId, actor, ip);
  }

  // ───────────── Compras ─────────────

  @Get(':id')
  @Permissions('purchases:read')
  @ApiOperation({ summary: 'Detalle de la compra: líneas, lo recibido, recepciones y las entradas que generaron' })
  @ApiResponse({ status: 404, description: 'Compra no encontrada' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchases.findOne(id);
  }

  @Post()
  @Permissions('purchases:write')
  @ApiOperation({ summary: 'Crea una compra en BORRADOR (u ORDENADA con order=true)' })
  create(@Body() dto: CreatePurchaseDto, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    return this.purchases.create(dto, actor, ip);
  }

  @Patch(':id')
  @Permissions('purchases:write')
  @ApiOperation({ summary: 'Modifica un borrador (items reemplaza las líneas); ya ordenada, solo fecha esperada y notas' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePurchaseDto,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip?: string,
  ) {
    return this.purchases.update(id, dto, actor, ip);
  }

  @Post(':id/order')
  @HttpCode(HttpStatus.OK)
  @Permissions('purchases:write')
  @ApiOperation({ summary: 'BORRADOR → ORDENADA (pendiente de recibir)' })
  order(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    return this.purchases.order(id, actor, ip);
  }

  @Post(':id/receive')
  @Permissions('purchases:write', 'inventory:write')
  @ApiOperation({
    summary: 'Registra la mercadería recibida (total o parcial): genera las entradas de inventario y recalcula el costo promedio',
  })
  @ApiResponse({ status: 400, description: 'Cantidad mayor que lo pendiente o línea ajena a la compra' })
  @ApiResponse({ status: 409, description: 'La compra no está ordenada o ya se recibió completa' })
  receive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReceivePurchaseDto,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip?: string,
  ) {
    return this.purchases.receive(id, dto, actor, ip);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Permissions('purchases:write')
  @ApiOperation({ summary: 'Cancela la compra o lo pendiente por recibir (exige motivo)' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelPurchaseDto,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip?: string,
  ) {
    return this.purchases.cancel(id, dto, actor, ip);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions('purchases:write')
  @ApiOperation({ summary: 'Elimina un BORRADOR' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    await this.purchases.remove(id, actor, ip);
    return { deleted: true };
  }
}

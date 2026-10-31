import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  CancelProductionOrderDto,
  CompleteProductionOrderDto,
  CompleteStepDto,
  CreateBomDto,
  CreateProductionOrderDto,
  CreateRouteDto,
  FilterLotDto,
  FilterProductionOrderDto,
  InspectLotDto,
  SetActiveDto,
  UpdateBomDto,
  UpdateRouteDto,
} from './dto/production.dto';
import { ProductionService } from './production.service';

/** Manufactura: BOM, rutas, órdenes de producción, lotes y control de calidad. */
@ApiTags('Producción')
@ApiBearerAuth()
@Controller('production')
export class ProductionController {
  constructor(private readonly production: ProductionService) {}

  // ───────────── BOM ─────────────

  @Get('boms')
  @Permissions('production:read')
  @ApiQuery({ name: 'productId', required: false })
  boms(@Query('productId', new ParseUUIDPipe({ optional: true })) productId?: string) {
    return this.production.boms(productId || undefined);
  }

  @Get('boms/:id')
  @Permissions('production:read')
  bom(@Param('id', ParseUUIDPipe) id: string) {
    return this.production.bom(id);
  }

  @Post('boms')
  @Permissions('production:write')
  @ApiOperation({ summary: 'Crea la lista de materiales del producto (queda como la vigente)' })
  createBom(@Body() dto: CreateBomDto, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    return this.production.createBom(dto, actor, ip);
  }

  @Patch('boms/:id')
  @Permissions('production:write')
  @ApiOperation({ summary: 'Modifica la BOM; si ya se usó en órdenes, crea una versión nueva' })
  updateBom(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBomDto, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    return this.production.updateBom(id, dto, actor, ip);
  }

  @Patch('boms/:id/status')
  @Permissions('production:write')
  setBomActive(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetActiveDto, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    return this.production.setBomActive(id, dto.isActive, actor, ip);
  }

  // ───────────── Rutas ─────────────

  @Get('routes')
  @Permissions('production:read')
  @ApiQuery({ name: 'productId', required: false })
  routes(@Query('productId', new ParseUUIDPipe({ optional: true })) productId?: string) {
    return this.production.routes(productId || undefined);
  }

  @Get('routes/:id')
  @Permissions('production:read')
  route(@Param('id', ParseUUIDPipe) id: string) {
    return this.production.route(id);
  }

  @Post('routes')
  @Permissions('production:write')
  createRoute(@Body() dto: CreateRouteDto, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    return this.production.createRoute(dto, actor, ip);
  }

  @Patch('routes/:id')
  @Permissions('production:write')
  updateRoute(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRouteDto, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    return this.production.updateRoute(id, dto, actor, ip);
  }

  @Patch('routes/:id/status')
  @Permissions('production:write')
  setRouteActive(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetActiveDto, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    return this.production.setRouteActive(id, dto.isActive, actor, ip);
  }

  // ───────────── Órdenes de producción ─────────────

  @Get('orders')
  @Permissions('production:read')
  orders(@Query() filter: FilterProductionOrderDto) {
    return this.production.orders(filter);
  }

  @Get('orders/:id')
  @Permissions('production:read')
  order(@Param('id', ParseUUIDPipe) id: string) {
    return this.production.order(id);
  }

  @Post('orders')
  @Permissions('production:write')
  @ApiOperation({ summary: 'Crea la OP en borrador: materiales según la BOM y pasos según la ruta' })
  createOrder(@Body() dto: CreateProductionOrderDto, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    return this.production.createOrder(dto, actor, ip);
  }

  @Post('orders/:id/release')
  @HttpCode(HttpStatus.OK)
  @Permissions('production:write')
  @ApiOperation({ summary: 'BORRADOR → LIBERADA' })
  release(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    return this.production.release(id, actor, ip);
  }

  @Post('orders/:id/start')
  @HttpCode(HttpStatus.OK)
  @Permissions('production:write', 'inventory:write')
  @ApiOperation({ summary: 'LIBERADA → EN PROCESO: consume los materiales (salidas de inventario)' })
  @ApiResponse({ status: 409, description: 'Stock insuficiente de algún componente' })
  start(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    return this.production.start(id, actor, ip);
  }

  @Post('orders/:id/steps/:stepId/complete')
  @HttpCode(HttpStatus.OK)
  @Permissions('production:write')
  @ApiOperation({ summary: 'Marca hecho un paso de la ruta (en orden)' })
  completeStep(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stepId', ParseUUIDPipe) stepId: string,
    @Body() dto: CompleteStepDto,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip?: string,
  ) {
    return this.production.completeStep(id, stepId, dto, actor, ip);
  }

  @Post('orders/:id/complete')
  @HttpCode(HttpStatus.OK)
  @Permissions('production:write')
  @ApiOperation({ summary: 'EN PROCESO → TERMINADA: las unidades buenas forman un lote pendiente de calidad' })
  complete(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CompleteProductionOrderDto, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    return this.production.complete(id, dto, actor, ip);
  }

  @Post('orders/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @Permissions('production:write')
  @ApiOperation({ summary: 'Cancela una OP en borrador o liberada (todavía sin consumo)' })
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelProductionOrderDto, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    return this.production.cancel(id, dto, actor, ip);
  }

  // ───────────── Lotes y calidad ─────────────

  @Get('lots')
  @Permissions('production:read')
  lots(@Query() filter: FilterLotDto) {
    return this.production.lots(filter);
  }

  @Get('lots/:id')
  @Permissions('production:read')
  lot(@Param('id', ParseUUIDPipe) id: string) {
    return this.production.lot(id);
  }

  @Post('lots/:id/inspections')
  @Permissions('quality:write')
  @ApiOperation({ summary: 'Inspección de calidad: las conformes entran al inventario; las no conformes siguen su disposición' })
  inspect(@Param('id', ParseUUIDPipe) id: string, @Body() dto: InspectLotDto, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    return this.production.inspect(id, dto, actor, ip);
  }
}

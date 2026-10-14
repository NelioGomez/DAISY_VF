import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  AssignTechnicianDto,
  CancelServiceOrderDto,
  CompleteServiceOrderDto,
  CreateServiceOrderDto,
  FilterServiceOrderDto,
  InvoiceServiceOrderDto,
  UpdateServiceOrderDto,
} from './dto/service-order.dto';
import { ServiceOrdersService } from './service-orders.service';

@ApiTags('Service orders (OPI)')
@ApiBearerAuth()
@Controller('service-orders')
export class ServiceOrdersController {
  constructor(private readonly orders: ServiceOrdersService) {}

  @Get()
  @Permissions('service-orders:read')
  @ApiOperation({ summary: 'Lista órdenes de servicio (un técnico solo ve las suyas)' })
  findAll(@Query() filter: FilterServiceOrderDto, @CurrentUser() actor: AuthUser) {
    return this.orders.findAll(filter, actor);
  }

  // Antes de ':id'
  @Get('technicians')
  @Permissions('service-orders:read')
  @ApiOperation({ summary: 'Técnicos activos disponibles para asignar' })
  technicians() {
    return this.orders.technicians();
  }

  @Get(':id')
  @Permissions('service-orders:read')
  @ApiResponse({ status: 404, description: 'Orden no encontrada' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser) {
    return this.orders.findOne(id, actor);
  }

  @Post()
  @Permissions('service-orders:write')
  @ApiOperation({ summary: 'Registra una orden (con técnico nace ASIGNADA). No disponible para técnicos' })
  create(@Body() dto: CreateServiceOrderDto, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    return this.orders.create(dto, actor, ip);
  }

  @Patch(':id')
  @Permissions('service-orders:write')
  @ApiOperation({ summary: 'Edita descripción (personal) o notas de avance (personal o técnico asignado)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceOrderDto,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip?: string,
  ) {
    return this.orders.update(id, dto, actor, ip);
  }

  @Post(':id/assign')
  @HttpCode(HttpStatus.OK)
  @Permissions('service-orders:write')
  @ApiOperation({ summary: 'Asigna o reasigna un técnico (REGISTRADA/ASIGNADA)' })
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTechnicianDto,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip?: string,
  ) {
    return this.orders.assign(id, dto, actor, ip);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @Permissions('service-orders:write')
  @ApiOperation({ summary: 'ASIGNADA → EN PROCESO' })
  start(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    return this.orders.start(id, actor, ip);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @Permissions('service-orders:write')
  @ApiOperation({ summary: 'EN PROCESO → COMPLETADA' })
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteServiceOrderDto,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip?: string,
  ) {
    return this.orders.complete(id, dto, actor, ip);
  }

  @Post(':id/invoice')
  @HttpCode(HttpStatus.OK)
  @Permissions('service-orders:write')
  @ApiOperation({ summary: 'COMPLETADA → FACTURADA, vinculando una venta vigente del mismo cliente' })
  invoice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InvoiceServiceOrderDto,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip?: string,
  ) {
    return this.orders.invoice(id, dto, actor, ip);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Permissions('service-orders:write')
  @ApiOperation({ summary: 'Cancela una orden no finalizada (exige motivo)' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelServiceOrderDto,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip?: string,
  ) {
    return this.orders.cancel(id, dto, actor, ip);
  }
}

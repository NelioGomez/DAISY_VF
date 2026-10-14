import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { ConvertQuotationDto } from '../sales/dto/sale.dto';
import { SalesService } from '../sales/sales.service';
import {
  CreateQuotationDto,
  FilterQuotationDto,
  RejectQuotationDto,
  UpdateQuotationDto,
} from './dto/quotation.dto';
import { QuotationsService } from './quotations.service';

@ApiTags('Quotations')
@ApiBearerAuth()
@Controller('quotations')
export class QuotationsController {
  constructor(
    private readonly quotations: QuotationsService,
    private readonly sales: SalesService,
  ) {}

  @Get()
  @Permissions('quotations:read')
  @ApiOperation({ summary: 'Lista cotizaciones (marca como VENCIDAS las que pasaron su fecha de validez)' })
  findAll(@Query() filter: FilterQuotationDto) {
    return this.quotations.findAll(filter);
  }

  @Get(':id')
  @Permissions('quotations:read')
  @ApiResponse({ status: 404, description: 'Cotización no encontrada' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.quotations.findOne(id);
  }

  @Post()
  @Permissions('quotations:write')
  @ApiOperation({ summary: 'Crea una cotización (PENDIENTE, o BORRADOR con asDraft=true); calcula IVA en el servidor' })
  create(@Body() dto: CreateQuotationDto, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    return this.quotations.create(dto, actor, ip);
  }

  @Patch(':id')
  @Permissions('quotations:write')
  @ApiOperation({ summary: 'Modifica una cotización en BORRADOR o PENDIENTE (items reemplaza las líneas)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuotationDto,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip?: string,
  ) {
    return this.quotations.update(id, dto, actor, ip);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @Permissions('quotations:write')
  @ApiOperation({ summary: 'BORRADOR → PENDIENTE' })
  submit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    return this.quotations.submit(id, actor, ip);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Permissions('quotations:write')
  @ApiOperation({ summary: 'PENDIENTE → APROBADA' })
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    return this.quotations.approve(id, actor, ip);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @Permissions('quotations:write')
  @ApiOperation({ summary: 'PENDIENTE/APROBADA → RECHAZADA' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectQuotationDto,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip?: string,
  ) {
    return this.quotations.reject(id, dto.reason, actor, ip);
  }

  @Post(':id/convert')
  @Permissions('quotations:write', 'sales:write')
  @ApiOperation({
    summary: 'Convierte una cotización APROBADA en venta: descuenta inventario y genera la factura',
  })
  @ApiResponse({ status: 409, description: 'No está aprobada, ya fue convertida, vencida o sin stock' })
  convert(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConvertQuotationDto,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip?: string,
  ) {
    return this.sales.convertQuotation(id, dto, actor, ip);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions('quotations:write')
  @ApiOperation({ summary: 'Elimina un BORRADOR' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    await this.quotations.remove(id, actor, ip);
    return { deleted: true };
  }
}

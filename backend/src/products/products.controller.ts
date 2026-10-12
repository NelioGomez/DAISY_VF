import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { SetStatusDto } from '../common/dto/set-status.dto';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { CreateProductDto, FilterProductDto, UpdateProductDto } from './dto/product.dto';
import { ProductsService } from './products.service';

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @Permissions('products:read')
  @ApiOperation({
    summary: 'Lista productos: búsqueda, filtros (categoría, marca, estado, stock crítico), orden y paginación',
  })
  findAll(@Query() filter: FilterProductDto) {
    return this.products.findAll(filter);
  }

  // Antes de ':id' para que "export" no se interprete como un UUID.
  @Get('export')
  @Permissions('products:read')
  @ApiOperation({ summary: 'Exporta a CSV el resultado de los filtros (sin paginar)' })
  @ApiProduces('text/csv')
  async export(
    @Query() filter: FilterProductDto,
    @CurrentUser() actor: AuthUser,
    @Res() res: Response,
    @ClientIp() ip?: string,
  ): Promise<void> {
    const csv = await this.products.exportCsv(filter, actor, ip);
    const date = new Date().toISOString().slice(0, 10);
    res
      .set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="productos-${date}.csv"`,
      })
      .send(csv);
  }

  @Get(':id')
  @Permissions('products:read')
  @ApiOperation({ summary: 'Consulta un producto' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.findOne(id);
  }

  @Post()
  @Permissions('products:write')
  @ApiOperation({ summary: 'Registra un producto (nace con stock 0; el stock entra por inventario)' })
  @ApiResponse({ status: 409, description: 'El SKU ya existe' })
  create(@Body() dto: CreateProductDto, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    return this.products.create(dto, actor, ip);
  }

  @Patch(':id')
  @Permissions('products:write')
  @ApiOperation({ summary: 'Actualiza datos del producto (no modifica stock ni costo promedio)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip?: string,
  ) {
    return this.products.update(id, dto, actor, ip);
  }

  @Patch(':id/status')
  @Permissions('products:write')
  @ApiOperation({ summary: 'Activa o desactiva un producto' })
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetStatusDto,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip?: string,
  ) {
    return this.products.setStatus(id, dto.isActive, actor, ip);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions('products:write')
  @ApiOperation({ summary: 'Elimina un producto sin movimientos ni ventas' })
  @ApiResponse({ status: 409, description: 'Tiene movimientos, cotizaciones o ventas: desactívelo' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip?: string,
  ) {
    await this.products.remove(id, actor, ip);
    return { deleted: true };
  }
}
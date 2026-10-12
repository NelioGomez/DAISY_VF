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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ClientIp } from '../../common/decorators/client-ip.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { SetStatusDto } from '../../common/dto/set-status.dto';
import type { AuthUser } from '../../common/interfaces/auth-user.interface';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto, FilterSupplierDto, UpdateSupplierDto } from '../dto/supplier.dto';

@ApiTags('Suppliers')
@ApiBearerAuth()
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  @Permissions('suppliers:read')
  @ApiOperation({ summary: 'Lista proveedores (filtros: búsqueda, estado, nacional/internacional)' })
  findAll(@Query() filter: FilterSupplierDto) {
    return this.suppliers.findAll(filter);
  }

  @Get(':id')
  @Permissions('suppliers:read')
  @ApiResponse({ status: 404, description: 'Proveedor no encontrado' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.suppliers.findOne(id);
  }

  @Post()
  @Permissions('suppliers:write')
  @ApiResponse({ status: 409, description: 'El identificador fiscal ya existe' })
  create(@Body() dto: CreateSupplierDto, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    return this.suppliers.create(dto, actor, ip);
  }

  @Patch(':id')
  @Permissions('suppliers:write')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierDto,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip?: string,
  ) {
    return this.suppliers.update(id, dto, actor, ip);
  }

  @Patch(':id/status')
  @Permissions('suppliers:write')
  @ApiOperation({ summary: 'Activa o desactiva un proveedor' })
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetStatusDto,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip?: string,
  ) {
    return this.suppliers.setStatus(id, dto.isActive, actor, ip);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions('suppliers:write')
  @ApiResponse({ status: 409, description: 'Tiene entradas de inventario: desactívelo' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip?: string,
  ) {
    await this.suppliers.remove(id, actor, ip);
    return { deleted: true };
  }
}
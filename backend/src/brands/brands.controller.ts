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
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { SetStatusDto } from '../common/dto/set-status.dto';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { BrandsService } from './brands.service';
import { CreateBrandDto, FilterBrandDto, UpdateBrandDto } from './dto/brand.dto';

@ApiTags('Brands')
@ApiBearerAuth()
@Controller('brands')
export class BrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Get()
  @Permissions('brands:read')
  @ApiOperation({ summary: 'Lista marcas con su cantidad de productos — requiere brands:read' })
  findAll(@Query() filter: FilterBrandDto) {
    return this.brands.findAll(filter);
  }

  @Get(':id')
  @Permissions('brands:read')
  @ApiOperation({ summary: 'Consulta una marca — requiere brands:read' })
  @ApiResponse({ status: 404, description: 'Marca no encontrada' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.brands.findOne(id);
  }

  @Post()
  @Permissions('brands:write')
  @ApiOperation({ summary: 'Crea una marca — requiere brands:write' })
  @ApiResponse({ status: 409, description: 'Nombre duplicado' })
  create(@Body() dto: CreateBrandDto, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    return this.brands.create(dto, actor, ip);
  }

  @Patch(':id')
  @Permissions('brands:write')
  @ApiOperation({ summary: 'Edita una marca — requiere brands:write' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBrandDto,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip?: string,
  ) {
    return this.brands.update(id, dto, actor, ip);
  }

  @Patch(':id/status')
  @Permissions('brands:write')
  @ApiOperation({ summary: 'Activa o desactiva una marca — requiere brands:write' })
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetStatusDto,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip?: string,
  ) {
    return this.brands.setStatus(id, dto.isActive, actor, ip);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions('brands:write')
  @ApiOperation({ summary: 'Elimina una marca sin productos — requiere brands:write' })
  @ApiResponse({ status: 409, description: 'La marca tiene productos asociados' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip?: string,
  ) {
    await this.brands.remove(id, actor, ip);
    return { deleted: true };
  }
}
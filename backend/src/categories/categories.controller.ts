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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, FilterCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@ApiTags('Categories')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @Permissions('categories:read')
  @ApiOperation({ summary: 'Lista categorías con su cantidad de productos — requiere categories:read' })
  findAll(@Query() filter: FilterCategoryDto) {
    return this.categories.findAll(filter);
  }

  @Get(':id')
  @Permissions('categories:read')
  @ApiOperation({ summary: 'Consulta una categoría — requiere categories:read' })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.categories.findOne(id);
  }

  @Post()
  @Permissions('categories:write')
  @ApiOperation({ summary: 'Crea una categoría — requiere categories:write' })
  @ApiResponse({ status: 409, description: 'Nombre duplicado' })
  create(@Body() dto: CreateCategoryDto, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    return this.categories.create(dto, actor, ip);
  }

  @Patch(':id')
  @Permissions('categories:write')
  @ApiOperation({ summary: 'Edita una categoría — requiere categories:write' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip?: string,
  ) {
    return this.categories.update(id, dto, actor, ip);
  }

  @Patch(':id/status')
  @Permissions('categories:write')
  @ApiOperation({ summary: 'Activa o desactiva una categoría — requiere categories:write' })
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetStatusDto,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip?: string,
  ) {
    return this.categories.setStatus(id, dto.isActive, actor, ip);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions('categories:write')
  @ApiOperation({ summary: 'Elimina una categoría sin productos — requiere categories:write' })
  @ApiResponse({ status: 409, description: 'La categoría tiene productos asociados' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip?: string,
  ) {
    await this.categories.remove(id, actor, ip);
    return { deleted: true };
  }
}
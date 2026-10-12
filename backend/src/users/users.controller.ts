import {
  Body,
  Controller,
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
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { FilterUserDto } from './dto/filter-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto, ResetPasswordDto, SetUserStatusDto } from './dto/user-password.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Permissions('users:read')
  @ApiOperation({ summary: 'Lista usuarios (paginado, con búsqueda y filtros) — requiere users:read' })
  findAll(@Query() filter: FilterUserDto) {
    return this.users.findAll(filter);
  }

  // Debe declararse antes de ':id' para que "me" no se interprete como un UUID.
  @Patch('me/password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cambia la contraseña del usuario autenticado' })
  @ApiResponse({ status: 400, description: 'Contraseña actual incorrecta' })
  async changeOwnPassword(
    @CurrentUser() actor: AuthUser,
    @Body() dto: ChangePasswordDto,
    @ClientIp() ip?: string,
  ) {
    await this.users.changeOwnPassword(actor, dto, ip);
    return { passwordChanged: true };
  }

  @Get(':id')
  @Permissions('users:read')
  @ApiOperation({ summary: 'Consulta un usuario — requiere users:read' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.findOne(id);
  }

  @Post()
  @Permissions('users:write')
  @ApiOperation({ summary: 'Crea un usuario y le asigna un rol — requiere users:write' })
  @ApiResponse({ status: 409, description: 'Usuario o correo duplicado' })
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    return this.users.create(dto, actor, ip);
  }

  @Patch(':id')
  @Permissions('users:write')
  @ApiOperation({ summary: 'Edita nombres, correo o rol — requiere users:write' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip?: string,
  ) {
    return this.users.update(id, dto, actor, ip);
  }

  @Patch(':id/status')
  @Permissions('users:write')
  @ApiOperation({ summary: 'Activa o desactiva un usuario — requiere users:write' })
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserStatusDto,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip?: string,
  ) {
    return this.users.setStatus(id, dto.isActive, actor, ip);
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  @Permissions('users:write')
  @ApiOperation({ summary: 'Restablece la contraseña de un usuario — requiere users:write' })
  async resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip?: string,
  ) {
    await this.users.resetPassword(id, dto.newPassword, actor, ip);
    return { passwordReset: true };
  }
}

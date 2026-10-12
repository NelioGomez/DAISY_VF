import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { SetRolePermissionsDto } from './dto/set-role-permissions.dto';
import { RolesService } from './roles.service';

@ApiTags('Roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @Permissions('users:read')
  @ApiOperation({ summary: 'Lista los roles con sus permisos — requiere users:read' })
  findAll() {
    return this.roles.findAll();
  }

  // Antes de ':id' para evitar ambigüedad de rutas.
  @Get('permissions')
  @Permissions('users:read')
  @ApiOperation({ summary: 'Lista todos los permisos disponibles — requiere users:read' })
  findAllPermissions() {
    return this.roles.findAllPermissions();
  }

  @Put(':id/permissions')
  @Permissions('users:write')
  @ApiOperation({ summary: 'Reemplaza los permisos de un rol — requiere users:write' })
  @ApiResponse({ status: 403, description: 'El rol Administrador no se puede modificar' })
  setPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetRolePermissionsDto,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip?: string,
  ) {
    return this.roles.setPermissions(id, dto.permissions, actor, ip);
  }
}

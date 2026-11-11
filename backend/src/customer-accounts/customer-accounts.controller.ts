import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { CustomerAccountsService } from './customer-accounts.service';
import {
  CreateCustomerAccountDto,
  FilterCustomerAccountDto,
  ResetCustomerPasswordDto,
  SetCustomerAccountStatusDto,
  UpdateCustomerAccountDto,
} from './dto/customer-account.dto';

/** Cuentas del portal de clientes administradas por el personal. Solo el administrador (users:*). */
@ApiTags('Customer accounts')
@ApiBearerAuth()
@Controller('customer-accounts')
export class CustomerAccountsController {
  constructor(private readonly accounts: CustomerAccountsService) {}

  @Get()
  @Permissions('users:read')
  @ApiOperation({ summary: 'Lista las cuentas del portal (búsqueda, estado, cliente) — requiere users:read' })
  findAll(@Query() f: FilterCustomerAccountDto) {
    return this.accounts.findAll(f);
  }

  @Get(':id')
  @Permissions('users:read')
  @ApiOperation({ summary: 'Consulta una cuenta del portal — requiere users:read' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.accounts.findOne(id);
  }

  @Post()
  @Permissions('users:write')
  @ApiOperation({ summary: 'Crea una cuenta del portal para un cliente existente — requiere users:write' })
  @ApiResponse({ status: 409, description: 'El correo ya tiene cuenta' })
  create(@Body() dto: CreateCustomerAccountDto, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    return this.accounts.create(dto, actor, ip);
  }

  @Patch(':id')
  @Permissions('users:write')
  @ApiOperation({ summary: 'Cambia el correo de acceso, el contacto o el teléfono — requiere users:write' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCustomerAccountDto, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    return this.accounts.update(id, dto, actor, ip);
  }

  @Patch(':id/status')
  @Permissions('users:write')
  @ApiOperation({ summary: 'Activa o desactiva una cuenta del portal — requiere users:write' })
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetCustomerAccountStatusDto, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    return this.accounts.setStatus(id, dto.isActive, actor, ip);
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  @Permissions('users:write')
  @ApiOperation({ summary: 'Pone una contraseña temporal y cierra las sesiones del cliente — requiere users:write' })
  async resetPassword(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ResetCustomerPasswordDto, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    await this.accounts.resetPassword(id, dto.newPassword, actor, ip);
    return { passwordReset: true };
  }

  @Post(':id/revoke-sessions')
  @HttpCode(HttpStatus.OK)
  @Permissions('users:write')
  @ApiOperation({ summary: 'Cierra las sesiones abiertas del cliente — requiere users:write' })
  async revokeSessions(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    await this.accounts.revokeSessions(id, actor, ip);
    return { sessionsRevoked: true };
  }
}

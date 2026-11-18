import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { UpdateSettingsDto } from './dto/settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('Configuración')
@Controller()
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @ApiBearerAuth()
  @Get('settings')
  @ApiOperation({ summary: 'Parámetros del negocio para la interfaz (impuesto, crédito, empresa)' })
  getAll() {
    return this.settings.getAll();
  }

  @ApiBearerAuth()
  @Patch('settings')
  @Permissions('settings:write')
  @ApiOperation({ summary: 'Cambia parámetros (solo Administración); queda en auditoría' })
  update(@Body() dto: UpdateSettingsDto, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    return this.settings.update(dto, actor, ip);
  }

  @Public()
  @Get('public/settings')
  @ApiOperation({ summary: 'Datos de contacto de la empresa para el sitio público' })
  getPublic() {
    return this.settings.getPublic();
  }
}

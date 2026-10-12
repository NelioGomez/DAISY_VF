import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { DashboardService } from './dashboard.service'; //Suele ocurrir un error al momento de referenciar a otro archivo, al final se solucionó solo dandole espacio y después borrando el espacio XD

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('summary')
  @Permissions('dashboard:read')
  @ApiOperation({
    summary:
      'Resumen gerencial con datos reales: ventas, stock crítico, cuentas por cobrar, OPI abiertas, cotizaciones, consultas y alertas. Cada sección depende de los permisos del usuario.',
  })
  summary(@CurrentUser() actor: AuthUser) {
    return this.dashboard.summary(actor);
  }
}
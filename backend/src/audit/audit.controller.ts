import { Controller, Get, Param, ParseUUIDPipe, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { AuditQueryService } from './audit-query.service';
import { FilterAuditDto } from './dto/audit.dto';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly auditQuery: AuditQueryService) {}

  @Get()
  @Permissions('audit:read')
  @ApiOperation({ summary: 'Bitácora de auditoría: filtros por usuario, módulo, acción, entidad, fechas y texto' })
  findAll(@Query() filter: FilterAuditDto) {
    return this.auditQuery.findAll(filter);
  }

  // Rutas fijas antes de ':id'
  @Get('filters')
  @Permissions('audit:read')
  @ApiOperation({ summary: 'Módulos y acciones existentes (para los selectores de filtro)' })
  filters() {
    return this.auditQuery.filters();
  }

  @Get('export')
  @Permissions('audit:read')
  @ApiProduces('text/csv')
  @ApiOperation({ summary: 'Exporta a CSV el resultado de los filtros (la exportación queda auditada)' })
  async export(
    @Query() filter: FilterAuditDto,
    @CurrentUser() actor: AuthUser,
    @Res() res: Response,
    @ClientIp() ip?: string,
  ): Promise<void> {
    const csv = await this.auditQuery.exportCsv(filter, actor, ip);
    const date = new Date().toISOString().slice(0, 10);
    res
      .set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="auditoria-${date}.csv"`,
      })
      .send(csv);
  }

  @Get(':id')
  @Permissions('audit:read')
  @ApiResponse({ status: 404, description: 'Registro no encontrado' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.auditQuery.findOne(id);
  }
}
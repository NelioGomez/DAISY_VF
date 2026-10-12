import { Controller, Get, Param, ParseEnumPipe, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { ReportName, ReportQueryDto } from './dto/report.dto';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  @Permissions('reports:read')
  @ApiOperation({ summary: 'Catálogo de reportes disponibles y los filtros que admite cada uno' })
  catalog() {
    return this.reports.catalog();
  }

  @Get(':name')
  @Permissions('reports:read')
  @ApiParam({ name: 'name', enum: ReportName })
  @ApiOperation({ summary: 'Ejecuta un reporte: columnas, filas y totales (sin fechas = últimos 30 días)' })
  run(@Param('name', new ParseEnumPipe(ReportName)) name: ReportName, @Query() query: ReportQueryDto) {
    return this.reports.run(name, query);
  }

  @Get(':name/export')
  @Permissions('reports:read')
  @ApiParam({ name: 'name', enum: ReportName })
  @ApiProduces('text/csv')
  @ApiOperation({ summary: 'Exporta el reporte a CSV (mismos filtros)' })
  async export(
    @Param('name', new ParseEnumPipe(ReportName)) name: ReportName,
    @Query() query: ReportQueryDto,
    @CurrentUser() actor: AuthUser,
    @Res() res: Response,
    @ClientIp() ip?: string,
  ): Promise<void> {
    const { csv, filename } = await this.reports.exportCsv(name, query, actor, ip);
    res
      .set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      })
      .send(csv);
  }
}
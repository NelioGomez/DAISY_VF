import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { FilterInquiryDto, SetInquiryStatusDto } from './dto/inquiry.dto';
import { InquiriesService } from './inquiries.service';

@ApiTags('Inquiries')
@ApiBearerAuth()
@Controller('inquiries')
export class InquiriesController {
  constructor(private readonly inquiries: InquiriesService) {}

  @Get()
  @Permissions('inquiries:read')
  @ApiOperation({ summary: 'Consultas recibidas del catálogo web, con conteo por estado' })
  findAll(@Query() filter: FilterInquiryDto) {
    return this.inquiries.findAll(filter);
  }

  @Get(':id')
  @Permissions('inquiries:read')
  @ApiResponse({ status: 404, description: 'Consulta no encontrada' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.inquiries.findOne(id);
  }

  @Patch(':id/status')
  @Permissions('inquiries:write')
  @ApiOperation({ summary: 'NUEVA → ATENDIDA → CERRADA (una nueva puede cerrarse directamente)' })
  @ApiResponse({ status: 409, description: 'Transición no permitida' })
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetInquiryStatusDto,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip?: string,
  ) {
    return this.inquiries.setStatus(id, dto.status, actor, ip);
  }
}
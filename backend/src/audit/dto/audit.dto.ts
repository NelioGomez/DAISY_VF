import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { trim } from '../../common/transformers/text.transformers';

/** Grupos predefinidos para el panel de administración (mejora n.° 71). */
export const AUDIT_SCOPES = ['access', 'admin'] as const;
export type AuditScope = (typeof AUDIT_SCOPES)[number];

export class FilterAuditDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: AUDIT_SCOPES,
    description: 'access = inicios de sesión, intentos fallidos y recuperaciones (SIVEN y portal); admin = cambios del panel de administración',
  })
  @IsOptional()
  @IsIn(AUDIT_SCOPES)
  scope?: AuditScope;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Nombre de usuario (contiene)' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  username?: string;

  @ApiPropertyOptional({ example: 'sales', description: 'Módulo exacto (ver /audit/filters)' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  module?: string;

  @ApiPropertyOptional({ example: 'VOID', description: 'Acción exacta (ver /audit/filters)' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  action?: string;

  @ApiPropertyOptional({ example: 'Sale' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  entity?: string;

  @ApiPropertyOptional({ description: 'Id del registro afectado' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(60)
  entityId?: string;

  @ApiPropertyOptional({ description: 'Busca en la descripción' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-01-31' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

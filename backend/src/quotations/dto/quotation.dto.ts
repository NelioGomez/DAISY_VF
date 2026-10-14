import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { trim } from '../../common/transformers/text.transformers';
import { QuotationStatus } from '../../generated/prisma/client';
import { DocumentItemDto } from '../../sales/dto/sale.dto';

export class CreateQuotationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  customerId!: string;

  @ApiProperty({ type: [DocumentItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe incluir al menos un producto' })
  @ArrayMaxSize(200, { message: 'Máximo 200 líneas por cotización' })
  @ValidateNested({ each: true })
  @Type(() => DocumentItemDto)
  items!: DocumentItemDto[];

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Válida hasta (por defecto 15 días; máximo 365)' })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({ description: 'true = guardar como borrador (por defecto nace PENDIENTE)', default: false })
  @IsOptional()
  @IsBoolean()
  asDraft?: boolean;
}

/** Solo editable en BORRADOR o PENDIENTE. Si se envían items, reemplazan a los anteriores. */
export class UpdateQuotationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ type: [DocumentItemDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe incluir al menos un producto' })
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => DocumentItemDto)
  items?: DocumentItemDto[];

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiPropertyOptional({ nullable: true })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class RejectQuotationDto {
  @ApiPropertyOptional({ description: 'Motivo del rechazo (queda en la auditoría)' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class FilterQuotationDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Busca por código o nombre del cliente' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: QuotationStatus })
  @IsOptional()
  @IsEnum(QuotationStatus)
  status?: QuotationStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-01-31' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

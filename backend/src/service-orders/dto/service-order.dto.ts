import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { trim } from '../../common/transformers/text.transformers';
import { ServiceOrderStatus } from '../../generated/prisma/client';

export class CreateServiceOrderDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  customerId!: string;

  @ApiProperty({ example: 'Calibración de dispensador de 4 mangueras' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  @MaxLength(4000)
  description!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Si se indica, la orden nace ASIGNADA' })
  @IsOptional()
  @IsUUID()
  technicianId?: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class UpdateServiceOrderDto {
  @ApiPropertyOptional({ description: 'Solo REGISTRADA/ASIGNADA y solo personal no técnico' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional({ description: 'Notas de avance; el técnico asignado también puede editarlas' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class AssignTechnicianDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  technicianId!: string;
}

export class CompleteServiceOrderDto {
  @ApiPropertyOptional({ description: 'Resumen del trabajo realizado (se agrega a las notas)' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summary?: string;
}

export class InvoiceServiceOrderDto {
  @ApiProperty({ format: 'uuid', description: 'Venta vigente del mismo cliente que factura el servicio' })
  @IsUUID()
  saleId!: string;
}

export class CancelServiceOrderDto {
  @ApiProperty({ minLength: 5 })
  @Transform(trim)
  @IsString()
  @MinLength(5, { message: 'Indique el motivo (mínimo 5 caracteres)' })
  @MaxLength(500)
  reason!: string;
}

export class FilterServiceOrderDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Busca por código, descripción o nombre del cliente' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: ServiceOrderStatus })
  @IsOptional()
  @IsEnum(ServiceOrderStatus)
  status?: ServiceOrderStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Ignorado para técnicos: solo ven las suyas' })
  @IsOptional()
  @IsUUID()
  technicianId?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-01-31' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

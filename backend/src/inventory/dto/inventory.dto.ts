import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { InventoryMovementType } from '../../generated/prisma/client';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Cada tipo exige campos distintos:
 *  - ENTRY:      quantity + unitCost (+ supplierId opcional)
 *  - EXIT:       quantity + note (merma, uso interno…; las ventas descuentan solas)
 *  - ADJUSTMENT: newStock (conteo físico) + note
 */
export class CreateMovementDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ enum: InventoryMovementType })
  @IsEnum(InventoryMovementType, { message: 'Tipo inválido (ENTRY, EXIT o ADJUSTMENT)' })
  type!: InventoryMovementType;

  @ApiPropertyOptional({ description: 'ENTRY y EXIT', minimum: 1 })
  @ValidateIf((o: CreateMovementDto) => o.type !== InventoryMovementType.ADJUSTMENT)
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad debe ser mayor que cero' })
  @Max(1_000_000)
  quantity?: number;

  @ApiPropertyOptional({ description: 'Solo ENTRY: costo unitario de esta compra (hasta 4 decimales)' })
  @ValidateIf((o: CreateMovementDto) => o.type === InventoryMovementType.ENTRY)
  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'El costo debe ser un número con máximo 4 decimales' })
  @Min(0, { message: 'El costo no puede ser negativo' })
  @Max(999_999_999.9999)
  unitCost?: number;

  @ApiPropertyOptional({ description: 'Solo ADJUSTMENT: stock contado (absoluto)', minimum: 0 })
  @ValidateIf((o: CreateMovementDto) => o.type === InventoryMovementType.ADJUSTMENT)
  @IsInt({ message: 'El stock contado debe ser un número entero' })
  @Min(0, { message: 'El stock contado no puede ser negativo' })
  @Max(2_000_000_000)
  newStock?: number;

  @ApiPropertyOptional({ format: 'uuid', description: 'Solo ENTRY' })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Factura/guía del proveedor, etc.' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @ApiPropertyOptional({ description: 'Obligatoria (mín. 5 caracteres) en EXIT y ADJUSTMENT' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class FilterMovementDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ enum: InventoryMovementType })
  @IsOptional()
  @IsEnum(InventoryMovementType)
  type?: InventoryMovementType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Usuario que registró el movimiento' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Busca en referencia, nota, SKU y nombre del producto' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ example: '2026-01-01', description: 'Desde (inclusive); fecha o ISO' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-01-31', description: 'Hasta (inclusive); fecha o ISO' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

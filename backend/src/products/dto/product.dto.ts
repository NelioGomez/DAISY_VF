import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { UnitOfMeasure } from '../../generated/prisma/client';
import { SortOrder } from '../../common/dto/sort-order.enum';
import { emptyToNull } from '../../common/transformers/text.transformers';
import { toBoolean } from '../../common/transformers/to-boolean.transformer';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
const trimUpper = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

const MAX_MONEY = 999_999_999_999.99;

/**
 * El stock y el costo promedio NO se envían aquí: solo cambian mediante
 * movimientos de inventario (Fase 9). Todo producto nace con stock 0.
 */
export class CreateProductDto {
  @ApiProperty({ example: 'GIL-NOZ-001', description: 'Único; se guarda en mayúsculas' })
  @Transform(trimUpper)
  @IsString()
  @IsNotEmpty({ message: 'El SKU es obligatorio' })
  @MaxLength(60)
  @Matches(/^[A-Z0-9][A-Z0-9._\-/]*$/, {
    message: 'El SKU solo puede contener letras, números, punto, guion, guion bajo y diagonal',
  })
  sku!: string;

  @ApiProperty({ example: 'Boquilla automática 3/4"' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(200)
  name!: string;

  /** Código de barras (EAN/UPC/Code 128) que lee el escáner del punto de venta (mejora n.° 17). */
  @ApiPropertyOptional({ example: '7501234567890', nullable: true, description: 'Único; vacío = sin código' })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9\-.]+$/, { message: 'El código de barras solo admite letras, números, guion y punto' })
  barcode?: string | null;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    enum: UnitOfMeasure,
    default: UnitOfMeasure.UNIT,
    description: 'Unidad en que se controla el stock (p. ej. FOOT para manguera a granel que se consume por pie)',
  })
  @IsOptional()
  @IsEnum(UnitOfMeasure, { message: 'Unidad de medida inválida' })
  unit?: UnitOfMeasure;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  brandId?: string | null;

  @ApiPropertyOptional({
    example: 125.5,
    minimum: 0,
    description: 'Precio comercial. Requiere el permiso prices:write (Administración / Gerencia); sin él el producto nace sin precio.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El precio debe ser un número con máximo 2 decimales' })
  @Min(0, { message: 'El precio no puede ser negativo' })
  @Max(MAX_MONEY)
  salePrice?: number;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @IsInt({ message: 'El stock mínimo debe ser un número entero' })
  @Min(0, { message: 'El stock mínimo no puede ser negativo' })
  @Max(1_000_000)
  minStock?: number;

  @ApiPropertyOptional({
    nullable: true,
    minimum: 0,
    description: 'Tope de reposición: el panel de reabastecimiento sugiere comprar hasta este nivel (≥ stock mínimo)',
  })
  @IsOptional()
  @IsInt({ message: 'El stock máximo debe ser un número entero' })
  @Min(0, { message: 'El stock máximo no puede ser negativo' })
  @Max(1_000_000)
  maxStock?: number | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** El estado se cambia con PATCH /products/:id/status. */
export class UpdateProductDto extends PartialType(OmitType(CreateProductDto, ['isActive'] as const)) {
  @ApiPropertyOptional({ description: 'Motivo del cambio de precio (queda en el historial)', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  priceReason?: string;
}

export enum ProductSortField {
  NAME = 'name',
  SKU = 'sku',
  SALE_PRICE = 'salePrice',
  STOCK = 'stock',
  CREATED_AT = 'createdAt',
}

export class FilterProductDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Busca en SKU, nombre y descripción' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'true = solo stock crítico (stock <= stock mínimo)' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  lowStock?: boolean;

  @ApiPropertyOptional({ enum: ProductSortField, default: ProductSortField.NAME })
  @IsOptional()
  @IsEnum(ProductSortField)
  sortBy?: ProductSortField;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.ASC })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder;
}

/** Cambio del precio comercial (sección de Precios: Administración y Gerencia). */
export class SetProductPriceDto {
  @ApiProperty({ example: 145.5, minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El precio debe ser un número con máximo 2 decimales' })
  @Min(0, { message: 'El precio no puede ser negativo' })
  @Max(MAX_MONEY)
  salePrice!: number;

  @ApiPropertyOptional({ description: 'Motivo del cambio (queda en el historial)', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

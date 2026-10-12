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
import { SortOrder } from '../../common/dto/sort-order.enum';
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

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  brandId?: string | null;

  @ApiProperty({ example: 125.5, minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El precio debe ser un número con máximo 2 decimales' })
  @Min(0, { message: 'El precio no puede ser negativo' })
  @Max(MAX_MONEY)
  salePrice!: number;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @IsInt({ message: 'El stock mínimo debe ser un número entero' })
  @Min(0, { message: 'El stock mínimo no puede ser negativo' })
  @Max(1_000_000)
  minStock?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** El estado se cambia con PATCH /products/:id/status. */
export class UpdateProductDto extends PartialType(OmitType(CreateProductDto, ['isActive'] as const)) {}

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
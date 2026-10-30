import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
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
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { emptyToNull, trim } from '../../common/transformers/text.transformers';
import { Currency, PurchaseStatus } from '../../generated/prisma/client';

const MAX_MONEY = 999_999_999_999.99;
const MAX_COST = 999_999_999.9999;

/** Línea de la orden de compra. El costo es el que cobra el proveedor, en la moneda de la compra. */
export class PurchaseItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad debe ser mayor que cero' })
  @Max(1_000_000)
  quantity!: number;

  @ApiProperty({ example: 950.5, description: 'Costo unitario del proveedor (hasta 4 decimales)' })
  @IsNumber({ maxDecimalPlaces: 4 }, { message: 'El costo debe ser un número con máximo 4 decimales' })
  @Min(0, { message: 'El costo no puede ser negativo' })
  @Max(MAX_COST)
  unitCost!: number;
}

export class CreatePurchaseDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  supplierId!: string;

  @ApiPropertyOptional({ enum: Currency, default: Currency.NIO })
  @IsOptional()
  @IsEnum(Currency, { message: 'Moneda inválida (NIO o USD)' })
  currency?: Currency;

  @ApiPropertyOptional({ example: 36.6243, description: 'C$ por US$. Obligatorio en dólares; en córdobas es 1.' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 }, { message: 'El tipo de cambio admite hasta 6 decimales' })
  @Min(0.000001, { message: 'El tipo de cambio debe ser mayor que cero' })
  @Max(999_999)
  exchangeRate?: number;

  @ApiPropertyOptional({ example: '2026-11-15', description: 'Fecha esperada de llegada' })
  @IsOptional()
  @IsDateString()
  expectedAt?: string;

  @ApiPropertyOptional({ example: 1500, description: 'Flete, aduana y otros gastos (moneda de la compra); se prorratean en el costo' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY)
  additionalCosts?: number;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiProperty({ type: [PurchaseItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe incluir al menos un producto' })
  @ArrayMaxSize(200, { message: 'Máximo 200 líneas por compra' })
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items!: PurchaseItemDto[];

  @ApiPropertyOptional({ default: false, description: 'true = confirmar la orden al guardarla (queda pendiente de recibir)' })
  @IsOptional()
  @IsBoolean()
  order?: boolean;
}

/**
 * En BORRADOR se puede cambiar todo (items reemplaza las líneas). Ya ordenada solo la fecha
 * esperada y las notas: el proveedor, la moneda y los gastos definen el costo de lo que llega.
 */
export class UpdatePurchaseDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ enum: Currency })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0.000001)
  @Max(999_999)
  exchangeRate?: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsDateString()
  expectedAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY)
  additionalCosts?: number;

  @ApiPropertyOptional({ nullable: true })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

  @ApiPropertyOptional({ type: [PurchaseItemDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe incluir al menos un producto' })
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items?: PurchaseItemDto[];
}

export class ReceiveItemDto {
  @ApiProperty({ format: 'uuid', description: 'Línea de la compra' })
  @IsUUID()
  purchaseItemId!: string;

  @ApiProperty({ minimum: 1, description: 'Unidades que llegaron (como máximo lo pendiente)' })
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad debe ser mayor que cero' })
  @Max(1_000_000)
  quantity!: number;
}

export class ReceivePurchaseDto {
  @ApiProperty({ type: [ReceiveItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Indique al menos una línea recibida' })
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ReceiveItemDto)
  items!: ReceiveItemDto[];

  @ApiPropertyOptional({ description: 'Factura o guía del proveedor, estado de la mercadería…' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CancelPurchaseDto {
  @ApiProperty({ minLength: 5 })
  @Transform(trim)
  @IsString()
  @MinLength(5, { message: 'Indique el motivo (mínimo 5 caracteres)' })
  @MaxLength(500)
  reason!: string;
}

export class FilterPurchaseDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Busca por código (OC-…) o nombre del proveedor' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: PurchaseStatus })
  @IsOptional()
  @IsEnum(PurchaseStatus)
  status?: PurchaseStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Compras que incluyen este producto' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-01-31' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

/** Posponer un producto en el panel de reabastecimiento. */
export class PostponeRestockDto {
  @ApiProperty({ minimum: 1, maximum: 90, example: 7 })
  @IsInt()
  @Min(1, { message: 'Entre 1 y 90 días' })
  @Max(90, { message: 'Entre 1 y 90 días' })
  days!: number;

  @ApiPropertyOptional({ description: 'Por qué no conviene comprar todavía (queda en auditoría)' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class FilterRestockDto {
  @ApiPropertyOptional({ description: 'true = incluye los productos pospuestos' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === true || value === 'true')
  @IsBoolean()
  includePostponed?: boolean;
}

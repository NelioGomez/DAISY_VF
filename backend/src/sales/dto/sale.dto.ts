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
import { toBoolean } from '../../common/transformers/to-boolean.transformer';
import { trim } from '../../common/transformers/text.transformers';
import { PaymentMethod, PaymentStatus, SaleStatus } from '../../generated/prisma/client';

const MAX_MONEY = 999_999_999_999.99;

/** Línea de cotización o venta. Si se omite unitPrice se usa el precio de venta vigente. */
export class DocumentItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad debe ser mayor que cero' })
  @Max(1_000_000)
  quantity!: number;

  @ApiPropertyOptional({ description: 'Precio unitario negociado; por defecto el precio de venta del producto' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El precio debe ser un número con máximo 2 decimales' })
  @Min(0)
  @Max(MAX_MONEY)
  unitPrice?: number;
}

export class SaleTermsDto {
  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod, { message: 'Forma de pago inválida (CASH, TRANSFER o CREDIT)' })
  paymentMethod!: PaymentMethod;

  @ApiPropertyOptional({ description: 'Solo CREDIT: plazo en días (por defecto el configurado, 15)', minimum: 1, maximum: 365 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  creditDays?: number;

  @ApiPropertyOptional({ description: 'Solo CREDIT: abono inicial', minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY)
  initialPayment?: number;

  @ApiPropertyOptional({ enum: [PaymentMethod.CASH, PaymentMethod.TRANSFER], description: 'Forma de pago del abono inicial' })
  @IsOptional()
  @IsEnum(PaymentMethod)
  initialPaymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ description: 'Referencia de la transferencia (obligatoria si se paga por transferencia)' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;
}

export class CreateSaleDto extends SaleTermsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  customerId!: string;

  @ApiProperty({ type: [DocumentItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe incluir al menos un producto' })
  @ArrayMaxSize(200, { message: 'Máximo 200 líneas por venta' })
  @ValidateNested({ each: true })
  @Type(() => DocumentItemDto)
  items!: DocumentItemDto[];
}

/** Conversión de cotización aprobada en venta: solo las condiciones de pago. */
export class ConvertQuotationDto extends SaleTermsDto {}

export class VoidSaleDto {
  @ApiProperty({ minLength: 5, description: 'Motivo de la anulación' })
  @Transform(trim)
  @IsString()
  @MinLength(5, { message: 'Indique el motivo (mínimo 5 caracteres)' })
  @MaxLength(500)
  reason!: string;
}

export class FilterSaleDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Busca por número de factura o nombre del cliente' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ enum: SaleStatus })
  @IsOptional()
  @IsEnum(SaleStatus)
  status?: SaleStatus;

  @ApiPropertyOptional({ description: 'true = a crédito, con saldo y vencidas' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  overdue?: boolean;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-01-31' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
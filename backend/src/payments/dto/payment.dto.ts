import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { toBoolean } from '../../common/transformers/to-boolean.transformer';
import { trim } from '../../common/transformers/text.transformers';
import { PaymentMethod } from '../../generated/prisma/client';

/** Los abonos solo pueden ser en efectivo o transferencia (CREDIT es una condición de venta, no un medio de pago). */
export const PAYMENT_METHODS = [PaymentMethod.CASH, PaymentMethod.TRANSFER] as const;

export class CreatePaymentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  saleId!: string;

  @ApiProperty({ example: 500, description: 'Monto del abono (no puede superar el saldo)' })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto debe ser un número con máximo 2 decimales' })
  @Min(0.01, { message: 'El monto debe ser mayor que cero' })
  @Max(999_999_999_999.99)
  amount!: number;

  @ApiProperty({ enum: PAYMENT_METHODS })
  @IsIn([...PAYMENT_METHODS], { message: 'El medio de pago debe ser CASH o TRANSFER' })
  method!: PaymentMethod;

  @ApiPropertyOptional({ description: 'Obligatoria en transferencias (nº de operación)' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;
}

export class FilterPaymentDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  saleId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Usuario que registró el pago' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ enum: PAYMENT_METHODS })
  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-01-31' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class FilterReceivableDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Busca por factura o nombre del cliente' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ description: 'true = solo vencidas; false = solo vigentes' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  overdue?: boolean;
}
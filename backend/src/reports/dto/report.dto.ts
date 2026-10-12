import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { toBoolean } from '../../common/transformers/to-boolean.transformer';
import { InventoryMovementType, PaymentMethod } from '../../generated/prisma/client';

export enum ReportName {
  SALES_BY_PERIOD = 'sales-by-period',
  SALES_BY_CUSTOMER = 'sales-by-customer',
  SALES_BY_PRODUCT = 'sales-by-product',
  SALES_BY_SELLER = 'sales-by-seller',
  SALES_BY_PAYMENT_METHOD = 'sales-by-payment-method',
  INVENTORY = 'inventory',
  INVENTORY_MOVEMENTS = 'inventory-movements',
  RECEIVABLES = 'receivables',
  PAYMENTS = 'payments',
  SERVICE_ORDERS = 'service-orders',
  QUOTATIONS = 'quotations',
}

export enum PeriodGrouping {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

export enum ServiceOrderGrouping {
  STATUS = 'status',
  TECHNICIAN = 'technician',
}

export class ReportQueryDto {
  @ApiPropertyOptional({ example: '2026-01-01', description: 'Desde (inclusive). Por defecto: hace 30 días' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-01-31', description: 'Hasta (inclusive). Por defecto: hoy' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: PeriodGrouping, description: 'sales-by-period: day | week | month (por defecto day)' })
  @IsOptional()
  @IsEnum(PeriodGrouping)
  groupBy?: PeriodGrouping;

  @ApiPropertyOptional({ enum: ServiceOrderGrouping, description: 'service-orders: status | technician (por defecto status)' })
  @IsOptional()
  @IsEnum(ServiceOrderGrouping)
  groupOrders?: ServiceOrderGrouping;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Vendedor / usuario que registró' })
  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  technicianId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ enum: InventoryMovementType })
  @IsOptional()
  @IsEnum(InventoryMovementType)
  movementType?: InventoryMovementType;

  @ApiPropertyOptional({ description: 'inventory: true = solo stock crítico' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  lowStock?: boolean;

  @ApiPropertyOptional({ description: 'Máximo de filas (1–10000)', minimum: 1, maximum: 10000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  limit?: number;
} //Ya tengo sueño, aquí lo dejo por ahora, talvez, quién sabe
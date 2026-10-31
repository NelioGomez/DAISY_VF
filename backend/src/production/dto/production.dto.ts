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
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { trim } from '../../common/transformers/text.transformers';
import { LotStatus, NonconformityDisposition, ProductionOrderStatus } from '../../generated/prisma/client';

const MAX_QTY = 1_000_000;

// ───────────────────────── BOM ─────────────────────────

export class BomItemDto {
  @ApiProperty({ format: 'uuid', description: 'Producto componente (materia prima o parte)' })
  @IsUUID()
  componentId!: string;

  @ApiProperty({ example: 10, description: 'Cantidad por unidad terminada, en la unidad del componente' })
  @Type(() => Number)
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad debe ser mayor que cero' })
  @Max(MAX_QTY)
  quantity!: number;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}

export class CreateBomDto {
  @ApiProperty({ format: 'uuid', description: 'Producto terminado que se fabrica' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ type: [BomItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Agregue al menos un componente' })
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BomItemDto)
  items!: BomItemDto[];

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/** Si la BOM ya se usó en órdenes, guardar cambios crea una versión nueva (la anterior queda inactiva). */
export class UpdateBomDto {
  @ApiProperty({ type: [BomItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Agregue al menos un componente' })
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => BomItemDto)
  items!: BomItemDto[];

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class SetActiveDto {
  @ApiProperty()
  @IsBoolean()
  isActive!: boolean;
}

// ───────────────────────── Rutas ─────────────────────────

export class RouteOperationDto {
  @ApiProperty({ example: 'Medición y corte' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Indique el nombre de la operación' })
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'Mesa de corte' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  workCenter?: string;

  @ApiProperty({ example: 3, description: 'Minutos estándar por unidad' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  standardMinutes!: number;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  instructions?: string;
}

export class CreateRouteDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: 'Ensamble de manguera 3/4"' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Indique el nombre de la ruta' })
  @MaxLength(120)
  name!: string;

  @ApiProperty({ type: [RouteOperationDto], description: 'En el orden en que se ejecutan' })
  @IsArray()
  @ArrayMinSize(1, { message: 'Agregue al menos una operación' })
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => RouteOperationDto)
  operations!: RouteOperationDto[];
}

export class UpdateRouteDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Indique el nombre de la ruta' })
  @MaxLength(120)
  name!: string;

  @ApiProperty({ type: [RouteOperationDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Agregue al menos una operación' })
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => RouteOperationDto)
  operations!: RouteOperationDto[];
}

// ───────────────────────── Órdenes de producción ─────────────────────────

export class CreateProductionOrderDto {
  @ApiProperty({ format: 'uuid', description: 'Producto terminado' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad debe ser mayor que cero' })
  @Max(MAX_QTY)
  quantity!: number;

  @ApiPropertyOptional({ format: 'uuid', description: 'Por defecto, la BOM activa más reciente del producto' })
  @IsOptional()
  @IsUUID()
  bomId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Por defecto, la ruta activa del producto' })
  @IsOptional()
  @IsUUID()
  routeId?: string;

  @ApiPropertyOptional({ example: '2026-11-03' })
  @IsOptional()
  @IsDateString()
  plannedStart?: string;

  @ApiPropertyOptional({ example: '2026-11-05' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CompleteStepDto {
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CompleteProductionOrderDto {
  @ApiProperty({ example: 5, description: 'Unidades buenas que salen de producción (forman el lote)' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_QTY)
  producedQuantity!: number;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CancelProductionOrderDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Indique el motivo de la cancelación' })
  @MaxLength(500)
  reason!: string;
}

export class FilterProductionOrderDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ProductionOrderStatus })
  @IsOptional()
  @IsEnum(ProductionOrderStatus)
  status?: ProductionOrderStatus;

  @ApiPropertyOptional({ description: 'Código de la OP o nombre/SKU del producto' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

// ───────────────────────── Lotes y calidad ─────────────────────────

export class FilterLotDto extends PaginationDto {
  @ApiPropertyOptional({ enum: LotStatus })
  @IsOptional()
  @IsEnum(LotStatus)
  status?: LotStatus;

  @ApiPropertyOptional({ description: 'Código del lote, de la OP o del producto' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class InspectLotDto {
  @ApiProperty({ example: 1, description: 'Unidades no conformes entre las inspeccionadas' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_QTY)
  defectiveQuantity!: number;

  @ApiPropertyOptional({ enum: NonconformityDisposition, description: 'Obligatoria si hay no conformes' })
  @IsOptional()
  @IsEnum(NonconformityDisposition)
  disposition?: NonconformityDisposition;

  @ApiPropertyOptional({ example: 'Fuga en el terminal macho' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  defectDescription?: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

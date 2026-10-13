import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { SortOrder } from '../../common/dto/sort-order.enum';
import { trim } from '../../common/transformers/text.transformers';

export enum Availability {
  AVAILABLE = 'AVAILABLE',
  LIMITED = 'LIMITED',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
}

export enum PublicSortField {
  NAME = 'name',
  PRICE = 'price',
}

export class PublicProductFilterDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 12, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 12;

  @ApiPropertyOptional({ description: 'Busca en nombre, SKU y descripción' })
  @Transform(trim)
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

  @ApiPropertyOptional({ enum: Availability })
  @IsOptional()
  @IsEnum(Availability)
  availability?: Availability;

  @ApiPropertyOptional({ enum: PublicSortField, default: PublicSortField.NAME })
  @IsOptional()
  @IsEnum(PublicSortField)
  sortBy?: PublicSortField;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.ASC })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder;
}

/** Quita caracteres de control (conserva saltos de línea) y recorta espacios. */
const clean = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string'
    ? // eslint-disable-next-line no-control-regex
      value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim()
    : value;

export class CreateInquiryDto {
  @ApiProperty({ example: 'Estación de Servicio Los Pinos' })
  @Transform(clean)
  @IsString()
  @IsNotEmpty({ message: 'Indique su nombre o empresa' })
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: 'compras@lospinos.com', description: 'Correo electrónico o teléfono' })
  @Transform(clean)
  @IsString()
  @IsNotEmpty({ message: 'Indique un teléfono o correo de contacto' })
  @MaxLength(150)
  @Matches(/^(?:[^\s@]+@[^\s@]+\.[^\s@]{2,}|\+?[0-9][0-9()\-\s.]{5,29})$/, {
    message: 'Ingrese un correo electrónico o un teléfono válido',
  })
  contact!: string;

  @ApiPropertyOptional({ example: 'Boquilla automática 3/4"' })
  @Transform(clean)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  productInterest?: string;

  @ApiPropertyOptional()
  @Transform(clean)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @ApiPropertyOptional({ description: 'Campo trampa anti-bots: debe ir vacío u omitido' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
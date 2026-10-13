import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { SortOrder } from '../../common/dto/sort-order.enum';
import { toBoolean } from '../../common/transformers/to-boolean.transformer';
import {
  emptyToNull,
  emptyToNullLower,
  emptyToNullUpper,
  trim,
} from '../../common/transformers/text.transformers';

export class CreateSupplierDto {
  @ApiProperty({ example: 'Gilbarco Veeder-Root' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ nullable: true, description: 'RUC / NIT / Tax ID; único' })
  @Transform(emptyToNullUpper)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^[A-Z0-9][A-Z0-9.\-/]*$/, { message: 'El identificador fiscal contiene caracteres inválidos' })
  taxId?: string | null;

  @ApiPropertyOptional({ example: 'Nicaragua', nullable: true })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string | null;

  @ApiPropertyOptional({
    description: 'Si se omite: true cuando el país está indicado y no es Nicaragua',
  })
  @IsOptional()
  @IsBoolean()
  isInternational?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^[0-9+()\-\s.]{6,40}$/, { message: 'Teléfono inválido' })
  phone?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Transform(emptyToNullLower)
  @IsOptional()
  @IsEmail({}, { message: 'Correo electrónico inválido' })
  @MaxLength(150)
  email?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string | null;
}

export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {}

export enum SupplierSortField {
  NAME = 'name',
  CREATED_AT = 'createdAt',
}

export class FilterSupplierDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Busca en nombre, identificador fiscal, país, contacto y correo' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'true = internacionales, false = nacionales' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isInternational?: boolean;

  @ApiPropertyOptional({ enum: SupplierSortField, default: SupplierSortField.NAME })
  @IsOptional()
  @IsEnum(SupplierSortField)
  sortBy?: SupplierSortField;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.ASC })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder;
}
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

export class CreateCustomerDto {
  @ApiProperty({ example: 'Estación de Servicio Los Pinos S.A.' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: 'J0310000000012', nullable: true, description: 'RUC o cédula; único' })
  @Transform(emptyToNullUpper)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^[A-Z0-9][A-Z0-9\-]*$/, { message: 'El RUC solo admite letras, números y guiones' })
  ruc?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactName?: string | null;

  @ApiPropertyOptional({ example: '+505 8888-8888', nullable: true })
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

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}

export enum CustomerSortField {
  NAME = 'name',
  CREATED_AT = 'createdAt',
}

export class FilterCustomerDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Busca en nombre, RUC, contacto, teléfono y correo' })
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

  @ApiPropertyOptional({ enum: CustomerSortField, default: CustomerSortField.NAME })
  @IsOptional()
  @IsEnum(CustomerSortField)
  sortBy?: CustomerSortField;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.ASC })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder;
}
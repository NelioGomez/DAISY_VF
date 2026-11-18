import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { emptyToNull, emptyToNullUpper, trimLower } from '../../common/transformers/text.transformers';
import { InquiryType } from '../../generated/prisma/client';

/** Quita caracteres de control (conserva saltos de línea) y recorta espacios. */
const clean = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string'
    ? // eslint-disable-next-line no-control-regex
      value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim()
    : value;

/** Registro de un cliente en el portal: crea la empresa (cliente) y su cuenta de acceso. */
export class RegisterCustomerDto {
  @ApiProperty({ example: 'Estación de Servicio Los Pinos S.A.', description: 'Razón social o nombre del cliente' })
  @Transform(clean)
  @IsString()
  @IsNotEmpty({ message: 'Indique el nombre o razón social' })
  @MaxLength(200)
  companyName!: string;

  @ApiPropertyOptional({ example: 'J0310000000012', description: 'RUC o cédula (opcional)' })
  @Transform(emptyToNullUpper)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^[A-Z0-9][A-Z0-9-]*$/, { message: 'El RUC solo admite letras, números y guiones' })
  ruc?: string | null;

  @ApiProperty({ example: 'Ana Pérez', description: 'Persona de contacto' })
  @Transform(clean)
  @IsString()
  @IsNotEmpty({ message: 'Indique la persona de contacto' })
  @MaxLength(120)
  contactName!: string;

  @ApiProperty({ example: 'compras@lospinos.com', description: 'Correo para iniciar sesión (se guarda en minúsculas)' })
  @Transform(trimLower)
  @IsEmail({}, { message: 'Escriba un correo válido' })
  @MaxLength(150)
  email!: string;

  @ApiPropertyOptional({ example: '+505 8888-8888' })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^[0-9+()\-\s.]{6,40}$/, { message: 'Teléfono inválido' })
  phone?: string | null;

  @ApiProperty({ minLength: 10, maxLength: 72, description: 'Mayúsculas, minúsculas, número y símbolo' })
  @IsString()
  @MaxLength(72, { message: 'La contraseña admite hasta 72 caracteres' })
  password!: string;
}

export class CustomerLoginDto {
  @ApiProperty({ example: 'compras@lospinos.com' })
  @Transform(trimLower)
  @IsEmail({}, { message: 'Escriba un correo válido' })
  @MaxLength(150)
  email!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Escriba su contraseña' })
  @MaxLength(72)
  password!: string;
}

export class UpdateCustomerProfileDto {
  @ApiPropertyOptional()
  @Transform(clean)
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Indique la persona de contacto' })
  @MaxLength(120)
  contactName?: string;

  @ApiPropertyOptional({ nullable: true })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^[0-9+()\-\s.]{6,40}$/, { message: 'Teléfono inválido' })
  phone?: string | null;
}

/** Mensaje del formulario de Contacto con la sesión iniciada (mejora n.° 59). */
export class CreatePortalContactDto {
  @ApiProperty({ enum: InquiryType })
  @IsEnum(InquiryType, { message: 'Elija el motivo de su mensaje' })
  type!: InquiryType;

  @ApiPropertyOptional({ example: 'Boquilla automática 3/4"' })
  @Transform(clean)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  productInterest?: string;

  @ApiProperty()
  @Transform(clean)
  @IsString()
  @IsNotEmpty({ message: 'Escriba su mensaje' })
  @MaxLength(1000)
  message!: string;
}

/** Cambio del correo de acceso por el propio cliente (pide la contraseña actual). */
export class ChangeCustomerEmailDto {
  @ApiProperty({ example: 'compras@nuevo-dominio.com' })
  @Transform(trimLower)
  @IsEmail({}, { message: 'Escriba un correo válido' })
  @MaxLength(150)
  email!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Escriba su contraseña actual' })
  @MaxLength(72)
  currentPassword!: string;
}

export class ChangeCustomerPasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Escriba su contraseña actual' })
  @MaxLength(72)
  currentPassword!: string;

  @ApiProperty({ minLength: 10, maxLength: 72 })
  @IsString()
  @MaxLength(72)
  newPassword!: string;
}

export class PortalInquiryItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ minimum: 1, maximum: 10000 })
  @Type(() => Number)
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad debe ser mayor que cero' })
  @Max(10_000)
  quantity!: number;

  @ApiPropertyOptional({ description: 'Observación de la línea (medida, modelo del surtidor…)' })
  @Transform(clean)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

/** Lista de solicitud de cotización enviada desde el catálogo por un cliente con sesión. */
export class CreatePortalInquiryDto {
  @ApiProperty({ type: [PortalInquiryItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Agregue al menos un producto a la lista' })
  @ArrayMaxSize(50, { message: 'Máximo 50 productos por solicitud' })
  @ValidateNested({ each: true })
  @Type(() => PortalInquiryItemDto)
  items!: PortalInquiryItemDto[];

  @ApiPropertyOptional({ description: 'Mensaje para el vendedor' })
  @Transform(clean)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}

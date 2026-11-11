import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { emptyToNull, trim, trimLower } from '../../common/transformers/text.transformers';

export class FilterCustomerAccountDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Busca en correo, contacto, cliente y RUC' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ format: 'uuid', description: 'Solo las cuentas de este cliente' })
  @IsOptional()
  @IsUUID()
  customerId?: string;
}

/** El administrador crea la cuenta del portal para un cliente que ya existe (así se vincula). */
export class CreateCustomerAccountDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all', { message: 'Elija el cliente' })
  customerId!: string;

  @ApiProperty({ example: 'compras@lospinos.com', description: 'Correo para iniciar sesión (se guarda en minúsculas)' })
  @Transform(trimLower)
  @IsEmail({}, { message: 'Escriba un correo válido' })
  @MaxLength(150)
  email!: string;

  @ApiProperty({ example: 'Ana Pérez' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Indique la persona de contacto' })
  @MaxLength(120)
  contactName!: string;

  @ApiPropertyOptional({ example: '+505 8888-8888' })
  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^[0-9+()\-\s.]{6,40}$/, { message: 'Teléfono inválido' })
  phone?: string | null;

  @ApiProperty({ minLength: 10, maxLength: 72, description: 'Contraseña temporal: mayúsculas, minúsculas, número y símbolo' })
  @IsString()
  @MaxLength(72, { message: 'La contraseña admite hasta 72 caracteres' })
  password!: string;
}

export class UpdateCustomerAccountDto {
  @ApiPropertyOptional({ description: 'Nuevo correo de acceso' })
  @Transform(trimLower)
  @IsOptional()
  @IsEmail({}, { message: 'Escriba un correo válido' })
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional()
  @Transform(trim)
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

export class ResetCustomerPasswordDto {
  @ApiProperty({ minLength: 10, maxLength: 72 })
  @IsString()
  @MaxLength(72, { message: 'La contraseña admite hasta 72 caracteres' })
  newPassword!: string;
}

export class SetCustomerAccountStatusDto {
  @ApiProperty({ description: 'true = activar, false = desactivar' })
  @IsBoolean()
  isActive!: boolean;
}

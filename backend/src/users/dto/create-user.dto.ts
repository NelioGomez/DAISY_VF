import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../generated/prisma/client';

/** Contraseña: 8–72 caracteres (límite de bcrypt), con al menos una letra y un número. */
export const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).+$/;
export const PASSWORD_MESSAGE = 'La contraseña debe tener entre 8 y 72 caracteres, con letras y números';

export class CreateUserDto {
  @ApiProperty({ example: 'jperez', minLength: 3, maxLength: 50 })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message: 'El usuario solo puede contener letras, números, punto, guion y guion bajo',
  })
  username!: string;

  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8, { message: PASSWORD_MESSAGE })
  @MaxLength(72, { message: PASSWORD_MESSAGE })
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  password!: string;

  @ApiProperty({ example: 'Juan' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({ example: 'Pérez' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string;

  @ApiProperty({ example: 'jperez@norcor.com' })
  @IsEmail({}, { message: 'El correo no tiene un formato válido' })
  @MaxLength(150)
  email!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.SELLER })
  @IsEnum(UserRole, { message: 'El rol no es válido' })
  role!: UserRole;
}

import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength } from 'class-validator';
import { trim, trimLower } from '../../common/transformers/text.transformers';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'ngomezanderson@gmail.com' })
  @Transform(trimLower)
  @IsEmail({}, { message: 'Escriba un correo válido' })
  @MaxLength(150)
  email!: string;
}

export class VerifyResetCodeDto extends ForgotPasswordDto {
  @ApiProperty({ example: '048213', description: 'Código de 6 dígitos recibido por correo' })
  @Transform(trim)
  @Matches(/^\d{6}$/, { message: 'El código tiene 6 dígitos' })
  code!: string;
}

export class ConfirmPasswordResetDto {
  @ApiProperty({ description: 'Permiso temporal entregado al verificar el código' })
  @Matches(/^[0-9a-f]{64}$/, { message: 'Permiso inválido' })
  resetToken!: string;

  @ApiProperty({ minLength: 10, maxLength: 72 })
  @IsString()
  @MaxLength(72, { message: 'La contraseña admite hasta 72 caracteres' })
  newPassword!: string;
}

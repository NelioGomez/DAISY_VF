import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { trimLower } from '../../common/transformers/text.transformers';

export class LoginDto {
  @ApiProperty({ example: 'admin', description: 'Nombre de usuario o correo electrónico' })
  @Transform(trimLower)
  @IsString()
  @IsNotEmpty({ message: 'El usuario es obligatorio' })
  @MaxLength(150)
  username!: string;

  @ApiProperty({ example: '********' })
  @IsString()
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @MaxLength(72)
  password!: string;
}

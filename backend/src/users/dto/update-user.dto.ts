import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

/**
 * El administrador puede cambiar todo menos la contraseña (tiene endpoints propios):
 * usuario, nombres, correo y rol. El usuario y el correo siguen siendo únicos.
 */
export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['password'] as const)) {}

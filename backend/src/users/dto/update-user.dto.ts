import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

/** El username es inmutable y la contraseña tiene endpoints propios. */
export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['username', 'password'] as const)) {}

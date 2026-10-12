import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetStatusDto {
  @ApiProperty({ description: 'true = activar, false = desactivar' })
  @IsBoolean()
  isActive!: boolean;
}
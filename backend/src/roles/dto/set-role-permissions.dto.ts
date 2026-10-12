import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsString } from 'class-validator';

export class SetRolePermissionsDto {
  @ApiProperty({
    type: [String],
    example: ['dashboard:read', 'products:read'],
    description: 'Lista COMPLETA de permisos del rol (reemplaza la anterior)',
  })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissions!: string[];
}

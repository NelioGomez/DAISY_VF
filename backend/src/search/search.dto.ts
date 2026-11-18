import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { trim } from '../common/transformers/text.transformers';

export class GlobalSearchDto {
  @ApiProperty({ example: 'boquilla', description: 'Texto a buscar (nombre, código, SKU, RUC, factura…)' })
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Escriba al menos 2 caracteres' })
  @MaxLength(100)
  q!: string;

  @ApiPropertyOptional({ default: 5, minimum: 1, maximum: 10, description: 'Resultados por tipo' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  limit: number = 5;
}

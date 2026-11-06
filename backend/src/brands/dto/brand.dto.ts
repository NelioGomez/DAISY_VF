import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { trim } from '../../common/transformers/text.transformers';
import { toBoolean } from '../../common/transformers/to-boolean.transformer';

export class CreateBrandDto {
  @ApiProperty({ example: 'Gilbarco' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(100)
  name!: string;
}

export class UpdateBrandDto extends PartialType(CreateBrandDto) {}

export class FilterBrandDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Busca en el nombre' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;
}

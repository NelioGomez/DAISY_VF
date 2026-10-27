import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { trim } from '../../common/transformers/text.transformers';
import { InquiryStatus } from '../../generated/prisma/client';
import { MANUAL_INQUIRY_STATUSES } from '../inquiry-status';

export class FilterInquiryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: InquiryStatus })
  @IsOptional()
  @IsEnum(InquiryStatus)
  status?: InquiryStatus;

  @ApiPropertyOptional({ description: 'Busca en nombre, contacto, producto de interés y mensaje' })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-01-31' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class SetInquiryStatusDto {
  @ApiProperty({ enum: MANUAL_INQUIRY_STATUSES })
  @IsIn(MANUAL_INQUIRY_STATUSES, { message: 'Estado inválido (IN_REVIEW, CLOSED o CANCELLED)' })
  status!: InquiryStatus;
}
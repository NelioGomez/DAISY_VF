import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class UpdateSettingsDto {
  @ApiProperty({
    example: { TAX_RATE: '0', TAX_REGIME: 'CUOTA_FIJA', COMPANY_PHONE: '+505 2222-0000' },
    description: 'Claves: TAX_RATE, TAX_REGIME, CREDIT_TERM_DAYS, COMPANY_NAME, COMPANY_PHONE, COMPANY_EMAIL, COMPANY_WHATSAPP, COMPANY_ADDRESS',
  })
  @IsObject()
  values!: Record<string, string>;
}

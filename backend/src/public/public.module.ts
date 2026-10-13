import { Module } from '@nestjs/common';
import { InquiriesModule } from '../inquiries/inquiries.module';
import { PublicCatalogService } from './public-catalog.service';
import { PublicController } from './public.controller';

@Module({
  imports: [InquiriesModule],
  controllers: [PublicController],
  providers: [PublicCatalogService],
})
export class PublicModule {}
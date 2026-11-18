import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { QuotationsModule } from '../quotations/quotations.module';
import { InquiriesController } from './inquiries.controller';
import { InquiriesService } from './inquiries.service';

@Module({
  imports: [DocumentsModule, QuotationsModule],
  controllers: [InquiriesController],
  providers: [InquiriesService],
  exports: [InquiriesService],
})
export class InquiriesModule {}

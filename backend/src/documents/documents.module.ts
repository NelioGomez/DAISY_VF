import { Global, Module } from '@nestjs/common';
import { DocumentLinesService } from './document-lines.service';
import { DocumentSequenceService } from './document-sequence.service';
import { TaxService } from './tax.service';

@Global()
@Module({
  providers: [TaxService, DocumentSequenceService, DocumentLinesService],
  exports: [TaxService, DocumentSequenceService, DocumentLinesService],
})
export class DocumentsModule {}
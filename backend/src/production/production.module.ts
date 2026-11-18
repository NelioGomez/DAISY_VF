import { Module } from '@nestjs/common';
import { ProductionController } from './production.controller';
import { ProductionService } from './production.service';

/** Manufactura. StockService, la numeración y la auditoría vienen de módulos globales. */
@Module({
  controllers: [ProductionController],
  providers: [ProductionService],
})
export class ProductionModule {}

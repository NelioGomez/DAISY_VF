import { Module } from '@nestjs/common';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';
import { RestockService } from './restock.service';

/** Compras, recepción y reabastecimiento. StockService y la numeración vienen de módulos globales. */
@Module({
  controllers: [PurchasesController],
  providers: [PurchasesService, RestockService],
  exports: [PurchasesService],
})
export class PurchasesModule {}

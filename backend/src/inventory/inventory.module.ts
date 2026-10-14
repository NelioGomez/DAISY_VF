import { Global, Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { StockService } from './stock.service';

/** StockService es global: ventas, anulaciones y otros módulos lo usan para mover stock. */
@Global()
@Module({
  imports: [ProductsModule],
  controllers: [InventoryController],
  providers: [StockService, InventoryService],
  exports: [StockService],
})
export class InventoryModule {}

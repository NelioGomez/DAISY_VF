import { Module } from '@nestjs/common';
import { ServiceOrdersController } from './service-orders.controller';
import { ServiceOrdersService } from './service-orders.service';

@Module({
  controllers: [ServiceOrdersController],
  providers: [ServiceOrdersService],
})
export class ServiceOrdersModule {}

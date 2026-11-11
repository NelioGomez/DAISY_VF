import { Module } from '@nestjs/common';
import { CustomerAccountsController } from './customer-accounts.controller';
import { CustomerAccountsService } from './customer-accounts.service';

@Module({
  controllers: [CustomerAccountsController],
  providers: [CustomerAccountsService],
})
export class CustomerAccountsModule {}

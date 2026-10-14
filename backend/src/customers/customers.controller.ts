import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { SetStatusDto } from '../common/dto/set-status.dto';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { CustomersService } from './customer.service';
import { CreateCustomerDto, FilterCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

@ApiTags('Customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @Permissions('customers:read')
  @ApiOperation({ summary: 'Lista clientes con total comprado y saldo pendiente' })
  findAll(@Query() filter: FilterCustomerDto) {
    return this.customers.findAll(filter);
  }

  @Get(':id')
  @Permissions('customers:read')
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.customers.findOne(id);
  }

  @Post()
  @Permissions('customers:write')
  @ApiResponse({ status: 409, description: 'El RUC ya existe' })
  create(@Body() dto: CreateCustomerDto, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    return this.customers.create(dto, actor, ip);
  }

  @Patch(':id')
  @Permissions('customers:write')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip?: string,
  ) {
    return this.customers.update(id, dto, actor, ip);
  }

  @Patch(':id/status')
  @Permissions('customers:write')
  @ApiOperation({ summary: 'Activa o desactiva un cliente' })
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetStatusDto,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip?: string,
  ) {
    return this.customers.setStatus(id, dto.isActive, actor, ip);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions('customers:write')
  @ApiResponse({ status: 409, description: 'Tiene historial: desactívelo' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip?: string,
  ) {
    await this.customers.remove(id, actor, ip);
    return { deleted: true };
  }
}
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { FilterProductDto } from '../products/dto/product.dto';
import { CreateMovementDto, FilterMovementDto } from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

@ApiTags('Inventory')
@ApiBearerAuth()
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  @Permissions('inventory:read')
  @ApiOperation({ summary: 'Existencias por producto, con valor de inventario y resumen (filtros de /products)' })
  overview(@Query() filter: FilterProductDto) {
    return this.inventory.overview(filter);
  }

  @Get('movements')
  @Permissions('inventory:read')
  @ApiOperation({ summary: 'Historial (kardex) de movimientos con filtros y paginación' })
  movements(@Query() filter: FilterMovementDto) {
    return this.inventory.movements(filter);
  }

  @Post('movements')
  @Permissions('inventory:write')
  @ApiOperation({
    summary: 'Registra una entrada (compra), salida (merma/uso interno) o ajuste por conteo físico',
  })
  @ApiResponse({ status: 409, description: 'Stock insuficiente' })
  create(@Body() dto: CreateMovementDto, @CurrentUser() actor: AuthUser, @ClientIp() ip?: string) {
    return this.inventory.createMovement(dto, actor, ip);
  }
}

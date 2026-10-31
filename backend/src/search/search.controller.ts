import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { GlobalSearchDto } from './search.dto';
import { SearchService } from './search.service';

@ApiTags('Búsqueda global')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  @ApiOperation({
    summary: 'Busca en productos, clientes, proveedores, ventas, cotizaciones, solicitudes, compras y OPI (solo en los módulos que el usuario puede leer)',
  })
  find(@Query() dto: GlobalSearchDto, @CurrentUser() actor: AuthUser) {
    return this.search.search(actor, dto.q, dto.limit);
  }
}

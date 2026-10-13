import { Body, Controller, Get, Header, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { Public } from '../common/decorators/public.decorator';
import { InquiriesService } from '../inquiries/inquiries.service';
import { CreateInquiryDto, PublicProductFilterDto } from './dto/public.dto';
import { PublicCatalogService } from './public-catalog.service';

/** Todo lo de este controlador es accesible sin iniciar sesión. */
@ApiTags('Public catalog')
@Public()
@Controller('public')
export class PublicController {
  constructor(
    private readonly catalog: PublicCatalogService,
    private readonly inquiries: InquiriesService,
  ) {}

  @Get('products')
  @Header('Cache-Control', 'public, max-age=60')
  @ApiOperation({ summary: 'Catálogo público: productos activos con búsqueda, filtros y paginación (sin costos ni stock exacto)' })
  products(@Query() filter: PublicProductFilterDto) {
    return this.catalog.products(filter);
  }

  @Get('products/:id')
  @Header('Cache-Control', 'public, max-age=60')
  @ApiResponse({ status: 404, description: 'Producto no encontrado o no publicado' })
  product(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.product(id);
  }

  @Get('categories')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({ summary: 'Categorías activas con productos publicados (para el filtro del catálogo)' })
  categories() {
    return this.catalog.categories();
  }

  @Get('brands')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({ summary: 'Marcas activas con productos publicados (para el filtro del catálogo)' })
  brands() {
    return this.catalog.brands();
  }

  @Post('inquiries')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } }) // máx. 5 solicitudes por hora por IP
  @ApiOperation({ summary: 'Solicitar cotización desde el catálogo (queda como consulta NUEVA)' })
  @ApiResponse({ status: 429, description: 'Demasiadas solicitudes desde esta IP' })
  createInquiry(@Body() dto: CreateInquiryDto, @ClientIp() ip?: string) {
    return this.inquiries.createPublic(dto, ip);
  }
}
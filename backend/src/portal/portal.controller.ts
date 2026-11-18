import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentCustomer, CustomerAuthGuard, type PortalCustomer } from './customer-auth.guard';
import {
  ChangeCustomerEmailDto,
  ChangeCustomerPasswordDto,
  CreatePortalContactDto,
  CreatePortalInquiryDto,
  CustomerLoginDto,
  RegisterCustomerDto,
  UpdateCustomerProfileDto,
} from './dto/portal.dto';
import { PortalAuthService } from './portal-auth.service';
import { PortalService } from './portal.service';

/**
 * Portal de clientes (/api/v1/portal). @Public() solo desactiva el login del PERSONAL: las rutas
 * privadas usan CustomerAuthGuard, que exige un token de cliente.
 */
@ApiTags('Portal de clientes')
@Public()
@Controller('portal')
export class PortalController {
  constructor(
    private readonly auth: PortalAuthService,
    private readonly portal: PortalService,
  ) {}

  // ───────────── Acceso ─────────────

  @Post('auth/register')
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Crea la cuenta del cliente (y su ficha de cliente) e inicia sesión' })
  @ApiResponse({ status: 409, description: 'El correo ya tiene cuenta o el RUC ya existe' })
  @ApiResponse({ status: 422, description: 'Datos o contraseña inválidos' })
  register(@Body() dto: RegisterCustomerDto, @ClientIp() ip?: string) {
    return this.auth.register(dto, ip);
  }

  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Inicio de sesión del cliente (correo y contraseña)' })
  @ApiResponse({ status: 401, description: 'Correo o contraseña incorrectos' })
  login(@Body() dto: CustomerLoginDto, @ClientIp() ip?: string) {
    return this.auth.login(dto, ip);
  }

  // ───────────── Mi perfil ─────────────

  @Get('me')
  @UseGuards(CustomerAuthGuard)
  @ApiBearerAuth()
  me(@CurrentCustomer() c: PortalCustomer) {
    return this.auth.me(c);
  }

  @Patch('me')
  @UseGuards(CustomerAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualiza la persona de contacto y el teléfono' })
  updateProfile(@CurrentCustomer() c: PortalCustomer, @Body() dto: UpdateCustomerProfileDto) {
    return this.auth.updateProfile(c, dto);
  }

  @Patch('me/password')
  @UseGuards(CustomerAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cambia la contraseña (cierra las demás sesiones y devuelve una nueva)' })
  changePassword(@CurrentCustomer() c: PortalCustomer, @Body() dto: ChangeCustomerPasswordDto, @ClientIp() ip?: string) {
    return this.auth.changePassword(c, dto, ip);
  }

  @Patch('me/email')
  @UseGuards(CustomerAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cambia el correo de acceso (pide la contraseña actual)' })
  @ApiResponse({ status: 409, description: 'Ese correo ya tiene cuenta' })
  @ApiResponse({ status: 422, description: 'Contraseña actual incorrecta' })
  changeEmail(@CurrentCustomer() c: PortalCustomer, @Body() dto: ChangeCustomerEmailDto, @ClientIp() ip?: string) {
    return this.auth.changeEmail(c, dto, ip);
  }

  // ───────────── Contacto con sesión ─────────────

  @Post('contact')
  @UseGuards(CustomerAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mensaje del formulario de Contacto enlazado a la cuenta (queda NUEVO, código SOL-…)' })
  createContact(@CurrentCustomer() c: PortalCustomer, @Body() dto: CreatePortalContactDto, @ClientIp() ip?: string) {
    return this.portal.createContact(c, dto, ip);
  }

  // ───────────── Mis solicitudes ─────────────

  @Get('inquiries')
  @UseGuards(CustomerAuthGuard)
  @ApiBearerAuth()
  inquiries(@CurrentCustomer() c: PortalCustomer) {
    return this.portal.inquiries(c);
  }

  @Get('inquiries/:id')
  @UseGuards(CustomerAuthGuard)
  @ApiBearerAuth()
  inquiry(@CurrentCustomer() c: PortalCustomer, @Param('id', ParseUUIDPipe) id: string) {
    return this.portal.inquiry(c, id);
  }

  @Post('inquiries')
  @UseGuards(CustomerAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Envía la lista de solicitud de cotización (queda NUEVA, código SOL-…)' })
  createInquiry(@CurrentCustomer() c: PortalCustomer, @Body() dto: CreatePortalInquiryDto, @ClientIp() ip?: string) {
    return this.portal.createInquiry(c, dto, ip);
  }

  // ───────────── Mis cotizaciones ─────────────

  @Get('quotations')
  @UseGuards(CustomerAuthGuard)
  @ApiBearerAuth()
  quotations(@CurrentCustomer() c: PortalCustomer) {
    return this.portal.quotations(c);
  }

  @Get('quotations/:id')
  @UseGuards(CustomerAuthGuard)
  @ApiBearerAuth()
  quotation(@CurrentCustomer() c: PortalCustomer, @Param('id', ParseUUIDPipe) id: string) {
    return this.portal.quotation(c, id);
  }
}

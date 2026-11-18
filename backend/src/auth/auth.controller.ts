import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto, ConfirmPasswordResetDto, VerifyResetCodeDto } from './dto/password-reset.dto';
import { PasswordResetService } from './password-reset.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly reset: PasswordResetService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // máx. 5 intentos por minuto por IP
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inicia sesión y devuelve un JWT' })
  @ApiResponse({ status: 200, description: 'Sesión iniciada' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  @ApiResponse({ status: 403, description: 'Usuario inactivo' })
  @ApiResponse({ status: 429, description: 'Demasiados intentos' })
  login(@Body() dto: LoginDto, @ClientIp() ip?: string) {
    return this.auth.login(dto, ip);
  }

  // ───────────── Recuperación de contraseña (3 pasos, sin sesión) ─────────────

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Paso 1: envía un código al correo (responde igual exista o no la cuenta)' })
  @ApiResponse({ status: 429, description: 'Demasiadas solicitudes para ese correo o IP' })
  forgotPassword(@Body() dto: ForgotPasswordDto, @ClientIp() ip?: string) {
    return this.reset.requestCode(dto.email, ip);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verify-reset-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Paso 2: valida el código y entrega un permiso temporal (resetToken)' })
  @ApiResponse({ status: 400, description: 'El código no coincide (errors: remainingAttempts)' })
  @ApiResponse({ status: 410, description: 'El código venció o no existe' })
  @ApiResponse({ status: 429, description: 'Se agotaron los intentos' })
  verifyResetCode(@Body() dto: VerifyResetCodeDto) {
    return this.reset.verifyCode(dto.email, dto.code);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Paso 3: fija la nueva contraseña y cierra las sesiones anteriores' })
  @ApiResponse({ status: 409, description: 'Es igual a la contraseña actual' })
  @ApiResponse({ status: 410, description: 'El permiso venció o ya se usó' })
  @ApiResponse({ status: 422, description: 'No cumple la política de contraseñas' })
  resetPassword(@Body() dto: ConfirmPasswordResetDto, @ClientIp() ip?: string) {
    return this.reset.resetPassword(dto.resetToken, dto.newPassword, ip);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Datos del usuario autenticado, su rol y permisos' })
  @ApiResponse({ status: 401, description: 'Token ausente, inválido o expirado' })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user);
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Registra el cierre de sesión (el cliente descarta el token)' })
  async logout(@CurrentUser() user: AuthUser, @ClientIp() ip?: string) {
    await this.auth.logout(user, ip);
    return { loggedOut: true };
  }
}

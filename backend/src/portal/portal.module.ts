import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { CustomerAuthGuard } from './customer-auth.guard';
import { PortalAuthService } from './portal-auth.service';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';

/**
 * Portal de clientes. Firma sus propios JWT (tipo "customer") con una duración propia
 * (PORTAL_JWT_EXPIRES_IN, 2 h por defecto): la sesión del cliente no se mezcla con la del personal.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: (config.get<string>('PORTAL_JWT_EXPIRES_IN') || '2h') as never },
      }),
    }),
  ],
  controllers: [PortalController],
  providers: [PortalAuthService, PortalService, CustomerAuthGuard],
})
export class PortalModule {}

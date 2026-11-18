import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthUser, JwtPayload } from '../../common/interfaces/auth-user.interface';
import { issuedBeforePasswordChange } from '../../common/utils/token-revocation';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false, // valida expiración
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'), // valida firma
    });
  }

  /**
   * Se ejecuta solo si el token es válido y no expiró.
   * Verifica que el usuario exista y esté activo, y toma el ROL y los PERMISOS
   * de la base de datos (nunca de lo que envíe el cliente).
   */
  async validate(payload: JwtPayload & { typ?: string }): Promise<AuthUser> {
    // Un token del portal de clientes nunca abre la API interna.
    if (payload.typ === 'customer') throw new UnauthorizedException('Token no válido para el sistema interno');
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        role: { include: { permissions: { include: { permission: { select: { code: true } } } } } },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario inexistente o inactivo');
    }
    if (issuedBeforePasswordChange(payload.iat, user.passwordChangedAt, payload.iatMs)) {
      throw new UnauthorizedException('Su sesión se cerró (cambio de contraseña o cierre por el administrador); inicie sesión de nuevo');
    }

    return {
      id: user.id,
      username: user.username,
      role: user.role.code,
      permissions: user.role.permissions.map((rp) => rp.permission.code),
    };
  }
}

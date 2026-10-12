import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import type { AuthUser, JwtPayload } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  /** Hash de relleno: evita revelar por tiempo de respuesta si el usuario existe. */
  private readonly dummyHash = bcrypt.hashSync('relleno-contra-ataques-de-tiempo', BCRYPT_ROUNDS);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(dto: LoginDto, ip?: string) {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
      include: {
        role: { include: { permissions: { include: { permission: { select: { code: true } } } } } },
      },
    });

    const passwordOk = await bcrypt.compare(dto.password, user?.passwordHash ?? this.dummyHash);

    if (!user || !passwordOk) {
      await this.audit.log({
        username: dto.username,
        module: 'auth',
        action: 'LOGIN_FAILED',
        description: 'Intento de inicio de sesión fallido',
        ip,
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.isActive) {
      await this.audit.log({
        userId: user.id,
        username: user.username,
        module: 'auth',
        action: 'LOGIN_BLOCKED',
        description: 'Inicio de sesión de usuario inactivo',
        ip,
      });
      throw new ForbiddenException('Usuario inactivo');
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const payload: JwtPayload = { sub: user.id, username: user.username, role: user.role.code };
    const accessToken = await this.jwt.signAsync(payload);
    const decoded = this.jwt.decode<{ iat: number; exp: number }>(accessToken);

    await this.audit.log({
      userId: user.id,
      username: user.username,
      module: 'auth',
      action: 'LOGIN',
      description: 'Inicio de sesión',
      ip,
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: decoded.exp - decoded.iat,
      user: {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role.code,
        permissions: user.role.permissions.map((rp) => rp.permission.code),
      },
    };
  }

  async me(auth: AuthUser) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: auth.id },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
        lastLoginAt: true,
      },
    });
    return { ...user, role: auth.role, permissions: auth.permissions };
  }

  /** JWT es sin estado: el cliente descarta el token. Aquí solo se audita. */
  async logout(auth: AuthUser, ip?: string): Promise<void> {
    await this.audit.log({
      userId: auth.id,
      username: auth.username,
      module: 'auth',
      action: 'LOGOUT',
      description: 'Cierre de sesión',
      ip,
    });
  }
}

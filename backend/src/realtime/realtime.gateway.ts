import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { AuthUser, JwtPayload } from '../common/interfaces/auth-user.interface';
import { issuedBeforePasswordChange } from '../common/utils/token-revocation';
import { PrismaService } from '../prisma/prisma.service';
import { CHANGE_AUDIENCE, type ChangeEvent, permissionRoom, userRoom } from './realtime.events';

interface SocketData {
  user?: AuthUser;
  expiryTimer?: NodeJS.Timeout;
}

/** Eventos que el servidor envía al cliente. */
interface ServerEvents {
  change: (event: ChangeEvent) => void;
  'session-expired': () => void;
  unauthorized: () => void;
}

type AppSocket = Socket<Record<string, never>, ServerEvents, Record<string, never>, SocketData>;

/**
 * Canal de tiempo real (socket.io en /socket.io).
 *
 * Seguridad:
 * - El cliente se autentica con el mismo JWT de la API (handshake.auth.token).
 * - Rol y permisos se leen de la base de datos, igual que en JwtStrategy.
 * - Cada socket entra a una sala por permiso; un evento solo llega a quien puede
 *   leer ese módulo. El socket se cierra cuando vence el JWT o se desactiva al usuario.
 * - El servidor solo emite; los mensajes que envíe el cliente se ignoran.
 */
@WebSocketGateway({ path: '/socket.io', serveClient: false })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger('TiempoReal');

  @WebSocketServer()
  private server!: Server<Record<string, never>, ServerEvents, Record<string, never>, SocketData>;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: AppSocket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) throw new Error('sin token');
      const payload = await this.jwt.verifyAsync<JwtPayload & { exp: number }>(token);
      const user = await this.loadUser(payload.sub, payload.iat, payload.iatMs);
      if (!user) throw new Error('usuario inexistente, inactivo o con contraseña cambiada');

      client.data.user = user;
      await client.join([userRoom(user.id), ...user.permissions.map(permissionRoom)]);

      // Al vencer el JWT se corta el canal: el cliente debe volver a iniciar sesión.
      const ms = payload.exp * 1000 - Date.now();
      client.data.expiryTimer = setTimeout(() => {
        client.emit('session-expired');
        client.disconnect(true);
      }, Math.max(0, Math.min(ms, 2_147_483_647)));

      this.logger.log(`@${user.username} conectado · ${this.online()} en línea`);
    } catch (e) {
      this.logger.warn(`Conexión rechazada (${e instanceof Error ? e.message : 'token inválido'}) desde ${client.handshake.address}`);
      client.emit('unauthorized');
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AppSocket): void {
    if (client.data.expiryTimer) clearTimeout(client.data.expiryTimer);
    const user = client.data.user;
    if (user) this.logger.log(`@${user.username} desconectado · ${this.online()} en línea`);
  }

  /** Avisa del cambio a quien corresponda según CHANGE_AUDIENCE. */
  broadcast(event: ChangeEvent): void {
    if (!this.server) return;
    const revokes =
      (event.module === 'users' && ['DEACTIVATE', 'CHANGE_PASSWORD', 'RESET_PASSWORD'].includes(event.action)) ||
      (event.module === 'auth' && event.action === 'PASSWORD_RESET');
    if (revokes && event.entityId) {
      this.server.in(userRoom(event.entityId)).disconnectSockets(true);
    }
    if (event.module === 'roles') void this.resyncRooms();

    const audience = CHANGE_AUDIENCE[event.module];
    if (!audience) return;
    const primary = audience.primary.map(permissionRoom);
    const related = audience.related.map(permissionRoom);
    this.server.to(primary).emit('change', event);
    if (related.length) {
      const slim: ChangeEvent = { module: event.module, action: event.action, at: event.at };
      this.server.to(related).except(primary).emit('change', slim);
    }
  }

  /** Tras cambiar los permisos de un rol, cada socket vuelve a calcular sus salas. */
  private async resyncRooms(): Promise<void> {
    const sockets = await this.server.fetchSockets();
    for (const s of sockets) {
      const old = s.data.user;
      if (!old) continue;
      const fresh = await this.loadUser(old.id);
      if (!fresh) {
        s.disconnect(true);
        continue;
      }
      for (const room of s.rooms) if (room.startsWith('perm:')) s.leave(room);
      s.join(fresh.permissions.map(permissionRoom));
      s.data.user = fresh;
    }
  }

  /** Sockets autenticados (no cuenta conexiones rechazadas ni pendientes). */
  private online(): number {
    let n = 0;
    for (const s of this.server.sockets.sockets.values()) if (s.data.user) n++;
    return n;
  }

  private extractToken(client: AppSocket): string | null {
    const fromAuth = (client.handshake.auth as { token?: unknown } | undefined)?.token;
    if (typeof fromAuth === 'string' && fromAuth) return fromAuth;
    const header = client.handshake.headers.authorization;
    return header?.startsWith('Bearer ') ? header.slice(7) : null;
  }

  private async loadUser(id: string, iat?: number, iatMs?: number): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { role: { include: { permissions: { include: { permission: { select: { code: true } } } } } } },
    });
    if (!user || !user.isActive || issuedBeforePasswordChange(iat, user.passwordChangedAt, iatMs)) return null;
    return {
      id: user.id,
      username: user.username,
      role: user.role.code,
      permissions: user.role.permissions.map((rp) => rp.permission.code),
    };
  }
}

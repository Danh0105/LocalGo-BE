import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { UserStatus } from '../../../../generated/prisma';
import { TokenService } from '../../auth/services/token.service';
import { UserService } from '../../users/services/user.service';
import { NotificationSocketEvent } from '../notification-types';
import { NotificationRepository } from '../repositories/notification.repository';

export const NOTIFICATIONS_NAMESPACE = '/notifications';

const userRoom = (userId: string) => `user:${userId}`;

/**
 * Realtime channel for the mini app bell (and chat). Clients connect to the
 * `/notifications` namespace with the same access token as the REST API:
 *   io(`${API_ORIGIN}/notifications`, { auth: { token }, transports: ['websocket'] })
 * The token is checked once at handshake; a client whose token expires keeps
 * its socket until it disconnects, then must reconnect with a fresh token.
 * Each socket joins `user:<id>`, so every device of a user receives events.
 * Single-process (pm2 fork): rooms live in memory; clustering would need the
 * socket.io Redis adapter.
 */
@WebSocketGateway({ namespace: NOTIFICATIONS_NAMESPACE })
export class NotificationsGateway
  implements OnGatewayInit<Namespace>, OnGatewayConnection<Socket>
{
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  private server?: Namespace;

  constructor(
    private readonly tokenService: TokenService,
    private readonly userService: UserService,
    private readonly repository: NotificationRepository,
  ) {}

  afterInit(namespace: Namespace): void {
    // Reject unauthenticated sockets during the handshake: the client gets a
    // `connect_error` with message UNAUTHORIZED instead of a silent drop.
    namespace.use((socket, next) => {
      this.authenticate(socket)
        .then((userId) => {
          (socket.data as { userId?: string }).userId = userId;
          next();
        })
        .catch(() => next(new Error('UNAUTHORIZED')));
    });
  }

  async handleConnection(socket: Socket): Promise<void> {
    const userId = (socket.data as { userId?: string }).userId;
    if (!userId) {
      socket.disconnect(true);
      return;
    }
    await socket.join(userRoom(userId));
    socket.emit(NotificationSocketEvent.UNREAD_COUNT, {
      unreadCount: await this.repository.countUnread(userId),
    });
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server?.to(userRoom(userId)).emit(event, payload);
  }

  private async authenticate(socket: Socket): Promise<string> {
    const token = this.extractToken(socket);
    if (!token) throw new Error('missing token');
    const payload = await this.tokenService.verifyAccessToken(token);
    const user = await this.userService.getProfile(payload.sub);
    if (
      user.status === UserStatus.BLOCKED ||
      (payload.cv ?? 0) !== user.credentialVersion
    ) {
      throw new Error('credentials revoked');
    }
    return user.id;
  }

  /** `auth.token` (recommended), `Authorization: Bearer`, or `?token=`. */
  private extractToken(socket: Socket): string | null {
    const { auth, headers, query } = socket.handshake;
    const fromAuth = (auth as { token?: unknown } | undefined)?.token;
    if (typeof fromAuth === 'string' && fromAuth) {
      return fromAuth.replace(/^Bearer\s+/i, '');
    }
    const header = headers.authorization;
    if (typeof header === 'string' && /^Bearer\s+/i.test(header)) {
      return header.replace(/^Bearer\s+/i, '');
    }
    const fromQuery = query.token;
    if (typeof fromQuery === 'string' && fromQuery) {
      this.logger.debug('Socket token passed in query string');
      return fromQuery;
    }
    return null;
  }
}

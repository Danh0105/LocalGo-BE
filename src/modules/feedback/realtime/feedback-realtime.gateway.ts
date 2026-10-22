import { Injectable } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Tickets are never joined based on a client-supplied ID alone. */
@Injectable()
@WebSocketGateway({ namespace: '/feedback', cors: { origin: false } })
export class FeedbackRealtimeGateway {
  @WebSocketServer() server!: Server;

  private secret(): string {
    const value = process.env.FEEDBACK_SOCKET_SECRET;
    if (!value || value.length < 32)
      throw new Error(
        'FEEDBACK_SOCKET_SECRET must contain at least 32 characters',
      );
    return value;
  }

  createTicketToken(
    ticketId: string,
    audience: 'user' | 'admin',
  ): { token: string; expiresIn: number } {
    const payload = Buffer.from(
      JSON.stringify({
        ticketId,
        audience,
        exp: Date.now() + 120000,
        nonce: randomBytes(12).toString('hex'),
      }),
    ).toString('base64url');
    const signature = createHmac('sha256', this.secret())
      .update(payload)
      .digest('base64url');
    return { token: `${payload}.${signature}`, expiresIn: 120 };
  }

  @SubscribeMessage('ticket:join')
  join(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { token?: string },
  ) {
    // Close any previous room before authenticating a new subscription.
    for (const room of client.rooms)
      if (room.startsWith('feedback:')) void client.leave(room);
    if (typeof body?.token !== 'string' || body.token.length > 2048)
      return { ok: false };
    const parts = body.token.split('.');
    if (parts.length !== 2) return { ok: false };
    const expected = createHmac('sha256', this.secret())
      .update(parts[0])
      .digest();
    let supplied: Buffer;
    try {
      supplied = Buffer.from(parts[1], 'base64url');
    } catch {
      return { ok: false };
    }
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    )
      return { ok: false };
    try {
      const payload = JSON.parse(
        Buffer.from(parts[0], 'base64url').toString('utf8'),
      ) as { ticketId?: unknown; audience?: unknown; exp?: unknown };
      if (
        typeof payload.ticketId !== 'string' ||
        !payload.ticketId ||
        (payload.audience !== 'user' && payload.audience !== 'admin') ||
        typeof payload.exp !== 'number' ||
        payload.exp <= Date.now()
      )
        return { ok: false };
      void client.join(`feedback:${payload.ticketId}:${payload.audience}`);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  messageCreated(ticketId: string, message: unknown, sender: 'user' | 'admin') {
    this.server
      ?.to(`feedback:${ticketId}:user`)
      .to(`feedback:${ticketId}:admin`)
      .emit('message:new', { ticketId, message });
    this.server
      ?.to(`feedback:${ticketId}:${sender === 'admin' ? 'user' : 'admin'}`)
      .emit('ticket:unread', { ticketId });
  }

  ticketStatusChanged(ticketId: string, status: string) {
    this.server
      ?.to(`feedback:${ticketId}:user`)
      .to(`feedback:${ticketId}:admin`)
      .emit('ticket:status', { ticketId, status });
  }

  markedRead(ticketId: string, reader: 'user' | 'admin', at: Date) {
    this.server
      ?.to(`feedback:${ticketId}:user`)
      .to(`feedback:${ticketId}:admin`)
      .emit('ticket:read', { ticketId, reader, readAt: at.toISOString() });
  }
}

# Feedback realtime extension

The archive contains only the `feedback` module, not the complete NestJS project. This patch cannot be compiled/tested against your full Prisma schema and auth configuration until integrated.

## Installation

1. Copy `feedback/` into your existing `src/modules/feedback/` location, preserving existing code.
2. Install compatible versions of `@nestjs/websockets`, `@nestjs/platform-socket.io`, and `socket.io` (major versions must match the NestJS application).
3. Append `docs/PRISMA_ADD_TO_SCHEMA.prisma.txt` to the Prisma schema and generate a migration in development: `npx prisma migrate dev --name feedback-read-state`; commit migration; on production `npx prisma migrate deploy` and `npx prisma generate`.
4. Set an independent, random `FEEDBACK_SOCKET_SECRET` of at least 32 characters on every app instance. Never commit it. Keep the same secret across instances.
5. Configure the existing reverse proxy to forward HTTP Upgrade for Socket.IO. For horizontal scaling, add Socket.IO Redis adapter and sticky-session strategy, otherwise room broadcasts only reach clients on the same instance.
6. Build and execute end-to-end tests against the entire application before deploying.

## WebSocket

Namespace `/feedback`; event `ticket:join` with `{token}`; ack `{ok: true|false}`. Fetch a short-lived token from the correct HTTP endpoint first (below). Socket room membership is signed by the server; do not send ticket IDs or phone numbers in WebSocket join events. On reconnect, request a fresh token. Subscriptions are authenticated at join and only expire on reconnect; revoke connections manually if ownership changes.

Server events:
- `message:new`: `{ticketId, message}`
- `ticket:unread`: `{ticketId}` (counter refresh signal)
- `ticket:read`: `{ticketId, reader, readAt}`
- `ticket:status`: `{ticketId, status}`

REST access:
- Anonymous: `POST /api/v1/feedback/tickets/realtime/access` `{ticketCode,phone}`
- Anonymous mark read: `POST /api/v1/feedback/tickets/realtime/read` `{ticketCode,phone}`
- Anonymous unread: `POST /api/v1/feedback/tickets/realtime/unread` `{ticketCode,phone}`
- Signed-in user: `POST /api/v1/feedback/tickets/me/:ticketCode/realtime/access`, `POST .../read`, `GET .../unread`
- Admin: `POST /api/v1/admin/feedback/tickets/:id/realtime/access`, `POST .../read`, `GET .../unread`

Existing REST endpoints remain intact. New messages are emitted only after the transaction commits. `unread` counts messages from the other side later than the last read marker. Admin read status is shared across all admins, not tracked per admin account.

## Example client

```ts
import { io } from 'socket.io-client';
const access = await fetch('/api/v1/feedback/tickets/realtime/access', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ticketCode, phone }),
}).then(r => r.json());
const socket = io('https://your-domain.example/feedback', { transports: ['websocket'] });
socket.on('connect', () => socket.emit('ticket:join', { token: access.data?.token ?? access.token }, console.log));
socket.on('message:new', ({ message }) => { /* append once by message.id */ });
socket.on('ticket:unread', () => { /* fetch unread counter */ });
socket.on('ticket:read', () => { /* update receipt */ });
socket.on('ticket:status', () => { /* update status */ });
```

## Security & operational limits

- Do not use public ticket IDs as socket authorization. This extension signs room-join grants after REST authorization checks. Anonymous access still depends on ticket code + phone, so apply IP throttling and abuse detection at the API gateway as well as Nest.
- `FEEDBACK_SOCKET_SECRET` is mandatory. If missing the access endpoint fails closed.
- Keep the token response out of logs and monitoring. Use HTTPS/WSS. Strictly configure Socket.IO origin and CORS for your actual frontend; `cors: { origin: false }` intentionally defaults to denial of cross-origin polling. Confirm Zalo Mini App's origin before allowing it.
- WebSocket read receipts and notification badges update only while a client is connected. Durable unread state persists in Prisma; offline push/FCM/Zalo OA notifications are NOT included and require an existing notification delivery system.
- Anonymous and signed-in users can both send through REST. All mutation flows remain under their original guards and authorization.
- `message:new` does not by itself establish exactly-once client delivery; deduplicate by message.id and resync with GET detail after reconnect.
- The read state uses a shared admin reader. Implement per-account read markers if your business rule requires individual admin badges.

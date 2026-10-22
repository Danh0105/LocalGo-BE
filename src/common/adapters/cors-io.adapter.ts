import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { Server, ServerOptions } from 'socket.io';

/**
 * Socket.IO adapter that applies the REST CORS allow-list (CORS_ORIGINS) to
 * the HTTP long-polling transport. WebSocket upgrades are not subject to CORS.
 */
export class CorsIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly corsOrigins: string[],
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    return super.createIOServer(port, {
      ...options,
      cors: {
        origin: this.corsOrigins.length > 0 ? this.corsOrigins : false,
        credentials: true,
      },
    }) as Server;
  }
}

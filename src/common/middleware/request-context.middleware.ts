import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { RequestContextService } from '../context/request-context.service';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly requestContext: RequestContextService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const incomingId = req.headers['x-request-id'];
    const requestId =
      (Array.isArray(incomingId) ? incomingId[0] : incomingId) ?? randomUUID();
    res.setHeader('X-Request-Id', requestId);

    this.requestContext.run(
      {
        requestId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
      next,
    );
  }
}

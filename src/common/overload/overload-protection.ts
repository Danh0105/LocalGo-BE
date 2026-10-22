import { Logger, type OnModuleDestroy } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { AppConfig } from '../../config/app.config';
import { ErrorCode } from '../constants/error-codes.constant';

export type OverloadOptions = Pick<
  AppConfig,
  | 'maxConcurrentRequests'
  | 'maxConcurrentHeavyRequests'
  | 'maxConcurrentUploads'
  | 'maxRssMb'
  | 'maxEventLoopDelayMs'
>;

interface Reservation {
  processing: boolean;
  closed: boolean;
  release: () => void;
}

type RejectionReason =
  | 'concurrent_requests'
  | 'concurrent_heavy_requests'
  | 'concurrent_uploads'
  | 'rss_memory'
  | 'event_loop_delay';

/** Process-wide admission control, before body parsing, auth or database work. */
export class OverloadProtection implements OnModuleDestroy {
  private readonly logger = new Logger(OverloadProtection.name);
  private active = 0;
  private heavy = 0;
  private uploads = 0;
  private eventLoopDelayMs = 0;
  private lastWarningAt = 0;
  private readonly reservations = new WeakMap<Request, Reservation>();
  private readonly timer: NodeJS.Timeout;

  constructor(private readonly options: OverloadOptions) {
    let expected = performance.now() + 250;
    this.timer = setInterval(() => {
      const now = performance.now();
      this.eventLoopDelayMs = Math.max(0, now - expected);
      expected = now + 250;
    }, 250);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  isResourceExhausted(): boolean {
    return this.getResourceRejectionReason() !== undefined;
  }

  readonly middleware = (
    request: Request,
    response: Response,
    next: NextFunction,
  ): void => {
    // Only the cheap liveness probe is exempt; /health/database consumes capacity.
    if (
      ['GET', 'HEAD'].includes(request.method) &&
      /^\/api\/v1\/health\/?$/i.test(request.path)
    ) {
      next();
      return;
    }

    const upload = /^multipart\/form-data(?:;|$)/i.test(
      request.headers['content-type'] ?? '',
    );
    const heavy =
      upload ||
      (request.method !== 'GET' &&
        request.method !== 'HEAD' &&
        /^\/api\/v1\/(?:auth(?:\/|$)|chatbot(?:\/|$)|(?:admin\/)?users(?:\/|$))/i.test(
          request.path,
        ));
    const rejectionReason = this.getRejectionReason(heavy, upload);
    if (rejectionReason) {
      // Do not queue requests (or read their bodies) while already overloaded.
      const existingRequestId = response.getHeader('X-Request-Id');
      const requestId =
        typeof existingRequestId === 'string'
          ? existingRequestId
          : randomUUID();
      response.setHeader('X-Request-Id', requestId);
      response.setHeader('Retry-After', '2');
      response.setHeader('Connection', 'close');
      response.setHeader('Cache-Control', 'no-store');
      this.warnRejectedRequest(rejectionReason);
      response.status(503).json({
        success: false,
        error: {
          code: ErrorCode.SERVER_BUSY,
          message: 'Hệ thống đang quá tải, vui lòng thử lại sau.',
          details: [],
        },
        requestId,
      });
      return;
    }

    this.active++;
    if (heavy) this.heavy++;
    if (upload) this.uploads++;
    let released = false;
    const reservation: Reservation = {
      processing: false,
      closed: false,
      release: () => {
        if (released) return;
        released = true;
        this.active--;
        if (heavy) this.heavy--;
        if (upload) this.uploads--;
        this.reservations.delete(request);
      },
    };
    this.reservations.set(request, reservation);
    response.once('finish', reservation.release);
    response.once('close', () => {
      reservation.closed = true;
      // Disconnecting does not cancel an already running Promise/sharp job.
      if (!reservation.processing) reservation.release();
    });
    next();
  };

  private getRejectionReason(
    heavy: boolean,
    upload: boolean,
  ): RejectionReason | undefined {
    if (this.active >= this.options.maxConcurrentRequests) {
      return 'concurrent_requests';
    }
    if (upload && this.uploads >= this.options.maxConcurrentUploads) {
      return 'concurrent_uploads';
    }
    if (heavy && this.heavy >= this.options.maxConcurrentHeavyRequests) {
      return 'concurrent_heavy_requests';
    }
    return this.getResourceRejectionReason();
  }

  private getResourceRejectionReason(): RejectionReason | undefined {
    if (process.memoryUsage.rss() >= this.options.maxRssMb * 1024 * 1024) {
      return 'rss_memory';
    }
    if (this.eventLoopDelayMs >= this.options.maxEventLoopDelayMs) {
      return 'event_loop_delay';
    }
    return undefined;
  }

  private warnRejectedRequest(reason: RejectionReason): void {
    const now = Date.now();
    if (now - this.lastWarningAt < 5_000) return;
    this.lastWarningAt = now;
    const rssMb = Math.round(process.memoryUsage.rss() / 1024 / 1024);
    this.logger.warn(
      `Request rejected (${reason}); active=${this.active}, heavy=${this.heavy}, uploads=${this.uploads}, rss=${rssMb}MiB, eventLoopDelay=${Math.round(this.eventLoopDelayMs)}ms`,
    );
  }

  trackProcessing(request: Request): () => void {
    const reservation = this.reservations.get(request);
    if (!reservation) return () => undefined;
    reservation.processing = true;
    return () => {
      reservation.processing = false;
      if (reservation.closed) reservation.release();
    };
  }
}

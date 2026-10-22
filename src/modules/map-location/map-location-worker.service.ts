import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MapLocationStatus, Prisma } from '../../../generated/prisma';
import { PrismaService } from '../../database/prisma.service';
import { GoogleMapResolverService } from './google-map-resolver.service';
import { TemporaryMapResolutionError } from './safe-google-redirect.service';

interface ClaimedResolution {
  id: string;
  googleMapsUrl: string;
  urlHash: string;
  attemptCount: number;
  source: string;
  sourceId: string;
  subId: string;
}

@Injectable()
export class MapLocationWorkerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(MapLocationWorkerService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private readonly enabled: boolean;
  private readonly concurrency: number;
  private readonly pollIntervalMs: number;
  private readonly maxAttempts: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: GoogleMapResolverService,
    config: ConfigService,
  ) {
    const enabledValue = config.get<string | boolean>(
      'MAP_LOCATION_WORKER_ENABLED',
      false,
    );
    const maintenanceCommand = process.argv.some((argument) =>
      argument.includes('map-location-maintenance'),
    );
    this.enabled =
      !maintenanceCommand && (enabledValue === true || enabledValue === 'true');
    this.concurrency = Number(
      config.get<string | number>('MAP_LOCATION_WORKER_CONCURRENCY', 3),
    );
    this.pollIntervalMs = Number(
      config.get<string | number>('MAP_LOCATION_WORKER_POLL_MS', 5_000),
    );
    this.maxAttempts = Number(
      config.get<string | number>('MAP_LOCATION_MAX_ATTEMPTS', 3),
    );
  }

  onApplicationBootstrap(): void {
    if (!this.enabled) {
      this.logger.log('Map-location worker is disabled');
      return;
    }
    this.timer = setInterval(() => this.trigger(), this.pollIntervalMs);
    this.timer.unref();
    this.trigger();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async processBatch(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const jobs = await this.claim(this.concurrency);
      await Promise.all(jobs.map((job) => this.processOne(job)));
      return jobs.length;
    } finally {
      this.running = false;
    }
  }

  private trigger(): void {
    void this.processBatch().catch((error: unknown) => {
      const code = error instanceof Error ? error.name : 'UNKNOWN';
      this.logger.error(`Map-location worker batch failed: code=${code}`);
    });
  }

  private async claim(limit: number): Promise<ClaimedResolution[]> {
    return this.prisma.$queryRaw<ClaimedResolution[]>(Prisma.sql`
      WITH candidates AS (
        SELECT "id"
        FROM "MapLocationResolution"
        WHERE "status" = 'PENDING'::"MapLocationStatus"
          AND "nextAttemptAt" <= NOW()
          AND ("lockedAt" IS NULL OR "lockedAt" < NOW() - INTERVAL '2 minutes')
        ORDER BY "nextAttemptAt" ASC, "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      )
      UPDATE "MapLocationResolution" AS resolution
      SET "lockedAt" = NOW(),
          "attemptCount" = resolution."attemptCount" + 1,
          "updatedAt" = NOW()
      FROM candidates
      WHERE resolution."id" = candidates."id"
      RETURNING resolution."id", resolution."googleMapsUrl",
        resolution."urlHash", resolution."attemptCount", resolution."source"::text,
        resolution."sourceId", resolution."subId"
    `);
  }

  private async processOne(job: ClaimedResolution): Promise<void> {
    try {
      const result = await this.resolver.resolve(job.googleMapsUrl);
      if (result.kind === 'resolved') {
        await this.prisma.mapLocationResolution.updateMany({
          where: { id: job.id, urlHash: job.urlHash },
          data: {
            status: MapLocationStatus.RESOLVED,
            lat: result.coordinates.lat,
            lng: result.coordinates.lng,
            resolvedAt: new Date(),
            reasonCode: null,
            lockedAt: null,
          },
        });
        return;
      }
      await this.prisma.mapLocationResolution.updateMany({
        where: { id: job.id, urlHash: job.urlHash },
        data: {
          status: MapLocationStatus.UNRESOLVED,
          lat: null,
          lng: null,
          resolvedAt: null,
          reasonCode: result.reasonCode,
          lockedAt: null,
        },
      });
    } catch (error) {
      const temporary = error instanceof TemporaryMapResolutionError;
      const exhausted = job.attemptCount >= this.maxAttempts;
      const reasonCode = temporary ? error.reasonCode : 'UNEXPECTED_ERROR';
      const retryDelayMs = 5_000 * 2 ** Math.max(0, job.attemptCount - 1);
      await this.prisma.mapLocationResolution.updateMany({
        where: { id: job.id, urlHash: job.urlHash },
        data: {
          status: exhausted
            ? MapLocationStatus.FAILED
            : MapLocationStatus.PENDING,
          lat: null,
          lng: null,
          resolvedAt: null,
          reasonCode,
          lockedAt: null,
          nextAttemptAt: new Date(Date.now() + retryDelayMs),
        },
      });
      this.logger.warn(
        `Map resolution ${exhausted ? 'failed' : 'will retry'}: source=${job.source} sourceId=${job.sourceId} subId=${job.subId || '-'} code=${reasonCode}`,
      );
    }
  }
}

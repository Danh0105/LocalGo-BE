import { Injectable } from '@nestjs/common';
import {
  MapLocationSource,
  MapLocationStatus,
} from '../../../generated/prisma';
import { isValidGoogleMapsUrl } from '../../common/validation/google-maps-url.validator';
import { PrismaService } from '../../database/prisma.service';
import { parseSuggestedPlaceDetails } from '../cuisine/utils/suggested-place.util';
import { MapLocationService } from './map-location.service';
import type { MapLocationBackfillOptions } from './map-location.types';

export interface MapLocationMaintenanceReport {
  eligible: number;
  pending: number;
  resolved: number;
  unresolved: number;
  failed: number;
  reasons: Record<string, number>;
}

@Injectable()
export class MapLocationMaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locations: MapLocationService,
  ) {}

  async backfill(
    options: MapLocationBackfillOptions,
  ): Promise<MapLocationMaintenanceReport> {
    const batchSize = Math.min(Math.max(options.batchSize, 1), 500);
    let eligible = 0;

    eligible += await this.backfillSimpleSource(
      MapLocationSource.MAP_PLACE,
      batchSize,
      options.dryRun,
      (cursor) =>
        this.prisma.mapPlace.findMany({
          take: batchSize,
          orderBy: { id: 'asc' },
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          select: { id: true, googleMapsUrl: true },
        }),
    );
    eligible += await this.backfillSimpleSource(
      MapLocationSource.TEMPLE,
      batchSize,
      options.dryRun,
      (cursor) =>
        this.prisma.temple.findMany({
          take: batchSize,
          orderBy: { id: 'asc' },
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          select: { id: true, googleMapsUrl: true },
        }),
    );
    eligible += await this.backfillSimpleSource(
      MapLocationSource.HISTORICAL_SITE,
      batchSize,
      options.dryRun,
      (cursor) =>
        this.prisma.historicalSite.findMany({
          take: batchSize,
          orderBy: { id: 'asc' },
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          select: { id: true, googleMapsUrl: true },
        }),
    );

    let cuisineCursor: string | undefined;
    while (true) {
      const records = await this.prisma.cuisineItem.findMany({
        take: batchSize,
        orderBy: { id: 'asc' },
        ...(cuisineCursor ? { cursor: { id: cuisineCursor }, skip: 1 } : {}),
        select: { id: true, googleMapsUrl: true, suggestedPlaces: true },
      });
      if (records.length === 0) break;
      for (const record of records) {
        const places = parseSuggestedPlaceDetails(
          record.suggestedPlaces,
          record.id,
        );
        if (this.isEligible(record.googleMapsUrl)) eligible += 1;
        eligible += places.filter((place) =>
          this.isEligible(place.googleMapsUrl),
        ).length;
        if (!options.dryRun) {
          await this.prisma.$transaction((tx) =>
            this.locations.syncCuisine(
              tx,
              record.id,
              record.googleMapsUrl,
              places,
            ),
          );
        }
      }
      cuisineCursor = records.at(-1)?.id;
    }

    return this.report(eligible);
  }

  async retry(
    statuses: Array<'failed' | 'unresolved'>,
  ): Promise<MapLocationMaintenanceReport> {
    const dbStatuses = statuses.map((status) =>
      status === 'failed'
        ? MapLocationStatus.FAILED
        : MapLocationStatus.UNRESOLVED,
    );
    const updated = await this.prisma.mapLocationResolution.updateMany({
      where: { status: { in: dbStatuses } },
      data: {
        status: MapLocationStatus.PENDING,
        lat: null,
        lng: null,
        resolvedAt: null,
        reasonCode: null,
        attemptCount: 0,
        nextAttemptAt: new Date(),
        lockedAt: null,
      },
    });
    return this.report(updated.count);
  }

  private async backfillSimpleSource(
    source: MapLocationSource,
    batchSize: number,
    dryRun: boolean,
    readBatch: (
      cursor?: string,
    ) => Promise<Array<{ id: string; googleMapsUrl: string }>>,
  ): Promise<number> {
    let cursor: string | undefined;
    let eligible = 0;
    while (true) {
      const records = await readBatch(cursor);
      if (records.length === 0) break;
      for (const record of records) {
        if (this.isEligible(record.googleMapsUrl)) eligible += 1;
        if (!dryRun) {
          await this.prisma.$transaction((tx) =>
            this.locations.sync(
              tx,
              { source, sourceId: record.id },
              record.googleMapsUrl,
            ),
          );
        }
      }
      cursor = records.at(-1)?.id;
      if (records.length < batchSize) break;
    }
    return eligible;
  }

  private isEligible(rawUrl: string): boolean {
    return rawUrl.trim().length > 0 && isValidGoogleMapsUrl(rawUrl);
  }

  private async report(
    eligible: number,
  ): Promise<MapLocationMaintenanceReport> {
    const groups = await this.prisma.mapLocationResolution.groupBy({
      by: ['status', 'reasonCode'],
      _count: { _all: true },
    });
    const count = (status: MapLocationStatus): number =>
      groups
        .filter((group) => group.status === status)
        .reduce((total, group) => total + group._count._all, 0);
    const reasons = groups.reduce<Record<string, number>>((result, group) => {
      if (group.reasonCode) {
        result[group.reasonCode] =
          (result[group.reasonCode] ?? 0) + group._count._all;
      }
      return result;
    }, {});
    return {
      eligible,
      pending: count(MapLocationStatus.PENDING),
      resolved: count(MapLocationStatus.RESOLVED),
      unresolved: count(MapLocationStatus.UNRESOLVED),
      failed: count(MapLocationStatus.FAILED),
      reasons,
    };
  }
}

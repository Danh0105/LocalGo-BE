import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  MapLocationSource,
  MapLocationStatus,
  Prisma,
  type MapLocationResolution,
} from '../../../generated/prisma';
import type { MapLocationResponseDto } from '../../common/dto/map-location-response.dto';
import { isValidGoogleMapsUrl } from '../../common/validation/google-maps-url.validator';
import { PrismaService } from '../../database/prisma.service';
import { mapLocationKey } from './map-location-key.util';
import type { MapLocationAssociation } from './map-location.types';

type DatabaseClient = PrismaService | Prisma.TransactionClient;

export interface MapLocationLookup {
  googleMapsUrl: string;
  response: MapLocationResponseDto;
}

@Injectable()
export class MapLocationService {
  constructor(private readonly prisma: PrismaService) {}

  async sync(
    tx: Prisma.TransactionClient,
    association: MapLocationAssociation,
    rawUrl: string | null | undefined,
  ): Promise<void> {
    const googleMapsUrl = rawUrl?.trim() ?? '';
    const subId = association.subId ?? '';
    const unique = {
      source_sourceId_subId: {
        source: association.source,
        sourceId: association.sourceId,
        subId,
      },
    };

    if (!googleMapsUrl || !isValidGoogleMapsUrl(googleMapsUrl)) {
      await tx.mapLocationResolution.deleteMany({
        where: {
          source: association.source,
          sourceId: association.sourceId,
          subId,
        },
      });
      return;
    }

    const urlHash = createHash('sha256').update(googleMapsUrl).digest('hex');
    const existing = await tx.mapLocationResolution.findUnique({
      where: unique,
      select: { urlHash: true },
    });
    if (existing?.urlHash === urlHash) return;

    const reset = {
      googleMapsUrl,
      urlHash,
      status: MapLocationStatus.PENDING,
      lat: null,
      lng: null,
      resolvedAt: null,
      reasonCode: null,
      attemptCount: 0,
      nextAttemptAt: new Date(),
      lockedAt: null,
    };
    await tx.mapLocationResolution.upsert({
      where: unique,
      create: {
        source: association.source,
        sourceId: association.sourceId,
        subId,
        ...reset,
      },
      update: reset,
    });
  }

  async syncCuisine(
    tx: Prisma.TransactionClient,
    cuisineId: string,
    googleMapsUrl: string,
    places: Array<{ id: string; googleMapsUrl: string }>,
  ): Promise<void> {
    await this.sync(
      tx,
      { source: MapLocationSource.CUISINE, sourceId: cuisineId },
      googleMapsUrl,
    );
    for (const place of places) {
      await this.sync(
        tx,
        {
          source: MapLocationSource.CUISINE,
          sourceId: cuisineId,
          subId: place.id,
        },
        place.googleMapsUrl,
      );
    }
    await tx.mapLocationResolution.deleteMany({
      where: {
        source: MapLocationSource.CUISINE,
        sourceId: cuisineId,
        subId: {
          not: '',
          ...(places.length > 0 ? { notIn: places.map(({ id }) => id) } : {}),
        },
      },
    });
  }

  async deleteForRecord(
    tx: Prisma.TransactionClient,
    source: MapLocationSource,
    sourceId: string,
  ): Promise<void> {
    await tx.mapLocationResolution.deleteMany({ where: { source, sourceId } });
  }

  async getOne(
    source: MapLocationSource,
    sourceId: string,
    subId = '',
    rawUrl?: string,
  ): Promise<MapLocationResponseDto | null> {
    const record = await this.prisma.mapLocationResolution.findUnique({
      where: { source_sourceId_subId: { source, sourceId, subId } },
    });
    if (!record) return this.pendingForValidUrl(rawUrl);
    if (rawUrl !== undefined && record.googleMapsUrl !== rawUrl.trim()) {
      return this.pendingForValidUrl(rawUrl);
    }
    return this.toResponse(record);
  }

  async getForRecords(
    source: MapLocationSource,
    sourceIds: string[],
    client: DatabaseClient = this.prisma,
  ): Promise<Map<string, MapLocationLookup>> {
    if (sourceIds.length === 0) return new Map();
    const records = await client.mapLocationResolution.findMany({
      where: { source, sourceId: { in: sourceIds } },
    });
    return new Map(
      records.map((record) => [
        mapLocationKey(record.source, record.sourceId, record.subId),
        {
          googleMapsUrl: record.googleMapsUrl,
          response: this.toResponse(record),
        },
      ]),
    );
  }

  getFromMap(
    locations: Map<string, MapLocationLookup>,
    source: MapLocationSource,
    sourceId: string,
    subId = '',
    rawUrl?: string,
  ): MapLocationResponseDto | null {
    const match = locations.get(mapLocationKey(source, sourceId, subId));
    if (
      !match ||
      (rawUrl !== undefined && match.googleMapsUrl !== rawUrl.trim())
    ) {
      return this.pendingForValidUrl(rawUrl);
    }
    return match.response;
  }

  private pendingForValidUrl(
    rawUrl: string | null | undefined,
  ): MapLocationResponseDto | null {
    if (!rawUrl?.trim() || !isValidGoogleMapsUrl(rawUrl)) return null;
    return { status: 'pending', coordinates: null, resolvedAt: null };
  }

  private toResponse(record: MapLocationResolution): MapLocationResponseDto {
    const status =
      record.status.toLowerCase() as MapLocationResponseDto['status'];
    const hasCoordinates =
      record.status === MapLocationStatus.RESOLVED &&
      record.lat !== null &&
      record.lng !== null;
    return {
      status,
      coordinates: hasCoordinates
        ? { lat: Number(record.lat), lng: Number(record.lng) }
        : null,
      resolvedAt:
        record.status === MapLocationStatus.RESOLVED && record.resolvedAt
          ? record.resolvedAt.toISOString()
          : null,
    };
  }
}

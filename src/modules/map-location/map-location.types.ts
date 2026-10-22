import type { MapLocationSource } from '../../../generated/prisma';

export interface MapLocationAssociation {
  source: MapLocationSource;
  sourceId: string;
  subId?: string;
}

export interface ResolvedCoordinates {
  lat: number;
  lng: number;
}

export type ResolutionResult =
  | { kind: 'resolved'; coordinates: ResolvedCoordinates }
  | { kind: 'unresolved'; reasonCode: string };

export interface MapLocationBackfillOptions {
  dryRun: boolean;
  batchSize: number;
}

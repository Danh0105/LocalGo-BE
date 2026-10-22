import type { MapLocationSource } from '../../../generated/prisma';

export function mapLocationKey(
  source: MapLocationSource,
  sourceId: string,
  subId = '',
): string {
  return `${source}\u0000${sourceId}\u0000${subId}`;
}

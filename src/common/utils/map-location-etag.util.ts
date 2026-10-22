import { createHash } from 'node:crypto';
import type { MapLocationResponseDto } from '../dto/map-location-response.dto';

export function mapLocationEtagPart(
  locations: Array<MapLocationResponseDto | null>,
): string {
  return createHash('sha256')
    .update(JSON.stringify(locations))
    .digest('hex')
    .slice(0, 12);
}

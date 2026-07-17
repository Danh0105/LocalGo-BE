import { Logger } from '@nestjs/common';
import type { Prisma } from '../../../../generated/prisma';
import { slugify } from '../../../common/utils/slugify.util';

export interface CuisineSuggestedPlace {
  id: string;
  name: string;
  address: string;
  googleMapsUrl: string;
}

const logger = new Logger('CuisineSuggestedPlaces');

/**
 * Reads CuisineItem.suggestedPlaces, which may still hold the legacy
 * string[] shape or the current CuisineSuggestedPlace[] shape. Never throws —
 * unrecognized entries are skipped (with a warning that never includes the
 * entry's own content) so one malformed record can't 500 a request.
 */
export function parseSuggestedPlaceDetails(
  value: Prisma.JsonValue,
  cuisineItemId: string,
): CuisineSuggestedPlace[] {
  if (!Array.isArray(value)) return [];

  const seenIds = new Set<string>();
  const uniqueId = (base: string): string => {
    let candidate = base;
    let suffix = 2;
    while (seenIds.has(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    seenIds.add(candidate);
    return candidate;
  };

  const places: CuisineSuggestedPlace[] = [];
  value.forEach((item, index) => {
    try {
      if (typeof item === 'string') {
        const name = item.trim();
        if (!name) return;
        places.push({
          id: uniqueId(slugify(name)),
          name,
          address: '',
          googleMapsUrl: '',
        });
        return;
      }

      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const raw = item as Record<string, unknown>;
        const name = typeof raw.name === 'string' ? raw.name.trim() : '';
        if (!name) return;
        const id =
          typeof raw.id === 'string' && raw.id.trim().length > 0
            ? uniqueId(raw.id.trim())
            : uniqueId(slugify(name));
        const address = typeof raw.address === 'string' ? raw.address : '';
        const googleMapsUrl =
          typeof raw.googleMapsUrl === 'string' ? raw.googleMapsUrl : '';
        places.push({ id, name, address, googleMapsUrl });
        return;
      }

      logger.warn(
        `Bỏ qua phần tử suggestedPlaces không nhận dạng được ở món ${cuisineItemId}, vị trí ${index}`,
      );
    } catch {
      logger.warn(
        `Không thể đọc phần tử suggestedPlaces của món ${cuisineItemId}, vị trí ${index}`,
      );
    }
  });
  return places;
}

import { Logger } from '@nestjs/common';
import type { Prisma } from '../../../../generated/prisma';
import { slugify } from '../../../common/utils/slugify.util';

export interface SpecialtyBuyPlace {
  id: string;
  name: string;
  address: string;
  googleMapsUrl: string;
  phone: string;
  email: string;
}

const logger = new Logger('SpecialtyBuyPlaces');

/**
 * Reads Specialty.buyPlaces in both the legacy string[] shape and the current
 * SpecialtyBuyPlace[] shape. Invalid entries are skipped so malformed legacy
 * data cannot make the public endpoint fail.
 */
export function parseBuyPlaceDetails(
  value: Prisma.JsonValue,
  specialtyId: string,
): SpecialtyBuyPlace[] {
  if (!Array.isArray(value)) return [];

  const seenIds = new Set<string>();
  const uniqueId = (base: string): string => {
    const normalizedBase = base || 'dia-diem';
    let candidate = normalizedBase;
    let suffix = 2;
    while (seenIds.has(candidate)) {
      candidate = `${normalizedBase}-${suffix}`;
      suffix += 1;
    }
    seenIds.add(candidate);
    return candidate;
  };

  const places: SpecialtyBuyPlace[] = [];
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
          phone: '',
          email: '',
        });
        return;
      }

      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const raw = item as Record<string, unknown>;
        const name = typeof raw.name === 'string' ? raw.name.trim() : '';
        if (!name) return;
        const rawId = typeof raw.id === 'string' ? raw.id.trim() : '';
        places.push({
          id: uniqueId(rawId || slugify(name)),
          name,
          address: typeof raw.address === 'string' ? raw.address : '',
          googleMapsUrl:
            typeof raw.googleMapsUrl === 'string' ? raw.googleMapsUrl : '',
          phone: typeof raw.phone === 'string' ? raw.phone : '',
          email: typeof raw.email === 'string' ? raw.email : '',
        });
        return;
      }

      logger.warn(
        `Bỏ qua phần tử buyPlaces không nhận dạng được ở đặc sản ${specialtyId}, vị trí ${index}`,
      );
    } catch {
      logger.warn(
        `Không thể đọc phần tử buyPlaces của đặc sản ${specialtyId}, vị trí ${index}`,
      );
    }
  });
  return places;
}

import { Logger } from '@nestjs/common';
import type { Prisma } from '../../../../generated/prisma';

export interface CuisineMenuItem {
  id: string;
  name: string;
  price: string;
  description: string;
}

export interface CuisineReview {
  id: string;
  reviewerName: string;
  rating: number;
  feedback: string;
  adminResponse: string;
}

const logger = new Logger('CuisineDetails');

export function parseCuisineMenu(
  value: Prisma.JsonValue,
  cuisineItemId: string,
): CuisineMenuItem[] {
  if (!Array.isArray(value)) return [];
  const seenIds = new Set<string>();
  const result: CuisineMenuItem[] = [];
  value.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      logger.warn(
        `Bỏ qua phần tử menu không hợp lệ ở món ${cuisineItemId}, vị trí ${index}`,
      );
      return;
    }
    const raw = item as Record<string, unknown>;
    const id = typeof raw.id === 'string' ? raw.id.trim() : '';
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    const price = typeof raw.price === 'string' ? raw.price.trim() : '';
    if (!id || !name || !price || seenIds.has(id)) return;
    seenIds.add(id);
    result.push({
      id,
      name,
      price,
      description: typeof raw.description === 'string' ? raw.description : '',
    });
  });
  return result;
}

export function parseCuisineReviews(
  value: Prisma.JsonValue,
  cuisineItemId: string,
): CuisineReview[] {
  if (!Array.isArray(value)) return [];
  const seenIds = new Set<string>();
  const result: CuisineReview[] = [];
  value.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      logger.warn(
        `Bỏ qua đánh giá không hợp lệ ở món ${cuisineItemId}, vị trí ${index}`,
      );
      return;
    }
    const raw = item as Record<string, unknown>;
    const id = typeof raw.id === 'string' ? raw.id.trim() : '';
    const reviewerName =
      typeof raw.reviewerName === 'string' ? raw.reviewerName.trim() : '';
    const feedback =
      typeof raw.feedback === 'string' ? raw.feedback.trim() : '';
    const rating = typeof raw.rating === 'number' ? raw.rating : 0;
    if (
      !id ||
      !reviewerName ||
      !feedback ||
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5 ||
      seenIds.has(id)
    ) {
      return;
    }
    seenIds.add(id);
    result.push({
      id,
      reviewerName,
      rating,
      feedback,
      adminResponse:
        typeof raw.adminResponse === 'string' ? raw.adminResponse : '',
    });
  });
  return result;
}

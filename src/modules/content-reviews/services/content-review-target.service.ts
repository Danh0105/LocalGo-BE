import { HttpStatus, Injectable } from '@nestjs/common';
import { ContentReviewTargetType } from '../../../../generated/prisma';
import { ErrorCode } from '../../../common/constants/error-codes.constant';
import { AppException } from '../../../common/exceptions/app.exception';
import { PrismaService } from '../../../database/prisma.service';
import { CONTENT_REVIEW_TARGET_FROM_DB } from '../content-review.constants';
import type { ContentReviewTargetResponseDto } from '../dto/content-review-response.dto';

const TARGET_SELECT = {
  id: true,
  name: true,
  isActive: true,
  media: { select: { originalUrl: true } },
} as const;

interface TargetRow {
  id: string;
  name: string;
  isActive: boolean;
  deletedAt?: Date | null;
  media: { originalUrl: string } | null;
}

export interface ContentReviewTargetKey {
  targetType: ContentReviewTargetType;
  targetId: string;
}

export function contentReviewTargetKey(key: ContentReviewTargetKey): string {
  return `${key.targetType}:${key.targetId}`;
}

/**
 * Looks up the content rows reviews point at. ContentReview has no FK to
 * them, so this is the single place that knows which table backs each
 * targetType.
 */
@Injectable()
export class ContentReviewTargetService {
  constructor(private readonly prisma: PrismaService) {}

  /** The target as the public mini app sees it; hidden or deleted items are a 404. */
  async getVisibleOrThrow(
    targetType: ContentReviewTargetType,
    targetId: string,
  ): Promise<ContentReviewTargetResponseDto> {
    const [row] = await this.findRows(targetType, [targetId]);
    const target = this.toDto(targetType, targetId, row);
    if (!target.isActive || target.deleted) {
      throw new AppException(
        ErrorCode.CONTENT_REVIEW_TARGET_NOT_FOUND,
        'Không tìm thấy mục cần đánh giá hoặc mục đang bị ẩn',
        HttpStatus.NOT_FOUND,
      );
    }
    return target;
  }

  /** Batch-resolves targets keyed by contentReviewTargetKey(); missing rows come back as deleted. */
  async resolve(
    keys: ContentReviewTargetKey[],
  ): Promise<Map<string, ContentReviewTargetResponseDto>> {
    const idsByType = new Map<ContentReviewTargetType, Set<string>>();
    for (const key of keys) {
      const ids = idsByType.get(key.targetType) ?? new Set<string>();
      ids.add(key.targetId);
      idsByType.set(key.targetType, ids);
    }

    const result = new Map<string, ContentReviewTargetResponseDto>();
    await Promise.all(
      [...idsByType].map(async ([targetType, idSet]) => {
        const ids = [...idSet];
        const rows = new Map(
          (await this.findRows(targetType, ids)).map((row) => [row.id, row]),
        );
        for (const targetId of ids) {
          result.set(
            contentReviewTargetKey({ targetType, targetId }),
            this.toDto(targetType, targetId, rows.get(targetId)),
          );
        }
      }),
    );
    return result;
  }

  private toDto(
    targetType: ContentReviewTargetType,
    targetId: string,
    row: TargetRow | undefined,
  ): ContentReviewTargetResponseDto {
    const deleted = !row || (row.deletedAt ?? null) !== null;
    return {
      targetType: CONTENT_REVIEW_TARGET_FROM_DB[targetType],
      id: targetId,
      name: row?.name ?? null,
      imageUrl: row?.media?.originalUrl ?? null,
      isActive: !deleted && (row?.isActive ?? false),
      deleted,
    };
  }

  private findRows(
    targetType: ContentReviewTargetType,
    ids: string[],
  ): Promise<TargetRow[]> {
    const where = { id: { in: ids } };
    switch (targetType) {
      case ContentReviewTargetType.TEMPLE:
        return this.prisma.temple.findMany({ where, select: TARGET_SELECT });
      case ContentReviewTargetType.SPECIALTY:
        // The only section with soft delete; a deleted specialty keeps its id.
        return this.prisma.specialty.findMany({
          where,
          select: { ...TARGET_SELECT, deletedAt: true },
        });
      case ContentReviewTargetType.HISTORICAL_SITE:
        return this.prisma.historicalSite.findMany({
          where,
          select: TARGET_SELECT,
        });
      case ContentReviewTargetType.AGRICULTURE:
        return this.prisma.agricultureItem.findMany({
          where,
          select: TARGET_SELECT,
        });
      case ContentReviewTargetType.CRAFT_VILLAGE:
        return this.prisma.craftVillage.findMany({
          where,
          select: TARGET_SELECT,
        });
      case ContentReviewTargetType.CUISINE:
        return this.prisma.cuisineItem.findMany({
          where,
          select: TARGET_SELECT,
        });
      case ContentReviewTargetType.FESTIVAL:
        return this.prisma.festival.findMany({ where, select: TARGET_SELECT });
      case ContentReviewTargetType.EXPERIENCE_TOUR:
        return this.prisma.experienceTour.findMany({
          where,
          select: TARGET_SELECT,
        });
      default: {
        const unsupported: never = targetType;
        throw new Error(
          `Unsupported content review target: ${String(unsupported)}`,
        );
      }
    }
  }
}

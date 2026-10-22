import { HttpStatus, Injectable } from '@nestjs/common';
import {
  ContentReviewStatus,
  Prisma,
  type ContentReviewTargetType,
} from '../../../../generated/prisma';
import { ErrorCode } from '../../../common/constants/error-codes.constant';
import type { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { PaginatedResultDto } from '../../../common/dto/pagination-meta.dto';
import { AppException } from '../../../common/exceptions/app.exception';
import {
  buildPaginationArgs,
  paginate,
} from '../../../common/pagination/pagination.util';
import { PrismaService } from '../../../database/prisma.service';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { MediaService } from '../../media/services/media.service';
import {
  NotificationType,
  excerpt,
} from '../../notifications/notification-types';
import { NotificationService } from '../../notifications/services/notification.service';
import {
  CONTENT_REVIEW_TARGET_FROM_DB,
  CONTENT_REVIEW_TARGET_LABELS,
  CONTENT_REVIEW_TARGET_TO_DB,
  CONTENT_REVIEW_TARGET_TYPES,
  type ContentReviewTargetTypeName,
} from '../content-review.constants';
import {
  ContentReviewAdminResponseDto,
  ContentReviewAdminStatsResponseDto,
  ContentReviewRatingResponseDto,
  ContentReviewResponseDto,
  ContentReviewSummaryResponseDto,
  ContentReviewWithTargetResponseDto,
} from '../dto/content-review-response.dto';
import {
  QueryContentReviewAdminDto,
  QueryContentReviewAdminStatsDto,
  QueryContentReviewRatingsDto,
} from '../dto/query-content-review.dto';
import {
  CreateContentReviewDto,
  UpdateContentReviewDto,
} from '../dto/upsert-content-review.dto';
import {
  ContentReviewTargetService,
  contentReviewTargetKey,
} from './content-review-target.service';

const IMAGES_INCLUDE = {
  include: { media: true },
  orderBy: { sortOrder: 'asc' as const },
};

/** Public responses: reviewer identity without contact details. */
const REVIEW_INCLUDE = {
  images: IMAGES_INCLUDE,
  user: { select: { id: true, displayName: true, avatarUrl: true } },
} satisfies Prisma.ContentReviewInclude;

const ADMIN_INCLUDE = {
  images: IMAGES_INCLUDE,
  user: {
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
      email: true,
      phone: true,
      status: true,
    },
  },
  repliedBy: { select: { id: true, displayName: true } },
} satisfies Prisma.ContentReviewInclude;

type ContentReviewRecord = Prisma.ContentReviewGetPayload<{
  include: typeof REVIEW_INCLUDE;
}>;
type ContentReviewAdminRecord = Prisma.ContentReviewGetPayload<{
  include: typeof ADMIN_INCLUDE;
}>;

type StarKey = '1' | '2' | '3' | '4' | '5';
const STAR_KEYS: StarKey[] = ['1', '2', '3', '4', '5'];

function roundRating(value: number): number {
  return Math.round(value * 10) / 10;
}

@Injectable()
export class ContentReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly targets: ContentReviewTargetService,
    private readonly mediaService: MediaService,
    private readonly auditLogService: AuditLogService,
    private readonly notifications: NotificationService,
  ) {}

  async listPublic(
    targetType: ContentReviewTargetType,
    targetId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResultDto<ContentReviewResponseDto>> {
    await this.targets.getVisibleOrThrow(targetType, targetId);
    const where: Prisma.ContentReviewWhereInput = {
      targetType,
      targetId,
      status: ContentReviewStatus.PUBLISHED,
      deletedAt: null,
    };
    const { skip, take } = buildPaginationArgs(query.page, query.limit);
    const [records, total] = await this.prisma.$transaction([
      this.prisma.contentReview.findMany({
        where,
        include: REVIEW_INCLUDE,
        orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
        skip,
        take,
      }),
      this.prisma.contentReview.count({ where }),
    ]);
    return paginate(
      records.map((record) => this.toDto(record)),
      query.page,
      query.limit,
      total,
    );
  }

  async getSummary(
    targetType: ContentReviewTargetType,
    targetId: string,
  ): Promise<ContentReviewSummaryResponseDto> {
    await this.targets.getVisibleOrThrow(targetType, targetId);
    const grouped = await this.prisma.contentReview.groupBy({
      by: ['rating'],
      where: {
        targetType,
        targetId,
        status: ContentReviewStatus.PUBLISHED,
        deletedAt: null,
      },
      _count: { _all: true },
    });

    const counts = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    let total = 0;
    let sum = 0;
    for (const row of grouped) {
      counts[String(row.rating) as StarKey] = row._count._all;
      total += row._count._all;
      sum += row.rating * row._count._all;
    }
    const distribution = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    if (total > 0) {
      for (const key of STAR_KEYS) {
        distribution[key] = Math.round((counts[key] / total) * 100);
      }
    }
    return {
      average: total > 0 ? roundRating(sum / total) : 0,
      total,
      distribution,
      counts,
    };
  }

  /** Average + count per item, for star badges on section list cards. */
  async getRatings(
    query: QueryContentReviewRatingsDto,
  ): Promise<ContentReviewRatingResponseDto[]> {
    const grouped = await this.prisma.contentReview.groupBy({
      by: ['targetId'],
      where: {
        targetType: CONTENT_REVIEW_TARGET_TO_DB[query.targetType],
        status: ContentReviewStatus.PUBLISHED,
        deletedAt: null,
        ...(query.ids ? { targetId: { in: query.ids } } : {}),
      },
      _avg: { rating: true },
      _count: { _all: true },
    });
    const ratings = new Map(
      grouped.map((row) => [
        row.targetId,
        {
          targetId: row.targetId,
          average: roundRating(row._avg.rating ?? 0),
          total: row._count._all,
        },
      ]),
    );
    if (!query.ids) return [...ratings.values()];
    return [...new Set(query.ids)].map(
      (targetId) => ratings.get(targetId) ?? { targetId, average: 0, total: 0 },
    );
  }

  /** The caller's active review on one item (any status), or null. */
  async findMine(
    user: AuthenticatedUser,
    targetType: ContentReviewTargetType,
    targetId: string,
  ): Promise<ContentReviewResponseDto | null> {
    const record = await this.prisma.contentReview.findFirst({
      where: { targetType, targetId, userId: user.id, deletedAt: null },
      include: REVIEW_INCLUDE,
    });
    return record ? this.toDto(record) : null;
  }

  async listMine(
    user: AuthenticatedUser,
    query: PaginationQueryDto,
  ): Promise<PaginatedResultDto<ContentReviewWithTargetResponseDto>> {
    const where: Prisma.ContentReviewWhereInput = {
      userId: user.id,
      deletedAt: null,
    };
    const { skip, take } = buildPaginationArgs(query.page, query.limit);
    const [records, total] = await this.prisma.$transaction([
      this.prisma.contentReview.findMany({
        where,
        include: REVIEW_INCLUDE,
        orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
        skip,
        take,
      }),
      this.prisma.contentReview.count({ where }),
    ]);
    const targets = await this.targets.resolve(records);
    return paginate(
      records.map((record) => ({
        ...this.toDto(record),
        target: targets.get(contentReviewTargetKey(record))!,
      })),
      query.page,
      query.limit,
      total,
    );
  }

  async create(
    user: AuthenticatedUser,
    targetType: ContentReviewTargetType,
    targetId: string,
    dto: CreateContentReviewDto,
  ): Promise<ContentReviewResponseDto> {
    const target = await this.targets.getVisibleOrThrow(targetType, targetId);
    const existing = await this.prisma.contentReview.findFirst({
      where: { targetType, targetId, userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (existing) throw this.alreadyReviewed();

    const imageIds = dto.imageIds ?? [];
    try {
      const record = await this.prisma.$transaction(async (tx) => {
        await this.assertUsableImages(tx, user.id, imageIds);
        // Post-moderated like trade reviews: public at once, admins may hide later.
        return tx.contentReview.create({
          data: {
            targetType,
            targetId,
            userId: user.id,
            rating: dto.rating,
            content: dto.content,
            images: {
              create: imageIds.map((mediaId, index) => ({
                mediaId,
                sortOrder: index,
              })),
            },
          },
          include: REVIEW_INCLUDE,
        });
      });
      const review = this.toDto(record);
      await this.notifications.notifyStaff(
        {
          type: NotificationType.CONTENT_REVIEW_SUBMITTED,
          title: 'Đánh giá nội dung mới',
          body: `${review.reviewer.displayName} vừa đánh giá ${review.rating}★ mục "${excerpt(target.name ?? targetId, 80)}": ${excerpt(review.content, 100)}`,
          data: {
            reviewId: review.id,
            targetType: review.targetType,
            targetId: review.targetId,
            submittedById: user.id,
          },
        },
        [user.id],
      );
      return review;
    } catch (error) {
      // Lost the race against a concurrent create: content_review_active_unique.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw this.alreadyReviewed();
      }
      throw error;
    }
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateContentReviewDto,
  ): Promise<ContentReviewResponseDto> {
    const existing = await this.findActiveOrThrow(id);
    this.assertAuthor(user, existing);

    const imageIds = dto.imageIds;
    const removedMediaIds =
      imageIds === undefined
        ? []
        : existing.images
            .map((image) => image.mediaId)
            .filter((mediaId) => !imageIds.includes(mediaId));

    const record = await this.prisma.$transaction(async (tx) => {
      if (imageIds !== undefined) {
        await this.assertUsableImages(tx, user.id, imageIds);
        await tx.contentReviewImage.deleteMany({
          where: { contentReviewId: id },
        });
        if (imageIds.length > 0) {
          await tx.contentReviewImage.createMany({
            data: imageIds.map((mediaId, index) => ({
              contentReviewId: id,
              mediaId,
              sortOrder: index,
            })),
          });
        }
      }
      // Edits keep the current status: a review an admin hid stays hidden.
      return tx.contentReview.update({
        where: { id },
        data: {
          ...(dto.rating !== undefined ? { rating: dto.rating } : {}),
          ...(dto.content !== undefined ? { content: dto.content } : {}),
        },
        include: REVIEW_INCLUDE,
      });
    });

    const deletedMediaIds =
      await this.mediaService.pruneDetachedMedia(removedMediaIds);
    await this.mediaService.purgeStorage(deletedMediaIds);
    return this.toDto(record);
  }

  /** Author only — moderators delete through the audited admin endpoint. */
  async remove(user: AuthenticatedUser, id: string): Promise<void> {
    const existing = await this.findActiveOrThrow(id);
    this.assertAuthor(user, existing);
    await this.prisma.contentReview.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /** Moderator/admin only — gated by RolesGuard at the controller. */
  async adminList(
    query: QueryContentReviewAdminDto,
  ): Promise<PaginatedResultDto<ContentReviewAdminResponseDto>> {
    const where: Prisma.ContentReviewWhereInput = {
      ...this.adminScope(query),
      ...(query.status ? { status: query.status } : {}),
      ...(query.rating ? { rating: query.rating } : {}),
      ...(query.search
        ? {
            OR: [
              { content: { contains: query.search, mode: 'insensitive' } },
              {
                user: {
                  displayName: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    const { skip, take } = buildPaginationArgs(query.page, query.limit);
    const [records, total] = await this.prisma.$transaction([
      this.prisma.contentReview.findMany({
        where,
        include: ADMIN_INCLUDE,
        orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
        skip,
        take,
      }),
      this.prisma.contentReview.count({ where }),
    ]);
    const targets = await this.targets.resolve(records);
    return paginate(
      records.map((record) =>
        this.toAdminDto(record, targets.get(contentReviewTargetKey(record))!),
      ),
      query.page,
      query.limit,
      total,
    );
  }

  /** Moderator/admin only — counts for the moderation queue tabs and badges. */
  async adminStats(
    query: QueryContentReviewAdminStatsDto,
  ): Promise<ContentReviewAdminStatsResponseDto> {
    const where = this.adminScope(query);
    const [statusRows, typeRows, unreplied] = await Promise.all([
      this.prisma.contentReview.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      this.prisma.contentReview.groupBy({
        by: ['targetType'],
        where,
        _count: { _all: true },
      }),
      this.prisma.contentReview.count({
        where: {
          ...where,
          status: ContentReviewStatus.PUBLISHED,
          replyContent: null,
        },
      }),
    ]);

    const byStatus: Record<ContentReviewStatus, number> = {
      PUBLISHED: 0,
      HIDDEN: 0,
    };
    for (const row of statusRows) byStatus[row.status] = row._count._all;
    const byTargetType = Object.fromEntries(
      CONTENT_REVIEW_TARGET_TYPES.map((name) => [name, 0]),
    ) as Record<ContentReviewTargetTypeName, number>;
    for (const row of typeRows) {
      byTargetType[CONTENT_REVIEW_TARGET_FROM_DB[row.targetType]] =
        row._count._all;
    }
    return {
      total: byStatus.PUBLISHED + byStatus.HIDDEN,
      byStatus,
      byTargetType,
      unreplied,
    };
  }

  /** Moderator/admin only — gated by RolesGuard at the controller. */
  async adminDetail(id: string): Promise<ContentReviewAdminResponseDto> {
    const record = await this.prisma.contentReview.findFirst({
      where: { id, deletedAt: null },
      include: ADMIN_INCLUDE,
    });
    if (!record) throw this.notFound();
    const targets = await this.targets.resolve([record]);
    return this.toAdminDto(
      record,
      targets.get(contentReviewTargetKey(record))!,
    );
  }

  /** Moderator/admin only — gated by RolesGuard at the controller. */
  async moderate(
    actorId: string,
    id: string,
    status: ContentReviewStatus,
  ): Promise<ContentReviewAdminResponseDto> {
    const existing = await this.findActiveOrThrow(id);
    if (existing.status !== status) {
      await this.prisma.contentReview.update({
        where: { id },
        data: { status },
      });
      await this.auditLogService.write({
        actorId,
        action: `CONTENT_REVIEW_${status}`,
        resourceType: 'ContentReview',
        resourceId: id,
        oldData: { status: existing.status },
        newData: { status },
      });
      const name = await this.targetName(existing);
      await this.notifyReviewer(
        existing,
        status === ContentReviewStatus.HIDDEN
          ? NotificationType.CONTENT_REVIEW_HIDDEN
          : NotificationType.CONTENT_REVIEW_UNHIDDEN,
        status === ContentReviewStatus.HIDDEN
          ? 'Đánh giá bị ẩn'
          : 'Đánh giá đã hiển thị lại',
        status === ContentReviewStatus.HIDDEN
          ? `Đánh giá của bạn về "${name}" đã bị quản trị viên ẩn.`
          : `Đánh giá của bạn về "${name}" đã được hiển thị công khai trở lại.`,
      );
    }
    return this.adminDetail(id);
  }

  /** Sets (or replaces) the admin team's public reply; the review itself is untouched. */
  async reply(
    actorId: string,
    id: string,
    content: string,
  ): Promise<ContentReviewAdminResponseDto> {
    const existing = await this.findActiveOrThrow(id);
    if (existing.status !== ContentReviewStatus.PUBLISHED) {
      throw new AppException(
        ErrorCode.REVIEW_REPLY_NOT_ALLOWED,
        'Chỉ phản hồi được đánh giá đang hiển thị',
        HttpStatus.CONFLICT,
      );
    }
    await this.prisma.contentReview.update({
      where: { id },
      data: {
        replyContent: content,
        repliedAt: new Date(),
        repliedById: actorId,
      },
    });
    await this.auditLogService.write({
      actorId,
      action: 'CONTENT_REVIEW_REPLY',
      resourceType: 'ContentReview',
      resourceId: id,
      oldData: { replyContent: existing.replyContent },
      newData: { replyContent: content },
    });
    await this.notifyReviewer(
      existing,
      NotificationType.CONTENT_REVIEW_REPLIED,
      'Ban quản lý đã phản hồi đánh giá',
      `Phản hồi về "${await this.targetName(existing)}": ${excerpt(content, 150)}`,
    );
    return this.adminDetail(id);
  }

  async removeReply(actorId: string, id: string): Promise<void> {
    const existing = await this.findActiveOrThrow(id);
    if (existing.replyContent === null) return;
    await this.prisma.contentReview.update({
      where: { id },
      data: { replyContent: null, repliedAt: null, repliedById: null },
    });
    await this.auditLogService.write({
      actorId,
      action: 'CONTENT_REVIEW_REPLY_DELETE',
      resourceType: 'ContentReview',
      resourceId: id,
      oldData: { replyContent: existing.replyContent },
      newData: { replyContent: null },
    });
  }

  /** Moderator/admin only — soft delete, like the author's own delete. */
  async adminRemove(actorId: string, id: string): Promise<void> {
    const existing = await this.findActiveOrThrow(id);
    const deletedAt = new Date();
    await this.prisma.contentReview.update({
      where: { id },
      data: { deletedAt },
    });
    await this.auditLogService.write({
      actorId,
      action: 'CONTENT_REVIEW_DELETE',
      resourceType: 'ContentReview',
      resourceId: id,
      oldData: {
        targetType: existing.targetType,
        targetId: existing.targetId,
        status: existing.status,
        rating: existing.rating,
        content: existing.content,
        deletedAt: null,
      },
      newData: { deletedAt: deletedAt.toISOString() },
    });
    await this.notifyReviewer(
      existing,
      NotificationType.CONTENT_REVIEW_DELETED,
      'Đánh giá bị xóa',
      `Đánh giá của bạn về "${await this.targetName(existing)}" đã bị quản trị viên xóa.`,
    );
  }

  /**
   * Called inside each section's remove() transaction, like
   * MapLocationService.deleteForRecord: item ids are slugs a later item may
   * reuse, so reviews must not outlive the item. Returns the review image
   * media ids it soft-deleted, for purgeStorage() after commit.
   */
  async deleteForRecord(
    tx: Prisma.TransactionClient,
    targetType: ContentReviewTargetType,
    targetId: string,
  ): Promise<string[]> {
    const images = await tx.contentReviewImage.findMany({
      where: { contentReview: { targetType, targetId } },
      select: { mediaId: true },
    });
    await tx.contentReview.deleteMany({ where: { targetType, targetId } });
    return this.mediaService.pruneDetachedMedia(
      [...new Set(images.map(({ mediaId }) => mediaId))],
      tx,
    );
  }

  private adminScope(query: {
    targetType?: ContentReviewTargetTypeName;
    targetId?: string;
  }): Prisma.ContentReviewWhereInput {
    return {
      deletedAt: null,
      ...(query.targetType
        ? { targetType: CONTENT_REVIEW_TARGET_TO_DB[query.targetType] }
        : {}),
      ...(query.targetId ? { targetId: query.targetId } : {}),
    };
  }

  /** Images must be the caller's own, live, unclaimed image uploads. */
  private async assertUsableImages(
    tx: Prisma.TransactionClient,
    userId: string,
    mediaIds: string[],
  ): Promise<void> {
    if (mediaIds.length === 0) return;
    const usable = await tx.media.count({
      where: {
        id: { in: mediaIds },
        ownerId: userId,
        deletedAt: null,
        resourceType: null,
        mimeType: { startsWith: 'image/' },
      },
    });
    if (usable !== mediaIds.length) {
      throw new AppException(
        ErrorCode.INVALID_CONTENT_REVIEW_MEDIA,
        'Một hoặc nhiều ảnh không hợp lệ hoặc không thuộc về bạn',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private assertAuthor(
    user: AuthenticatedUser,
    review: ContentReviewRecord,
  ): void {
    if (review.userId !== user.id) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_OWNED,
        'Bạn chỉ có thể sửa hoặc xóa đánh giá của chính mình',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private async findActiveOrThrow(id: string): Promise<ContentReviewRecord> {
    const record = await this.prisma.contentReview.findFirst({
      where: { id, deletedAt: null },
      include: REVIEW_INCLUDE,
    });
    if (!record) throw this.notFound();
    return record;
  }

  private async targetName(review: ContentReviewRecord): Promise<string> {
    const targets = await this.targets.resolve([review]);
    const name = targets.get(contentReviewTargetKey(review))?.name;
    return excerpt(name ?? CONTENT_REVIEW_TARGET_LABELS[review.targetType], 80);
  }

  private notifyReviewer(
    review: ContentReviewRecord,
    type: NotificationType,
    title: string,
    body: string,
  ): Promise<void> {
    return this.notifications.notify(review.userId, {
      type,
      title,
      body,
      data: {
        reviewId: review.id,
        targetType: CONTENT_REVIEW_TARGET_FROM_DB[review.targetType],
        targetId: review.targetId,
      },
    });
  }

  private toDto(
    record: ContentReviewRecord | ContentReviewAdminRecord,
  ): ContentReviewResponseDto {
    return {
      id: record.id,
      targetType: CONTENT_REVIEW_TARGET_FROM_DB[record.targetType],
      targetId: record.targetId,
      userId: record.userId,
      rating: record.rating,
      content: record.content,
      status: record.status,
      replyContent: record.replyContent,
      repliedAt: record.repliedAt,
      images: record.images.map((image) => ({
        id: image.mediaId,
        url: image.media.originalUrl,
        thumbnailUrl: image.media.thumbnailUrl,
        sortOrder: image.sortOrder,
      })),
      reviewer: {
        id: record.user.id,
        displayName: record.user.displayName,
        avatarUrl: record.user.avatarUrl,
      },
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private toAdminDto(
    record: ContentReviewAdminRecord,
    target: ContentReviewAdminResponseDto['target'],
  ): ContentReviewAdminResponseDto {
    return {
      ...this.toDto(record),
      target,
      user: { ...record.user },
      repliedBy: record.repliedBy,
    };
  }

  private alreadyReviewed(): AppException {
    return new AppException(
      ErrorCode.REVIEW_ALREADY_EXISTS,
      'Bạn đã đánh giá mục này rồi, hãy sửa đánh giá cũ',
      HttpStatus.CONFLICT,
    );
  }

  private notFound(): AppException {
    return new AppException(
      ErrorCode.CONTENT_REVIEW_NOT_FOUND,
      'Không tìm thấy đánh giá',
      HttpStatus.NOT_FOUND,
    );
  }
}

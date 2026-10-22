import { Injectable } from '@nestjs/common';
import type {
  Prisma,
  TradeReview,
  TradePostStatus,
  TradeReviewStatus,
} from '../../../../../generated/prisma';
import { PrismaService } from '../../../../database/prisma.service';
import type {
  TradeReviewCustomerReplyWithAuthor,
  TradeReviewWithAdminRelations,
  TradeReviewWithPublicRelations,
} from '../entities/trade-review.entity';
import { notExpiredWhere } from '../../posts/utils/trade-post-business-rules.util';

const POST_SELECT = {
  select: {
    id: true,
    title: true,
    slug: true,
    thumbnailUrl: true,
    status: true,
    deletedAt: true,
  },
} as const;

const CUSTOMER_REPLIES_INCLUDE = {
  author: { select: { id: true, displayName: true, avatarUrl: true } },
} satisfies Prisma.TradeReviewCustomerReplyInclude;

export interface LockedTradeReviewCustomerReplyTarget {
  reviewId: string;
  reviewStatus: TradeReviewStatus;
  reviewDeletedAt: Date | null;
  replyContent: string | null;
  ownerId: string;
  postStatus: TradePostStatus;
  postDeletedAt: Date | null;
  expiresAt: Date | null;
  eventEndAt: Date | null;
  categoryActive: boolean;
  categoryDeletedAt: Date | null;
}

/** Public responses: reviewer identity without contact details. */
const DETAIL_INCLUDE = {
  images: {
    include: { media: true },
    orderBy: { sortOrder: 'asc' as const },
  },
  tradePost: POST_SELECT,
  user: { select: { id: true, displayName: true, avatarUrl: true } },
  customerReplies: {
    include: CUSTOMER_REPLIES_INCLUDE,
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
  },
} satisfies Prisma.TradeReviewInclude;

const ADMIN_INCLUDE = {
  ...DETAIL_INCLUDE,
  user: {
    select: {
      id: true,
      displayName: true,
      email: true,
      phone: true,
      avatarUrl: true,
      status: true,
    },
  },
} satisfies Prisma.TradeReviewInclude;

@Injectable()
export class TradeReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveReviewByUserAndPost(
    tradePostId: string,
    userId: string,
  ): Promise<TradeReview | null> {
    return this.prisma.tradeReview.findFirst({
      where: { tradePostId, userId, deletedAt: null },
    });
  }

  findDetailById(id: string): Promise<TradeReviewWithPublicRelations | null> {
    return this.prisma.tradeReview.findFirst({
      where: { id, deletedAt: null },
      include: DETAIL_INCLUDE,
    });
  }

  /** Published reviews on any (non-deleted) post owned by `ownerId`, newest first. */
  async findForPostOwner(params: {
    ownerId: string;
    skip: number;
    take: number;
  }): Promise<{ items: TradeReviewWithPublicRelations[]; total: number }> {
    const where: Prisma.TradeReviewWhereInput = {
      status: 'PUBLISHED',
      deletedAt: null,
      tradePost: { ownerId: params.ownerId, deletedAt: null },
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.tradeReview.findMany({
        where,
        include: DETAIL_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.tradeReview.count({ where }),
    ]);
    return { items, total };
  }

  async findPublicList(params: {
    tradePostId: string;
    skip: number;
    take: number;
  }): Promise<{ items: TradeReviewWithPublicRelations[]; total: number }> {
    const where: Prisma.TradeReviewWhereInput = {
      tradePostId: params.tradePostId,
      status: 'PUBLISHED',
      deletedAt: null,
      tradePost: {
        status: 'PUBLISHED',
        deletedAt: null,
        category: { isActive: true, deletedAt: null },
        AND: [notExpiredWhere()],
      },
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.tradeReview.findMany({
        where,
        include: DETAIL_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.tradeReview.count({ where }),
    ]);
    return { items, total };
  }

  findAdminDetailById(
    id: string,
  ): Promise<TradeReviewWithAdminRelations | null> {
    return this.prisma.tradeReview.findFirst({
      where: { id, deletedAt: null },
      include: ADMIN_INCLUDE,
    });
  }

  async findAdminList(params: {
    skip: number;
    take: number;
    where: Prisma.TradeReviewWhereInput;
    sortOrder: Prisma.SortOrder;
  }): Promise<{ items: TradeReviewWithAdminRelations[]; total: number }> {
    const where: Prisma.TradeReviewWhereInput = {
      deletedAt: null,
      ...params.where,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.tradeReview.findMany({
        where,
        include: ADMIN_INCLUDE,
        orderBy: { createdAt: params.sortOrder },
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.tradeReview.count({ where }),
    ]);
    return { items, total };
  }

  async countByStatus(
    where: Prisma.TradeReviewWhereInput,
  ): Promise<{ status: TradeReviewStatus; count: number }[]> {
    const grouped = await this.prisma.tradeReview.groupBy({
      by: ['status'],
      where: { deletedAt: null, ...where },
      _count: { _all: true },
    });
    return grouped.map((row) => ({
      status: row.status,
      count: row._count._all,
    }));
  }

  /**
   * Locks the review and post rows while a customer reply is validated and
   * inserted, preventing a concurrent seller-reply removal from slipping
   * between the check and write.
   */
  async lockCustomerReplyTarget(
    tx: Prisma.TransactionClient,
    tradePostId: string,
    reviewId: string,
  ): Promise<LockedTradeReviewCustomerReplyTarget | null> {
    const rows = await tx.$queryRaw<LockedTradeReviewCustomerReplyTarget[]>`
      SELECT
        r."id" AS "reviewId",
        r."status" AS "reviewStatus",
        r."deletedAt" AS "reviewDeletedAt",
        r."replyContent",
        p."ownerId",
        p."status" AS "postStatus",
        p."deletedAt" AS "postDeletedAt",
        p."expiresAt",
        p."eventEndAt",
        category."isActive" AS "categoryActive",
        category."deletedAt" AS "categoryDeletedAt"
      FROM "TradeReview" AS r
      INNER JOIN "TradePost" AS p ON p."id" = r."tradePostId"
      INNER JOIN "TradePostCategory" AS category ON category."id" = p."categoryId"
      WHERE r."id" = ${reviewId} AND r."tradePostId" = ${tradePostId}
      FOR UPDATE OF r, p
    `;
    return rows[0] ?? null;
  }

  createCustomerReply(
    tx: Prisma.TransactionClient,
    data: { reviewId: string; userId: string; content: string },
  ): Promise<TradeReviewCustomerReplyWithAuthor> {
    return tx.tradeReviewCustomerReply.create({
      data,
      include: CUSTOMER_REPLIES_INCLUDE,
    });
  }

  create(data: Prisma.TradeReviewUncheckedCreateInput): Promise<TradeReview> {
    return this.prisma.tradeReview.create({ data });
  }

  update(
    id: string,
    data: Prisma.TradeReviewUncheckedUpdateInput,
  ): Promise<TradeReview> {
    return this.prisma.tradeReview.update({ where: { id }, data });
  }

  softDelete(id: string): Promise<TradeReview> {
    return this.prisma.tradeReview.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}

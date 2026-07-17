import { Injectable } from '@nestjs/common';
import type { Prisma, TradeReview } from '../../../../../generated/prisma';
import { PrismaService } from '../../../../database/prisma.service';
import type { TradeReviewWithImages } from '../entities/trade-review.entity';

const DETAIL_INCLUDE = {
  images: {
    include: { media: true },
    orderBy: { sortOrder: 'asc' as const },
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

  findDetailById(id: string): Promise<TradeReviewWithImages | null> {
    return this.prisma.tradeReview.findFirst({
      where: { id, deletedAt: null },
      include: DETAIL_INCLUDE,
    });
  }

  async findPublicList(params: {
    tradePostId: string;
    skip: number;
    take: number;
  }): Promise<{ items: TradeReviewWithImages[]; total: number }> {
    const where: Prisma.TradeReviewWhereInput = {
      tradePostId: params.tradePostId,
      status: 'PUBLISHED',
      deletedAt: null,
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

  async findAdminList(params: {
    skip: number;
    take: number;
    where: Prisma.TradeReviewWhereInput;
  }): Promise<{ items: TradeReviewWithImages[]; total: number }> {
    const where: Prisma.TradeReviewWhereInput = {
      deletedAt: null,
      ...params.where,
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

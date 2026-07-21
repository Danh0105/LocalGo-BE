import { Injectable } from '@nestjs/common';
import type {
  Prisma,
  TradePostCategory,
} from '../../../../../generated/prisma';
import { PrismaService } from '../../../../database/prisma.service';

export type TradePostCategoryWithPostCount = TradePostCategory & {
  postCount: number;
};

@Injectable()
export class TradePostCategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  findPublic(): Promise<TradePostCategory[]> {
    return this.prisma.tradePostCategory.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    });
  }

  async findAdminList(params: {
    skip: number;
    take: number;
    where: Prisma.TradePostCategoryWhereInput;
  }): Promise<{ items: TradePostCategoryWithPostCount[]; total: number }> {
    const [items, total, counts] = await this.prisma.$transaction([
      this.prisma.tradePostCategory.findMany({
        where: params.where,
        skip: params.skip,
        take: params.take,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.tradePostCategory.count({ where: params.where }),
      this.prisma.tradePost.groupBy({
        by: ['categoryId'],
        orderBy: { categoryId: 'asc' },
        _count: { _all: true },
      }),
    ]);
    const countByCategoryId = new Map(
      counts.map((count) => [
        count.categoryId,
        (count._count as { _all: number })._all,
      ]),
    );
    return {
      items: items.map((item) => ({
        ...item,
        postCount: countByCategoryId.get(item.id) ?? 0,
      })),
      total,
    };
  }

  async findById(id: string): Promise<TradePostCategoryWithPostCount | null> {
    const category = await this.prisma.tradePostCategory.findFirst({
      where: { id, deletedAt: null },
    });
    if (!category) return null;
    const postCount = await this.prisma.tradePost.count({
      where: { categoryId: id },
    });
    return { ...category, postCount };
  }

  findByCode(code: string): Promise<TradePostCategory | null> {
    return this.prisma.tradePostCategory.findUnique({ where: { code } });
  }

  create(
    data: Prisma.TradePostCategoryUncheckedCreateInput,
  ): Promise<TradePostCategory> {
    return this.prisma.tradePostCategory.create({ data });
  }
}

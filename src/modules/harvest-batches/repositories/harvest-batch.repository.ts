import { Injectable } from '@nestjs/common';
import { Prisma, UserStatus } from '../../../../generated/prisma';
import { PrismaService } from '../../../database/prisma.service';
import { toDateColumn } from '../harvest-batch.constants';

export const HARVEST_BATCH_INCLUDE = {
  images: {
    orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
    include: { media: true },
  },
} satisfies Prisma.HarvestBatchInclude;

const TRACE_INCLUDE = {
  owner: { select: { displayName: true } },
  ...HARVEST_BATCH_INCLUDE,
} satisfies Prisma.HarvestBatchInclude;

export type HarvestBatchRecord = Prisma.HarvestBatchGetPayload<{
  include: typeof HARVEST_BATCH_INCLUDE;
}>;

export type HarvestTraceRecord = Prisma.HarvestBatchGetPayload<{
  include: typeof TRACE_INCLUDE;
}>;

@Injectable()
export class HarvestBatchRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPageForOwner(params: {
    ownerId: string;
    search?: string;
    from?: string;
    to?: string;
    skip: number;
    take: number;
  }): Promise<{ items: HarvestBatchRecord[]; total: number }> {
    const where: Prisma.HarvestBatchWhereInput = {
      ownerId: params.ownerId,
      deletedAt: null,
      ...(params.search
        ? {
            OR: [
              { fruitName: { contains: params.search, mode: 'insensitive' } },
              { code: { contains: params.search.toUpperCase() } },
            ],
          }
        : {}),
      ...(params.from || params.to
        ? {
            harvestDate: {
              ...(params.from ? { gte: toDateColumn(params.from) } : {}),
              ...(params.to ? { lte: toDateColumn(params.to) } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.harvestBatch.findMany({
        where,
        orderBy: [{ harvestDate: 'desc' }, { createdAt: 'desc' }],
        skip: params.skip,
        take: params.take,
        include: HARVEST_BATCH_INCLUDE,
      }),
      this.prisma.harvestBatch.count({ where }),
    ]);
    return { items, total };
  }

  findForOwner(
    id: string,
    ownerId: string,
  ): Promise<HarvestBatchRecord | null> {
    return this.prisma.harvestBatch.findFirst({
      where: { id, ownerId, deletedAt: null },
      include: HARVEST_BATCH_INCLUDE,
    });
  }

  /**
   * Public lookup by label code. Labels of deleted batches, and of owners who
   * were removed or blocked, stop resolving.
   */
  findTraceable(code: string): Promise<HarvestTraceRecord | null> {
    return this.prisma.harvestBatch.findFirst({
      where: {
        code,
        deletedAt: null,
        owner: { deletedAt: null, status: { not: UserStatus.BLOCKED } },
      },
      include: TRACE_INCLUDE,
    });
  }
}

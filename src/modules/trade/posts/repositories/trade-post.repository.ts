import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../../../generated/prisma';
import { PrismaService } from '../../../../database/prisma.service';
import type {
  TradePostWithCategory,
  TradePostWithImages,
  TradePostWithImagesAndOwner,
  TradePostWithOwner,
} from '../entities/trade-post.entity';

const DETAIL_INCLUDE = {
  category: true,
  images: {
    include: { media: true },
    orderBy: { sortOrder: 'asc' as const },
  },
} satisfies Prisma.TradePostInclude;

const LIST_INCLUDE = {
  category: true,
} satisfies Prisma.TradePostInclude;

const OWNER_SELECT = {
  id: true,
  displayName: true,
  email: true,
  phone: true,
  avatarUrl: true,
  role: true,
  status: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class TradePostRepository {
  constructor(private readonly prisma: PrismaService) {}

  async slugExists(slug: string): Promise<boolean> {
    const count = await this.prisma.tradePost.count({ where: { slug } });
    return count > 0;
  }

  findByIdForOwner(id: string): Promise<TradePostWithCategory | null> {
    return this.prisma.tradePost.findFirst({
      where: { id, deletedAt: null },
      include: LIST_INCLUDE,
    });
  }

  findDetailBySlugOrId(idOrSlug: string): Promise<TradePostWithImages | null> {
    return this.prisma.tradePost.findFirst({
      where: { deletedAt: null, OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: DETAIL_INCLUDE,
    });
  }

  /**
   * Resolves the id of a post that is publicly viewable right now — same
   * visibility gate as `TradePostService.getPublicDetail` (PUBLISHED, active
   * category, not expired). Used by the engagement/interaction write path to
   * reject events against hidden/expired/nonexistent posts without loading the
   * full detail payload.
   */
  async findViewableIdBySlugOrId(
    idOrSlug: string,
  ): Promise<{ id: string } | null> {
    return this.prisma.tradePost.findFirst({
      where: {
        deletedAt: null,
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        status: 'PUBLISHED',
        category: { isActive: true, deletedAt: null },
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }],
      },
      select: { id: true },
    });
  }

  /** Resolves a non-deleted post id by id or slug, regardless of status. */
  async findIdBySlugOrId(idOrSlug: string): Promise<{ id: string } | null> {
    return this.prisma.tradePost.findFirst({
      where: { deletedAt: null, OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      select: { id: true },
    });
  }

  findAdminDetail(id: string): Promise<TradePostWithImagesAndOwner | null> {
    return this.prisma.tradePost.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...DETAIL_INCLUDE,
        owner: { select: OWNER_SELECT },
      },
    });
  }

  async findAdminList(params: {
    skip: number;
    take: number;
    where: Prisma.TradePostWhereInput;
    orderBy:
      | Prisma.TradePostOrderByWithRelationInput
      | Prisma.TradePostOrderByWithRelationInput[];
  }): Promise<{ items: TradePostWithOwner[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.tradePost.findMany({
        where: params.where,
        orderBy: params.orderBy,
        skip: params.skip,
        take: params.take,
        include: { ...LIST_INCLUDE, owner: { select: OWNER_SELECT } },
      }),
      this.prisma.tradePost.count({ where: params.where }),
    ]);
    return { items, total };
  }

  async findList(params: {
    skip: number;
    take: number;
    where: Prisma.TradePostWhereInput;
    orderBy:
      | Prisma.TradePostOrderByWithRelationInput
      | Prisma.TradePostOrderByWithRelationInput[];
  }): Promise<{ items: TradePostWithCategory[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.tradePost.findMany({
        where: params.where,
        orderBy: params.orderBy,
        skip: params.skip,
        take: params.take,
        include: LIST_INCLUDE,
      }),
      this.prisma.tradePost.count({ where: params.where }),
    ]);
    return { items, total };
  }

  update(
    id: string,
    data: Prisma.TradePostUncheckedUpdateInput,
  ): Promise<TradePostWithCategory> {
    return this.prisma.tradePost.update({
      where: { id },
      data,
      include: LIST_INCLUDE,
    });
  }

  softDelete(id: string): Promise<TradePostWithCategory> {
    return this.prisma.tradePost.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: LIST_INCLUDE,
    });
  }

  incrementViewCount(id: string): Promise<TradePostWithCategory> {
    return this.prisma.tradePost.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
      include: LIST_INCLUDE,
    });
  }
}

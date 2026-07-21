import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '../../../../../generated/prisma';
import { ErrorCode } from '../../../../common/constants/error-codes.constant';
import { AppException } from '../../../../common/exceptions/app.exception';
import { PaginatedResultDto } from '../../../../common/dto/pagination-meta.dto';
import {
  buildPaginationArgs,
  paginate,
} from '../../../../common/pagination/pagination.util';
import { PrismaService } from '../../../../database/prisma.service';
import {
  ReorderTradePostCategoriesDto,
  UpdateTradePostCategoryStatusDto,
} from '../dto/trade-post-category-action.dto';
import { QueryTradePostCategoryAdminDto } from '../dto/query-trade-post-category.dto';
import {
  CreateTradePostCategoryDto,
  UpdateTradePostCategoryDto,
} from '../dto/upsert-trade-post-category.dto';
import { TradePostCategoryEntity } from '../entities/trade-post-category.entity';
import { TradePostCategoryRepository } from '../repositories/trade-post-category.repository';
import {
  TRADE_POST_CATEGORY_CODE_PATTERN,
  normalizeTradePostCategoryCode,
} from '../trade-post-category.constants';

@Injectable()
export class TradePostCategoryService {
  constructor(
    private readonly repository: TradePostCategoryRepository,
    private readonly prisma: PrismaService,
  ) {}

  async listPublic(): Promise<TradePostCategoryEntity[]> {
    const categories = await this.repository.findPublic();
    return categories.map((category) => new TradePostCategoryEntity(category));
  }

  async listForAdmin(
    query: QueryTradePostCategoryAdminDto,
  ): Promise<PaginatedResultDto<TradePostCategoryEntity>> {
    const { skip, take } = buildPaginationArgs(query.page, query.limit);
    const where: Prisma.TradePostCategoryWhereInput = {
      deletedAt: null,
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(query.search
        ? {
            OR: [
              {
                code: {
                  contains: normalizeTradePostCategoryCode(query.search),
                },
              },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const { items, total } = await this.repository.findAdminList({
      skip,
      take,
      where,
    });
    return paginate(
      items.map((category) => new TradePostCategoryEntity(category)),
      query.page,
      query.limit,
      total,
    );
  }

  async adminDetail(id: string): Promise<TradePostCategoryEntity> {
    return new TradePostCategoryEntity(await this.findOrThrow(id));
  }

  async create(
    actorId: string,
    dto: CreateTradePostCategoryDto,
  ): Promise<TradePostCategoryEntity> {
    const code = normalizeTradePostCategoryCode(dto.code);
    if (!TRADE_POST_CATEGORY_CODE_PATTERN.test(code)) {
      throw this.invalidCategory();
    }
    const duplicate = await this.repository.findByCode(code);
    if (duplicate) {
      throw new AppException(
        ErrorCode.TRADE_POST_CATEGORY_CODE_EXISTS,
        'Mã danh mục tin giao thương đã tồn tại',
        HttpStatus.CONFLICT,
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const category = await tx.tradePostCategory.create({
        data: {
          code,
          name: dto.name,
          description: dto.description ?? null,
          sortOrder: dto.sortOrder ?? (await this.nextSortOrder(tx)),
          isActive: dto.isActive ?? true,
          requiresPromotionDetails: dto.requiresPromotionDetails ?? false,
          createdById: actorId,
          updatedById: actorId,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'TRADE_POST_CATEGORY_CREATED',
          resourceType: 'TradePostCategory',
          resourceId: category.id,
          newData: {
            code: category.code,
            name: category.name,
            version: category.version,
          },
        },
      });
      return category;
    });
    return new TradePostCategoryEntity({ ...created, postCount: 0 });
  }

  async update(
    actorId: string,
    id: string,
    dto: UpdateTradePostCategoryDto,
  ): Promise<TradePostCategoryEntity> {
    const current = await this.findOrThrow(id);
    const record = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.tradePostCategory.updateMany({
        where: { id, deletedAt: null, version: dto.version },
        data: {
          name: dto.name,
          description: dto.description ?? null,
          sortOrder: dto.sortOrder,
          requiresPromotionDetails: dto.requiresPromotionDetails,
          version: { increment: 1 },
          updatedById: actorId,
        },
      });
      if (updated.count !== 1) throw await this.versionConflict(tx, id);
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'TRADE_POST_CATEGORY_UPDATED',
          resourceType: 'TradePostCategory',
          resourceId: id,
          oldData: {
            name: current.name,
            description: current.description,
            sortOrder: current.sortOrder,
            requiresPromotionDetails: current.requiresPromotionDetails,
            version: dto.version,
          },
          newData: {
            name: dto.name,
            description: dto.description ?? null,
            sortOrder: dto.sortOrder,
            requiresPromotionDetails: dto.requiresPromotionDetails,
            version: dto.version + 1,
          },
        },
      });
      return tx.tradePostCategory.findUniqueOrThrow({ where: { id } });
    });
    return new TradePostCategoryEntity({
      ...record,
      postCount: current.postCount ?? 0,
    });
  }

  async updateStatus(
    actorId: string,
    id: string,
    dto: UpdateTradePostCategoryStatusDto,
  ): Promise<TradePostCategoryEntity> {
    await this.findOrThrow(id);
    const record = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.tradePostCategory.updateMany({
        where: { id, deletedAt: null, version: dto.version },
        data: {
          isActive: dto.isActive,
          version: { increment: 1 },
          updatedById: actorId,
        },
      });
      if (updated.count !== 1) throw await this.versionConflict(tx, id);
      await tx.auditLog.create({
        data: {
          actorId,
          action: dto.isActive
            ? 'TRADE_POST_CATEGORY_SHOWN'
            : 'TRADE_POST_CATEGORY_HIDDEN',
          resourceType: 'TradePostCategory',
          resourceId: id,
          oldData: { version: dto.version },
          newData: { isActive: dto.isActive, version: dto.version + 1 },
        },
      });
      return tx.tradePostCategory.findUniqueOrThrow({ where: { id } });
    });
    const postCount = await this.prisma.tradePost.count({
      where: { categoryId: id },
    });
    return new TradePostCategoryEntity({ ...record, postCount });
  }

  async reorder(
    actorId: string,
    dto: ReorderTradePostCategoriesDto,
  ): Promise<TradePostCategoryEntity[]> {
    const ids = dto.items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'Danh sách sắp xếp chứa ID trùng',
      );
    }
    const records = await this.prisma.$transaction(async (tx) => {
      const found = await tx.tradePostCategory.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: { id: true, version: true },
      });
      if (found.length !== ids.length) throw this.notFound();
      const versionById = new Map(found.map((item) => [item.id, item.version]));
      for (const item of dto.items) {
        if (
          item.version !== undefined &&
          versionById.get(item.id) !== item.version
        ) {
          throw await this.versionConflict(tx, item.id);
        }
        await tx.tradePostCategory.update({
          where: { id: item.id },
          data: {
            sortOrder: item.sortOrder,
            version: { increment: 1 },
            updatedById: actorId,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'TRADE_POST_CATEGORIES_REORDERED',
          resourceType: 'TradePostCategory',
          newData: {
            items: dto.items.map(({ id, sortOrder }) => ({ id, sortOrder })),
          },
        },
      });
      return tx.tradePostCategory.findMany({
        where: { id: { in: ids } },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      });
    });
    const counts = await this.prisma.tradePost.groupBy({
      by: ['categoryId'],
      where: { categoryId: { in: ids } },
      orderBy: { categoryId: 'asc' },
      _count: { _all: true },
    });
    const countByCategoryId = new Map(
      counts.map((count) => [
        count.categoryId,
        (count._count as { _all: number })._all,
      ]),
    );
    return records.map(
      (record) =>
        new TradePostCategoryEntity({
          ...record,
          postCount: countByCategoryId.get(record.id) ?? 0,
        }),
    );
  }

  async remove(actorId: string, id: string): Promise<void> {
    const current = await this.findOrThrow(id);
    if ((current.postCount ?? 0) > 0) {
      throw new AppException(
        ErrorCode.TRADE_POST_CATEGORY_IN_USE,
        'Danh mục đang có tin tham chiếu, hãy ẩn danh mục thay vì xóa',
        HttpStatus.CONFLICT,
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.tradePostCategory.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          isActive: false,
          version: { increment: 1 },
          updatedById: actorId,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'TRADE_POST_CATEGORY_DELETED',
          resourceType: 'TradePostCategory',
          resourceId: id,
          oldData: { code: current.code, deletedAt: null },
          newData: { deletedAt: new Date().toISOString() },
        },
      });
    });
  }

  async findActiveByCodeOrThrow(codeInput: string) {
    const code = normalizeTradePostCategoryCode(codeInput);
    if (!TRADE_POST_CATEGORY_CODE_PATTERN.test(code)) {
      throw this.invalidCategory();
    }
    const category = await this.repository.findByCode(code);
    if (!category || category.deletedAt !== null || !category.isActive) {
      throw this.invalidCategory();
    }
    return category;
  }

  async findVisibleByCodeOrThrow(codeInput: string, activeOnly: boolean) {
    const code = normalizeTradePostCategoryCode(codeInput);
    if (!TRADE_POST_CATEGORY_CODE_PATTERN.test(code)) {
      throw this.invalidCategory();
    }
    const category = await this.repository.findByCode(code);
    if (
      !category ||
      category.deletedAt !== null ||
      (activeOnly && !category.isActive)
    ) {
      throw this.invalidCategory();
    }
    return category;
  }

  private async findOrThrow(id: string) {
    const category = await this.repository.findById(id);
    if (!category) throw this.notFound();
    return category;
  }

  private async nextSortOrder(tx: Prisma.TransactionClient): Promise<number> {
    const result = await tx.tradePostCategory.aggregate({
      where: { deletedAt: null },
      _max: { sortOrder: true },
    });
    return (result._max.sortOrder ?? -1) + 1;
  }

  private async versionConflict(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<AppException> {
    const latest = await tx.tradePostCategory.findFirst({
      where: { id, deletedAt: null },
    });
    if (!latest) return this.notFound();
    const postCount = await tx.tradePost.count({ where: { categoryId: id } });
    return new AppException(
      ErrorCode.TRADE_POST_CATEGORY_VERSION_CONFLICT,
      'Danh mục tin giao thương đã được người khác cập nhật, vui lòng tải lại',
      HttpStatus.CONFLICT,
      [
        {
          latest: { ...new TradePostCategoryEntity({ ...latest, postCount }) },
        },
      ],
    );
  }

  private invalidCategory(): AppException {
    return new AppException(
      ErrorCode.TRADE_POST_CATEGORY_INVALID,
      'Danh mục tin giao thương không hợp lệ hoặc đang bị ẩn',
      HttpStatus.BAD_REQUEST,
    );
  }

  private notFound(): AppException {
    return new AppException(
      ErrorCode.TRADE_POST_CATEGORY_NOT_FOUND,
      'Không tìm thấy danh mục tin giao thương',
      HttpStatus.NOT_FOUND,
    );
  }
}

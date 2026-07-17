import { HttpStatus, Injectable } from '@nestjs/common';
import {
  MediaResourceType,
  Prisma,
  type CraftVillage,
  type Media,
  type User,
} from '../../../../generated/prisma';
import { ErrorCode } from '../../../common/constants/error-codes.constant';
import { paginate } from '../../../common/pagination/pagination.util';
import { AppException } from '../../../common/exceptions/app.exception';
import { slugify } from '../../../common/utils/slugify.util';
import { PrismaService } from '../../../database/prisma.service';
import { MediaService } from '../../media/services/media.service';
import {
  ReorderCraftVillagesDto,
  UpdateCraftVillageStatusDto,
} from '../dto/craft-village-action.dto';
import {
  QueryCraftVillageAdminDto,
  QueryCraftVillagePublicDto,
} from '../dto/query-craft-village.dto';
import {
  CraftVillageAdminResponseDto,
  CraftVillageListItemResponseDto,
  CraftVillageResponseDto,
} from '../dto/craft-village-response.dto';
import {
  CreateCraftVillageDto,
  UpdateCraftVillageDto,
} from '../dto/upsert-craft-village.dto';
import {
  CRAFT_VILLAGE_CATEGORY_FROM_DB,
  CRAFT_VILLAGE_CATEGORY_TO_DB,
} from '../craft-village.constants';

type CraftVillageRecord = CraftVillage & {
  media: Media | null;
  createdBy: Pick<User, 'displayName'> | null;
  updatedBy: Pick<User, 'displayName'> | null;
};

const includeCraftVillage = {
  media: true,
  createdBy: { select: { displayName: true } },
  updatedBy: { select: { displayName: true } },
};

@Injectable()
export class CraftVillageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
  ) {}

  async publicList(
    query: QueryCraftVillagePublicDto,
  ): Promise<CraftVillageListItemResponseDto[]> {
    const records = await this.prisma.craftVillage.findMany({
      where: {
        isActive: true,
        ...(query.category
          ? { category: CRAFT_VILLAGE_CATEGORY_TO_DB[query.category] }
          : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      include: includeCraftVillage,
    });
    return records.map((record) => this.toListDto(record));
  }

  async publicDetail(id: string): Promise<CraftVillageResponseDto> {
    const record = await this.prisma.craftVillage.findFirst({
      where: { id, isActive: true },
      include: includeCraftVillage,
    });
    if (!record) throw this.notFound();
    return this.toPublicDto(record);
  }

  async adminList(query: QueryCraftVillageAdminDto) {
    const where: Prisma.CraftVillageWhereInput = {
      ...(query.category
        ? { category: CRAFT_VILLAGE_CATEGORY_TO_DB[query.category] }
        : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { address: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.craftVillage.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        include: includeCraftVillage,
      }),
      this.prisma.craftVillage.count({ where }),
    ]);
    return paginate(
      records.map((record) => this.toAdminDto(record)),
      query.page,
      query.limit,
      total,
    );
  }

  async adminDetail(id: string): Promise<CraftVillageAdminResponseDto> {
    return this.toAdminDto(await this.findOrThrow(id));
  }

  async create(
    actorId: string,
    dto: CreateCraftVillageDto,
  ): Promise<CraftVillageAdminResponseDto> {
    const id = dto.id ?? slugify(dto.name);
    const duplicate = await this.prisma.craftVillage.findUnique({
      where: { id },
      select: { id: true },
    });
    if (duplicate) throw this.slugExists();
    await this.validateMedia(dto.mediaId, actorId, id);

    const record = await this.prisma.$transaction(async (tx) => {
      const sortOrder = dto.sortOrder ?? (await this.nextSortOrder(tx));
      const created = await tx.craftVillage.create({
        data: {
          id,
          name: dto.name,
          category: CRAFT_VILLAGE_CATEGORY_TO_DB[dto.category],
          address: dto.address,
          workingTime: dto.workingTime,
          mainProducts: dto.mainProducts,
          summary: dto.summary,
          description: dto.description,
          highlights: dto.highlights,
          visitorNote: dto.visitorNote,
          mediaId: dto.mediaId ?? null,
          imageAlt: dto.imageAlt,
          sortOrder,
          isActive: dto.isActive ?? true,
          createdById: actorId,
          updatedById: actorId,
        },
        include: includeCraftVillage,
      });
      await this.claimMedia(tx, dto.mediaId, actorId, id);
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'CRAFT_VILLAGE_CREATED',
          resourceType: 'CraftVillage',
          resourceId: id,
          newData: { version: 1 },
        },
      });
      return created;
    });
    return this.toAdminDto(record);
  }

  async update(
    actorId: string,
    id: string,
    dto: UpdateCraftVillageDto,
  ): Promise<CraftVillageAdminResponseDto> {
    const current = await this.findOrThrow(id);
    await this.validateMedia(dto.mediaId, actorId, id);

    const { record, deletedMediaId } = await this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.craftVillage.updateMany({
          where: { id, version: dto.version },
          data: {
            name: dto.name,
            category: CRAFT_VILLAGE_CATEGORY_TO_DB[dto.category],
            address: dto.address,
            workingTime: dto.workingTime,
            mainProducts: dto.mainProducts,
            summary: dto.summary,
            description: dto.description,
            highlights: dto.highlights,
            visitorNote: dto.visitorNote,
            mediaId: dto.mediaId ?? null,
            imageAlt: dto.imageAlt,
            ...(dto.sortOrder === undefined
              ? {}
              : { sortOrder: dto.sortOrder }),
            ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
            version: { increment: 1 },
            updatedById: actorId,
          },
        });
        if (updated.count !== 1) throw await this.versionConflict(tx, id);

        const deletedMediaId = await this.mediaService.releaseSingularMedia(
          tx,
          {
            previousMediaId: current.mediaId,
            nextMediaId: dto.mediaId ?? null,
            resourceType: MediaResourceType.CRAFT_VILLAGE,
            resourceId: id,
          },
        );
        await this.claimMedia(tx, dto.mediaId, actorId, id);
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'CRAFT_VILLAGE_UPDATED',
            resourceType: 'CraftVillage',
            resourceId: id,
            oldData: { version: dto.version },
            newData: { version: dto.version + 1 },
          },
        });
        const record = await tx.craftVillage.findUniqueOrThrow({
          where: { id },
          include: includeCraftVillage,
        });
        return { record, deletedMediaId };
      },
    );
    await this.mediaService.purgeStorage([deletedMediaId]);
    return this.toAdminDto(record);
  }

  async updateStatus(
    actorId: string,
    id: string,
    dto: UpdateCraftVillageStatusDto,
  ): Promise<CraftVillageAdminResponseDto> {
    const record = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.craftVillage.updateMany({
        where: { id, version: dto.version },
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
          action: dto.isActive ? 'CRAFT_VILLAGE_SHOWN' : 'CRAFT_VILLAGE_HIDDEN',
          resourceType: 'CraftVillage',
          resourceId: id,
          newData: { isActive: dto.isActive },
        },
      });
      return tx.craftVillage.findUniqueOrThrow({
        where: { id },
        include: includeCraftVillage,
      });
    });
    return this.toAdminDto(record);
  }

  async reorder(
    actorId: string,
    dto: ReorderCraftVillagesDto,
  ): Promise<CraftVillageAdminResponseDto[]> {
    const ids = dto.items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'Danh sách sắp xếp chứa ID trùng',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const found = await tx.craftVillage.count({
        where: { id: { in: ids } },
      });
      if (found !== ids.length) throw this.notFound();
      for (const item of dto.items) {
        await tx.craftVillage.update({
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
          action: 'CRAFT_VILLAGES_REORDERED',
          resourceType: 'CraftVillage',
          newData: {
            items: dto.items.map(({ id, sortOrder }) => ({ id, sortOrder })),
          },
        },
      });
      const records = await tx.craftVillage.findMany({
        where: { id: { in: ids } },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        include: includeCraftVillage,
      });
      return records.map((record) => this.toAdminDto(record));
    });
  }

  async remove(actorId: string, id: string): Promise<void> {
    const current = await this.findOrThrow(id);
    const deletedMediaId = await this.prisma.$transaction(async (tx) => {
      await tx.craftVillage.delete({ where: { id } });
      const deletedMediaId = await this.mediaService.releaseSingularMedia(tx, {
        previousMediaId: current.mediaId,
        nextMediaId: null,
        resourceType: MediaResourceType.CRAFT_VILLAGE,
        resourceId: id,
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'CRAFT_VILLAGE_DELETED',
          resourceType: 'CraftVillage',
          resourceId: id,
        },
      });
      return deletedMediaId;
    });
    await this.mediaService.purgeStorage([deletedMediaId]);
  }

  private async findOrThrow(id: string): Promise<CraftVillageRecord> {
    const record = await this.prisma.craftVillage.findUnique({
      where: { id },
      include: includeCraftVillage,
    });
    if (!record) throw this.notFound();
    return record;
  }

  private toListDto(
    record: CraftVillageRecord,
  ): CraftVillageListItemResponseDto {
    return {
      id: record.id,
      name: record.name,
      category: CRAFT_VILLAGE_CATEGORY_FROM_DB[record.category],
      address: record.address,
      workingTime: record.workingTime,
      mainProducts: record.mainProducts,
      summary: record.summary,
      imageUrl: record.media?.originalUrl ?? null,
      imageAlt: record.imageAlt,
      sortOrder: record.sortOrder,
      updatedAt: record.updatedAt,
    };
  }

  private toPublicDto(record: CraftVillageRecord): CraftVillageResponseDto {
    return {
      ...this.toListDto(record),
      description: this.readStringArray(record.description),
      highlights: this.readStringArray(record.highlights),
      visitorNote: record.visitorNote,
    };
  }

  private toAdminDto(record: CraftVillageRecord): CraftVillageAdminResponseDto {
    return {
      ...this.toPublicDto(record),
      mediaId: record.mediaId,
      isActive: record.isActive,
      version: record.version,
      createdAt: record.createdAt,
      createdBy: record.createdBy?.displayName ?? null,
      updatedBy: record.updatedBy?.displayName ?? null,
    };
  }

  private readStringArray(value: Prisma.JsonValue): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  }

  private async validateMedia(
    mediaId: string | null | undefined,
    actorId: string,
    craftVillageId: string,
  ): Promise<void> {
    if (!mediaId) return;
    const media = await this.prisma.media.findFirst({
      where: { id: mediaId, deletedAt: null },
    });
    const validImage = media?.mimeType.startsWith('image/');
    const usable =
      media &&
      ((media.resourceType === null && media.ownerId === actorId) ||
        (media.resourceType === MediaResourceType.CRAFT_VILLAGE &&
          (media.resourceId === craftVillageId || media.resourceId === null)));
    if (!validImage || !usable) {
      throw new AppException(
        ErrorCode.INVALID_CRAFT_VILLAGE_MEDIA,
        'Ảnh không tồn tại hoặc không được phép sử dụng',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async claimMedia(
    tx: Prisma.TransactionClient,
    mediaId: string | null | undefined,
    actorId: string,
    craftVillageId: string,
  ): Promise<void> {
    if (!mediaId) return;
    const claimed = await tx.media.updateMany({
      where: {
        id: mediaId,
        ownerId: actorId,
        resourceType: null,
        deletedAt: null,
      },
      data: {
        resourceType: MediaResourceType.CRAFT_VILLAGE,
        resourceId: craftVillageId,
      },
    });
    if (claimed.count === 0) {
      const existing = await tx.media.findFirst({
        where: {
          id: mediaId,
          resourceType: MediaResourceType.CRAFT_VILLAGE,
          OR: [{ resourceId: craftVillageId }, { resourceId: null }],
          deletedAt: null,
        },
      });
      if (!existing)
        throw new AppException(
          ErrorCode.INVALID_CRAFT_VILLAGE_MEDIA,
          'Ảnh đã được nội dung khác sử dụng',
          HttpStatus.CONFLICT,
        );
    }
  }

  private async nextSortOrder(tx: Prisma.TransactionClient): Promise<number> {
    const result = await tx.craftVillage.aggregate({
      _max: { sortOrder: true },
    });
    return (result._max.sortOrder ?? -1) + 1;
  }

  private async versionConflict(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<AppException> {
    const latest = await tx.craftVillage.findUnique({
      where: { id },
      include: includeCraftVillage,
    });
    if (!latest) return this.notFound();
    return new AppException(
      ErrorCode.CRAFT_VILLAGE_VERSION_CONFLICT,
      'Làng nghề đã được người khác cập nhật, vui lòng tải lại',
      HttpStatus.CONFLICT,
      [{ latest: this.toAdminDto(latest) }],
    );
  }

  private notFound(): AppException {
    return new AppException(
      ErrorCode.CRAFT_VILLAGE_NOT_FOUND,
      'Không tìm thấy làng nghề',
      HttpStatus.NOT_FOUND,
    );
  }

  private slugExists(): AppException {
    return new AppException(
      ErrorCode.CRAFT_VILLAGE_SLUG_EXISTS,
      'Slug làng nghề đã tồn tại',
      HttpStatus.CONFLICT,
    );
  }
}

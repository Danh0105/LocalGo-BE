import { HttpStatus, Injectable } from '@nestjs/common';
import {
  MediaResourceType,
  Prisma,
  type Media,
  type Specialty,
  type User,
} from '../../../../generated/prisma';
import { ErrorCode } from '../../../common/constants/error-codes.constant';
import { paginate } from '../../../common/pagination/pagination.util';
import { AppException } from '../../../common/exceptions/app.exception';
import { slugify } from '../../../common/utils/slugify.util';
import { PrismaService } from '../../../database/prisma.service';
import { MediaService } from '../../media/services/media.service';
import {
  ReorderSpecialtiesDto,
  UpdateSpecialtyStatusDto,
} from '../dto/specialty-action.dto';
import {
  QuerySpecialtyAdminDto,
  QuerySpecialtyPublicDto,
} from '../dto/query-specialty.dto';
import {
  SpecialtyAdminResponseDto,
  SpecialtyListItemResponseDto,
  SpecialtyResponseDto,
} from '../dto/specialty-response.dto';
import {
  CreateSpecialtyDto,
  UpdateSpecialtyDto,
} from '../dto/upsert-specialty.dto';
import {
  SPECIALTY_CATEGORY_FROM_DB,
  SPECIALTY_CATEGORY_TO_DB,
} from '../specialty.constants';

type SpecialtyRecord = Specialty & {
  media: Media | null;
  createdBy: Pick<User, 'displayName'> | null;
  updatedBy: Pick<User, 'displayName'> | null;
};

const includeSpecialty = {
  media: true,
  createdBy: { select: { displayName: true } },
  updatedBy: { select: { displayName: true } },
};

@Injectable()
export class SpecialtyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
  ) {}

  async publicList(
    query: QuerySpecialtyPublicDto,
  ): Promise<SpecialtyListItemResponseDto[]> {
    const records = await this.prisma.specialty.findMany({
      where: {
        isActive: true,
        ...(query.category
          ? { category: SPECIALTY_CATEGORY_TO_DB[query.category] }
          : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      include: includeSpecialty,
    });
    return records.map((record) => this.toListDto(record));
  }

  async publicDetail(id: string): Promise<SpecialtyResponseDto> {
    const record = await this.prisma.specialty.findFirst({
      where: { id, isActive: true },
      include: includeSpecialty,
    });
    if (!record) throw this.notFound();
    return this.toPublicDto(record);
  }

  async adminList(query: QuerySpecialtyAdminDto) {
    const where: Prisma.SpecialtyWhereInput = {
      ...(query.category
        ? { category: SPECIALTY_CATEGORY_TO_DB[query.category] }
        : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.specialty.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        include: includeSpecialty,
      }),
      this.prisma.specialty.count({ where }),
    ]);
    return paginate(
      records.map((record) => this.toAdminDto(record)),
      query.page,
      query.limit,
      total,
    );
  }

  async adminDetail(id: string): Promise<SpecialtyAdminResponseDto> {
    return this.toAdminDto(await this.findOrThrow(id));
  }

  async create(
    actorId: string,
    dto: CreateSpecialtyDto,
  ): Promise<SpecialtyAdminResponseDto> {
    const id = dto.id ?? slugify(dto.name);
    const duplicate = await this.prisma.specialty.findUnique({
      where: { id },
      select: { id: true },
    });
    if (duplicate) throw this.slugExists();
    await this.validateMedia(dto.mediaId, actorId, id);

    const record = await this.prisma.$transaction(async (tx) => {
      const sortOrder = dto.sortOrder ?? (await this.nextSortOrder(tx));
      const created = await tx.specialty.create({
        data: {
          id,
          name: dto.name,
          category: SPECIALTY_CATEGORY_TO_DB[dto.category],
          price: dto.price,
          season: dto.season,
          summary: dto.summary,
          description: dto.description,
          buyPlaces: dto.buyPlaces,
          mediaId: dto.mediaId ?? null,
          imageAlt: dto.imageAlt,
          sortOrder,
          isActive: dto.isActive ?? true,
          createdById: actorId,
          updatedById: actorId,
        },
        include: includeSpecialty,
      });
      await this.claimMedia(tx, dto.mediaId, actorId, id);
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'SPECIALTY_CREATED',
          resourceType: 'Specialty',
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
    dto: UpdateSpecialtyDto,
  ): Promise<SpecialtyAdminResponseDto> {
    const current = await this.findOrThrow(id);
    await this.validateMedia(dto.mediaId, actorId, id);

    const { record, deletedMediaId } = await this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.specialty.updateMany({
          where: { id, version: dto.version },
          data: {
            name: dto.name,
            category: SPECIALTY_CATEGORY_TO_DB[dto.category],
            price: dto.price,
            season: dto.season,
            summary: dto.summary,
            description: dto.description,
            buyPlaces: dto.buyPlaces,
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
            resourceType: MediaResourceType.SPECIALTY,
            resourceId: id,
          },
        );
        await this.claimMedia(tx, dto.mediaId, actorId, id);
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'SPECIALTY_UPDATED',
            resourceType: 'Specialty',
            resourceId: id,
            oldData: { version: dto.version },
            newData: { version: dto.version + 1 },
          },
        });
        const record = await tx.specialty.findUniqueOrThrow({
          where: { id },
          include: includeSpecialty,
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
    dto: UpdateSpecialtyStatusDto,
  ): Promise<SpecialtyAdminResponseDto> {
    const record = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.specialty.updateMany({
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
          action: dto.isActive ? 'SPECIALTY_SHOWN' : 'SPECIALTY_HIDDEN',
          resourceType: 'Specialty',
          resourceId: id,
          newData: { isActive: dto.isActive },
        },
      });
      return tx.specialty.findUniqueOrThrow({
        where: { id },
        include: includeSpecialty,
      });
    });
    return this.toAdminDto(record);
  }

  async reorder(
    actorId: string,
    dto: ReorderSpecialtiesDto,
  ): Promise<SpecialtyAdminResponseDto[]> {
    const ids = dto.items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'Danh sách sắp xếp chứa ID trùng',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const found = await tx.specialty.count({ where: { id: { in: ids } } });
      if (found !== ids.length) throw this.notFound();
      for (const item of dto.items) {
        await tx.specialty.update({
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
          action: 'SPECIALTIES_REORDERED',
          resourceType: 'Specialty',
          newData: {
            items: dto.items.map(({ id, sortOrder }) => ({ id, sortOrder })),
          },
        },
      });
      const records = await tx.specialty.findMany({
        where: { id: { in: ids } },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        include: includeSpecialty,
      });
      return records.map((record) => this.toAdminDto(record));
    });
  }

  async remove(actorId: string, id: string): Promise<void> {
    const current = await this.findOrThrow(id);
    const deletedMediaId = await this.prisma.$transaction(async (tx) => {
      await tx.specialty.delete({ where: { id } });
      const deletedMediaId = await this.mediaService.releaseSingularMedia(tx, {
        previousMediaId: current.mediaId,
        nextMediaId: null,
        resourceType: MediaResourceType.SPECIALTY,
        resourceId: id,
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'SPECIALTY_DELETED',
          resourceType: 'Specialty',
          resourceId: id,
        },
      });
      return deletedMediaId;
    });
    await this.mediaService.purgeStorage([deletedMediaId]);
  }

  private async findOrThrow(id: string): Promise<SpecialtyRecord> {
    const record = await this.prisma.specialty.findUnique({
      where: { id },
      include: includeSpecialty,
    });
    if (!record) throw this.notFound();
    return record;
  }

  private toListDto(record: SpecialtyRecord): SpecialtyListItemResponseDto {
    return {
      id: record.id,
      name: record.name,
      category: SPECIALTY_CATEGORY_FROM_DB[record.category],
      price: record.price,
      season: record.season,
      summary: record.summary,
      imageUrl: record.media?.originalUrl ?? null,
      imageAlt: record.imageAlt,
      sortOrder: record.sortOrder,
      updatedAt: record.updatedAt,
    };
  }

  private toPublicDto(record: SpecialtyRecord): SpecialtyResponseDto {
    return {
      ...this.toListDto(record),
      description: this.readStringArray(record.description),
      buyPlaces: this.readStringArray(record.buyPlaces),
    };
  }

  private toAdminDto(record: SpecialtyRecord): SpecialtyAdminResponseDto {
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
    specialtyId: string,
  ): Promise<void> {
    if (!mediaId) return;
    const media = await this.prisma.media.findFirst({
      where: { id: mediaId, deletedAt: null },
    });
    const validImage = media?.mimeType.startsWith('image/');
    const usable =
      media &&
      ((media.resourceType === null && media.ownerId === actorId) ||
        (media.resourceType === MediaResourceType.SPECIALTY &&
          (media.resourceId === specialtyId || media.resourceId === null)));
    if (!validImage || !usable) {
      throw new AppException(
        ErrorCode.INVALID_SPECIALTY_MEDIA,
        'Ảnh không tồn tại hoặc không được phép sử dụng',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async claimMedia(
    tx: Prisma.TransactionClient,
    mediaId: string | null | undefined,
    actorId: string,
    specialtyId: string,
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
        resourceType: MediaResourceType.SPECIALTY,
        resourceId: specialtyId,
      },
    });
    if (claimed.count === 0) {
      const existing = await tx.media.findFirst({
        where: {
          id: mediaId,
          resourceType: MediaResourceType.SPECIALTY,
          OR: [{ resourceId: specialtyId }, { resourceId: null }],
          deletedAt: null,
        },
      });
      if (!existing)
        throw new AppException(
          ErrorCode.INVALID_SPECIALTY_MEDIA,
          'Ảnh đã được nội dung khác sử dụng',
          HttpStatus.CONFLICT,
        );
    }
  }

  private async nextSortOrder(tx: Prisma.TransactionClient): Promise<number> {
    const result = await tx.specialty.aggregate({ _max: { sortOrder: true } });
    return (result._max.sortOrder ?? -1) + 1;
  }

  private async versionConflict(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<AppException> {
    const latest = await tx.specialty.findUnique({
      where: { id },
      include: includeSpecialty,
    });
    if (!latest) return this.notFound();
    return new AppException(
      ErrorCode.SPECIALTY_VERSION_CONFLICT,
      'Đặc sản đã được người khác cập nhật, vui lòng tải lại',
      HttpStatus.CONFLICT,
      [{ latest: this.toAdminDto(latest) }],
    );
  }

  private notFound(): AppException {
    return new AppException(
      ErrorCode.SPECIALTY_NOT_FOUND,
      'Không tìm thấy đặc sản',
      HttpStatus.NOT_FOUND,
    );
  }

  private slugExists(): AppException {
    return new AppException(
      ErrorCode.SPECIALTY_SLUG_EXISTS,
      'Slug đặc sản đã tồn tại',
      HttpStatus.CONFLICT,
    );
  }
}

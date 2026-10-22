import { HttpStatus, Injectable } from '@nestjs/common';
import {
  MediaResourceType,
  Prisma,
  type Media,
  type Specialty,
  type SpecialtyImage,
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
  type SpecialtyContentDto,
  UpdateSpecialtyDto,
} from '../dto/upsert-specialty.dto';
import {
  SPECIALTY_CATEGORY_FROM_DB,
  SPECIALTY_CATEGORY_TO_DB,
} from '../specialty.constants';
import {
  parseBuyPlaceDetails,
  type SpecialtyBuyPlace,
} from '../utils/buy-place.util';

type SpecialtyRecord = Specialty & {
  media: Media | null;
  galleryImages: Array<SpecialtyImage & { media: Media }>;
  createdBy: Pick<User, 'displayName'> | null;
  updatedBy: Pick<User, 'displayName'> | null;
};

const includeSpecialty = {
  media: true,
  galleryImages: {
    orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
    include: { media: true },
  },
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
        deletedAt: null,
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
      where: { id, isActive: true, deletedAt: null },
      include: includeSpecialty,
    });
    if (!record) throw this.notFound();
    return this.toPublicDto(record);
  }

  async adminList(query: QuerySpecialtyAdminDto) {
    const where: Prisma.SpecialtyWhereInput = {
      ...(query.includeDeleted ? {} : { deletedAt: null }),
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
    const id = await this.resolveCreateId(dto);
    const galleryMediaIds = dto.galleryMediaIds ?? [];
    this.mediaService.assertDistinctContentImages(dto.mediaId, galleryMediaIds);
    await this.mediaService.validateContentImageSet({
      mediaIds: [dto.mediaId, ...galleryMediaIds],
      actorId,
      resourceType: MediaResourceType.SPECIALTY,
      resourceId: id,
      errorCode: ErrorCode.INVALID_SPECIALTY_MEDIA,
    });
    const places = this.resolveBuyPlaces(dto, id);
    this.assertBuyPlacesForActive(dto.isActive ?? true, places);

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
          buyPlaces: places as unknown as Prisma.InputJsonValue,
          mediaId: dto.mediaId ?? null,
          imageAlt: dto.imageAlt,
          sortOrder,
          isActive: dto.isActive ?? true,
          createdById: actorId,
          updatedById: actorId,
          ...(galleryMediaIds.length === 0
            ? {}
            : {
                galleryImages: {
                  create: galleryMediaIds.map((mediaId, index) => ({
                    mediaId,
                    sortOrder: index,
                  })),
                },
              }),
        },
        include: includeSpecialty,
      });
      await this.mediaService.claimContentImageSet(tx, {
        mediaIds: [dto.mediaId, ...galleryMediaIds],
        actorId,
        resourceType: MediaResourceType.SPECIALTY,
        resourceId: id,
        errorCode: ErrorCode.INVALID_SPECIALTY_MEDIA,
      });
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

  private async resolveCreateId(dto: CreateSpecialtyDto): Promise<string> {
    if (dto.id) {
      const duplicate = await this.prisma.specialty.findUnique({
        where: { id: dto.id },
        select: { id: true },
      });
      if (duplicate) throw this.slugExists();
      return dto.id;
    }

    const baseId = slugify(dto.name);
    const matchingIds = await this.prisma.specialty.findMany({
      where: { OR: [{ id: baseId }, { id: { startsWith: `${baseId}-` } }] },
      select: { id: true },
    });
    const occupied = new Set(matchingIds.map(({ id }) => id));
    if (!occupied.has(baseId)) return baseId;

    let suffix = 2;
    while (occupied.has(`${baseId}-${suffix}`)) suffix += 1;
    return `${baseId}-${suffix}`;
  }

  async update(
    actorId: string,
    id: string,
    dto: UpdateSpecialtyDto,
  ): Promise<SpecialtyAdminResponseDto> {
    const current = await this.findOrThrow(id);
    const galleryMediaIds =
      dto.galleryMediaIds ??
      current.galleryImages.map((image) => image.mediaId);
    this.mediaService.assertDistinctContentImages(dto.mediaId, galleryMediaIds);
    await this.mediaService.validateContentImageSet({
      mediaIds: [dto.mediaId, ...galleryMediaIds],
      actorId,
      resourceType: MediaResourceType.SPECIALTY,
      resourceId: id,
      errorCode: ErrorCode.INVALID_SPECIALTY_MEDIA,
    });
    const places = this.resolveBuyPlaces(dto, id);
    this.assertBuyPlacesForActive(dto.isActive ?? current.isActive, places);

    const { record, deletedMediaIds } = await this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.specialty.updateMany({
          where: { id, version: dto.version, deletedAt: null },
          data: {
            name: dto.name,
            category: SPECIALTY_CATEGORY_TO_DB[dto.category],
            price: dto.price,
            season: dto.season,
            summary: dto.summary,
            description: dto.description,
            buyPlaces: places as unknown as Prisma.InputJsonValue,
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

        if (dto.galleryMediaIds !== undefined) {
          await tx.specialtyImage.deleteMany({ where: { specialtyId: id } });
          if (galleryMediaIds.length > 0)
            await tx.specialtyImage.createMany({
              data: galleryMediaIds.map((mediaId, index) => ({
                specialtyId: id,
                mediaId,
                sortOrder: index,
              })),
            });
        }
        await this.mediaService.claimContentImageSet(tx, {
          mediaIds: [dto.mediaId, ...galleryMediaIds],
          actorId,
          resourceType: MediaResourceType.SPECIALTY,
          resourceId: id,
          errorCode: ErrorCode.INVALID_SPECIALTY_MEDIA,
        });
        const deletedMediaIds = await this.mediaService.releaseContentImageSet(
          tx,
          {
            previousMediaIds: [
              current.mediaId,
              ...current.galleryImages.map((image) => image.mediaId),
            ],
            nextMediaIds: [dto.mediaId, ...galleryMediaIds],
            resourceType: MediaResourceType.SPECIALTY,
            resourceId: id,
          },
        );
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
        return { record, deletedMediaIds };
      },
    );
    await this.mediaService.purgeStorage(deletedMediaIds);
    return this.toAdminDto(record);
  }

  async updateStatus(
    actorId: string,
    id: string,
    dto: UpdateSpecialtyStatusDto,
  ): Promise<SpecialtyAdminResponseDto> {
    if (dto.isActive) {
      const current = await this.findOrThrow(id);
      this.assertBuyPlacesForActive(
        true,
        parseBuyPlaceDetails(current.buyPlaces, id),
      );
    }
    const record = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.specialty.updateMany({
        where: { id, version: dto.version, deletedAt: null },
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
      const found = await tx.specialty.count({
        where: { id: { in: ids }, deletedAt: null },
      });
      if (found !== ids.length) throw this.notFound();
      for (const item of dto.items) {
        await tx.specialty.update({
          where: { id: item.id, deletedAt: null },
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
        where: { id: { in: ids }, deletedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        include: includeSpecialty,
      });
      return records.map((record) => this.toAdminDto(record));
    });
  }

  async remove(actorId: string, id: string): Promise<void> {
    await this.findOrThrow(id);
    await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.specialty.updateMany({
        where: { id, deletedAt: null },
        data: {
          deletedAt: new Date(),
          isActive: false,
          version: { increment: 1 },
          updatedById: actorId,
        },
      });
      if (deleted.count !== 1) throw this.notFound();
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'SPECIALTY_DELETED',
          resourceType: 'Specialty',
          resourceId: id,
        },
      });
    });
  }

  private async findOrThrow(id: string): Promise<SpecialtyRecord> {
    const record = await this.prisma.specialty.findFirst({
      where: { id, deletedAt: null },
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
    const places = parseBuyPlaceDetails(record.buyPlaces, record.id);
    return {
      ...this.toListDto(record),
      description: this.readStringArray(record.description),
      buyPlaces: places.map((place) => place.name),
      buyPlaceDetails: places,
      galleryImages: record.galleryImages.map((image) => ({
        mediaId: image.mediaId,
        imageUrl: image.media.originalUrl,
        thumbnailUrl: image.media.thumbnailUrl,
        sortOrder: image.sortOrder,
      })),
    };
  }

  private toAdminDto(record: SpecialtyRecord): SpecialtyAdminResponseDto {
    return {
      ...this.toPublicDto(record),
      mediaId: record.mediaId,
      galleryMediaIds: record.galleryImages.map((image) => image.mediaId),
      isActive: record.isActive,
      version: record.version,
      createdAt: record.createdAt,
      deletedAt: record.deletedAt,
      createdBy: record.createdBy?.displayName ?? null,
      updatedBy: record.updatedBy?.displayName ?? null,
    };
  }

  private readStringArray(value: Prisma.JsonValue): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  }

  private resolveBuyPlaces(
    dto: Pick<SpecialtyContentDto, 'buyPlaceDetails' | 'buyPlaces'>,
    specialtyId: string,
  ): SpecialtyBuyPlace[] {
    let places: SpecialtyBuyPlace[];
    if (dto.buyPlaceDetails) {
      places = dto.buyPlaceDetails.map((place) => ({
        id: place.id,
        name: place.name,
        address: place.address ?? '',
        googleMapsUrl: place.googleMapsUrl ?? '',
        phone: place.phone ?? '',
        email: place.email ?? '',
      }));
      const ids = places.map((place) => place.id);
      if (new Set(ids).size !== ids.length) {
        throw new AppException(
          ErrorCode.VALIDATION_ERROR,
          'Danh sách địa điểm mua chứa ID trùng',
        );
      }
    } else if (dto.buyPlaces) {
      places = parseBuyPlaceDetails(dto.buyPlaces, specialtyId);
    } else {
      places = [];
    }
    return places;
  }

  private assertBuyPlacesForActive(
    isActive: boolean,
    places: SpecialtyBuyPlace[],
  ): void {
    if (!isActive) return;
    for (const place of places) {
      if (!place.googleMapsUrl.trim()) {
        throw new AppException(
          ErrorCode.VALIDATION_ERROR,
          `Địa điểm mua "${place.name}" cần có link Google Maps trước khi hiển thị đặc sản này`,
        );
      }
    }
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
    const latest = await tx.specialty.findFirst({
      where: { id, deletedAt: null },
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
      'Đặc sản không tồn tại hoặc đã bị xóa',
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

import { HttpStatus, Injectable } from '@nestjs/common';
import {
  MediaResourceType,
  Prisma,
  type ExperienceTour,
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
  ReorderExperienceToursDto,
  UpdateExperienceTourStatusDto,
} from '../dto/experience-tour-action.dto';
import {
  QueryExperienceTourAdminDto,
  QueryExperienceTourPublicDto,
} from '../dto/query-experience-tour.dto';
import {
  ExperienceTourAdminResponseDto,
  ExperienceTourListItemResponseDto,
  ExperienceTourResponseDto,
} from '../dto/experience-tour-response.dto';
import {
  CreateExperienceTourDto,
  UpdateExperienceTourDto,
} from '../dto/upsert-experience-tour.dto';
import {
  EXPERIENCE_TOUR_CATEGORY_FROM_DB,
  EXPERIENCE_TOUR_CATEGORY_TO_DB,
} from '../experience-tour.constants';

type ExperienceTourRecord = ExperienceTour & {
  media: Media | null;
  createdBy: Pick<User, 'displayName'> | null;
  updatedBy: Pick<User, 'displayName'> | null;
};

const includeExperienceTour = {
  media: true,
  createdBy: { select: { displayName: true } },
  updatedBy: { select: { displayName: true } },
};

@Injectable()
export class ExperienceTourService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
  ) {}

  async publicList(
    query: QueryExperienceTourPublicDto,
  ): Promise<ExperienceTourListItemResponseDto[]> {
    const records = await this.prisma.experienceTour.findMany({
      where: {
        isActive: true,
        ...(query.category
          ? { category: EXPERIENCE_TOUR_CATEGORY_TO_DB[query.category] }
          : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      include: includeExperienceTour,
    });
    return records.map((record) => this.toListDto(record));
  }

  async publicDetail(id: string): Promise<ExperienceTourResponseDto> {
    const record = await this.prisma.experienceTour.findFirst({
      where: { id, isActive: true },
      include: includeExperienceTour,
    });
    if (!record) throw this.notFound();
    return this.toPublicDto(record);
  }

  async adminList(query: QueryExperienceTourAdminDto) {
    const where: Prisma.ExperienceTourWhereInput = {
      ...(query.category
        ? { category: EXPERIENCE_TOUR_CATEGORY_TO_DB[query.category] }
        : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { meetingPoint: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.experienceTour.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        include: includeExperienceTour,
      }),
      this.prisma.experienceTour.count({ where }),
    ]);
    return paginate(
      records.map((record) => this.toAdminDto(record)),
      query.page,
      query.limit,
      total,
    );
  }

  async adminDetail(id: string): Promise<ExperienceTourAdminResponseDto> {
    return this.toAdminDto(await this.findOrThrow(id));
  }

  async create(
    actorId: string,
    dto: CreateExperienceTourDto,
  ): Promise<ExperienceTourAdminResponseDto> {
    const id = dto.id ?? slugify(dto.name);
    const duplicate = await this.prisma.experienceTour.findUnique({
      where: { id },
      select: { id: true },
    });
    if (duplicate) throw this.slugExists();
    await this.validateMedia(dto.mediaId, actorId, id);
    this.assertItineraryForActive(dto.isActive ?? true, dto.itinerary);

    const record = await this.prisma.$transaction(async (tx) => {
      const sortOrder = dto.sortOrder ?? (await this.nextSortOrder(tx));
      const created = await tx.experienceTour.create({
        data: {
          id,
          name: dto.name,
          category: EXPERIENCE_TOUR_CATEGORY_TO_DB[dto.category],
          duration: dto.duration,
          startTime: dto.startTime,
          priceRange: dto.priceRange,
          meetingPoint: dto.meetingPoint,
          summary: dto.summary,
          description: dto.description,
          itinerary: dto.itinerary,
          included: dto.included,
          note: dto.note,
          contactPhone: dto.contactPhone,
          mediaId: dto.mediaId ?? null,
          imageAlt: dto.imageAlt,
          sortOrder,
          isActive: dto.isActive ?? true,
          createdById: actorId,
          updatedById: actorId,
        },
        include: includeExperienceTour,
      });
      await this.claimMedia(tx, dto.mediaId, actorId, id);
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'EXPERIENCE_TOUR_CREATED',
          resourceType: 'ExperienceTour',
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
    dto: UpdateExperienceTourDto,
  ): Promise<ExperienceTourAdminResponseDto> {
    const current = await this.findOrThrow(id);
    await this.validateMedia(dto.mediaId, actorId, id);
    this.assertItineraryForActive(
      dto.isActive ?? current.isActive,
      dto.itinerary,
    );

    const { record, deletedMediaId } = await this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.experienceTour.updateMany({
          where: { id, version: dto.version },
          data: {
            name: dto.name,
            category: EXPERIENCE_TOUR_CATEGORY_TO_DB[dto.category],
            duration: dto.duration,
            startTime: dto.startTime,
            priceRange: dto.priceRange,
            meetingPoint: dto.meetingPoint,
            summary: dto.summary,
            description: dto.description,
            itinerary: dto.itinerary,
            included: dto.included,
            note: dto.note,
            contactPhone: dto.contactPhone,
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
            resourceType: MediaResourceType.EXPERIENCE_TOUR,
            resourceId: id,
          },
        );
        await this.claimMedia(tx, dto.mediaId, actorId, id);
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'EXPERIENCE_TOUR_UPDATED',
            resourceType: 'ExperienceTour',
            resourceId: id,
            oldData: { version: dto.version },
            newData: { version: dto.version + 1 },
          },
        });
        const record = await tx.experienceTour.findUniqueOrThrow({
          where: { id },
          include: includeExperienceTour,
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
    dto: UpdateExperienceTourStatusDto,
  ): Promise<ExperienceTourAdminResponseDto> {
    if (dto.isActive) {
      const current = await this.findOrThrow(id);
      this.assertItineraryForActive(
        true,
        this.readStringArray(current.itinerary),
      );
      this.assertContactPhoneForActive(current.contactPhone);
    }
    const record = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.experienceTour.updateMany({
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
          action: dto.isActive
            ? 'EXPERIENCE_TOUR_SHOWN'
            : 'EXPERIENCE_TOUR_HIDDEN',
          resourceType: 'ExperienceTour',
          resourceId: id,
          newData: { isActive: dto.isActive },
        },
      });
      return tx.experienceTour.findUniqueOrThrow({
        where: { id },
        include: includeExperienceTour,
      });
    });
    return this.toAdminDto(record);
  }

  async reorder(
    actorId: string,
    dto: ReorderExperienceToursDto,
  ): Promise<ExperienceTourAdminResponseDto[]> {
    const ids = dto.items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'Danh sách sắp xếp chứa ID trùng',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const found = await tx.experienceTour.count({
        where: { id: { in: ids } },
      });
      if (found !== ids.length) throw this.notFound();
      for (const item of dto.items) {
        await tx.experienceTour.update({
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
          action: 'EXPERIENCE_TOURS_REORDERED',
          resourceType: 'ExperienceTour',
          newData: {
            items: dto.items.map(({ id, sortOrder }) => ({ id, sortOrder })),
          },
        },
      });
      const records = await tx.experienceTour.findMany({
        where: { id: { in: ids } },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        include: includeExperienceTour,
      });
      return records.map((record) => this.toAdminDto(record));
    });
  }

  async remove(actorId: string, id: string): Promise<void> {
    const current = await this.findOrThrow(id);
    const deletedMediaId = await this.prisma.$transaction(async (tx) => {
      await tx.experienceTour.delete({ where: { id } });
      const deletedMediaId = await this.mediaService.releaseSingularMedia(tx, {
        previousMediaId: current.mediaId,
        nextMediaId: null,
        resourceType: MediaResourceType.EXPERIENCE_TOUR,
        resourceId: id,
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'EXPERIENCE_TOUR_DELETED',
          resourceType: 'ExperienceTour',
          resourceId: id,
        },
      });
      return deletedMediaId;
    });
    await this.mediaService.purgeStorage([deletedMediaId]);
  }

  private async findOrThrow(id: string): Promise<ExperienceTourRecord> {
    const record = await this.prisma.experienceTour.findUnique({
      where: { id },
      include: includeExperienceTour,
    });
    if (!record) throw this.notFound();
    return record;
  }

  private toListDto(
    record: ExperienceTourRecord,
  ): ExperienceTourListItemResponseDto {
    return {
      id: record.id,
      name: record.name,
      category: EXPERIENCE_TOUR_CATEGORY_FROM_DB[record.category],
      duration: record.duration,
      startTime: record.startTime,
      priceRange: record.priceRange,
      meetingPoint: record.meetingPoint,
      summary: record.summary,
      imageUrl: record.media?.originalUrl ?? null,
      imageAlt: record.imageAlt,
      sortOrder: record.sortOrder,
      updatedAt: record.updatedAt,
    };
  }

  private toPublicDto(record: ExperienceTourRecord): ExperienceTourResponseDto {
    return {
      ...this.toListDto(record),
      description: this.readStringArray(record.description),
      itinerary: this.readStringArray(record.itinerary),
      included: this.readStringArray(record.included),
      note: record.note,
      contactPhone: record.contactPhone,
    };
  }

  private toAdminDto(
    record: ExperienceTourRecord,
  ): ExperienceTourAdminResponseDto {
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

  private assertItineraryForActive(
    isActive: boolean,
    itinerary: string[],
  ): void {
    if (isActive && itinerary.length === 0) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'Tour cần tối thiểu 1 bước lịch trình (itinerary) trước khi hiển thị',
      );
    }
  }

  private assertContactPhoneForActive(contactPhone: string | null): void {
    if (!contactPhone || contactPhone.trim().length === 0) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'Cần có số điện thoại liên hệ trước khi hiển thị tour này',
      );
    }
  }

  private async validateMedia(
    mediaId: string | null | undefined,
    actorId: string,
    experienceTourId: string,
  ): Promise<void> {
    if (!mediaId) return;
    const media = await this.prisma.media.findFirst({
      where: { id: mediaId, deletedAt: null },
    });
    const validImage = media?.mimeType.startsWith('image/');
    const usable =
      media &&
      ((media.resourceType === null && media.ownerId === actorId) ||
        (media.resourceType === MediaResourceType.EXPERIENCE_TOUR &&
          (media.resourceId === experienceTourId ||
            media.resourceId === null)));
    if (!validImage || !usable) {
      throw new AppException(
        ErrorCode.INVALID_EXPERIENCE_TOUR_MEDIA,
        'Ảnh không tồn tại hoặc không được phép sử dụng',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async claimMedia(
    tx: Prisma.TransactionClient,
    mediaId: string | null | undefined,
    actorId: string,
    experienceTourId: string,
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
        resourceType: MediaResourceType.EXPERIENCE_TOUR,
        resourceId: experienceTourId,
      },
    });
    if (claimed.count === 0) {
      const existing = await tx.media.findFirst({
        where: {
          id: mediaId,
          resourceType: MediaResourceType.EXPERIENCE_TOUR,
          OR: [{ resourceId: experienceTourId }, { resourceId: null }],
          deletedAt: null,
        },
      });
      if (!existing)
        throw new AppException(
          ErrorCode.INVALID_EXPERIENCE_TOUR_MEDIA,
          'Ảnh đã được nội dung khác sử dụng',
          HttpStatus.CONFLICT,
        );
    }
  }

  private async nextSortOrder(tx: Prisma.TransactionClient): Promise<number> {
    const result = await tx.experienceTour.aggregate({
      _max: { sortOrder: true },
    });
    return (result._max.sortOrder ?? -1) + 1;
  }

  private async versionConflict(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<AppException> {
    const latest = await tx.experienceTour.findUnique({
      where: { id },
      include: includeExperienceTour,
    });
    if (!latest) return this.notFound();
    return new AppException(
      ErrorCode.EXPERIENCE_TOUR_VERSION_CONFLICT,
      'Tour trải nghiệm đã được người khác cập nhật, vui lòng tải lại',
      HttpStatus.CONFLICT,
      [{ latest: this.toAdminDto(latest) }],
    );
  }

  private notFound(): AppException {
    return new AppException(
      ErrorCode.EXPERIENCE_TOUR_NOT_FOUND,
      'Không tìm thấy tour trải nghiệm',
      HttpStatus.NOT_FOUND,
    );
  }

  private slugExists(): AppException {
    return new AppException(
      ErrorCode.EXPERIENCE_TOUR_SLUG_EXISTS,
      'Slug tour trải nghiệm đã tồn tại',
      HttpStatus.CONFLICT,
    );
  }
}

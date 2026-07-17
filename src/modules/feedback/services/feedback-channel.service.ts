import { HttpStatus, Injectable } from '@nestjs/common';
import {
  MediaResourceType,
  Prisma,
  type FeedbackChannel,
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
  ReorderFeedbackChannelsDto,
  UpdateFeedbackChannelStatusDto,
} from '../dto/feedback-channel-action.dto';
import {
  QueryFeedbackChannelAdminDto,
  QueryFeedbackChannelPublicDto,
} from '../dto/query-feedback-channel.dto';
import {
  FeedbackChannelAdminResponseDto,
  FeedbackChannelListItemResponseDto,
  FeedbackChannelResponseDto,
} from '../dto/feedback-channel-response.dto';
import {
  CreateFeedbackChannelDto,
  UpdateFeedbackChannelDto,
} from '../dto/upsert-feedback-channel.dto';
import {
  FEEDBACK_CHANNEL_CATEGORY_FROM_DB,
  FEEDBACK_CHANNEL_CATEGORY_TO_DB,
} from '../feedback-channel.constants';

type FeedbackChannelRecord = FeedbackChannel & {
  media: Media | null;
  createdBy: Pick<User, 'displayName'> | null;
  updatedBy: Pick<User, 'displayName'> | null;
};

const includeFeedbackChannel = {
  media: true,
  createdBy: { select: { displayName: true } },
  updatedBy: { select: { displayName: true } },
};

@Injectable()
export class FeedbackChannelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
  ) {}

  async publicList(
    query: QueryFeedbackChannelPublicDto,
  ): Promise<FeedbackChannelListItemResponseDto[]> {
    const records = await this.prisma.feedbackChannel.findMany({
      where: {
        isActive: true,
        ...(query.category
          ? { category: FEEDBACK_CHANNEL_CATEGORY_TO_DB[query.category] }
          : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      include: includeFeedbackChannel,
    });
    return records.map((record) => this.toListDto(record));
  }

  async publicDetail(id: string): Promise<FeedbackChannelResponseDto> {
    const record = await this.prisma.feedbackChannel.findFirst({
      where: { id, isActive: true },
      include: includeFeedbackChannel,
    });
    if (!record) throw this.notFound();
    return this.toPublicDto(record);
  }

  async adminList(query: QueryFeedbackChannelAdminDto) {
    const where: Prisma.FeedbackChannelWhereInput = {
      ...(query.category
        ? { category: FEEDBACK_CHANNEL_CATEGORY_TO_DB[query.category] }
        : {}),
      ...(query.search
        ? {
            title: { contains: query.search, mode: 'insensitive' },
          }
        : {}),
    };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.feedbackChannel.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        include: includeFeedbackChannel,
      }),
      this.prisma.feedbackChannel.count({ where }),
    ]);
    return paginate(
      records.map((record) => this.toAdminDto(record)),
      query.page,
      query.limit,
      total,
    );
  }

  async adminDetail(id: string): Promise<FeedbackChannelAdminResponseDto> {
    return this.toAdminDto(await this.findOrThrow(id));
  }

  async create(
    actorId: string,
    dto: CreateFeedbackChannelDto,
  ): Promise<FeedbackChannelAdminResponseDto> {
    const id = dto.id ?? slugify(dto.title);
    const duplicate = await this.prisma.feedbackChannel.findUnique({
      where: { id },
      select: { id: true },
    });
    if (duplicate) throw this.slugExists();
    await this.validateMedia(dto.mediaId, actorId, id);

    const record = await this.prisma.$transaction(async (tx) => {
      const sortOrder = dto.sortOrder ?? (await this.nextSortOrder(tx));
      const created = await tx.feedbackChannel.create({
        data: {
          id,
          title: dto.title,
          category: FEEDBACK_CHANNEL_CATEGORY_TO_DB[dto.category],
          responseTime: dto.responseTime,
          requiredInfo: dto.requiredInfo,
          summary: dto.summary,
          description: dto.description,
          examples: dto.examples,
          note: dto.note,
          mediaId: dto.mediaId ?? null,
          imageAlt: dto.imageAlt,
          sortOrder,
          isActive: dto.isActive ?? true,
          createdById: actorId,
          updatedById: actorId,
        },
        include: includeFeedbackChannel,
      });
      await this.claimMedia(tx, dto.mediaId, actorId, id);
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'FEEDBACK_CHANNEL_CREATED',
          resourceType: 'FeedbackChannel',
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
    dto: UpdateFeedbackChannelDto,
  ): Promise<FeedbackChannelAdminResponseDto> {
    const current = await this.findOrThrow(id);
    await this.validateMedia(dto.mediaId, actorId, id);

    const { record, deletedMediaId } = await this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.feedbackChannel.updateMany({
          where: { id, version: dto.version },
          data: {
            title: dto.title,
            category: FEEDBACK_CHANNEL_CATEGORY_TO_DB[dto.category],
            responseTime: dto.responseTime,
            requiredInfo: dto.requiredInfo,
            summary: dto.summary,
            description: dto.description,
            examples: dto.examples,
            note: dto.note,
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
            resourceType: MediaResourceType.FEEDBACK_CHANNEL,
            resourceId: id,
          },
        );
        await this.claimMedia(tx, dto.mediaId, actorId, id);
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'FEEDBACK_CHANNEL_UPDATED',
            resourceType: 'FeedbackChannel',
            resourceId: id,
            oldData: { version: dto.version },
            newData: { version: dto.version + 1 },
          },
        });
        const record = await tx.feedbackChannel.findUniqueOrThrow({
          where: { id },
          include: includeFeedbackChannel,
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
    dto: UpdateFeedbackChannelStatusDto,
  ): Promise<FeedbackChannelAdminResponseDto> {
    const record = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.feedbackChannel.updateMany({
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
            ? 'FEEDBACK_CHANNEL_SHOWN'
            : 'FEEDBACK_CHANNEL_HIDDEN',
          resourceType: 'FeedbackChannel',
          resourceId: id,
          newData: { isActive: dto.isActive },
        },
      });
      return tx.feedbackChannel.findUniqueOrThrow({
        where: { id },
        include: includeFeedbackChannel,
      });
    });
    return this.toAdminDto(record);
  }

  async reorder(
    actorId: string,
    dto: ReorderFeedbackChannelsDto,
  ): Promise<FeedbackChannelAdminResponseDto[]> {
    const ids = dto.items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'Danh sách sắp xếp chứa ID trùng',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const found = await tx.feedbackChannel.count({
        where: { id: { in: ids } },
      });
      if (found !== ids.length) throw this.notFound();
      for (const item of dto.items) {
        await tx.feedbackChannel.update({
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
          action: 'FEEDBACK_CHANNELS_REORDERED',
          resourceType: 'FeedbackChannel',
          newData: {
            items: dto.items.map(({ id, sortOrder }) => ({ id, sortOrder })),
          },
        },
      });
      const records = await tx.feedbackChannel.findMany({
        where: { id: { in: ids } },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        include: includeFeedbackChannel,
      });
      return records.map((record) => this.toAdminDto(record));
    });
  }

  async remove(actorId: string, id: string): Promise<void> {
    const current = await this.findOrThrow(id);
    const deletedMediaId = await this.prisma.$transaction(async (tx) => {
      await tx.feedbackChannel.delete({ where: { id } });
      const deletedMediaId = await this.mediaService.releaseSingularMedia(tx, {
        previousMediaId: current.mediaId,
        nextMediaId: null,
        resourceType: MediaResourceType.FEEDBACK_CHANNEL,
        resourceId: id,
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'FEEDBACK_CHANNEL_DELETED',
          resourceType: 'FeedbackChannel',
          resourceId: id,
        },
      });
      return deletedMediaId;
    });
    await this.mediaService.purgeStorage([deletedMediaId]);
  }

  private async findOrThrow(id: string): Promise<FeedbackChannelRecord> {
    const record = await this.prisma.feedbackChannel.findUnique({
      where: { id },
      include: includeFeedbackChannel,
    });
    if (!record) throw this.notFound();
    return record;
  }

  private toListDto(
    record: FeedbackChannelRecord,
  ): FeedbackChannelListItemResponseDto {
    return {
      id: record.id,
      title: record.title,
      category: FEEDBACK_CHANNEL_CATEGORY_FROM_DB[record.category],
      responseTime: record.responseTime,
      summary: record.summary,
      imageUrl: record.media?.originalUrl ?? null,
      imageAlt: record.imageAlt,
      sortOrder: record.sortOrder,
      updatedAt: record.updatedAt,
    };
  }

  private toPublicDto(
    record: FeedbackChannelRecord,
  ): FeedbackChannelResponseDto {
    return {
      ...this.toListDto(record),
      requiredInfo: this.readStringArray(record.requiredInfo),
      description: this.readStringArray(record.description),
      examples: this.readStringArray(record.examples),
      note: record.note,
    };
  }

  private toAdminDto(
    record: FeedbackChannelRecord,
  ): FeedbackChannelAdminResponseDto {
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
    channelId: string,
  ): Promise<void> {
    if (!mediaId) return;
    const media = await this.prisma.media.findFirst({
      where: { id: mediaId, deletedAt: null },
    });
    const validImage = media?.mimeType.startsWith('image/');
    const usable =
      media &&
      ((media.resourceType === null && media.ownerId === actorId) ||
        (media.resourceType === MediaResourceType.FEEDBACK_CHANNEL &&
          (media.resourceId === channelId || media.resourceId === null)));
    if (!validImage || !usable) {
      throw new AppException(
        ErrorCode.INVALID_FEEDBACK_CHANNEL_MEDIA,
        'Ảnh không tồn tại hoặc không được phép sử dụng',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async claimMedia(
    tx: Prisma.TransactionClient,
    mediaId: string | null | undefined,
    actorId: string,
    channelId: string,
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
        resourceType: MediaResourceType.FEEDBACK_CHANNEL,
        resourceId: channelId,
      },
    });
    if (claimed.count === 0) {
      const existing = await tx.media.findFirst({
        where: {
          id: mediaId,
          resourceType: MediaResourceType.FEEDBACK_CHANNEL,
          OR: [{ resourceId: channelId }, { resourceId: null }],
          deletedAt: null,
        },
      });
      if (!existing)
        throw new AppException(
          ErrorCode.INVALID_FEEDBACK_CHANNEL_MEDIA,
          'Ảnh đã được nội dung khác sử dụng',
          HttpStatus.CONFLICT,
        );
    }
  }

  private async nextSortOrder(tx: Prisma.TransactionClient): Promise<number> {
    const result = await tx.feedbackChannel.aggregate({
      _max: { sortOrder: true },
    });
    return (result._max.sortOrder ?? -1) + 1;
  }

  private async versionConflict(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<AppException> {
    const latest = await tx.feedbackChannel.findUnique({
      where: { id },
      include: includeFeedbackChannel,
    });
    if (!latest) return this.notFound();
    return new AppException(
      ErrorCode.FEEDBACK_CHANNEL_VERSION_CONFLICT,
      'Kênh phản hồi đã được người khác cập nhật, vui lòng tải lại',
      HttpStatus.CONFLICT,
      [{ latest: this.toAdminDto(latest) }],
    );
  }

  private notFound(): AppException {
    return new AppException(
      ErrorCode.FEEDBACK_CHANNEL_NOT_FOUND,
      'Không tìm thấy kênh phản hồi',
      HttpStatus.NOT_FOUND,
    );
  }

  private slugExists(): AppException {
    return new AppException(
      ErrorCode.FEEDBACK_CHANNEL_SLUG_EXISTS,
      'Slug kênh phản hồi đã tồn tại',
      HttpStatus.CONFLICT,
    );
  }
}

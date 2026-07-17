import { HttpStatus, Injectable } from '@nestjs/common';
import {
  MediaResourceType,
  Prisma,
  type Media,
  type NewsArticle,
  type User,
} from '../../../../generated/prisma';
import { ErrorCode } from '../../../common/constants/error-codes.constant';
import { paginate } from '../../../common/pagination/pagination.util';
import { AppException } from '../../../common/exceptions/app.exception';
import { slugify } from '../../../common/utils/slugify.util';
import { PrismaService } from '../../../database/prisma.service';
import { MediaService } from '../../media/services/media.service';
import { UpdateNewsArticleStatusDto } from '../dto/news-action.dto';
import { QueryNewsAdminDto, QueryNewsPublicDto } from '../dto/query-news.dto';
import {
  NewsArticleAdminResponseDto,
  NewsArticleListItemResponseDto,
  NewsArticleResponseDto,
} from '../dto/news-response.dto';
import {
  CreateNewsArticleDto,
  UpdateNewsArticleDto,
} from '../dto/upsert-news.dto';
import { NEWS_CATEGORY_FROM_DB, NEWS_CATEGORY_TO_DB } from '../news.constants';

type NewsArticleRecord = NewsArticle & {
  media: Media | null;
  createdBy: Pick<User, 'displayName'> | null;
  updatedBy: Pick<User, 'displayName'> | null;
};

const includeNewsArticle = {
  media: true,
  createdBy: { select: { displayName: true } },
  updatedBy: { select: { displayName: true } },
};

@Injectable()
export class NewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
  ) {}

  async publicList(query: QueryNewsPublicDto) {
    const where: Prisma.NewsArticleWhereInput = {
      isActive: true,
      publishedAt: { lte: new Date() },
      ...(query.category
        ? { category: NEWS_CATEGORY_TO_DB[query.category] }
        : {}),
    };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.newsArticle.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ publishedAt: query.sortOrder }, { id: query.sortOrder }],
        include: includeNewsArticle,
      }),
      this.prisma.newsArticle.count({ where }),
    ]);
    return paginate(
      records.map((record) => this.toListDto(record)),
      query.page,
      query.limit,
      total,
    );
  }

  async publicDetail(id: string): Promise<NewsArticleResponseDto> {
    const record = await this.prisma.newsArticle.findFirst({
      where: { id, isActive: true, publishedAt: { lte: new Date() } },
      include: includeNewsArticle,
    });
    if (!record) throw this.notFound();
    return this.toPublicDto(record);
  }

  async adminList(query: QueryNewsAdminDto) {
    const where: Prisma.NewsArticleWhereInput = {
      ...(query.category
        ? { category: NEWS_CATEGORY_TO_DB[query.category] }
        : {}),
      ...(query.search
        ? { title: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.newsArticle.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ publishedAt: query.sortOrder }, { id: query.sortOrder }],
        include: includeNewsArticle,
      }),
      this.prisma.newsArticle.count({ where }),
    ]);
    return paginate(
      records.map((record) => this.toAdminDto(record)),
      query.page,
      query.limit,
      total,
    );
  }

  async adminDetail(id: string): Promise<NewsArticleAdminResponseDto> {
    return this.toAdminDto(await this.findOrThrow(id));
  }

  async create(
    actorId: string,
    dto: CreateNewsArticleDto,
  ): Promise<NewsArticleAdminResponseDto> {
    const id = dto.id ?? slugify(dto.title);
    const duplicate = await this.prisma.newsArticle.findUnique({
      where: { id },
      select: { id: true },
    });
    if (duplicate) throw this.slugExists();
    await this.validateMedia(dto.mediaId, actorId, id);

    const record = await this.prisma.$transaction(async (tx) => {
      const created = await tx.newsArticle.create({
        data: {
          id,
          title: dto.title,
          category: NEWS_CATEGORY_TO_DB[dto.category],
          publishedAt: new Date(dto.publishedAt),
          author: dto.author,
          summary: dto.summary,
          content: dto.content,
          tags: dto.tags,
          relatedLinks: dto.relatedLinks,
          mediaId: dto.mediaId ?? null,
          imageAlt: dto.imageAlt,
          isActive: dto.isActive ?? true,
          createdById: actorId,
          updatedById: actorId,
        },
        include: includeNewsArticle,
      });
      await this.claimMedia(tx, dto.mediaId, actorId, id);
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'NEWS_ARTICLE_CREATED',
          resourceType: 'NewsArticle',
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
    dto: UpdateNewsArticleDto,
  ): Promise<NewsArticleAdminResponseDto> {
    const current = await this.findOrThrow(id);
    await this.validateMedia(dto.mediaId, actorId, id);

    const { record, deletedMediaId } = await this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.newsArticle.updateMany({
          where: { id, version: dto.version },
          data: {
            title: dto.title,
            category: NEWS_CATEGORY_TO_DB[dto.category],
            publishedAt: new Date(dto.publishedAt),
            author: dto.author,
            summary: dto.summary,
            content: dto.content,
            tags: dto.tags,
            relatedLinks: dto.relatedLinks,
            mediaId: dto.mediaId ?? null,
            imageAlt: dto.imageAlt,
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
            resourceType: MediaResourceType.NEWS_ARTICLE,
            resourceId: id,
          },
        );
        await this.claimMedia(tx, dto.mediaId, actorId, id);
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'NEWS_ARTICLE_UPDATED',
            resourceType: 'NewsArticle',
            resourceId: id,
            oldData: { version: dto.version },
            newData: { version: dto.version + 1 },
          },
        });
        const record = await tx.newsArticle.findUniqueOrThrow({
          where: { id },
          include: includeNewsArticle,
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
    dto: UpdateNewsArticleStatusDto,
  ): Promise<NewsArticleAdminResponseDto> {
    const record = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.newsArticle.updateMany({
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
          action: dto.isActive ? 'NEWS_ARTICLE_SHOWN' : 'NEWS_ARTICLE_HIDDEN',
          resourceType: 'NewsArticle',
          resourceId: id,
          newData: { isActive: dto.isActive },
        },
      });
      return tx.newsArticle.findUniqueOrThrow({
        where: { id },
        include: includeNewsArticle,
      });
    });
    return this.toAdminDto(record);
  }

  async remove(actorId: string, id: string): Promise<void> {
    const current = await this.findOrThrow(id);
    const deletedMediaId = await this.prisma.$transaction(async (tx) => {
      await tx.newsArticle.delete({ where: { id } });
      const deletedMediaId = await this.mediaService.releaseSingularMedia(tx, {
        previousMediaId: current.mediaId,
        nextMediaId: null,
        resourceType: MediaResourceType.NEWS_ARTICLE,
        resourceId: id,
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'NEWS_ARTICLE_DELETED',
          resourceType: 'NewsArticle',
          resourceId: id,
        },
      });
      return deletedMediaId;
    });
    await this.mediaService.purgeStorage([deletedMediaId]);
  }

  private async findOrThrow(id: string): Promise<NewsArticleRecord> {
    const record = await this.prisma.newsArticle.findUnique({
      where: { id },
      include: includeNewsArticle,
    });
    if (!record) throw this.notFound();
    return record;
  }

  private toListDto(record: NewsArticleRecord): NewsArticleListItemResponseDto {
    return {
      id: record.id,
      title: record.title,
      category: NEWS_CATEGORY_FROM_DB[record.category],
      publishedAt: record.publishedAt,
      author: record.author,
      summary: record.summary,
      imageUrl: record.media?.originalUrl ?? null,
      imageAlt: record.imageAlt,
      updatedAt: record.updatedAt,
    };
  }

  private toPublicDto(record: NewsArticleRecord): NewsArticleResponseDto {
    return {
      ...this.toListDto(record),
      content: this.readStringArray(record.content),
      tags: this.readStringArray(record.tags),
      relatedLinks: this.readStringArray(record.relatedLinks),
    };
  }

  private toAdminDto(record: NewsArticleRecord): NewsArticleAdminResponseDto {
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
    newsArticleId: string,
  ): Promise<void> {
    if (!mediaId) return;
    const media = await this.prisma.media.findFirst({
      where: { id: mediaId, deletedAt: null },
    });
    const validImage = media?.mimeType.startsWith('image/');
    const usable =
      media &&
      ((media.resourceType === null && media.ownerId === actorId) ||
        (media.resourceType === MediaResourceType.NEWS_ARTICLE &&
          (media.resourceId === newsArticleId || media.resourceId === null)));
    if (!validImage || !usable) {
      throw new AppException(
        ErrorCode.INVALID_NEWS_ARTICLE_MEDIA,
        'Ảnh không tồn tại hoặc không được phép sử dụng',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async claimMedia(
    tx: Prisma.TransactionClient,
    mediaId: string | null | undefined,
    actorId: string,
    newsArticleId: string,
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
        resourceType: MediaResourceType.NEWS_ARTICLE,
        resourceId: newsArticleId,
      },
    });
    if (claimed.count === 0) {
      const existing = await tx.media.findFirst({
        where: {
          id: mediaId,
          resourceType: MediaResourceType.NEWS_ARTICLE,
          OR: [{ resourceId: newsArticleId }, { resourceId: null }],
          deletedAt: null,
        },
      });
      if (!existing)
        throw new AppException(
          ErrorCode.INVALID_NEWS_ARTICLE_MEDIA,
          'Ảnh đã được nội dung khác sử dụng',
          HttpStatus.CONFLICT,
        );
    }
  }

  private async versionConflict(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<AppException> {
    const latest = await tx.newsArticle.findUnique({
      where: { id },
      include: includeNewsArticle,
    });
    if (!latest) return this.notFound();
    return new AppException(
      ErrorCode.NEWS_ARTICLE_VERSION_CONFLICT,
      'Bài viết đã được người khác cập nhật, vui lòng tải lại',
      HttpStatus.CONFLICT,
      [{ latest: this.toAdminDto(latest) }],
    );
  }

  private notFound(): AppException {
    return new AppException(
      ErrorCode.NEWS_ARTICLE_NOT_FOUND,
      'Không tìm thấy bài viết',
      HttpStatus.NOT_FOUND,
    );
  }

  private slugExists(): AppException {
    return new AppException(
      ErrorCode.NEWS_ARTICLE_SLUG_EXISTS,
      'Slug bài viết đã tồn tại',
      HttpStatus.CONFLICT,
    );
  }
}

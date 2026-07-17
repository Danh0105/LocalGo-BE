import { HttpStatus, Injectable } from '@nestjs/common';
import {
  MediaResourceType,
  Prisma,
  type AboutPage,
  type Media,
} from '../../../../generated/prisma';
import { ErrorCode } from '../../../common/constants/error-codes.constant';
import { AppException } from '../../../common/exceptions/app.exception';
import { PrismaService } from '../../../database/prisma.service';
import {
  AboutAdminStateDto,
  AboutResponseDto,
} from '../dto/about-response.dto';
import { UpdateAboutDto } from '../dto/update-about.dto';
import { AboutRepository } from '../repositories/about.repository';
import type { AboutSnapshot } from '../types/about-snapshot.type';

interface PublishedResult {
  data: AboutResponseDto;
  etag: string;
}

@Injectable()
export class AboutService {
  constructor(
    private readonly repository: AboutRepository,
    private readonly prisma: PrismaService,
  ) {}

  async getPublished(): Promise<PublishedResult> {
    const page = await this.getPageOrThrow();
    if (!page.publishedSnapshot || !page.publishedAt) {
      throw new AppException(
        ErrorCode.ABOUT_NOT_PUBLISHED,
        'Nội dung Giới thiệu chưa được xuất bản',
        HttpStatus.NOT_FOUND,
      );
    }
    const snapshot = this.readSnapshot(page.publishedSnapshot);
    return {
      data: await this.resolveSnapshot(
        snapshot,
        true,
        page.publishedVersion,
        page.publishedAt,
        page.publishedAt,
      ),
      etag: `"about-${page.publishedVersion}"`,
    };
  }

  async getAdminState(): Promise<AboutAdminStateDto> {
    return this.toAdminState(await this.getPageOrThrow());
  }

  async preview(): Promise<AboutResponseDto> {
    const page = await this.getPageOrThrow();
    const snapshot = this.readSnapshot(page.draftSnapshot);
    return this.resolveSnapshot(
      snapshot,
      true,
      page.version,
      page.updatedAt,
      null,
    );
  }

  async saveDraft(
    actorId: string,
    dto: UpdateAboutDto,
  ): Promise<AboutAdminStateDto> {
    const snapshot = this.normalize(dto);
    this.validateContent(snapshot);
    const media = await this.validateMedia(snapshot, actorId, true);

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.aboutPage.updateMany({
        where: { id: 'about', version: dto.version },
        data: {
          draftSnapshot: snapshot as unknown as Prisma.InputJsonValue,
          version: { increment: 1 },
          updatedById: actorId,
        },
      });
      if (updated.count !== 1) {
        const latest = await tx.aboutPage.findUnique({
          where: { id: 'about' },
          select: { version: true },
        });
        if (!latest) throw this.notInitialized();
        throw new AppException(
          ErrorCode.ABOUT_VERSION_CONFLICT,
          'Bản nháp đã được người khác cập nhật, vui lòng tải lại',
          HttpStatus.CONFLICT,
          [{ latestVersion: latest.version }],
        );
      }
      const claimIds = media
        .filter((item) => item.resourceType === null)
        .map((item) => item.id);
      if (claimIds.length > 0) {
        const claimed = await tx.media.updateMany({
          where: {
            id: { in: claimIds },
            ownerId: actorId,
            resourceType: null,
          },
          data: { resourceType: MediaResourceType.ABOUT, resourceId: 'about' },
        });
        if (claimed.count !== claimIds.length) {
          throw new AppException(
            ErrorCode.INVALID_ABOUT_MEDIA,
            'Ảnh đã được sử dụng bởi nội dung khác',
            HttpStatus.CONFLICT,
          );
        }
      }
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'ABOUT_DRAFT_SAVED',
          resourceType: 'AboutPage',
          resourceId: 'about',
          oldData: { version: dto.version },
          newData: { version: dto.version + 1 },
        },
      });
    });

    return this.getAdminState();
  }

  async publish(actorId: string): Promise<AboutResponseDto> {
    await this.prisma.$transaction(async (tx) => {
      const page = await tx.aboutPage.findUnique({ where: { id: 'about' } });
      if (!page) throw this.notInitialized();
      const draft = this.readSnapshot(page.draftSnapshot);
      this.validateContent(draft);
      await this.validateMediaInTransaction(tx, draft);

      if (
        page.publishedSnapshot &&
        this.snapshotsEqual(draft, this.readSnapshot(page.publishedSnapshot))
      ) {
        return;
      }

      await tx.aboutRevision.create({
        data: {
          aboutPageId: 'about',
          version: page.version,
          snapshot: draft as unknown as Prisma.InputJsonValue,
          publishedById: actorId,
        },
      });
      const publishedAt = new Date();
      await tx.aboutPage.update({
        where: { id: 'about' },
        data: {
          publishedSnapshot: draft as unknown as Prisma.InputJsonValue,
          publishedVersion: page.version,
          publishedById: actorId,
          publishedAt,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'ABOUT_PUBLISHED',
          resourceType: 'AboutPage',
          resourceId: 'about',
          oldData: { version: page.publishedVersion },
          newData: { version: page.version },
        },
      });
    });

    return (await this.getPublished()).data;
  }

  async discardDraft(actorId: string): Promise<AboutAdminStateDto> {
    await this.prisma.$transaction(async (tx) => {
      const page = await tx.aboutPage.findUnique({ where: { id: 'about' } });
      if (!page) throw this.notInitialized();
      if (!page.publishedSnapshot) {
        throw new AppException(
          ErrorCode.ABOUT_NOT_PUBLISHED,
          'Chưa có phiên bản đã xuất bản để khôi phục',
          HttpStatus.NOT_FOUND,
        );
      }
      await tx.aboutPage.update({
        where: { id: 'about' },
        data: {
          draftSnapshot: page.publishedSnapshot,
          version: { increment: 1 },
          updatedById: actorId,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'ABOUT_DRAFT_DISCARDED',
          resourceType: 'AboutPage',
          resourceId: 'about',
          oldData: { version: page.version },
          newData: { restoredPublishedVersion: page.publishedVersion },
        },
      });
    });
    return this.getAdminState();
  }

  private async resolveSnapshot(
    snapshot: AboutSnapshot,
    activeOnly: boolean,
    version: number,
    effectiveAt: Date,
    publishedAt: Date | null = effectiveAt,
  ): Promise<AboutResponseDto> {
    const media = await this.repository.findMedia(this.mediaIds(snapshot));
    const urls = new Map(media.map((item) => [item.id, item.originalUrl]));
    const filterSort = <
      T extends { id: string; sortOrder: number; isActive: boolean },
    >(
      items: T[],
    ) =>
      items
        .filter((item) => !activeOnly || item.isActive)
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));

    return {
      id: 'about',
      title: snapshot.title,
      hero: {
        imageUrl: snapshot.hero.mediaId
          ? (urls.get(snapshot.hero.mediaId) ?? '')
          : '',
        imageAlt: snapshot.hero.imageAlt,
      },
      overview: snapshot.overview,
      statistics: filterSort(snapshot.statistics),
      highlightsSectionTitle: snapshot.highlightsSectionTitle,
      highlights: filterSort(snapshot.highlights).map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        imageUrl: item.mediaId ? (urls.get(item.mediaId) ?? '') : '',
        imageAlt: item.imageAlt,
        sortOrder: item.sortOrder,
        isActive: item.isActive,
      })),
      milestonesSectionTitle: snapshot.milestonesSectionTitle,
      milestones: filterSort(snapshot.milestones),
      publishedAt,
      updatedAt: effectiveAt,
      version,
    };
  }

  private normalize(dto: UpdateAboutDto): AboutSnapshot {
    return {
      title: dto.title.trim(),
      hero: {
        mediaId: dto.hero.mediaId ?? null,
        imageAlt: dto.hero.imageAlt.trim(),
      },
      overview: {
        title: dto.overview.title.trim(),
        paragraphs: dto.overview.paragraphs.map((item) => item.trim()),
      },
      statistics: dto.statistics.map((item) => ({
        ...item,
        value: item.value.trim(),
        unit: item.unit.trim(),
        label: item.label.trim(),
      })),
      highlightsSectionTitle: dto.highlightsSectionTitle.trim(),
      highlights: dto.highlights.map((item) => ({
        ...item,
        title: item.title.trim(),
        description: item.description.trim(),
        mediaId: item.mediaId ?? null,
        imageAlt: item.imageAlt.trim(),
      })),
      milestonesSectionTitle: dto.milestonesSectionTitle.trim(),
      milestones: dto.milestones.map((item) => ({
        ...item,
        year: item.year.trim(),
        title: item.title.trim(),
        description: item.description.trim(),
      })),
    };
  }

  private validateContent(snapshot: AboutSnapshot): void {
    const required = [
      snapshot.title,
      snapshot.overview.title,
      snapshot.highlightsSectionTitle,
      snapshot.milestonesSectionTitle,
      ...snapshot.overview.paragraphs,
      ...snapshot.statistics.flatMap((item) => [item.value, item.label]),
      ...snapshot.highlights.flatMap((item) => [item.title, item.description]),
      ...snapshot.milestones.flatMap((item) => [item.year, item.description]),
    ];
    if (required.some((value) => value.trim().length === 0)) {
      throw this.invalidContent('Nội dung bắt buộc không được để trống');
    }
    const allText = [
      ...required,
      snapshot.hero.imageAlt,
      ...snapshot.statistics.map((item) => item.unit),
      ...snapshot.highlights.map((item) => item.imageAlt),
      ...snapshot.milestones.map((item) => item.title),
    ];
    if (allText.some((value) => /<\/?[a-z][^>]*>/i.test(value))) {
      throw this.invalidContent('Nội dung Giới thiệu chỉ hỗ trợ văn bản thuần');
    }
    for (const items of [
      snapshot.statistics,
      snapshot.highlights,
      snapshot.milestones,
    ]) {
      if (new Set(items.map((item) => item.id)).size !== items.length) {
        throw this.invalidContent(
          'ID của các mục nội dung không được trùng nhau',
        );
      }
    }
  }

  private async validateMedia(
    snapshot: AboutSnapshot,
    actorId: string,
    allowAttached: boolean,
  ): Promise<Media[]> {
    const ids = this.mediaIds(snapshot);
    const media = await this.repository.findMedia(ids);
    if (
      media.length !== ids.length ||
      media.some(
        (item) =>
          !item.mimeType.startsWith('image/') ||
          !(
            (allowAttached &&
              item.resourceType === MediaResourceType.ABOUT &&
              item.resourceId === 'about') ||
            (item.ownerId === actorId && item.resourceType === null)
          ),
      )
    ) {
      throw new AppException(
        ErrorCode.INVALID_ABOUT_MEDIA,
        'Ảnh không tồn tại, sai loại hoặc bạn không có quyền sử dụng',
        HttpStatus.BAD_REQUEST,
      );
    }
    return media;
  }

  private async validateMediaInTransaction(
    tx: Prisma.TransactionClient,
    snapshot: AboutSnapshot,
  ): Promise<void> {
    const ids = this.mediaIds(snapshot);
    if (ids.length === 0) return;
    const count = await tx.media.count({
      where: {
        id: { in: ids },
        deletedAt: null,
        mimeType: { startsWith: 'image/' },
        resourceType: MediaResourceType.ABOUT,
        resourceId: 'about',
      },
    });
    if (count !== ids.length) {
      throw new AppException(
        ErrorCode.INVALID_ABOUT_MEDIA,
        'Ảnh của bản nháp không còn hợp lệ',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private mediaIds(snapshot: AboutSnapshot): string[] {
    return [
      ...new Set(
        [
          snapshot.hero.mediaId,
          ...snapshot.highlights.map((item) => item.mediaId),
        ].filter((id): id is string => Boolean(id)),
      ),
    ];
  }

  private toAdminState(page: AboutPage): AboutAdminStateDto {
    const draft = this.readSnapshot(page.draftSnapshot);
    return {
      draft,
      version: page.version,
      publishedVersion: page.publishedVersion,
      publishedAt: page.publishedAt,
      updatedAt: page.updatedAt,
      hasUnpublishedChanges:
        !page.publishedSnapshot ||
        !this.snapshotsEqual(draft, this.readSnapshot(page.publishedSnapshot)),
    };
  }

  private readSnapshot(value: Prisma.JsonValue): AboutSnapshot {
    return value as unknown as AboutSnapshot;
  }

  private snapshotsEqual(a: AboutSnapshot, b: AboutSnapshot): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  private async getPageOrThrow(): Promise<AboutPage> {
    const page = await this.repository.findPage();
    if (!page) throw this.notInitialized();
    return page;
  }

  private notInitialized(): AppException {
    return new AppException(
      ErrorCode.ABOUT_NOT_INITIALIZED,
      'Nội dung Giới thiệu chưa được khởi tạo, hãy chạy seed',
      HttpStatus.NOT_FOUND,
    );
  }

  private invalidContent(message: string): AppException {
    return new AppException(
      ErrorCode.INVALID_ABOUT_CONTENT,
      message,
      HttpStatus.BAD_REQUEST,
    );
  }
}

import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import {
  MediaResourceType,
  MediaStorageProvider as MediaStorageProviderEnum,
  Prisma,
} from '../../../../generated/prisma';
import { ErrorCode } from '../../../common/constants/error-codes.constant';
import { AppException } from '../../../common/exceptions/app.exception';
import type { MediaConfig } from '../../../config/media.config';
import { PrismaService } from '../../../database/prisma.service';
import { MediaEntity } from '../entities/media.entity';
import type { MediaStorageService } from '../providers/storage/media-storage-provider.interface';
import { MEDIA_STORAGE_SERVICE } from '../providers/storage/media-storage.token';
import { MediaRepository } from '../repositories/media.repository';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  detectImageMimeType,
  processUploadedImage,
} from '../utils/image-processing.util';

export interface UploadImageInput {
  ownerId: string;
  buffer: Buffer;
  resourceType?: MediaResourceType;
}

export interface ReleaseSingularMediaInput {
  previousMediaId: string | null;
  nextMediaId: string | null;
  resourceType: MediaResourceType;
  resourceId: string;
}

@Injectable()
export class MediaService {
  constructor(
    private readonly mediaRepository: MediaRepository,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(MEDIA_STORAGE_SERVICE)
    private readonly storageService: MediaStorageService,
  ) {}

  async uploadImage(input: UploadImageInput): Promise<MediaEntity> {
    const mediaConfig = this.configService.getOrThrow<MediaConfig>('media');

    const maxBytes = mediaConfig.maxImageSizeMb * 1024 * 1024;
    if (input.buffer.byteLength > maxBytes) {
      throw new AppException(
        ErrorCode.IMAGE_SIZE_EXCEEDED,
        `Kích thước ảnh vượt quá ${mediaConfig.maxImageSizeMb}MB`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const detectedMime = detectImageMimeType(input.buffer);
    if (!detectedMime || !ALLOWED_IMAGE_MIME_TYPES.has(detectedMime)) {
      throw new AppException(
        ErrorCode.INVALID_IMAGE_FORMAT,
        'Chỉ chấp nhận ảnh định dạng JPG, PNG hoặc WebP',
        HttpStatus.BAD_REQUEST,
      );
    }

    const processed = await processUploadedImage(input.buffer);
    const checksum = createHash('sha256')
      .update(processed.originalBuffer)
      .digest('hex');

    const id = randomUUID();
    const storageKey = `${id}.webp`;
    const thumbnailKey = `${id}-thumb.webp`;

    const stored = await this.storageService.upload({
      storageKey,
      thumbnailKey,
      originalBuffer: processed.originalBuffer,
      thumbnailBuffer: processed.thumbnailBuffer,
      mimeType: 'image/webp',
    });

    const media = await this.mediaRepository.create({
      id,
      ownerId: input.ownerId,
      storageProvider:
        mediaConfig.storageProvider === 's3'
          ? MediaStorageProviderEnum.S3
          : MediaStorageProviderEnum.LOCAL,
      storageKey: stored.storageKey,
      originalUrl: stored.originalUrl,
      thumbnailUrl: stored.thumbnailUrl,
      mimeType: 'image/webp',
      size: processed.originalBuffer.byteLength,
      width: processed.width,
      height: processed.height,
      checksum,
      resourceType: input.resourceType,
    });

    return new MediaEntity(media);
  }

  /**
   * Releases and soft-deletes the previous media of a single-image "claim" field
   * (mediaId/imageAlt pattern) when it's being replaced or cleared. Must run inside
   * the caller's transaction so it stays atomic with the parent record's update.
   * Returns the released media id (to purge storage for) or null if nothing changed.
   */
  async releaseSingularMedia(
    tx: Prisma.TransactionClient,
    input: ReleaseSingularMediaInput,
  ): Promise<string | null> {
    const { previousMediaId, nextMediaId, resourceType, resourceId } = input;
    if (!previousMediaId || previousMediaId === nextMediaId) return null;
    const released = await tx.media.updateMany({
      where: { id: previousMediaId, resourceType, resourceId },
      data: { resourceType: null, resourceId: null, deletedAt: new Date() },
    });
    return released.count > 0 ? previousMediaId : null;
  }

  /**
   * Soft-deletes media ids detached from a multi-image join table, but only the
   * ones with no remaining reference anywhere else — these tables have no
   * exclusive "claim", so the same media id could still be attached elsewhere.
   * Returns the ids actually deleted (to purge storage for).
   */
  async pruneDetachedMedia(removedMediaIds: string[]): Promise<string[]> {
    if (removedMediaIds.length === 0) return [];
    const checks = await Promise.all(
      removedMediaIds.map(async (id) => {
        const [tradePostImage, tradeReviewImage, businessDoc, media] =
          await Promise.all([
            this.prisma.tradePostImage.count({ where: { mediaId: id } }),
            this.prisma.tradeReviewImage.count({ where: { mediaId: id } }),
            this.prisma.businessApplicationDocument.count({
              where: { mediaId: id },
            }),
            this.prisma.media.findUnique({
              where: { id },
              select: { resourceType: true, deletedAt: true },
            }),
          ]);
        const referenced =
          tradePostImage > 0 ||
          tradeReviewImage > 0 ||
          businessDoc > 0 ||
          media?.resourceType !== null;
        return { id, shouldDelete: !referenced && !media?.deletedAt };
      }),
    );
    const toDelete = checks
      .filter((check) => check.shouldDelete)
      .map((check) => check.id);
    if (toDelete.length > 0) {
      await this.prisma.media.updateMany({
        where: { id: { in: toDelete } },
        data: { deletedAt: new Date() },
      });
    }
    return toDelete;
  }

  /** Physically deletes the storage files of already soft-deleted media. Best-effort. */
  async purgeStorage(
    mediaIds: Array<string | null | undefined>,
  ): Promise<void> {
    const ids = [...new Set(mediaIds.filter((id): id is string => !!id))];
    if (ids.length === 0) return;
    const records = await this.mediaRepository.findRawByIds(ids);
    await Promise.all(
      records.map((record) =>
        this.storageService.delete(
          record.storageKey,
          this.thumbnailKeyFor(record.storageKey),
        ),
      ),
    );
  }

  private thumbnailKeyFor(storageKey: string): string {
    return storageKey.replace(/\.webp$/, '-thumb.webp');
  }
}

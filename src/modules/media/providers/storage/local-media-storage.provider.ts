import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { constants as fsConstants } from 'node:fs';
import { access, mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { AppConfig } from '../../../../config/app.config';
import type { MediaConfig } from '../../../../config/media.config';
import type {
  MediaStorageService,
  StoredMedia,
  UploadMediaInput,
} from './media-storage-provider.interface';

@Injectable()
export class LocalMediaStorageService implements MediaStorageService {
  private readonly imagesDir: string;
  private readonly publicBaseUrl: string;

  constructor(configService: ConfigService) {
    const mediaConfig = configService.getOrThrow<MediaConfig>('media');
    const appConfig = configService.getOrThrow<AppConfig>('app');
    this.imagesDir = join(process.cwd(), mediaConfig.uploadDir, 'images');
    this.publicBaseUrl = appConfig.publicBaseUrl.replace(/\/$/, '');
  }

  async upload(input: UploadMediaInput): Promise<StoredMedia> {
    await mkdir(this.imagesDir, { recursive: true });

    // storageKey/thumbnailKey are always server-generated UUIDs, never
    // derived from client input — basename() is defense in depth against
    // path traversal regardless.
    const safeKey = basename(input.storageKey);
    const safeThumbKey = basename(input.thumbnailKey);

    await writeFile(join(this.imagesDir, safeKey), input.originalBuffer);
    await writeFile(join(this.imagesDir, safeThumbKey), input.thumbnailBuffer);

    return {
      storageKey: safeKey,
      originalUrl: `${this.publicBaseUrl}/uploads/images/${safeKey}`,
      thumbnailUrl: `${this.publicBaseUrl}/uploads/images/${safeThumbKey}`,
    };
  }

  async delete(storageKey: string, thumbnailKey?: string): Promise<void> {
    const safeKey = basename(storageKey);
    await unlink(join(this.imagesDir, safeKey)).catch(() => undefined);
    if (thumbnailKey) {
      const safeThumbKey = basename(thumbnailKey);
      await unlink(join(this.imagesDir, safeThumbKey)).catch(() => undefined);
    }
  }

  async exists(storageKey: string): Promise<boolean> {
    const safeKey = basename(storageKey);
    return access(join(this.imagesDir, safeKey), fsConstants.F_OK)
      .then(() => true)
      .catch(() => false);
  }
}

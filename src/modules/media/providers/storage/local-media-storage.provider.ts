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
  private readonly videosDir: string;
  private readonly publicBaseUrl: string;

  constructor(configService: ConfigService) {
    const mediaConfig = configService.getOrThrow<MediaConfig>('media');
    const appConfig = configService.getOrThrow<AppConfig>('app');
    this.imagesDir = join(process.cwd(), mediaConfig.uploadDir, 'images');
    this.videosDir = join(process.cwd(), mediaConfig.uploadDir, 'videos');
    this.publicBaseUrl = appConfig.publicBaseUrl.replace(/\/$/, '');
  }

  private dirFor(mimeType: string): { dir: string; segment: string } {
    return mimeType.startsWith('video/')
      ? { dir: this.videosDir, segment: 'videos' }
      : { dir: this.imagesDir, segment: 'images' };
  }

  async upload(input: UploadMediaInput): Promise<StoredMedia> {
    const { dir, segment } = this.dirFor(input.mimeType);
    await mkdir(dir, { recursive: true });

    // storageKey/thumbnailKey are always server-generated UUIDs, never
    // derived from client input — basename() is defense in depth against
    // path traversal regardless.
    const safeKey = basename(input.storageKey);
    await writeFile(join(dir, safeKey), input.originalBuffer);

    let thumbnailUrl: string | undefined;
    if (input.thumbnailKey && input.thumbnailBuffer) {
      const safeThumbKey = basename(input.thumbnailKey);
      await writeFile(join(dir, safeThumbKey), input.thumbnailBuffer);
      thumbnailUrl = `${this.publicBaseUrl}/uploads/${segment}/${safeThumbKey}`;
    }

    return {
      storageKey: safeKey,
      originalUrl: `${this.publicBaseUrl}/uploads/${segment}/${safeKey}`,
      thumbnailUrl,
    };
  }

  async delete(storageKey: string, thumbnailKey?: string): Promise<void> {
    // deletion doesn't know the mime type any more, so try both dirs —
    // unlink() on a missing path is swallowed either way.
    for (const dir of [this.imagesDir, this.videosDir]) {
      const safeKey = basename(storageKey);
      await unlink(join(dir, safeKey)).catch(() => undefined);
      if (thumbnailKey) {
        const safeThumbKey = basename(thumbnailKey);
        await unlink(join(dir, safeThumbKey)).catch(() => undefined);
      }
    }
  }

  async exists(storageKey: string): Promise<boolean> {
    const safeKey = basename(storageKey);
    for (const dir of [this.imagesDir, this.videosDir]) {
      const found = await access(join(dir, safeKey), fsConstants.F_OK)
        .then(() => true)
        .catch(() => false);
      if (found) return true;
    }
    return false;
  }
}

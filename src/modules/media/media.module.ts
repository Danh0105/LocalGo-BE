import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import type { MediaConfig } from '../../config/media.config';
import { MediaController } from './controllers/media.controller';
import { LocalMediaStorageService } from './providers/storage/local-media-storage.provider';
import { MEDIA_STORAGE_SERVICE } from './providers/storage/media-storage.token';
import { MediaRepository } from './repositories/media.repository';
import { MediaService } from './services/media.service';
import { BoundedMemoryStorage } from './providers/bounded-memory.storage';

@Module({
  imports: [
    MulterModule.registerAsync({
      useFactory: (configService: ConfigService) => {
        const mediaConfig = configService.getOrThrow<MediaConfig>('media');
        // Sized for the largest accepted upload (feedback-ticket video
        // attachments); per-type limits are still enforced in MediaService
        // after the buffer is read.
        const maxBytes =
          Math.max(mediaConfig.maxImageSizeMb, mediaConfig.maxVideoSizeMb) *
          1024 *
          1024;
        return {
          storage: new BoundedMemoryStorage(
            Number(configService.get('MAX_UPLOAD_TOTAL_MB', 64)) * 1024 * 1024,
          ),
          limits: {
            fileSize: maxBytes,
            files: 20,
            fields: 32,
            fieldSize: 64 * 1024,
            parts: 52,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [MediaController],
  providers: [
    MediaRepository,
    MediaService,
    {
      provide: MEDIA_STORAGE_SERVICE,
      useFactory: (configService: ConfigService) => {
        const mediaConfig = configService.getOrThrow<MediaConfig>('media');
        if (mediaConfig.storageProvider === 'local') {
          return new LocalMediaStorageService(configService);
        }
        throw new Error(
          'MEDIA_STORAGE_PROVIDER=s3 chưa được triển khai ở Phase 1',
        );
      },
      inject: [ConfigService],
    },
  ],
  // Share the same bounds with feedback and business document interceptors.
  exports: [MediaService, MulterModule],
})
export class MediaModule {}

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { MediaConfig } from '../../config/media.config';
import { MediaController } from './controllers/media.controller';
import { LocalMediaStorageService } from './providers/storage/local-media-storage.provider';
import { MEDIA_STORAGE_SERVICE } from './providers/storage/media-storage.token';
import { MediaRepository } from './repositories/media.repository';
import { MediaService } from './services/media.service';

@Module({
  imports: [
    MulterModule.registerAsync({
      useFactory: (configService: ConfigService) => {
        const mediaConfig = configService.getOrThrow<MediaConfig>('media');
        return {
          storage: memoryStorage(),
          limits: { fileSize: mediaConfig.maxImageSizeMb * 1024 * 1024 },
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
  exports: [MediaService],
})
export class MediaModule {}

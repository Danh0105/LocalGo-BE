import { registerAs } from '@nestjs/config';

export interface MediaConfig {
  storageProvider: 'local' | 's3';
  uploadDir: string;
  maxImageSizeMb: number;
}

export default registerAs('media', (): MediaConfig => ({
  storageProvider:
    (process.env.MEDIA_STORAGE_PROVIDER as 'local' | 's3') ?? 'local',
  uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
  maxImageSizeMb: Number(process.env.MAX_IMAGE_SIZE_MB ?? 5),
}));

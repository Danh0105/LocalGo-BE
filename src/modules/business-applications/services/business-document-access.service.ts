import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { basename, join } from 'node:path';
import type { AppConfig } from '../../../config/app.config';
import type { JwtConfig } from '../../../config/jwt.config';
import type { MediaConfig } from '../../../config/media.config';
import { ErrorCode } from '../../../common/constants/error-codes.constant';
import { AppException } from '../../../common/exceptions/app.exception';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class BusinessDocumentAccessService {
  private readonly secret: string;
  private readonly baseUrl: string;
  private readonly uploadDir: string;

  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.secret = configService.getOrThrow<JwtConfig>('jwt').accessSecret;
    this.baseUrl = configService
      .getOrThrow<AppConfig>('app')
      .publicBaseUrl.replace(/\/$/, '');
    this.uploadDir = configService.getOrThrow<MediaConfig>('media').uploadDir;
  }

  createSignedUrl(documentId: string): string {
    const expiresAt = Math.floor(Date.now() / 1000) + 5 * 60;
    const payload = `${documentId}.${expiresAt}`;
    const signature = this.sign(payload);
    return `${this.baseUrl}/api/v1/business-application-documents/${documentId}?expires=${expiresAt}&signature=${signature}`;
  }

  async resolveDownload(
    documentId: string,
    expires: number,
    signature: string,
  ) {
    const payload = `${documentId}.${expires}`;
    const expected = Buffer.from(this.sign(payload));
    const actual = Buffer.from(signature || '');
    if (
      !Number.isInteger(expires) ||
      expires < Math.floor(Date.now() / 1000) ||
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      throw new AppException(
        ErrorCode.FORBIDDEN,
        'Liên kết tài liệu không hợp lệ hoặc đã hết hạn',
        HttpStatus.FORBIDDEN,
      );
    }
    const document = await this.prisma.businessApplicationDocument.findUnique({
      where: { id: documentId },
      include: { media: true },
    });
    if (!document || document.media.deletedAt) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không tìm thấy tài liệu',
        HttpStatus.NOT_FOUND,
      );
    }
    return {
      filePath: join(
        process.cwd(),
        this.uploadDir,
        'images',
        basename(document.media.storageKey),
      ),
      mimeType: document.media.mimeType,
      name: basename(document.name),
    };
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.secret)
      .update(payload)
      .digest('base64url');
  }
}

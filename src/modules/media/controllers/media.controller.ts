import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { MediaResponseDto } from '../dto/media-response.dto';
import { MediaService } from '../services/media.service';

const MAX_BATCH_IMAGE_UPLOADS = 10;

@ApiTags('media')
@ApiBearerAuth()
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Tải lên một ảnh (JPG/PNG/WebP)' })
  @ApiConsumes('multipart/form-data')
  @Post('images')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MediaResponseDto> {
    if (!file) {
      throw new BadRequestException('Không có file được tải lên');
    }
    const media = await this.mediaService.uploadImage({
      ownerId: user.id,
      buffer: file.buffer,
    });
    return MediaResponseDto.fromEntity(media);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: `Tải lên nhiều ảnh cùng lúc (tối đa ${MAX_BATCH_IMAGE_UPLOADS} ảnh JPG/PNG/WebP)`,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: {
          type: 'array',
          maxItems: MAX_BATCH_IMAGE_UPLOADS,
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @Post('images/batch')
  @UseInterceptors(FilesInterceptor('files', MAX_BATCH_IMAGE_UPLOADS))
  async uploadImages(
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MediaResponseDto[]> {
    if (!files?.length) {
      throw new BadRequestException('Không có file nào được tải lên');
    }

    const media = await Promise.all(
      files.map((file) =>
        this.mediaService.uploadImage({
          ownerId: user.id,
          buffer: file.buffer,
        }),
      ),
    );
    return media.map((item) => MediaResponseDto.fromEntity(item));
  }
}

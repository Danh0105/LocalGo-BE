import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { MediaResponseDto } from '../dto/media-response.dto';
import { MediaService } from '../services/media.service';

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
}

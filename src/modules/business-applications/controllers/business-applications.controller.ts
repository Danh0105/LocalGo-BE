import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { MediaResponseDto } from '../../media/dto/media-response.dto';
import { MediaService } from '../../media/services/media.service';
import { BusinessApplicationResponseDto } from '../dto/business-application-response.dto';
import { BusinessTypeResponseDto } from '../dto/business-type-response.dto';
import { CheckBusinessApplicationDto } from '../dto/check-business-application.dto';
import { CheckBusinessApplicationResponseDto } from '../dto/check-business-application-response.dto';
import { SubmitBusinessApplicationRequestDto } from '../dto/submit-business-application-request.dto';
import { UpsertBusinessApplicationDto } from '../dto/upsert-business-application.dto';
import { BusinessApplicationService } from '../services/business-application.service';

@ApiTags('business-applications')
@ApiBearerAuth()
@Controller('business-applications')
export class BusinessApplicationsController {
  constructor(
    private readonly service: BusinessApplicationService,
    private readonly mediaService: MediaService,
  ) {}

  @Public()
  @Get('business-types')
  @ApiOperation({
    summary: 'Danh sách loại hình đăng ký và trường/giấy tờ cần cho từng loại',
    description:
      'Dùng để dựng form đăng ký theo loại hình (Ban quản lý đền/miếu, nhà hàng, khách sạn, chủ vườn, khác) và biết loại tin (có lợi nhuận / phi lợi nhuận) mỗi loại hình được đăng.',
  })
  listBusinessTypes(): BusinessTypeResponseDto[] {
    return BusinessTypeResponseDto.all();
  }

  @Public()
  @Get('check')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Kiểm tra theo Zalo ID xem đã nộp hồ sơ Business hay chưa (dùng để điều hướng UI)',
  })
  async check(
    @Query() query: CheckBusinessApplicationDto,
  ): Promise<CheckBusinessApplicationResponseDto> {
    return this.service.checkByZaloId(query.zaloId);
  }

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Nộp hồ sơ đăng ký tài khoản BUSINESS' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertBusinessApplicationDto,
  ) {
    return BusinessApplicationResponseDto.fromEntity(
      await this.service.create(user.id, dto),
    );
  }

  @Public()
  @Post('requests')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Gửi yêu cầu đăng ký BUSINESS khi chưa có tài khoản',
  })
  async createAnonymous(@Body() dto: SubmitBusinessApplicationRequestDto) {
    return BusinessApplicationResponseDto.fromEntity(
      await this.service.createAnonymous(dto),
    );
  }

  @Public()
  @Post('request-documents')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Tải giấy tờ cho yêu cầu đăng ký công khai (tối đa 20 tệp JPG/PNG/WebP/PDF)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: {
          type: 'array',
          maxItems: 20,
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiResponse({ status: 201, type: [MediaResponseDto] })
  @UseInterceptors(FilesInterceptor('files', 20))
  async uploadRequestDocuments(
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ): Promise<MediaResponseDto[]> {
    if (!files?.length) {
      throw new BadRequestException('Không có tài liệu nào được tải lên');
    }
    const result: MediaResponseDto[] = [];
    for (const file of files) {
      const buffer = file.buffer;
      try {
        const media = await this.mediaService.uploadBusinessApplicationDocument(
          { buffer },
        );
        result.push(MediaResponseDto.fromEntity(media));
      } finally {
        file.buffer = Buffer.alloc(0);
      }
    }
    return result;
  }

  @Get('me')
  @ApiOperation({ summary: 'Hồ sơ BUSINESS mới nhất của người dùng hiện tại' })
  async getMine(@CurrentUser() user: AuthenticatedUser) {
    return BusinessApplicationResponseDto.fromEntity(
      await this.service.getMine(user.id),
    );
  }

  @Patch(':id')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Chỉnh sửa và gửi lại hồ sơ BUSINESS bị từ chối' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpsertBusinessApplicationDto,
  ) {
    return BusinessApplicationResponseDto.fromEntity(
      await this.service.update(user.id, id, dto),
    );
  }
}

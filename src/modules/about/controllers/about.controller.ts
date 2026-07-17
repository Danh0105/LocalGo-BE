import { Controller, Get, Headers, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { AboutResponseDto } from '../dto/about-response.dto';
import { AboutService } from '../services/about.service';

@ApiTags('about')
@Controller('about')
export class AboutController {
  constructor(private readonly service: AboutService) {}

  @Public()
  @Get()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Nội dung Giới thiệu đã xuất bản' })
  @ApiResponse({ status: 200, type: AboutResponseDto })
  @ApiResponse({ status: 404, description: 'ABOUT_NOT_PUBLISHED' })
  async getPublished(
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AboutResponseDto | void> {
    const result = await this.service.getPublished();
    response.setHeader('ETag', result.etag);
    response.setHeader('Cache-Control', 'public, max-age=60, must-revalidate');
    if (ifNoneMatch === result.etag) {
      response.status(304).end();
      return;
    }
    return result.data;
  }
}

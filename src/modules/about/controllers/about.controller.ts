import { Controller, Get, Res } from '@nestjs/common';
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
    @Res({ passthrough: true }) response: Response,
  ): Promise<AboutResponseDto> {
    const result = await this.service.getPublished();
    // Express answers 304 itself when If-None-Match matches this ETag
    // (req.fresh in res.send); ending the response here would make Nest's
    // passthrough reply write a second time.
    response.setHeader('ETag', result.etag);
    response.setHeader('Cache-Control', 'public, max-age=60, must-revalidate');
    return result.data;
  }
}

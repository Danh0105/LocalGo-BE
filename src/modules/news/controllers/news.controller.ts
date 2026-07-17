import { Controller, Get, Headers, Param, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { QueryNewsPublicDto } from '../dto/query-news.dto';
import {
  NewsArticleListItemResponseDto,
  NewsArticleResponseDto,
} from '../dto/news-response.dto';
import { NewsService } from '../services/news.service';

@ApiTags('news')
@Controller('news')
export class NewsController {
  constructor(private readonly service: NewsService) {}

  @Public()
  @Get()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Danh sách tin tức đang hiển thị, đã đến giờ đăng, sắp theo publishedAt',
  })
  @ApiResponse({ status: 200, type: [NewsArticleListItemResponseDto] })
  list(@Query() query: QueryNewsPublicDto) {
    return this.service.publicList(query);
  }

  @Public()
  @Get(':id')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Chi tiết một bài tin tức đang hiển thị' })
  @ApiResponse({ status: 200, type: NewsArticleResponseDto })
  @ApiResponse({ status: 404, description: 'NEWS_ARTICLE_NOT_FOUND' })
  async detail(
    @Param('id') id: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<NewsArticleResponseDto | void> {
    const data = await this.service.publicDetail(id);
    const etag = `"news-${data.id}-${data.updatedAt.getTime()}"`;
    response.setHeader('ETag', etag);
    response.setHeader('Cache-Control', 'public, max-age=60, must-revalidate');
    if (ifNoneMatch === etag) {
      response.status(304).end();
      return;
    }
    return data;
  }
}

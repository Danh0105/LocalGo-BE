import { Controller, Get, Headers, Param, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { QueryHistoricalSitePublicDto } from '../dto/query-historical-site.dto';
import {
  HistoricalSiteListItemResponseDto,
  HistoricalSiteResponseDto,
} from '../dto/historical-site-response.dto';
import { HistoricalSiteService } from '../services/historical-site.service';

@ApiTags('historical-sites')
@Controller('historical-sites')
export class HistoricalSitesController {
  constructor(private readonly service: HistoricalSiteService) {}

  @Public()
  @Get()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Danh sách di tích lịch sử đang hiển thị' })
  @ApiResponse({ status: 200, type: [HistoricalSiteListItemResponseDto] })
  list(
    @Query() query: QueryHistoricalSitePublicDto,
  ): Promise<HistoricalSiteListItemResponseDto[]> {
    return this.service.publicList(query);
  }

  @Public()
  @Get(':id')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Chi tiết một di tích lịch sử đang hiển thị' })
  @ApiResponse({ status: 200, type: HistoricalSiteResponseDto })
  @ApiResponse({ status: 404, description: 'HISTORICAL_SITE_NOT_FOUND' })
  async detail(
    @Param('id') id: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<HistoricalSiteResponseDto | void> {
    const data = await this.service.publicDetail(id);
    const etag = `"historical-site-${data.id}-${data.updatedAt.getTime()}"`;
    response.setHeader('ETag', etag);
    response.setHeader('Cache-Control', 'public, max-age=60, must-revalidate');
    if (ifNoneMatch === etag) {
      response.status(304).end();
      return;
    }
    return data;
  }
}

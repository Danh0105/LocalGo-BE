import { Controller, Get, Headers, Param, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { QueryAgriculturePublicDto } from '../dto/query-agriculture.dto';
import {
  AgricultureListItemResponseDto,
  AgricultureResponseDto,
} from '../dto/agriculture-response.dto';
import { AgricultureService } from '../services/agriculture.service';

@ApiTags('agriculture')
@Controller('agriculture')
export class AgricultureController {
  constructor(private readonly service: AgricultureService) {}

  @Public()
  @Get()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Danh sách nội dung nông nghiệp đang hiển thị' })
  @ApiResponse({ status: 200, type: [AgricultureListItemResponseDto] })
  list(
    @Query() query: QueryAgriculturePublicDto,
  ): Promise<AgricultureListItemResponseDto[]> {
    return this.service.publicList(query);
  }

  @Public()
  @Get(':id')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Chi tiết một mục nông nghiệp đang hiển thị' })
  @ApiResponse({ status: 200, type: AgricultureResponseDto })
  @ApiResponse({ status: 404, description: 'AGRICULTURE_ITEM_NOT_FOUND' })
  async detail(
    @Param('id') id: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AgricultureResponseDto | void> {
    const data = await this.service.publicDetail(id);
    const etag = `"agriculture-${data.id}-${data.updatedAt.getTime()}"`;
    response.setHeader('ETag', etag);
    response.setHeader('Cache-Control', 'public, max-age=60, must-revalidate');
    if (ifNoneMatch === etag) {
      response.status(304).end();
      return;
    }
    return data;
  }
}

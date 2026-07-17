import { Controller, Get, Headers, Param, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { QueryFestivalPublicDto } from '../dto/query-festival.dto';
import {
  FestivalListItemResponseDto,
  FestivalResponseDto,
} from '../dto/festival-response.dto';
import { FestivalService } from '../services/festival.service';

@ApiTags('festivals')
@Controller('festivals')
export class FestivalsController {
  constructor(private readonly service: FestivalService) {}

  @Public()
  @Get()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Danh sách lễ hội đang hiển thị' })
  @ApiResponse({ status: 200, type: [FestivalListItemResponseDto] })
  list(
    @Query() query: QueryFestivalPublicDto,
  ): Promise<FestivalListItemResponseDto[]> {
    return this.service.publicList(query);
  }

  @Public()
  @Get(':id')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Chi tiết một lễ hội đang hiển thị' })
  @ApiResponse({ status: 200, type: FestivalResponseDto })
  @ApiResponse({ status: 404, description: 'FESTIVAL_NOT_FOUND' })
  async detail(
    @Param('id') id: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<FestivalResponseDto | void> {
    const data = await this.service.publicDetail(id);
    const etag = `"festival-${data.id}-${data.updatedAt.getTime()}"`;
    response.setHeader('ETag', etag);
    response.setHeader('Cache-Control', 'public, max-age=60, must-revalidate');
    if (ifNoneMatch === etag) {
      response.status(304).end();
      return;
    }
    return data;
  }
}

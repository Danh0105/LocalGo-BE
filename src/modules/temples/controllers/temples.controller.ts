import { Controller, Get, Headers, Param, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { QueryTemplePublicDto } from '../dto/query-temple.dto';
import {
  TempleListItemResponseDto,
  TempleResponseDto,
} from '../dto/temple-response.dto';
import { TempleService } from '../services/temple.service';

@ApiTags('temples')
@Controller('temples')
export class TemplesController {
  constructor(private readonly service: TempleService) {}

  @Public()
  @Get()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Danh sách Đền - Chùa - Miếu đang hiển thị' })
  @ApiResponse({ status: 200, type: [TempleListItemResponseDto] })
  list(
    @Query() query: QueryTemplePublicDto,
  ): Promise<TempleListItemResponseDto[]> {
    return this.service.publicList(query);
  }

  @Public()
  @Get(':id')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Chi tiết một Đền - Chùa - Miếu đang hiển thị' })
  @ApiResponse({ status: 200, type: TempleResponseDto })
  @ApiResponse({ status: 404, description: 'TEMPLE_NOT_FOUND' })
  async detail(
    @Param('id') id: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TempleResponseDto | void> {
    const data = await this.service.publicDetail(id);
    const etag = `"temple-${data.id}-${data.updatedAt.getTime()}"`;
    response.setHeader('ETag', etag);
    response.setHeader('Cache-Control', 'public, max-age=60, must-revalidate');
    if (ifNoneMatch === etag) {
      response.status(304).end();
      return;
    }
    return data;
  }
}

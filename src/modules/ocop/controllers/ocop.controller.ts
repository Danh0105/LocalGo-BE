import { Controller, Get, Headers, Param, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { QueryOcopPublicDto } from '../dto/query-ocop.dto';
import {
  OcopListItemResponseDto,
  OcopResponseDto,
} from '../dto/ocop-response.dto';
import { OcopService } from '../services/ocop.service';

@ApiTags('ocop')
@Controller('ocop')
export class OcopController {
  constructor(private readonly service: OcopService) {}

  @Public()
  @Get()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Danh sách sản phẩm OCOP đang hiển thị' })
  @ApiResponse({ status: 200, type: [OcopListItemResponseDto] })
  list(@Query() query: QueryOcopPublicDto): Promise<OcopListItemResponseDto[]> {
    return this.service.publicList(query);
  }

  @Public()
  @Get(':id')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Chi tiết một sản phẩm OCOP đang hiển thị' })
  @ApiResponse({ status: 200, type: OcopResponseDto })
  @ApiResponse({ status: 404, description: 'OCOP_PRODUCT_NOT_FOUND' })
  async detail(
    @Param('id') id: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<OcopResponseDto | void> {
    const data = await this.service.publicDetail(id);
    const etag = `"ocop-${data.id}-${data.updatedAt.getTime()}"`;
    response.setHeader('ETag', etag);
    response.setHeader('Cache-Control', 'public, max-age=60, must-revalidate');
    if (ifNoneMatch === etag) {
      response.status(304).end();
      return;
    }
    return data;
  }
}

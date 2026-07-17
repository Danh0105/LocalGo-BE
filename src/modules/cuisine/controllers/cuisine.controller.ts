import { Controller, Get, Headers, Param, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { QueryCuisinePublicDto } from '../dto/query-cuisine.dto';
import {
  CuisineListItemResponseDto,
  CuisineResponseDto,
} from '../dto/cuisine-response.dto';
import { CuisineService } from '../services/cuisine.service';

@ApiTags('cuisine')
@Controller('cuisine')
export class CuisineController {
  constructor(private readonly service: CuisineService) {}

  @Public()
  @Get()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Danh sách món ăn đang hiển thị' })
  @ApiResponse({ status: 200, type: [CuisineListItemResponseDto] })
  list(
    @Query() query: QueryCuisinePublicDto,
  ): Promise<CuisineListItemResponseDto[]> {
    return this.service.publicList(query);
  }

  @Public()
  @Get(':id')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Chi tiết một món ăn đang hiển thị' })
  @ApiResponse({ status: 200, type: CuisineResponseDto })
  @ApiResponse({ status: 404, description: 'CUISINE_ITEM_NOT_FOUND' })
  async detail(
    @Param('id') id: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CuisineResponseDto | void> {
    const data = await this.service.publicDetail(id);
    const etag = `"cuisine-${data.id}-${data.updatedAt.getTime()}"`;
    response.setHeader('ETag', etag);
    response.setHeader('Cache-Control', 'public, max-age=60, must-revalidate');
    if (ifNoneMatch === etag) {
      response.status(304).end();
      return;
    }
    return data;
  }
}

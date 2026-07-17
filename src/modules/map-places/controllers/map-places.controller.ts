import { Controller, Get, Headers, Param, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { QueryMapPlacePublicDto } from '../dto/query-map-place.dto';
import {
  MapPlaceListItemResponseDto,
  MapPlaceResponseDto,
} from '../dto/map-place-response.dto';
import { MapPlaceService } from '../services/map-place.service';

@ApiTags('map-places')
@Controller('map-places')
export class MapPlacesController {
  constructor(private readonly service: MapPlaceService) {}

  @Public()
  @Get()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Danh sách điểm bản đồ đang hiển thị' })
  @ApiResponse({ status: 200, type: [MapPlaceListItemResponseDto] })
  list(
    @Query() query: QueryMapPlacePublicDto,
  ): Promise<MapPlaceListItemResponseDto[]> {
    return this.service.publicList(query);
  }

  @Public()
  @Get(':id')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Chi tiết một điểm bản đồ đang hiển thị' })
  @ApiResponse({ status: 200, type: MapPlaceResponseDto })
  @ApiResponse({ status: 404, description: 'MAP_PLACE_NOT_FOUND' })
  async detail(
    @Param('id') id: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MapPlaceResponseDto | void> {
    const data = await this.service.publicDetail(id);
    const etag = `"map-place-${data.id}-${data.updatedAt.getTime()}"`;
    response.setHeader('ETag', etag);
    response.setHeader('Cache-Control', 'public, max-age=60, must-revalidate');
    if (ifNoneMatch === etag) {
      response.status(304).end();
      return;
    }
    return data;
  }
}

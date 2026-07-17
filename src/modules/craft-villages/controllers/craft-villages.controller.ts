import { Controller, Get, Headers, Param, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { QueryCraftVillagePublicDto } from '../dto/query-craft-village.dto';
import {
  CraftVillageListItemResponseDto,
  CraftVillageResponseDto,
} from '../dto/craft-village-response.dto';
import { CraftVillageService } from '../services/craft-village.service';

@ApiTags('craft-villages')
@Controller('craft-villages')
export class CraftVillagesController {
  constructor(private readonly service: CraftVillageService) {}

  @Public()
  @Get()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Danh sách làng nghề đang hiển thị' })
  @ApiResponse({ status: 200, type: [CraftVillageListItemResponseDto] })
  list(
    @Query() query: QueryCraftVillagePublicDto,
  ): Promise<CraftVillageListItemResponseDto[]> {
    return this.service.publicList(query);
  }

  @Public()
  @Get(':id')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Chi tiết một làng nghề đang hiển thị' })
  @ApiResponse({ status: 200, type: CraftVillageResponseDto })
  @ApiResponse({ status: 404, description: 'CRAFT_VILLAGE_NOT_FOUND' })
  async detail(
    @Param('id') id: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CraftVillageResponseDto | void> {
    const data = await this.service.publicDetail(id);
    const etag = `"craft-village-${data.id}-${data.updatedAt.getTime()}"`;
    response.setHeader('ETag', etag);
    response.setHeader('Cache-Control', 'public, max-age=60, must-revalidate');
    if (ifNoneMatch === etag) {
      response.status(304).end();
      return;
    }
    return data;
  }
}

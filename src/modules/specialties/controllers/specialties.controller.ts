import { Controller, Get, Headers, Param, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { QuerySpecialtyPublicDto } from '../dto/query-specialty.dto';
import {
  SpecialtyListItemResponseDto,
  SpecialtyResponseDto,
} from '../dto/specialty-response.dto';
import { SpecialtyService } from '../services/specialty.service';

@ApiTags('specialties')
@Controller('specialties')
export class SpecialtiesController {
  constructor(private readonly service: SpecialtyService) {}

  @Public()
  @Get()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Danh sách đặc sản đang hiển thị' })
  @ApiResponse({ status: 200, type: [SpecialtyListItemResponseDto] })
  list(
    @Query() query: QuerySpecialtyPublicDto,
  ): Promise<SpecialtyListItemResponseDto[]> {
    return this.service.publicList(query);
  }

  @Public()
  @Get(':id')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Chi tiết một đặc sản đang hiển thị' })
  @ApiResponse({ status: 200, type: SpecialtyResponseDto })
  @ApiResponse({ status: 404, description: 'SPECIALTY_NOT_FOUND' })
  async detail(
    @Param('id') id: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SpecialtyResponseDto | void> {
    const data = await this.service.publicDetail(id);
    const etag = `"specialty-${data.id}-${data.updatedAt.getTime()}"`;
    response.setHeader('ETag', etag);
    response.setHeader('Cache-Control', 'public, max-age=60, must-revalidate');
    if (ifNoneMatch === etag) {
      response.status(304).end();
      return;
    }
    return data;
  }
}

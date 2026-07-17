import { Controller, Get, Headers, Param, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { QueryExperienceTourPublicDto } from '../dto/query-experience-tour.dto';
import {
  ExperienceTourListItemResponseDto,
  ExperienceTourResponseDto,
} from '../dto/experience-tour-response.dto';
import { ExperienceTourService } from '../services/experience-tour.service';

@ApiTags('experience-tours')
@Controller('experience-tours')
export class ExperienceToursController {
  constructor(private readonly service: ExperienceTourService) {}

  @Public()
  @Get()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Danh sách tour trải nghiệm đang hiển thị' })
  @ApiResponse({ status: 200, type: [ExperienceTourListItemResponseDto] })
  list(
    @Query() query: QueryExperienceTourPublicDto,
  ): Promise<ExperienceTourListItemResponseDto[]> {
    return this.service.publicList(query);
  }

  @Public()
  @Get(':id')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Chi tiết một tour trải nghiệm đang hiển thị' })
  @ApiResponse({ status: 200, type: ExperienceTourResponseDto })
  @ApiResponse({ status: 404, description: 'EXPERIENCE_TOUR_NOT_FOUND' })
  async detail(
    @Param('id') id: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ExperienceTourResponseDto | void> {
    const data = await this.service.publicDetail(id);
    const etag = `"experience-tour-${data.id}-${data.updatedAt.getTime()}"`;
    response.setHeader('ETag', etag);
    response.setHeader('Cache-Control', 'public, max-age=60, must-revalidate');
    if (ifNoneMatch === etag) {
      response.status(304).end();
      return;
    }
    return data;
  }
}

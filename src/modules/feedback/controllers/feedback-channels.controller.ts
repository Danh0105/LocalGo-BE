import { Controller, Get, Headers, Param, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { QueryFeedbackChannelPublicDto } from '../dto/query-feedback-channel.dto';
import {
  FeedbackChannelListItemResponseDto,
  FeedbackChannelResponseDto,
} from '../dto/feedback-channel-response.dto';
import { FeedbackChannelService } from '../services/feedback-channel.service';

@ApiTags('feedback-channels')
@Controller('feedback/channels')
export class FeedbackChannelsController {
  constructor(private readonly service: FeedbackChannelService) {}

  @Public()
  @Get()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Danh sách kênh phản hồi đang hiển thị' })
  @ApiResponse({ status: 200, type: [FeedbackChannelListItemResponseDto] })
  list(
    @Query() query: QueryFeedbackChannelPublicDto,
  ): Promise<FeedbackChannelListItemResponseDto[]> {
    return this.service.publicList(query);
  }

  @Public()
  @Get(':id')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Chi tiết một kênh phản hồi đang hiển thị' })
  @ApiResponse({ status: 200, type: FeedbackChannelResponseDto })
  @ApiResponse({ status: 404, description: 'FEEDBACK_CHANNEL_NOT_FOUND' })
  async detail(
    @Param('id') id: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<FeedbackChannelResponseDto | void> {
    const data = await this.service.publicDetail(id);
    const etag = `"feedback-channel-${data.id}-${data.updatedAt.getTime()}"`;
    response.setHeader('ETag', etag);
    response.setHeader('Cache-Control', 'public, max-age=60, must-revalidate');
    if (ifNoneMatch === etag) {
      response.status(304).end();
      return;
    }
    return data;
  }
}

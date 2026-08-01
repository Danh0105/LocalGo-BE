import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../auth/types/authenticated-user.interface';
import { QueryTradePostAnalyticsDto } from '../dto/query-trade-post-analytics.dto';
import {
  TradePostAnalyticsDetailDto,
  TradePostAnalyticsSummaryDto,
} from '../dto/trade-post-analytics-response.dto';
import { TradePostAnalyticsService } from '../services/trade-post-analytics.service';

@ApiTags('trade-posts')
@ApiBearerAuth()
@Controller('trade-posts')
export class TradePostAnalyticsController {
  constructor(private readonly analyticsService: TradePostAnalyticsService) {}

  @ApiOperation({
    summary: 'Thống kê truy cập & tương tác tổng hợp cho các tin của tôi',
  })
  @Get('me/analytics')
  getMySummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryTradePostAnalyticsDto,
  ): Promise<TradePostAnalyticsSummaryDto> {
    return this.analyticsService.getOwnerSummary(user, query);
  }

  @ApiOperation({
    summary: 'Thống kê truy cập & tương tác của một tin (chủ tin hoặc admin)',
  })
  @Get(':id/analytics')
  getPostAnalytics(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: QueryTradePostAnalyticsDto,
  ): Promise<TradePostAnalyticsDetailDto> {
    return this.analyticsService.getPostAnalytics(user, id, query);
  }
}

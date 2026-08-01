import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '../../../../../generated/prisma';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { Roles } from '../../../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../../auth/types/authenticated-user.interface';
import { QueryTradePostAnalyticsDto } from '../dto/query-trade-post-analytics.dto';
import {
  TradePostAnalyticsDetailDto,
  TradePostAnalyticsSummaryDto,
} from '../dto/trade-post-analytics-response.dto';
import { TradePostAnalyticsService } from '../services/trade-post-analytics.service';

@ApiTags('admin-trade-posts')
@ApiBearerAuth()
@Roles(UserRole.MODERATOR, UserRole.ADMIN)
@Controller('admin/trade-posts')
export class TradePostAnalyticsAdminController {
  constructor(private readonly analyticsService: TradePostAnalyticsService) {}

  @ApiOperation({
    summary:
      '[Admin] Thống kê truy cập & tương tác toàn nền tảng (lọc theo chủ tin/danh mục)',
  })
  @Get('analytics/summary')
  getSummary(
    @Query() query: QueryTradePostAnalyticsDto,
  ): Promise<TradePostAnalyticsSummaryDto> {
    return this.analyticsService.getAdminSummary(query);
  }

  @ApiOperation({
    summary: '[Admin] Thống kê truy cập & tương tác của một tin',
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

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { Public } from '../../../../common/decorators/public.decorator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import type { AuthenticatedUser } from '../../../auth/types/authenticated-user.interface';
import { CreateTradeReviewDto } from '../dto/create-trade-review.dto';
import { TradeReviewResponseDto } from '../dto/trade-review-response.dto';
import { TradeReviewSummaryResponseDto } from '../dto/trade-review-summary-response.dto';
import { TradeReviewService } from '../services/trade-review.service';

@ApiTags('trade-reviews')
@Controller('trade-posts/:tradePostId/reviews')
export class TradeReviewsController {
  constructor(private readonly tradeReviewService: TradeReviewService) {}

  @Public()
  @ApiOperation({
    summary: 'Danh sách đánh giá đã duyệt của một tin giao thương',
  })
  @Get()
  async list(
    @Param('tradePostId') tradePostId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<{ data: TradeReviewResponseDto[]; meta: unknown }> {
    const result = await this.tradeReviewService.listPublicForPost(
      tradePostId,
      query.page,
      query.limit,
    );
    return {
      data: result.data.map((item) => TradeReviewResponseDto.fromEntity(item)),
      meta: result.meta,
    };
  }

  @Public()
  @ApiOperation({
    summary: 'Tổng hợp thống kê đánh giá của một tin giao thương',
  })
  @Get('summary')
  async summary(
    @Param('tradePostId') tradePostId: string,
  ): Promise<TradeReviewSummaryResponseDto> {
    return this.tradeReviewService.getSummary(tradePostId);
  }

  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Gửi đánh giá cho một tin giao thương' })
  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tradePostId') tradePostId: string,
    @Body() dto: CreateTradeReviewDto,
  ): Promise<TradeReviewResponseDto> {
    const review = await this.tradeReviewService.create(user, tradePostId, dto);
    return TradeReviewResponseDto.fromEntity(review);
  }
}

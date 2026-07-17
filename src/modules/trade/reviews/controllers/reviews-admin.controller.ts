import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '../../../../../generated/prisma';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { Roles } from '../../../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../../auth/types/authenticated-user.interface';
import { ModerateTradeReviewDto } from '../dto/moderate-trade-review.dto';
import { QueryTradeReviewAdminDto } from '../dto/query-trade-review-admin.dto';
import { TradeReviewResponseDto } from '../dto/trade-review-response.dto';
import { TradeReviewService } from '../services/trade-review.service';

@ApiTags('admin-reviews')
@ApiBearerAuth()
@Roles(UserRole.MODERATOR, UserRole.ADMIN)
@Controller('admin/reviews')
export class ReviewsAdminController {
  constructor(private readonly tradeReviewService: TradeReviewService) {}

  @ApiOperation({
    summary:
      '[Admin] Danh sách đánh giá (mọi trạng thái, lọc theo status/tradePostId)',
  })
  @Get()
  async list(
    @Query() query: QueryTradeReviewAdminDto,
  ): Promise<{ data: TradeReviewResponseDto[]; meta: unknown }> {
    const result = await this.tradeReviewService.listForAdmin(query);
    return {
      data: result.data.map((item) => TradeReviewResponseDto.fromEntity(item)),
      meta: result.meta,
    };
  }

  @ApiOperation({ summary: '[Admin] Duyệt hoặc ẩn một đánh giá' })
  @Patch(':id/status')
  async setStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ModerateTradeReviewDto,
  ): Promise<TradeReviewResponseDto> {
    const review = await this.tradeReviewService.moderate(
      user.id,
      id,
      dto.status,
    );
    return TradeReviewResponseDto.fromEntity(review);
  }
}

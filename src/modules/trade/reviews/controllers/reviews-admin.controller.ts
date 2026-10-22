import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '../../../../../generated/prisma';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { Roles } from '../../../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../../auth/types/authenticated-user.interface';
import { ModerateTradeReviewDto } from '../dto/moderate-trade-review.dto';
import {
  QueryTradeReviewAdminDto,
  QueryTradeReviewAdminStatsDto,
} from '../dto/query-trade-review-admin.dto';
import {
  TradeReviewAdminResponseDto,
  TradeReviewAdminStatsResponseDto,
} from '../dto/trade-review-admin-response.dto';
import { TradeReviewService } from '../services/trade-review.service';

@ApiTags('admin-reviews')
@ApiBearerAuth()
@Roles(UserRole.MODERATOR, UserRole.ADMIN)
@Controller('admin/reviews')
export class ReviewsAdminController {
  constructor(private readonly tradeReviewService: TradeReviewService) {}

  @ApiOperation({
    summary:
      '[Admin] Danh sách đánh giá (mọi trạng thái, lọc theo status/tradePostId/rating, tìm kiếm)',
  })
  @Get()
  async list(
    @Query() query: QueryTradeReviewAdminDto,
  ): Promise<{ data: TradeReviewAdminResponseDto[]; meta: unknown }> {
    const result = await this.tradeReviewService.listForAdmin(query);
    return {
      data: result.data.map((item) =>
        TradeReviewAdminResponseDto.fromEntity(item),
      ),
      meta: result.meta,
    };
  }

  @ApiOperation({ summary: '[Admin] Số lượng đánh giá theo trạng thái' })
  @Get('stats')
  async stats(
    @Query() query: QueryTradeReviewAdminStatsDto,
  ): Promise<TradeReviewAdminStatsResponseDto> {
    return this.tradeReviewService.getAdminStats(query.tradePostId);
  }

  @ApiOperation({ summary: '[Admin] Chi tiết một đánh giá' })
  @Get(':id')
  async detail(@Param('id') id: string): Promise<TradeReviewAdminResponseDto> {
    const review = await this.tradeReviewService.getAdminDetail(id);
    return TradeReviewAdminResponseDto.fromEntity(review);
  }

  @ApiOperation({ summary: '[Admin] Ẩn hoặc hiển thị lại một đánh giá' })
  @Patch(':id/status')
  async setStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ModerateTradeReviewDto,
  ): Promise<TradeReviewAdminResponseDto> {
    const review = await this.tradeReviewService.moderate(
      user.id,
      id,
      dto.status,
    );
    return TradeReviewAdminResponseDto.fromEntity(review);
  }

  @ApiOperation({
    summary: '[Admin] Xóa một đánh giá (xóa mềm, tính lại điểm của tin)',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.tradeReviewService.removeByAdmin(user.id, id);
  }
}

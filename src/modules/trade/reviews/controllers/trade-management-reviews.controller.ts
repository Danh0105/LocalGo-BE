import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import type { AuthenticatedUser } from '../../../auth/types/authenticated-user.interface';
import { SellerAccess } from '../../common/seller-access.guard';
import { ReplyTradeReviewDto } from '../dto/reply-trade-review.dto';
import { TradeReviewResponseDto } from '../dto/trade-review-response.dto';
import { TradeReviewService } from '../services/trade-review.service';

/** Seller center: reviews customers left on the caller's posts, and replies to them. */
@ApiTags('trade-management')
@ApiBearerAuth()
@SellerAccess()
@Controller('trade-management/reviews')
export class TradeManagementReviewsController {
  constructor(private readonly tradeReviewService: TradeReviewService) {}

  @ApiOperation({
    summary:
      'Đánh giá đang hiển thị trên các tin của tôi (kèm người đánh giá và tin)',
  })
  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<{ data: TradeReviewResponseDto[]; meta: unknown }> {
    const result = await this.tradeReviewService.listForPostOwner(
      user.id,
      query.page,
      query.limit,
    );
    return {
      data: result.data.map((item) => TradeReviewResponseDto.fromEntity(item)),
      meta: result.meta,
    };
  }

  @ApiOperation({
    summary: 'Phản hồi (hoặc sửa phản hồi) một đánh giá trên tin của tôi',
  })
  @Put(':id/reply')
  async reply(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReplyTradeReviewDto,
  ): Promise<TradeReviewResponseDto> {
    const review = await this.tradeReviewService.reply(user, id, dto.content);
    return TradeReviewResponseDto.fromEntity(review);
  }

  @ApiOperation({ summary: 'Xóa phản hồi của tôi trên một đánh giá' })
  @Delete(':id/reply')
  async removeReply(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<TradeReviewResponseDto> {
    const review = await this.tradeReviewService.removeReply(user, id);
    return TradeReviewResponseDto.fromEntity(review);
  }
}

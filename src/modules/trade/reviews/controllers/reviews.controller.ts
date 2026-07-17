import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../auth/types/authenticated-user.interface';
import { AttachReviewImageDto } from '../dto/attach-review-image.dto';
import { TradeReviewResponseDto } from '../dto/trade-review-response.dto';
import { UpdateTradeReviewDto } from '../dto/update-trade-review.dto';
import { TradeReviewService } from '../services/trade-review.service';

@ApiTags('reviews')
@ApiBearerAuth()
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly tradeReviewService: TradeReviewService) {}

  @ApiOperation({ summary: 'Cập nhật đánh giá của chính tôi' })
  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTradeReviewDto,
  ): Promise<TradeReviewResponseDto> {
    const review = await this.tradeReviewService.update(user, id, dto);
    return TradeReviewResponseDto.fromEntity(review);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Xóa đánh giá của chính tôi (hoặc quyền kiểm duyệt)',
  })
  @Delete(':id')
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.tradeReviewService.remove(user, id);
  }

  @ApiOperation({ summary: 'Đính kèm ảnh vào đánh giá (tối đa 3 ảnh)' })
  @Post(':id/images')
  async attachImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AttachReviewImageDto,
  ): Promise<TradeReviewResponseDto> {
    const review = await this.tradeReviewService.attachImage(
      user,
      id,
      dto.mediaId,
    );
    return TradeReviewResponseDto.fromEntity(review);
  }

  @ApiOperation({ summary: 'Xóa một ảnh khỏi đánh giá' })
  @Delete(':reviewId/images/:imageId')
  async removeImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reviewId') reviewId: string,
    @Param('imageId') imageId: string,
  ): Promise<TradeReviewResponseDto> {
    const review = await this.tradeReviewService.removeImage(
      user,
      reviewId,
      imageId,
    );
    return TradeReviewResponseDto.fromEntity(review);
  }
}

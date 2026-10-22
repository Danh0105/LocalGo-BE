import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { ContentReviewTargetType } from '../../../../generated/prisma';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { CONTENT_REVIEW_TARGET_TYPES } from '../content-review.constants';
import {
  ContentReviewRatingResponseDto,
  ContentReviewResponseDto,
  ContentReviewSummaryResponseDto,
  ContentReviewWithTargetResponseDto,
} from '../dto/content-review-response.dto';
import { QueryContentReviewRatingsDto } from '../dto/query-content-review.dto';
import {
  CreateContentReviewDto,
  UpdateContentReviewDto,
} from '../dto/upsert-content-review.dto';
import { ParseContentReviewTargetTypePipe } from '../pipes/parse-content-review-target-type.pipe';
import { ContentReviewService } from '../services/content-review.service';

const TargetTypeParam = () =>
  ApiParam({ name: 'targetType', enum: CONTENT_REVIEW_TARGET_TYPES });

@ApiTags('content-reviews')
@Controller('content-reviews')
export class ContentReviewsController {
  constructor(private readonly service: ContentReviewService) {}

  @Public()
  @Get('ratings')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Điểm trung bình và số đánh giá của nhiều mục cùng loại (cho thẻ danh sách)',
  })
  @ApiResponse({ status: 200, type: [ContentReviewRatingResponseDto] })
  ratings(
    @Query() query: QueryContentReviewRatingsDto,
  ): Promise<ContentReviewRatingResponseDto[]> {
    return this.service.getRatings(query);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Các đánh giá của tôi trên mọi mục' })
  @ApiResponse({ status: 200, type: [ContentReviewWithTargetResponseDto] })
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.service.listMine(user, query);
  }

  @Public()
  @Get(':targetType/:targetId')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @TargetTypeParam()
  @ApiOperation({
    summary: 'Danh sách bình luận đánh giá công khai của một mục',
  })
  @ApiResponse({ status: 200, type: [ContentReviewResponseDto] })
  @ApiResponse({ status: 404, description: 'CONTENT_REVIEW_TARGET_NOT_FOUND' })
  list(
    @Param('targetType', ParseContentReviewTargetTypePipe)
    targetType: ContentReviewTargetType,
    @Param('targetId') targetId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.service.listPublic(targetType, targetId, query);
  }

  @Public()
  @Get(':targetType/:targetId/summary')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @TargetTypeParam()
  @ApiOperation({ summary: 'Tổng hợp số sao của một mục' })
  @ApiResponse({ status: 200, type: ContentReviewSummaryResponseDto })
  @ApiResponse({ status: 404, description: 'CONTENT_REVIEW_TARGET_NOT_FOUND' })
  summary(
    @Param('targetType', ParseContentReviewTargetTypePipe)
    targetType: ContentReviewTargetType,
    @Param('targetId') targetId: string,
  ): Promise<ContentReviewSummaryResponseDto> {
    return this.service.getSummary(targetType, targetId);
  }

  @ApiBearerAuth()
  @Get(':targetType/:targetId/me')
  @TargetTypeParam()
  @ApiOperation({
    summary: 'Đánh giá của tôi cho một mục (null nếu chưa đánh giá)',
  })
  @ApiResponse({ status: 200, type: ContentReviewResponseDto })
  findMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('targetType', ParseContentReviewTargetTypePipe)
    targetType: ContentReviewTargetType,
    @Param('targetId') targetId: string,
  ): Promise<ContentReviewResponseDto | null> {
    return this.service.findMine(user, targetType, targetId);
  }

  @ApiBearerAuth()
  @Post(':targetType/:targetId')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @TargetTypeParam()
  @ApiOperation({
    summary: 'Gửi bình luận đánh giá cho một mục (mỗi người một đánh giá/mục)',
  })
  @ApiResponse({ status: 201, type: ContentReviewResponseDto })
  @ApiResponse({ status: 404, description: 'CONTENT_REVIEW_TARGET_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'REVIEW_ALREADY_EXISTS' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('targetType', ParseContentReviewTargetTypePipe)
    targetType: ContentReviewTargetType,
    @Param('targetId') targetId: string,
    @Body() dto: CreateContentReviewDto,
  ): Promise<ContentReviewResponseDto> {
    return this.service.create(user, targetType, targetId, dto);
  }

  @ApiBearerAuth()
  @Patch(':id')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Sửa đánh giá của chính tôi' })
  @ApiResponse({ status: 200, type: ContentReviewResponseDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateContentReviewDto,
  ): Promise<ContentReviewResponseDto> {
    return this.service.update(user, id, dto);
  }

  @ApiBearerAuth()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa đánh giá của chính tôi' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.remove(user, id);
  }
}

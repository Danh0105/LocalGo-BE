import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '../../../../generated/prisma';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import {
  ModerateContentReviewDto,
  ReplyContentReviewDto,
} from '../dto/content-review-action.dto';
import {
  ContentReviewAdminResponseDto,
  ContentReviewAdminStatsResponseDto,
} from '../dto/content-review-response.dto';
import {
  QueryContentReviewAdminDto,
  QueryContentReviewAdminStatsDto,
} from '../dto/query-content-review.dto';
import { ContentReviewService } from '../services/content-review.service';

@ApiTags('admin-content-reviews')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
@Controller('admin/content-reviews')
export class ContentReviewsAdminController {
  constructor(private readonly service: ContentReviewService) {}

  @Get()
  @ApiOperation({
    summary:
      '[Admin] Danh sách bình luận đánh giá (lọc theo mục, trạng thái, số sao, tìm kiếm)',
  })
  @ApiResponse({ status: 200, type: [ContentReviewAdminResponseDto] })
  list(@Query() query: QueryContentReviewAdminDto) {
    return this.service.adminList(query);
  }

  @Get('stats')
  @ApiOperation({
    summary:
      '[Admin] Số đánh giá theo trạng thái, theo mục và số chưa phản hồi',
  })
  @ApiResponse({ status: 200, type: ContentReviewAdminStatsResponseDto })
  stats(
    @Query() query: QueryContentReviewAdminStatsDto,
  ): Promise<ContentReviewAdminStatsResponseDto> {
    return this.service.adminStats(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '[Admin] Chi tiết một đánh giá' })
  @ApiResponse({ status: 200, type: ContentReviewAdminResponseDto })
  detail(@Param('id') id: string): Promise<ContentReviewAdminResponseDto> {
    return this.service.adminDetail(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: '[Admin] Ẩn hoặc hiển thị lại một đánh giá' })
  @ApiResponse({ status: 200, type: ContentReviewAdminResponseDto })
  setStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ModerateContentReviewDto,
  ): Promise<ContentReviewAdminResponseDto> {
    return this.service.moderate(actor.id, id, dto.status);
  }

  @Put(':id/reply')
  @ApiOperation({
    summary: '[Admin] Phản hồi công khai (hoặc sửa phản hồi) của ban quản lý',
  })
  @ApiResponse({ status: 200, type: ContentReviewAdminResponseDto })
  @ApiResponse({ status: 409, description: 'REVIEW_REPLY_NOT_ALLOWED' })
  reply(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReplyContentReviewDto,
  ): Promise<ContentReviewAdminResponseDto> {
    return this.service.reply(actor.id, id, dto.content);
  }

  @Delete(':id/reply')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Xóa phản hồi của ban quản lý' })
  async removeReply(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.removeReply(actor.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Xóa một đánh giá (xóa mềm)' })
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.adminRemove(actor.id, id);
  }
}

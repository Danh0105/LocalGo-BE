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
import { Roles } from '../../../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../../auth/types/authenticated-user.interface';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { FeatureTradePostDto } from '../dto/feature-trade-post.dto';
import { QueryTradePostDto } from '../dto/query-trade-post.dto';
import { RejectTradePostDto } from '../dto/reject-trade-post.dto';
import { TradePostResponseDto } from '../dto/trade-post-response.dto';
import { TradePostStatusService } from '../services/trade-post-status.service';
import { TradePostService } from '../services/trade-post.service';

@ApiTags('admin-trade-posts')
@ApiBearerAuth()
@Roles(UserRole.MODERATOR, UserRole.ADMIN)
@Controller('admin/trade-posts')
export class TradePostsAdminController {
  constructor(
    private readonly tradePostService: TradePostService,
    private readonly tradePostStatusService: TradePostStatusService,
  ) {}

  @ApiOperation({
    summary: '[Admin] Danh sách tin giao thương (mọi trạng thái)',
  })
  @Get()
  async list(
    @Query() query: QueryTradePostDto,
  ): Promise<{ data: TradePostResponseDto[]; meta: unknown }> {
    const result = await this.tradePostService.listForAdmin(query);
    return {
      data: result.data.map((item) => TradePostResponseDto.fromEntity(item)),
      meta: result.meta,
    };
  }

  @ApiOperation({
    summary: '[Admin] Chi tiết tin giao thương (mọi trạng thái)',
  })
  @Get(':id')
  async detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<TradePostResponseDto> {
    const post = await this.tradePostService.getOwnerOrAdminDetail(user, id);
    return TradePostResponseDto.fromEntity(post);
  }

  @ApiOperation({ summary: '[Admin] Duyệt tin (PENDING -> PUBLISHED)' })
  @Patch(':id/approve')
  async approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<TradePostResponseDto> {
    const post = await this.tradePostStatusService.approve(user.id, id);
    return TradePostResponseDto.fromEntity(post);
  }

  @ApiOperation({ summary: '[Admin] Từ chối tin (PENDING -> REJECTED)' })
  @Patch(':id/reject')
  async reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RejectTradePostDto,
  ): Promise<TradePostResponseDto> {
    const post = await this.tradePostStatusService.reject(
      user.id,
      id,
      dto.reason,
    );
    return TradePostResponseDto.fromEntity(post);
  }

  @ApiOperation({ summary: '[Admin] Lưu trữ tin (PUBLISHED -> ARCHIVED)' })
  @Patch(':id/archive')
  async archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<TradePostResponseDto> {
    const post = await this.tradePostStatusService.archive(user.id, id);
    return TradePostResponseDto.fromEntity(post);
  }

  @ApiOperation({ summary: '[Admin] Ẩn tin đã duyệt khỏi API công khai' })
  @Patch(':id/hide')
  async hide(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<TradePostResponseDto> {
    const post = await this.tradePostStatusService.hide(user.id, id);
    return TradePostResponseDto.fromEntity(post);
  }

  @ApiOperation({ summary: '[Admin] Hiển thị lại tin đang bị ẩn' })
  @Patch(':id/unhide')
  async unhide(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<TradePostResponseDto> {
    const post = await this.tradePostStatusService.unhide(user.id, id);
    return TradePostResponseDto.fromEntity(post);
  }

  @ApiOperation({ summary: '[Admin] Xóa mềm tin đã duyệt hoặc đang bị ẩn' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteApproved(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.tradePostStatusService.deleteApproved(user.id, id);
  }

  @ApiOperation({ summary: '[Admin] Đặt/bỏ nổi bật cho tin' })
  @Patch(':id/feature')
  async feature(
    @Param('id') id: string,
    @Body() dto: FeatureTradePostDto,
  ): Promise<TradePostResponseDto> {
    const post = await this.tradePostStatusService.setFeatured(
      id,
      dto.featured,
    );
    return TradePostResponseDto.fromEntity(post);
  }
}

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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { Public } from '../../../../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../../../auth/types/authenticated-user.interface';
import { SellerAccess } from '../../common/seller-access.guard';
import { TradePostFavoriteService } from '../../favorites/services/trade-post-favorite.service';
import { CreateTradePostDto } from '../dto/create-trade-post.dto';
import { QueryTradePostDto } from '../dto/query-trade-post.dto';
import { RecordTradePostInteractionDto } from '../dto/record-trade-post-interaction.dto';
import { TradePostResponseDto } from '../dto/trade-post-response.dto';
import { UpdateTradePostDto } from '../dto/update-trade-post.dto';
import { TradePostEngagementService } from '../services/trade-post-engagement.service';
import { TradePostStatusService } from '../services/trade-post-status.service';
import { TradePostService } from '../services/trade-post.service';

@ApiTags('trade-posts')
@Controller('trade-posts')
export class TradePostsController {
  constructor(
    private readonly tradePostService: TradePostService,
    private readonly tradePostStatusService: TradePostStatusService,
    private readonly engagementService: TradePostEngagementService,
    private readonly favoriteService: TradePostFavoriteService,
  ) {}

  @Public()
  @ApiOperation({
    summary: 'Danh sách tin giao thương đã xuất bản (công khai)',
  })
  @Get()
  async list(
    @Query() query: QueryTradePostDto,
    @CurrentUser() viewer: AuthenticatedUser | undefined,
  ): Promise<{ data: TradePostResponseDto[]; meta: unknown }> {
    const result = await this.tradePostService.listPublic(query);
    const saved = await this.favoriteService.savedPostIds(
      viewer?.id,
      result.data.map((item) => item.id),
    );
    return {
      data: result.data.map((item) => {
        const dto = TradePostResponseDto.fromEntity(item);
        dto.isSaved = saved.has(item.id);
        return dto;
      }),
      meta: result.meta,
    };
  }

  @ApiBearerAuth()
  @SellerAccess()
  @ApiOperation({
    summary: 'Tạo tin giao thương mới (trạng thái DRAFT)',
    description:
      'Các field bắt buộc: category, title, summary, description, address, contactName, contactPhone; priceType bắt buộc khi purpose=COMMERCIAL. googleMapsUrl là tùy chọn. Chỉ tài khoản role BUSINESS (đã có hồ sơ đăng ký được Admin duyệt) mới được tạo tin — trả 403 BUSINESS_PROFILE_REQUIRED nếu chưa đủ điều kiện.',
  })
  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTradePostDto,
  ): Promise<TradePostResponseDto> {
    const post = await this.tradePostService.create(user, dto);
    return TradePostResponseDto.fromEntity(post);
  }

  @ApiBearerAuth()
  @SellerAccess()
  @ApiOperation({
    summary: 'Danh sách tin giao thương của chính tôi (mọi trạng thái)',
    description:
      'Lọc status/category/search/purpose, sắp xếp sortBy + sortOrder (newest theo ngày tạo). Chỉ tài khoản BUSINESS đang hoạt động.',
  })
  @Get('me')
  async listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryTradePostDto,
  ): Promise<{ data: TradePostResponseDto[]; meta: unknown }> {
    const result = await this.tradePostService.listMine(user.id, query);
    return {
      data: result.data.map((item) => TradePostResponseDto.fromEntity(item)),
      meta: result.meta,
    };
  }

  @ApiBearerAuth()
  @SellerAccess({ allowStaff: true })
  @ApiOperation({
    summary: 'Chi tiết tin để quản lý (chủ tin hoặc ADMIN/MODERATOR)',
    description:
      'Trả mọi trạng thái (kể cả DRAFT/PENDING/REJECTED/HIDDEN), không tính lượt xem. Endpoint công khai GET /trade-posts/:idOrSlug chỉ trả tin PUBLISHED.',
  })
  @Get(':id/manage')
  async getManageDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<TradePostResponseDto> {
    const post = await this.tradePostService.getOwnerOrAdminDetail(user, id);
    return TradePostResponseDto.fromEntity(post);
  }

  @Public()
  @ApiOperation({ summary: 'Chi tiết tin giao thương đã xuất bản (công khai)' })
  @Get(':idOrSlug')
  async getPublicDetail(
    @Param('idOrSlug') idOrSlug: string,
    @CurrentUser() viewer: AuthenticatedUser | undefined,
  ): Promise<TradePostResponseDto> {
    const post = await this.tradePostService.getPublicDetail(
      idOrSlug,
      viewer?.id,
    );
    const saved = await this.favoriteService.savedPostIds(viewer?.id, [
      post.id,
    ]);
    const dto = TradePostResponseDto.fromEntity(post);
    dto.isSaved = saved.has(post.id);
    return dto;
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Ghi nhận tương tác với tin (gọi điện / Zalo / chia sẻ)',
    description:
      'Dùng để đo lường tương tác của người dùng phục vụ thống kê. Gọi khi người dùng bấm nút gọi điện, liên hệ Zalo, hoặc chia sẻ tin.',
  })
  @Post(':idOrSlug/interactions')
  async recordInteraction(
    @Param('idOrSlug') idOrSlug: string,
    @Body() dto: RecordTradePostInteractionDto,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ): Promise<void> {
    await this.engagementService.recordInteraction(
      idOrSlug,
      dto.type,
      user?.id,
    );
  }

  @ApiBearerAuth()
  @SellerAccess({ allowStaff: true })
  @ApiOperation({
    summary: 'Cập nhật tin giao thương của chính tôi',
    description:
      'Gửi null để xóa giá trị tùy chọn (price, priceLabel, googleMapsUrl, contactZalo, promotion*, expiresAt, eventStartAt/eventEndAt). Sửa nội dung quan trọng của tin PUBLISHED sẽ đưa tin về PENDING.',
  })
  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTradePostDto,
  ): Promise<TradePostResponseDto> {
    const post = await this.tradePostService.update(user, id, dto);
    return TradePostResponseDto.fromEntity(post);
  }

  @ApiBearerAuth()
  @SellerAccess({ allowStaff: true })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa (thu hồi) tin giao thương của chính tôi' })
  @Delete(':id')
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.tradePostService.remove(user, id);
  }

  @ApiBearerAuth()
  @SellerAccess()
  @ApiOperation({
    summary: 'Gửi tin (DRAFT/REJECTED) để chờ kiểm duyệt (PENDING)',
  })
  @Patch(':id/submit')
  async submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<TradePostResponseDto> {
    const post = await this.tradePostStatusService.submit(user, id);
    return TradePostResponseDto.fromEntity(post);
  }
}

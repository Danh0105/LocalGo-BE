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
import { CreateTradePostDto } from '../dto/create-trade-post.dto';
import { QueryTradePostDto } from '../dto/query-trade-post.dto';
import { TradePostResponseDto } from '../dto/trade-post-response.dto';
import { UpdateTradePostDto } from '../dto/update-trade-post.dto';
import { TradePostStatusService } from '../services/trade-post-status.service';
import { TradePostService } from '../services/trade-post.service';

@ApiTags('trade-posts')
@Controller('trade-posts')
export class TradePostsController {
  constructor(
    private readonly tradePostService: TradePostService,
    private readonly tradePostStatusService: TradePostStatusService,
  ) {}

  @Public()
  @ApiOperation({
    summary: 'Danh sách tin giao thương đã xuất bản (công khai)',
  })
  @Get()
  async list(
    @Query() query: QueryTradePostDto,
  ): Promise<{ data: TradePostResponseDto[]; meta: unknown }> {
    const result = await this.tradePostService.listPublic(query);
    return {
      data: result.data.map((item) => TradePostResponseDto.fromEntity(item)),
      meta: result.meta,
    };
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Tạo tin giao thương mới (trạng thái DRAFT)',
    description:
      'Chỉ tài khoản role BUSINESS (đã có hồ sơ đăng ký được Admin duyệt) mới được tạo tin — trả 403 BUSINESS_PROFILE_REQUIRED nếu chưa đủ điều kiện.',
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
  @ApiOperation({
    summary: 'Danh sách tin giao thương của chính tôi (mọi trạng thái)',
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

  @Public()
  @ApiOperation({ summary: 'Chi tiết tin giao thương đã xuất bản (công khai)' })
  @Get(':idOrSlug')
  async getPublicDetail(
    @Param('idOrSlug') idOrSlug: string,
  ): Promise<TradePostResponseDto> {
    const post = await this.tradePostService.getPublicDetail(idOrSlug);
    return TradePostResponseDto.fromEntity(post);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật tin giao thương của chính tôi' })
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

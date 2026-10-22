import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import type { AuthenticatedUser } from '../../../auth/types/authenticated-user.interface';
import { SaveTradePostResponseDto } from '../dto/save-trade-post-response.dto';
import { SavedTradePostResponseDto } from '../dto/saved-trade-post-response.dto';
import { TradePostFavoriteService } from '../services/trade-post-favorite.service';

@ApiTags('trade-posts')
@ApiBearerAuth()
@Controller('trade-posts')
export class TradePostFavoritesController {
  constructor(private readonly favoriteService: TradePostFavoriteService) {}

  @ApiOperation({
    summary: 'Danh sách tin đã lưu của tôi (mới lưu trước)',
    description:
      'Mỗi tin có savedAt và isAvailable (false nếu tin đã bị ẩn, hết hạn, lưu trữ hoặc đang chờ duyệt lại). Tin đã xóa không còn trong danh sách.',
  })
  @Get('me/saved')
  async listSaved(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<{ data: SavedTradePostResponseDto[]; meta: unknown }> {
    const result = await this.favoriteService.listSaved(user.id, query);
    return {
      data: result.data.map((item) =>
        SavedTradePostResponseDto.fromSaved(item),
      ),
      meta: result.meta,
    };
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Lưu (bookmark) một tin giao thương',
    description:
      'Idempotent: lưu lại tin đã lưu không lỗi. Chỉ lưu được tin đang hiển thị công khai (404 nếu không).',
  })
  @Post(':idOrSlug/save')
  async save(
    @CurrentUser() user: AuthenticatedUser,
    @Param('idOrSlug') idOrSlug: string,
  ): Promise<SaveTradePostResponseDto> {
    return this.favoriteService.save(user.id, idOrSlug);
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Bỏ lưu một tin giao thương',
    description: 'Idempotent; bỏ lưu được cả tin không còn công khai.',
  })
  @Delete(':idOrSlug/save')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsave(
    @CurrentUser() user: AuthenticatedUser,
    @Param('idOrSlug') idOrSlug: string,
  ): Promise<void> {
    await this.favoriteService.unsave(user.id, idOrSlug);
  }
}

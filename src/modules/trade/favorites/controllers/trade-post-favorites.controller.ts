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
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import type { AuthenticatedUser } from '../../../auth/types/authenticated-user.interface';
import { TradePostResponseDto } from '../../posts/dto/trade-post-response.dto';
import { SaveTradePostResponseDto } from '../dto/save-trade-post-response.dto';
import { TradePostFavoriteService } from '../services/trade-post-favorite.service';

@ApiTags('trade-posts')
@ApiBearerAuth()
@Controller('trade-posts')
export class TradePostFavoritesController {
  constructor(private readonly favoriteService: TradePostFavoriteService) {}

  @ApiOperation({ summary: 'Danh sách tin đã lưu của tôi' })
  @Get('me/saved')
  async listSaved(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<{ data: TradePostResponseDto[]; meta: unknown }> {
    const result = await this.favoriteService.listSaved(user.id, query);
    return {
      data: result.data.map((item) => TradePostResponseDto.fromEntity(item)),
      meta: result.meta,
    };
  }

  @ApiOperation({ summary: 'Lưu (bookmark) một tin giao thương' })
  @Post(':idOrSlug/save')
  async save(
    @CurrentUser() user: AuthenticatedUser,
    @Param('idOrSlug') idOrSlug: string,
  ): Promise<SaveTradePostResponseDto> {
    return this.favoriteService.save(user.id, idOrSlug);
  }

  @ApiOperation({ summary: 'Bỏ lưu một tin giao thương' })
  @Delete(':idOrSlug/save')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsave(
    @CurrentUser() user: AuthenticatedUser,
    @Param('idOrSlug') idOrSlug: string,
  ): Promise<void> {
    await this.favoriteService.unsave(user.id, idOrSlug);
  }
}

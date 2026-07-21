import { Controller, Get, Headers, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../../../common/decorators/public.decorator';
import { TradePostCategoryResponseDto } from '../dto/trade-post-category-response.dto';
import { TradePostCategoryService } from '../services/trade-post-category.service';

@ApiTags('trade-post-categories')
@Controller('trade-post-categories')
export class TradePostCategoriesController {
  constructor(private readonly service: TradePostCategoryService) {}

  @Public()
  @Get()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Danh sách danh mục tin giao thương đang hoạt động',
    description:
      '`code` là public stable identifier cho request/response tin đăng; `id` là internal DB identifier.',
  })
  @ApiResponse({ status: 200, type: [TradePostCategoryResponseDto] })
  async list(
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TradePostCategoryResponseDto[] | void> {
    const categories = await this.service.listPublic();
    const data = categories.map((category) =>
      TradePostCategoryResponseDto.fromEntity(category),
    );
    const etag = `"trade-post-categories-${data
      .map(
        (category, index) =>
          `${category.id}:${category.sortOrder}:${category.code}:${categories[index].updatedAt.getTime()}`,
      )
      .join('|')}"`;
    response.setHeader('ETag', etag);
    response.setHeader('Cache-Control', 'public, max-age=60, must-revalidate');
    if (ifNoneMatch === etag) {
      response.status(304).end();
      return;
    }
    return data;
  }
}

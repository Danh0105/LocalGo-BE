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
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '../../../../generated/prisma';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { UpdateNewsArticleStatusDto } from '../dto/news-action.dto';
import { QueryNewsAdminDto } from '../dto/query-news.dto';
import { NewsArticleAdminResponseDto } from '../dto/news-response.dto';
import {
  CreateNewsArticleDto,
  UpdateNewsArticleDto,
} from '../dto/upsert-news.dto';
import { NewsService } from '../services/news.service';

@ApiTags('admin-news')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
@Controller('admin/news')
export class NewsAdminController {
  constructor(private readonly service: NewsService) {}

  @Get()
  @ApiOperation({
    summary: '[Admin] Danh sách đầy đủ tin tức (kể cả ẩn và lên lịch)',
  })
  @ApiResponse({ status: 200, type: [NewsArticleAdminResponseDto] })
  list(@Query() query: QueryNewsAdminDto) {
    return this.service.adminList(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '[Admin] Chi tiết bài tin tức' })
  @ApiResponse({ status: 200, type: NewsArticleAdminResponseDto })
  detail(@Param('id') id: string): Promise<NewsArticleAdminResponseDto> {
    return this.service.adminDetail(id);
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Tạo bài tin tức' })
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateNewsArticleDto,
  ): Promise<NewsArticleAdminResponseDto> {
    return this.service.create(actor.id, dto);
  }

  @Put(':id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Cập nhật với optimistic locking' })
  @ApiResponse({ status: 409, description: 'NEWS_ARTICLE_VERSION_CONFLICT' })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateNewsArticleDto,
  ): Promise<NewsArticleAdminResponseDto> {
    return this.service.update(actor.id, id, dto);
  }

  @Patch(':id/status')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Ẩn hoặc hiện bài tin tức' })
  updateStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateNewsArticleStatusDto,
  ): Promise<NewsArticleAdminResponseDto> {
    return this.service.updateStatus(actor.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Xóa bài tin tức' })
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.remove(actor.id, id);
  }
}

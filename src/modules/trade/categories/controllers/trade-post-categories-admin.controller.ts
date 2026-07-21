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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '../../../../../generated/prisma';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { Roles } from '../../../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../../auth/types/authenticated-user.interface';
import {
  ReorderTradePostCategoriesDto,
  UpdateTradePostCategoryStatusDto,
} from '../dto/trade-post-category-action.dto';
import { QueryTradePostCategoryAdminDto } from '../dto/query-trade-post-category.dto';
import { TradePostCategoryAdminResponseDto } from '../dto/trade-post-category-response.dto';
import {
  CreateTradePostCategoryDto,
  UpdateTradePostCategoryDto,
} from '../dto/upsert-trade-post-category.dto';
import { TradePostCategoryService } from '../services/trade-post-category.service';

@ApiTags('admin-trade-post-categories')
@ApiBearerAuth()
@Controller('admin/trade-post-categories')
export class TradePostCategoriesAdminController {
  constructor(private readonly service: TradePostCategoryService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: '[Admin] Danh sách danh mục tin giao thương' })
  @ApiResponse({ status: 200, type: [TradePostCategoryAdminResponseDto] })
  async list(@Query() query: QueryTradePostCategoryAdminDto) {
    const result = await this.service.listForAdmin(query);
    return {
      data: result.data.map((category) =>
        TradePostCategoryAdminResponseDto.fromEntity(category),
      ),
      meta: result.meta,
    };
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOperation({ summary: '[Admin] Chi tiết danh mục tin giao thương' })
  @ApiResponse({ status: 200, type: TradePostCategoryAdminResponseDto })
  async detail(
    @Param('id') id: string,
  ): Promise<TradePostCategoryAdminResponseDto> {
    return TradePostCategoryAdminResponseDto.fromEntity(
      await this.service.adminDetail(id),
    );
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Tạo danh mục tin giao thương' })
  async create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateTradePostCategoryDto,
  ): Promise<TradePostCategoryAdminResponseDto> {
    return TradePostCategoryAdminResponseDto.fromEntity(
      await this.service.create(actor.id, dto),
    );
  }

  @Patch('reorder')
  @Roles(UserRole.ADMIN)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: '[Admin] Sắp xếp nhiều danh mục trong một transaction',
  })
  async reorder(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: ReorderTradePostCategoriesDto,
  ): Promise<TradePostCategoryAdminResponseDto[]> {
    const categories = await this.service.reorder(actor.id, dto);
    return categories.map((category) =>
      TradePostCategoryAdminResponseDto.fromEntity(category),
    );
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Ẩn hoặc hiện danh mục tin giao thương' })
  async updateStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTradePostCategoryStatusDto,
  ): Promise<TradePostCategoryAdminResponseDto> {
    return TradePostCategoryAdminResponseDto.fromEntity(
      await this.service.updateStatus(actor.id, id, dto),
    );
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: '[Admin] Cập nhật danh mục với optimistic locking',
    description: 'Không cho sửa `code`; hãy tạo danh mục mới nếu cần mã mới.',
  })
  @ApiResponse({
    status: 409,
    description: 'TRADE_POST_CATEGORY_VERSION_CONFLICT',
  })
  async update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTradePostCategoryDto,
  ): Promise<TradePostCategoryAdminResponseDto> {
    return TradePostCategoryAdminResponseDto.fromEntity(
      await this.service.update(actor.id, id, dto),
    );
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Xóa mềm danh mục chưa được sử dụng' })
  @ApiResponse({ status: 409, description: 'TRADE_POST_CATEGORY_IN_USE' })
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.remove(actor.id, id);
  }
}

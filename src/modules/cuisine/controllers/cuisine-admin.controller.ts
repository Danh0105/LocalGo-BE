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
import {
  ReorderCuisineItemsDto,
  UpdateCuisineItemStatusDto,
} from '../dto/cuisine-action.dto';
import { QueryCuisineAdminDto } from '../dto/query-cuisine.dto';
import { CuisineAdminResponseDto } from '../dto/cuisine-response.dto';
import {
  CreateCuisineItemDto,
  UpdateCuisineItemDto,
} from '../dto/upsert-cuisine.dto';
import { CuisineService } from '../services/cuisine.service';

@ApiTags('admin-cuisine')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
@Controller('admin/cuisine')
export class CuisineAdminController {
  constructor(private readonly service: CuisineService) {}

  @Get()
  @ApiOperation({ summary: '[Admin] Danh sách đầy đủ món ăn' })
  @ApiResponse({ status: 200, type: [CuisineAdminResponseDto] })
  list(@Query() query: QueryCuisineAdminDto) {
    return this.service.adminList(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '[Admin] Chi tiết món ăn' })
  @ApiResponse({ status: 200, type: CuisineAdminResponseDto })
  detail(@Param('id') id: string): Promise<CuisineAdminResponseDto> {
    return this.service.adminDetail(id);
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Tạo món ăn' })
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateCuisineItemDto,
  ): Promise<CuisineAdminResponseDto> {
    return this.service.create(actor.id, dto);
  }

  @Put(':id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Cập nhật với optimistic locking' })
  @ApiResponse({ status: 409, description: 'CUISINE_ITEM_VERSION_CONFLICT' })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCuisineItemDto,
  ): Promise<CuisineAdminResponseDto> {
    return this.service.update(actor.id, id, dto);
  }

  @Patch('reorder')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: '[Admin] Sắp xếp nhiều món ăn trong một transaction',
  })
  reorder(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: ReorderCuisineItemsDto,
  ): Promise<CuisineAdminResponseDto[]> {
    return this.service.reorder(actor.id, dto);
  }

  @Patch(':id/status')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Ẩn hoặc hiện món ăn' })
  updateStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCuisineItemStatusDto,
  ): Promise<CuisineAdminResponseDto> {
    return this.service.updateStatus(actor.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Xóa món ăn' })
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.remove(actor.id, id);
  }
}

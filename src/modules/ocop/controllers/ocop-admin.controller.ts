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
  ReorderOcopProductsDto,
  UpdateOcopProductStatusDto,
} from '../dto/ocop-action.dto';
import { QueryOcopAdminDto } from '../dto/query-ocop.dto';
import { OcopAdminResponseDto } from '../dto/ocop-response.dto';
import {
  CreateOcopProductDto,
  UpdateOcopProductDto,
} from '../dto/upsert-ocop.dto';
import { OcopService } from '../services/ocop.service';

@ApiTags('admin-ocop')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
@Controller('admin/ocop')
export class OcopAdminController {
  constructor(private readonly service: OcopService) {}

  @Get()
  @ApiOperation({ summary: '[Admin] Danh sách đầy đủ sản phẩm OCOP' })
  @ApiResponse({ status: 200, type: [OcopAdminResponseDto] })
  list(@Query() query: QueryOcopAdminDto) {
    return this.service.adminList(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '[Admin] Chi tiết sản phẩm OCOP' })
  @ApiResponse({ status: 200, type: OcopAdminResponseDto })
  detail(@Param('id') id: string): Promise<OcopAdminResponseDto> {
    return this.service.adminDetail(id);
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Tạo sản phẩm OCOP' })
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateOcopProductDto,
  ): Promise<OcopAdminResponseDto> {
    return this.service.create(actor.id, dto);
  }

  @Put(':id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Cập nhật với optimistic locking' })
  @ApiResponse({ status: 409, description: 'OCOP_PRODUCT_VERSION_CONFLICT' })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateOcopProductDto,
  ): Promise<OcopAdminResponseDto> {
    return this.service.update(actor.id, id, dto);
  }

  @Patch('reorder')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: '[Admin] Sắp xếp nhiều sản phẩm OCOP trong một transaction',
  })
  reorder(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: ReorderOcopProductsDto,
  ): Promise<OcopAdminResponseDto[]> {
    return this.service.reorder(actor.id, dto);
  }

  @Patch(':id/status')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Ẩn hoặc hiện sản phẩm OCOP' })
  updateStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateOcopProductStatusDto,
  ): Promise<OcopAdminResponseDto> {
    return this.service.updateStatus(actor.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Xóa sản phẩm OCOP' })
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.remove(actor.id, id);
  }
}

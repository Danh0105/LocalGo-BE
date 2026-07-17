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
  ReorderAgricultureItemsDto,
  UpdateAgricultureItemStatusDto,
} from '../dto/agriculture-action.dto';
import { QueryAgricultureAdminDto } from '../dto/query-agriculture.dto';
import { AgricultureAdminResponseDto } from '../dto/agriculture-response.dto';
import {
  CreateAgricultureItemDto,
  UpdateAgricultureItemDto,
} from '../dto/upsert-agriculture.dto';
import { AgricultureService } from '../services/agriculture.service';

@ApiTags('admin-agriculture')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
@Controller('admin/agriculture')
export class AgricultureAdminController {
  constructor(private readonly service: AgricultureService) {}

  @Get()
  @ApiOperation({ summary: '[Admin] Danh sách đầy đủ nội dung nông nghiệp' })
  @ApiResponse({ status: 200, type: [AgricultureAdminResponseDto] })
  list(@Query() query: QueryAgricultureAdminDto) {
    return this.service.adminList(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '[Admin] Chi tiết mục nông nghiệp' })
  @ApiResponse({ status: 200, type: AgricultureAdminResponseDto })
  detail(@Param('id') id: string): Promise<AgricultureAdminResponseDto> {
    return this.service.adminDetail(id);
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Tạo mục nông nghiệp' })
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateAgricultureItemDto,
  ): Promise<AgricultureAdminResponseDto> {
    return this.service.create(actor.id, dto);
  }

  @Put(':id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Cập nhật với optimistic locking' })
  @ApiResponse({
    status: 409,
    description: 'AGRICULTURE_ITEM_VERSION_CONFLICT',
  })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAgricultureItemDto,
  ): Promise<AgricultureAdminResponseDto> {
    return this.service.update(actor.id, id, dto);
  }

  @Patch('reorder')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: '[Admin] Sắp xếp nhiều mục nông nghiệp trong một transaction',
  })
  reorder(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: ReorderAgricultureItemsDto,
  ): Promise<AgricultureAdminResponseDto[]> {
    return this.service.reorder(actor.id, dto);
  }

  @Patch(':id/status')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Ẩn hoặc hiện mục nông nghiệp' })
  updateStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAgricultureItemStatusDto,
  ): Promise<AgricultureAdminResponseDto> {
    return this.service.updateStatus(actor.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Xóa mục nông nghiệp' })
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.remove(actor.id, id);
  }
}

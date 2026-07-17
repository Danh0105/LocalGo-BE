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
  ReorderHistoricalSitesDto,
  UpdateHistoricalSiteStatusDto,
} from '../dto/historical-site-action.dto';
import { QueryHistoricalSiteAdminDto } from '../dto/query-historical-site.dto';
import { HistoricalSiteAdminResponseDto } from '../dto/historical-site-response.dto';
import {
  CreateHistoricalSiteDto,
  UpdateHistoricalSiteDto,
} from '../dto/upsert-historical-site.dto';
import { HistoricalSiteService } from '../services/historical-site.service';

@ApiTags('admin-historical-sites')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
@Controller('admin/historical-sites')
export class HistoricalSitesAdminController {
  constructor(private readonly service: HistoricalSiteService) {}

  @Get()
  @ApiOperation({ summary: '[Admin] Danh sách đầy đủ di tích lịch sử' })
  @ApiResponse({ status: 200, type: [HistoricalSiteAdminResponseDto] })
  list(@Query() query: QueryHistoricalSiteAdminDto) {
    return this.service.adminList(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '[Admin] Chi tiết di tích lịch sử' })
  @ApiResponse({ status: 200, type: HistoricalSiteAdminResponseDto })
  detail(@Param('id') id: string): Promise<HistoricalSiteAdminResponseDto> {
    return this.service.adminDetail(id);
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Tạo di tích lịch sử' })
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateHistoricalSiteDto,
  ): Promise<HistoricalSiteAdminResponseDto> {
    return this.service.create(actor.id, dto);
  }

  @Put(':id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Cập nhật với optimistic locking' })
  @ApiResponse({ status: 409, description: 'HISTORICAL_SITE_VERSION_CONFLICT' })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateHistoricalSiteDto,
  ): Promise<HistoricalSiteAdminResponseDto> {
    return this.service.update(actor.id, id, dto);
  }

  @Patch('reorder')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: '[Admin] Sắp xếp nhiều di tích lịch sử trong một transaction',
  })
  reorder(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: ReorderHistoricalSitesDto,
  ): Promise<HistoricalSiteAdminResponseDto[]> {
    return this.service.reorder(actor.id, dto);
  }

  @Patch(':id/status')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Ẩn hoặc hiện di tích lịch sử' })
  updateStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateHistoricalSiteStatusDto,
  ): Promise<HistoricalSiteAdminResponseDto> {
    return this.service.updateStatus(actor.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Xóa di tích lịch sử' })
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.remove(actor.id, id);
  }
}

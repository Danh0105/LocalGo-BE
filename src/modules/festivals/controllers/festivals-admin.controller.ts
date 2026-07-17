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
  ReorderFestivalsDto,
  UpdateFestivalStatusDto,
} from '../dto/festival-action.dto';
import { QueryFestivalAdminDto } from '../dto/query-festival.dto';
import { FestivalAdminResponseDto } from '../dto/festival-response.dto';
import {
  CreateFestivalDto,
  UpdateFestivalDto,
} from '../dto/upsert-festival.dto';
import { FestivalService } from '../services/festival.service';

@ApiTags('admin-festivals')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
@Controller('admin/festivals')
export class FestivalsAdminController {
  constructor(private readonly service: FestivalService) {}

  @Get()
  @ApiOperation({ summary: '[Admin] Danh sách đầy đủ lễ hội' })
  @ApiResponse({ status: 200, type: [FestivalAdminResponseDto] })
  list(@Query() query: QueryFestivalAdminDto) {
    return this.service.adminList(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '[Admin] Chi tiết lễ hội' })
  @ApiResponse({ status: 200, type: FestivalAdminResponseDto })
  detail(@Param('id') id: string): Promise<FestivalAdminResponseDto> {
    return this.service.adminDetail(id);
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Tạo lễ hội' })
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateFestivalDto,
  ): Promise<FestivalAdminResponseDto> {
    return this.service.create(actor.id, dto);
  }

  @Put(':id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Cập nhật với optimistic locking' })
  @ApiResponse({ status: 409, description: 'FESTIVAL_VERSION_CONFLICT' })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateFestivalDto,
  ): Promise<FestivalAdminResponseDto> {
    return this.service.update(actor.id, id, dto);
  }

  @Patch('reorder')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: '[Admin] Sắp xếp nhiều lễ hội trong một transaction',
  })
  reorder(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: ReorderFestivalsDto,
  ): Promise<FestivalAdminResponseDto[]> {
    return this.service.reorder(actor.id, dto);
  }

  @Patch(':id/status')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Ẩn hoặc hiện lễ hội' })
  updateStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateFestivalStatusDto,
  ): Promise<FestivalAdminResponseDto> {
    return this.service.updateStatus(actor.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Xóa lễ hội' })
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.remove(actor.id, id);
  }
}

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
  ReorderTemplesDto,
  UpdateTempleStatusDto,
} from '../dto/temple-action.dto';
import { QueryTempleAdminDto } from '../dto/query-temple.dto';
import { TempleAdminResponseDto } from '../dto/temple-response.dto';
import { CreateTempleDto, UpdateTempleDto } from '../dto/upsert-temple.dto';
import { TempleService } from '../services/temple.service';

@ApiTags('admin-temples')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
@Controller('admin/temples')
export class TemplesAdminController {
  constructor(private readonly service: TempleService) {}

  @Get()
  @ApiOperation({ summary: '[Admin] Danh sách đầy đủ Đền - Chùa - Miếu' })
  @ApiResponse({ status: 200, type: [TempleAdminResponseDto] })
  list(@Query() query: QueryTempleAdminDto) {
    return this.service.adminList(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '[Admin] Chi tiết điểm du lịch' })
  @ApiResponse({ status: 200, type: TempleAdminResponseDto })
  detail(@Param('id') id: string): Promise<TempleAdminResponseDto> {
    return this.service.adminDetail(id);
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Tạo điểm du lịch' })
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateTempleDto,
  ): Promise<TempleAdminResponseDto> {
    return this.service.create(actor.id, dto);
  }

  @Put(':id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Cập nhật với optimistic locking' })
  @ApiResponse({ status: 409, description: 'TEMPLE_VERSION_CONFLICT' })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTempleDto,
  ): Promise<TempleAdminResponseDto> {
    return this.service.update(actor.id, id, dto);
  }

  @Patch('reorder')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Sắp xếp nhiều điểm trong một transaction' })
  reorder(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: ReorderTemplesDto,
  ): Promise<TempleAdminResponseDto[]> {
    return this.service.reorder(actor.id, dto);
  }

  @Patch(':id/status')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Ẩn hoặc hiện điểm du lịch' })
  updateStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTempleStatusDto,
  ): Promise<TempleAdminResponseDto> {
    return this.service.updateStatus(actor.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Xóa điểm du lịch và các sự kiện con' })
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.remove(actor.id, id);
  }
}

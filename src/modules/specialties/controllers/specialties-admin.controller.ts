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
  ReorderSpecialtiesDto,
  UpdateSpecialtyStatusDto,
} from '../dto/specialty-action.dto';
import { QuerySpecialtyAdminDto } from '../dto/query-specialty.dto';
import { SpecialtyAdminResponseDto } from '../dto/specialty-response.dto';
import {
  CreateSpecialtyDto,
  UpdateSpecialtyDto,
} from '../dto/upsert-specialty.dto';
import { SpecialtyService } from '../services/specialty.service';

@ApiTags('admin-specialties')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
@Controller('admin/specialties')
export class SpecialtiesAdminController {
  constructor(private readonly service: SpecialtyService) {}

  @Get()
  @ApiOperation({ summary: '[Admin] Danh sách đầy đủ đặc sản' })
  @ApiResponse({ status: 200, type: [SpecialtyAdminResponseDto] })
  list(@Query() query: QuerySpecialtyAdminDto) {
    return this.service.adminList(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '[Admin] Chi tiết đặc sản' })
  @ApiResponse({ status: 200, type: SpecialtyAdminResponseDto })
  detail(@Param('id') id: string): Promise<SpecialtyAdminResponseDto> {
    return this.service.adminDetail(id);
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Tạo đặc sản' })
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateSpecialtyDto,
  ): Promise<SpecialtyAdminResponseDto> {
    return this.service.create(actor.id, dto);
  }

  @Put(':id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Cập nhật với optimistic locking' })
  @ApiResponse({ status: 409, description: 'SPECIALTY_VERSION_CONFLICT' })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateSpecialtyDto,
  ): Promise<SpecialtyAdminResponseDto> {
    return this.service.update(actor.id, id, dto);
  }

  @Patch('reorder')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: '[Admin] Sắp xếp nhiều đặc sản trong một transaction',
  })
  reorder(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: ReorderSpecialtiesDto,
  ): Promise<SpecialtyAdminResponseDto[]> {
    return this.service.reorder(actor.id, dto);
  }

  @Patch(':id/status')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Ẩn hoặc hiện đặc sản' })
  updateStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateSpecialtyStatusDto,
  ): Promise<SpecialtyAdminResponseDto> {
    return this.service.updateStatus(actor.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Xóa đặc sản' })
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.remove(actor.id, id);
  }
}

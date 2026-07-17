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
  ReorderExperienceToursDto,
  UpdateExperienceTourStatusDto,
} from '../dto/experience-tour-action.dto';
import { QueryExperienceTourAdminDto } from '../dto/query-experience-tour.dto';
import { ExperienceTourAdminResponseDto } from '../dto/experience-tour-response.dto';
import {
  CreateExperienceTourDto,
  UpdateExperienceTourDto,
} from '../dto/upsert-experience-tour.dto';
import { ExperienceTourService } from '../services/experience-tour.service';

@ApiTags('admin-experience-tours')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
@Controller('admin/experience-tours')
export class ExperienceToursAdminController {
  constructor(private readonly service: ExperienceTourService) {}

  @Get()
  @ApiOperation({ summary: '[Admin] Danh sách đầy đủ tour trải nghiệm' })
  @ApiResponse({ status: 200, type: [ExperienceTourAdminResponseDto] })
  list(@Query() query: QueryExperienceTourAdminDto) {
    return this.service.adminList(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '[Admin] Chi tiết tour trải nghiệm' })
  @ApiResponse({ status: 200, type: ExperienceTourAdminResponseDto })
  detail(@Param('id') id: string): Promise<ExperienceTourAdminResponseDto> {
    return this.service.adminDetail(id);
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Tạo tour trải nghiệm' })
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateExperienceTourDto,
  ): Promise<ExperienceTourAdminResponseDto> {
    return this.service.create(actor.id, dto);
  }

  @Put(':id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Cập nhật với optimistic locking' })
  @ApiResponse({ status: 409, description: 'EXPERIENCE_TOUR_VERSION_CONFLICT' })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateExperienceTourDto,
  ): Promise<ExperienceTourAdminResponseDto> {
    return this.service.update(actor.id, id, dto);
  }

  @Patch('reorder')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: '[Admin] Sắp xếp nhiều tour trải nghiệm trong một transaction',
  })
  reorder(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: ReorderExperienceToursDto,
  ): Promise<ExperienceTourAdminResponseDto[]> {
    return this.service.reorder(actor.id, dto);
  }

  @Patch(':id/status')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Ẩn hoặc hiện tour trải nghiệm' })
  updateStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateExperienceTourStatusDto,
  ): Promise<ExperienceTourAdminResponseDto> {
    return this.service.updateStatus(actor.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Xóa tour trải nghiệm' })
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.remove(actor.id, id);
  }
}

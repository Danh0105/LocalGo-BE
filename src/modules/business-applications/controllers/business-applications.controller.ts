import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { BusinessApplicationResponseDto } from '../dto/business-application-response.dto';
import { UpsertBusinessApplicationDto } from '../dto/upsert-business-application.dto';
import { BusinessApplicationService } from '../services/business-application.service';

@ApiTags('business-applications')
@ApiBearerAuth()
@Controller('business-applications')
export class BusinessApplicationsController {
  constructor(private readonly service: BusinessApplicationService) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Nộp hồ sơ đăng ký tài khoản BUSINESS' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertBusinessApplicationDto,
  ) {
    return BusinessApplicationResponseDto.fromEntity(
      await this.service.create(user.id, dto),
    );
  }

  @Get('me')
  @ApiOperation({ summary: 'Hồ sơ BUSINESS mới nhất của người dùng hiện tại' })
  async getMine(@CurrentUser() user: AuthenticatedUser) {
    return BusinessApplicationResponseDto.fromEntity(
      await this.service.getMine(user.id),
    );
  }

  @Patch(':id')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Chỉnh sửa và gửi lại hồ sơ BUSINESS bị từ chối' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpsertBusinessApplicationDto,
  ) {
    return BusinessApplicationResponseDto.fromEntity(
      await this.service.update(user.id, id, dto),
    );
  }
}

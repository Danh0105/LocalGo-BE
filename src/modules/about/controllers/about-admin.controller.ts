import { Body, Controller, Get, Post, Put } from '@nestjs/common';
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
  AboutAdminStateDto,
  AboutResponseDto,
} from '../dto/about-response.dto';
import { UpdateAboutDto } from '../dto/update-about.dto';
import { AboutService } from '../services/about.service';

@ApiTags('admin-about')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
@Controller('admin/about')
export class AboutAdminController {
  constructor(private readonly service: AboutService) {}

  @Get()
  @ApiOperation({ summary: '[Admin] Bản nháp và metadata Giới thiệu' })
  @ApiResponse({ status: 200, type: AboutAdminStateDto })
  getState(): Promise<AboutAdminStateDto> {
    return this.service.getAdminState();
  }

  @Put()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: '[Admin] Lưu toàn bộ bản nháp với optimistic locking',
  })
  @ApiResponse({ status: 409, description: 'ABOUT_VERSION_CONFLICT' })
  saveDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAboutDto,
  ): Promise<AboutAdminStateDto> {
    return this.service.saveDraft(user.id, dto);
  }

  @Get('preview')
  @ApiOperation({ summary: '[Admin] Xem trước bản nháp đã resolve media' })
  preview(): Promise<AboutResponseDto> {
    return this.service.preview();
  }

  @Post('publish')
  @ApiOperation({ summary: '[Admin] Xuất bản snapshot hiện tại' })
  publish(@CurrentUser() user: AuthenticatedUser): Promise<AboutResponseDto> {
    return this.service.publish(user.id);
  }

  @Post('discard-draft')
  @ApiOperation({ summary: '[Admin] Hủy thay đổi và khôi phục bản published' })
  discardDraft(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AboutAdminStateDto> {
    return this.service.discardDraft(user.id);
  }
}

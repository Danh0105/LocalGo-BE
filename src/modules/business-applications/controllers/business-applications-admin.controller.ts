import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '../../../../generated/prisma';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { BusinessApplicationResponseDto } from '../dto/business-application-response.dto';
import { QueryBusinessApplicationsDto } from '../dto/query-business-applications.dto';
import { RejectBusinessApplicationDto } from '../dto/reject-business-application.dto';
import { BusinessApplicationService } from '../services/business-application.service';

@ApiTags('admin-business-applications')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
@Controller('admin/business-applications')
export class BusinessApplicationsAdminController {
  constructor(private readonly service: BusinessApplicationService) {}

  @Get()
  @ApiOperation({ summary: '[Admin] Danh sách hồ sơ đăng ký BUSINESS' })
  async list(@Query() query: QueryBusinessApplicationsDto) {
    const result = await this.service.listForAdmin(query);
    return {
      data: result.data.map((item) =>
        BusinessApplicationResponseDto.fromEntity(item),
      ),
      meta: result.meta,
    };
  }

  @Post(':id/approve')
  @ApiOperation({
    summary: '[Admin] Duyệt hồ sơ và nâng tài khoản Zalo thành BUSINESS',
  })
  async approve(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return BusinessApplicationResponseDto.fromEntity(
      await this.service.approve(actor.id, id),
    );
  }

  @Post(':id/reject')
  @ApiOperation({ summary: '[Admin] Từ chối hồ sơ BUSINESS' })
  async reject(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RejectBusinessApplicationDto,
  ) {
    return BusinessApplicationResponseDto.fromEntity(
      await this.service.reject(actor.id, id, dto.reason),
    );
  }
}

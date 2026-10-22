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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '../../../../generated/prisma';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { BusinessProfileResponseDto } from '../dto/business-profile-response.dto';
import { QueryAdminBusinessProfilesDto } from '../dto/query-business-profiles.dto';
import {
  AdminCreateBusinessProfileDto,
  UpdateBusinessProfileDto,
} from '../dto/upsert-business-profile.dto';
import { BusinessProfileService } from '../services/business-profile.service';

@ApiTags('admin-business-profiles')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
@Controller('admin/business-profiles')
export class BusinessProfilesAdminController {
  constructor(private readonly service: BusinessProfileService) {}

  @Get()
  @ApiOperation({ summary: '[Admin] Danh sách hồ sơ doanh nghiệp' })
  async list(@Query() query: QueryAdminBusinessProfilesDto) {
    const result = await this.service.listAdmin(query);
    return {
      data: result.data.map((item) =>
        BusinessProfileResponseDto.fromRecord(item),
      ),
      meta: result.meta,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: '[Admin] Chi tiết hồ sơ doanh nghiệp' })
  async get(@Param('id') id: string) {
    return BusinessProfileResponseDto.fromRecord(
      await this.service.getAdmin(id),
    );
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[Admin] Tạo hồ sơ cho một tài khoản BUSINESS' })
  async create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: AdminCreateBusinessProfileDto,
  ) {
    return BusinessProfileResponseDto.fromRecord(
      await this.service.createAdmin(actor.id, dto),
    );
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[Admin] Cập nhật hồ sơ doanh nghiệp' })
  async update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateBusinessProfileDto,
  ) {
    return BusinessProfileResponseDto.fromRecord(
      await this.service.updateAdmin(actor.id, id, dto),
    );
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Xóa mềm hồ sơ doanh nghiệp' })
  async delete(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.deleteAdmin(actor.id, id);
  }
}

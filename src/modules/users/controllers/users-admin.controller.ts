import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '../../../../generated/prisma';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { QueryAdminUsersDto } from '../dto/query-admin-users.dto';
import { UpdateUserStatusDto } from '../dto/update-user-status.dto';
import { UserResponseDto } from '../dto/user-response.dto';
import { UserAdminService } from '../services/user-admin.service';

@ApiTags('admin-users')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
@Controller('admin/users')
export class UsersAdminController {
  constructor(private readonly userAdminService: UserAdminService) {}

  @Get()
  @ApiOperation({ summary: '[Admin] Danh sách người dùng' })
  async list(@Query() query: QueryAdminUsersDto) {
    const result = await this.userAdminService.list(query);
    return {
      data: result.data.map((item) => UserResponseDto.fromEntity(item)),
      meta: result.meta,
    };
  }

  @Patch(':id/status')
  @ApiOperation({ summary: '[Admin] Khóa hoặc mở khóa người dùng' })
  async updateStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ): Promise<UserResponseDto> {
    const user = await this.userAdminService.updateStatus(
      actor,
      id,
      dto.status,
    );
    return UserResponseDto.fromEntity(user);
  }
}

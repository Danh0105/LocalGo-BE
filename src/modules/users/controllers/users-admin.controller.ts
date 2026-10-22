import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '../../../../generated/prisma';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { CreateAdminUserDto } from '../dto/create-admin-user.dto';
import { QueryAdminUsersDto } from '../dto/query-admin-users.dto';
import { UpdateUserPasswordDto } from '../dto/update-user-password.dto';
import { UpdateUserRoleDto } from '../dto/update-user-role.dto';
import { UpdateUserStatusDto } from '../dto/update-user-status.dto';
import { UserResponseDto } from '../dto/user-response.dto';
import { UserDeletionImpactDto } from '../dto/user-deletion-impact.dto';
import { UserAdminService } from '../services/user-admin.service';

@ApiTags('admin-users')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
@Controller('admin/users')
export class UsersAdminController {
  constructor(private readonly userAdminService: UserAdminService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: '[Admin] Tạo tài khoản USER, BUSINESS hoặc MODERATOR',
  })
  async createUser(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateAdminUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.userAdminService.createUser(actor, dto);
    return UserResponseDto.fromEntity(user);
  }

  @Get()
  @ApiOperation({ summary: '[Admin] Danh sách người dùng' })
  async list(@Query() query: QueryAdminUsersDto) {
    const result = await this.userAdminService.list(query);
    return {
      data: result.data.map((item) => UserResponseDto.fromEntity(item)),
      meta: result.meta,
    };
  }

  @Get(':id/deletion-impact')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: '[Admin] Xem toàn bộ dữ liệu sẽ bị xóa cùng tài khoản',
  })
  getDeletionImpact(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<UserDeletionImpactDto> {
    return this.userAdminService.getDeletionImpact(actor, id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: '[Admin] Xóa vĩnh viễn tài khoản và toàn bộ dữ liệu liên quan',
  })
  async deleteAccount(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ deleted: true }> {
    await this.userAdminService.deleteAccount(actor, id);
    return { deleted: true };
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

  @Patch(':id/role')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[Admin] Thay đổi vai trò người dùng' })
  async updateRole(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ): Promise<UserResponseDto> {
    const user = await this.userAdminService.updateRole(actor, id, dto.role);
    return UserResponseDto.fromEntity(user);
  }

  @Patch(':id/password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Đặt lại mật khẩu người dùng' })
  async updatePassword(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserPasswordDto,
  ): Promise<UserResponseDto> {
    const user = await this.userAdminService.updatePassword(
      actor,
      id,
      dto.password,
    );
    return UserResponseDto.fromEntity(user);
  }
}

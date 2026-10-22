import { HttpStatus, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { UserRole, UserStatus } from '../../../../generated/prisma';
import { ErrorCode } from '../../../common/constants/error-codes.constant';
import { PaginatedResultDto } from '../../../common/dto/pagination-meta.dto';
import { AppException } from '../../../common/exceptions/app.exception';
import {
  buildPaginationArgs,
  paginate,
} from '../../../common/pagination/pagination.util';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { CreateAdminUserDto } from '../dto/create-admin-user.dto';
import { QueryAdminUsersDto } from '../dto/query-admin-users.dto';
import { UserEntity } from '../entities/user.entity';
import { UserRepository } from '../repositories/user.repository';
import { MediaService } from '../../media/services/media.service';
import type { UserDeletionImpactDto } from '../dto/user-deletion-impact.dto';

@Injectable()
export class UserAdminService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly mediaService: MediaService,
  ) {}

  private assertAdmin(actor: AuthenticatedUser): void {
    if (actor.role !== UserRole.ADMIN) {
      throw new AppException(
        ErrorCode.INSUFFICIENT_PERMISSION,
        'Chỉ quản trị viên mới được xóa tài khoản',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private async findDeletionTarget(actor: AuthenticatedUser, targetId: string) {
    this.assertAdmin(actor);
    if (actor.id === targetId) {
      throw new AppException(
        ErrorCode.CANNOT_DELETE_SELF,
        'Bạn không thể xóa tài khoản đang đăng nhập.',
        HttpStatus.CONFLICT,
      );
    }
    const target = await this.userRepository.findById(targetId);
    if (!target) {
      throw new AppException(
        ErrorCode.USER_NOT_FOUND,
        'Không tìm thấy người dùng',
        HttpStatus.NOT_FOUND,
      );
    }
    return target;
  }

  async getDeletionImpact(
    actor: AuthenticatedUser,
    targetId: string,
  ): Promise<UserDeletionImpactDto> {
    const target = await this.findDeletionTarget(actor, targetId);
    const counts = await this.userRepository.getDeletionCounts(targetId);
    return {
      userId: target.id,
      displayName: target.displayName,
      email: target.email,
      role: target.role,
      counts,
    };
  }

  async deleteAccount(
    actor: AuthenticatedUser,
    targetId: string,
  ): Promise<void> {
    await this.findDeletionTarget(actor, targetId);
    const mediaIds = await this.userRepository.deleteAccountAndRelatedData({
      actorId: actor.id,
      targetId,
    });
    await this.mediaService.purgeStorage(mediaIds);
    await this.userRepository.hardDeleteMedia(mediaIds);
  }

  async createUser(
    actor: AuthenticatedUser,
    dto: CreateAdminUserDto,
  ): Promise<UserEntity> {
    if (actor.role !== UserRole.ADMIN) {
      throw new AppException(
        ErrorCode.INSUFFICIENT_PERMISSION,
        'Chỉ quản trị viên mới được tạo tài khoản',
        HttpStatus.FORBIDDEN,
      );
    }
    if (dto.role === UserRole.ADMIN) {
      throw new AppException(
        ErrorCode.INSUFFICIENT_PERMISSION,
        'Không được phép tạo thêm tài khoản quản trị viên',
        HttpStatus.FORBIDDEN,
      );
    }

    const email = dto.email.trim().toLowerCase();
    if (await this.userRepository.emailExists(email)) {
      throw new AppException(
        ErrorCode.EMAIL_ALREADY_EXISTS,
        'Email đã được sử dụng',
        HttpStatus.CONFLICT,
      );
    }
    const phone = dto.phone?.trim() || null;
    if (phone && (await this.userRepository.phoneExists(phone))) {
      throw new AppException(
        ErrorCode.PHONE_ALREADY_EXISTS,
        'Số điện thoại đã được sử dụng',
        HttpStatus.CONFLICT,
      );
    }

    const passwordHash = await argon2.hash(dto.password);
    const created = await this.userRepository.createUserWithAudit({
      actorId: actor.id,
      displayName: dto.displayName.trim(),
      email,
      phone,
      passwordHash,
      role: dto.role,
    });
    return new UserEntity(created);
  }

  async list(
    query: QueryAdminUsersDto,
  ): Promise<PaginatedResultDto<UserEntity>> {
    const { skip, take } = buildPaginationArgs(query.page, query.limit);
    const result = await this.userRepository.findAdminList({
      skip,
      take,
      role: query.role,
      status: query.status,
      search: query.search?.trim(),
      sortOrder: query.sortOrder,
    });
    return paginate(
      result.items.map((user) => new UserEntity(user)),
      query.page,
      query.limit,
      result.total,
    );
  }

  async updateStatus(
    actor: AuthenticatedUser,
    targetId: string,
    status: UserStatus,
  ): Promise<UserEntity> {
    if (actor.id === targetId) {
      throw new AppException(
        ErrorCode.CANNOT_UPDATE_SELF_STATUS,
        'Bạn không thể thay đổi trạng thái tài khoản đang đăng nhập.',
        HttpStatus.CONFLICT,
      );
    }
    const target = await this.userRepository.findById(targetId);
    if (!target) {
      throw new AppException(
        ErrorCode.USER_NOT_FOUND,
        'Không tìm thấy người dùng',
        HttpStatus.NOT_FOUND,
      );
    }
    if (actor.role === UserRole.MODERATOR && target.role === UserRole.ADMIN) {
      throw new AppException(
        ErrorCode.INSUFFICIENT_PERMISSION,
        'Kiểm duyệt viên không được thay đổi trạng thái quản trị viên',
        HttpStatus.FORBIDDEN,
      );
    }
    const updated = await this.userRepository.updateStatusAndRevokeSessions({
      actorId: actor.id,
      target,
      status,
    });
    return new UserEntity(updated);
  }

  async updateRole(
    actor: AuthenticatedUser,
    targetId: string,
    role: UserRole,
  ): Promise<UserEntity> {
    if (actor.id === targetId) {
      throw new AppException(
        ErrorCode.CANNOT_UPDATE_SELF_ROLE,
        'Bạn không thể thay đổi vai trò của tài khoản đang đăng nhập.',
        HttpStatus.CONFLICT,
      );
    }
    if (actor.role !== UserRole.ADMIN) {
      throw new AppException(
        ErrorCode.INSUFFICIENT_PERMISSION,
        'Chỉ quản trị viên mới được thay đổi vai trò người dùng',
        HttpStatus.FORBIDDEN,
      );
    }
    const target = await this.userRepository.findById(targetId);
    if (!target) {
      throw new AppException(
        ErrorCode.USER_NOT_FOUND,
        'Không tìm thấy người dùng',
        HttpStatus.NOT_FOUND,
      );
    }
    const updated = await this.userRepository.updateRole({
      actorId: actor.id,
      target,
      role,
    });
    return new UserEntity(updated);
  }

  async updatePassword(
    actor: AuthenticatedUser,
    targetId: string,
    password: string,
  ): Promise<UserEntity> {
    if (actor.role !== UserRole.ADMIN) {
      throw new AppException(
        ErrorCode.INSUFFICIENT_PERMISSION,
        'Chỉ quản trị viên mới được đặt lại mật khẩu người dùng',
        HttpStatus.FORBIDDEN,
      );
    }
    const target = await this.userRepository.findById(targetId);
    if (!target) {
      throw new AppException(
        ErrorCode.USER_NOT_FOUND,
        'Không tìm thấy người dùng',
        HttpStatus.NOT_FOUND,
      );
    }
    const passwordHash = await argon2.hash(password);
    const updated = await this.userRepository.updatePasswordAndRevokeSessions({
      actorId: actor.id,
      target,
      passwordHash,
    });
    return new UserEntity(updated);
  }
}

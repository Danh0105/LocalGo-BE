import { HttpStatus, Injectable } from '@nestjs/common';
import { UserRole, UserStatus } from '../../../../generated/prisma';
import { ErrorCode } from '../../../common/constants/error-codes.constant';
import { PaginatedResultDto } from '../../../common/dto/pagination-meta.dto';
import { AppException } from '../../../common/exceptions/app.exception';
import {
  buildPaginationArgs,
  paginate,
} from '../../../common/pagination/pagination.util';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { QueryAdminUsersDto } from '../dto/query-admin-users.dto';
import { UserEntity } from '../entities/user.entity';
import { UserRepository } from '../repositories/user.repository';

@Injectable()
export class UserAdminService {
  constructor(private readonly userRepository: UserRepository) {}

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
}

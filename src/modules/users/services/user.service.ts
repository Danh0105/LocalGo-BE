import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import {
  BusinessType,
  UserRole,
  UserStatus,
  type User,
} from '../../../../generated/prisma';
import { ErrorCode } from '../../../common/constants/error-codes.constant';
import { AppException } from '../../../common/exceptions/app.exception';
import type { ChangePasswordDto } from '../dto/change-password.dto';
import { UserRepository } from '../repositories/user.repository';
import { UserEntity } from '../entities/user.entity';
import { UpdateProfileDto } from '../dto/update-profile.dto';

export interface ZaloProfileInput {
  zaloId: string;
  displayName: string;
  avatarUrl?: string;
}

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async getProfile(userId: string): Promise<UserEntity> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }
    return new UserEntity(user);
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserEntity> {
    const user = await this.userRepository.update(userId, {
      ...(dto.displayName !== undefined
        ? { displayName: dto.displayName }
        : {}),
      ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
    });
    return new UserEntity(user);
  }

  async findOrCreateByZaloProfile(
    profile: ZaloProfileInput,
  ): Promise<UserEntity> {
    const existing = await this.userRepository.findByZaloId(profile.zaloId);
    if (existing) {
      return new UserEntity(existing);
    }
    const created = await this.userRepository.create({
      zaloId: profile.zaloId,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
    });
    return new UserEntity(created);
  }

  /**
   * Internal-only: returns the raw row including passwordHash for AuthService
   * to verify credentials against. Never expose this via a controller.
   */
  async findByEmailForAuth(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  async changeGardenOwnerPassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<void> {
    if (dto.newPassword !== dto.newPasswordConfirmation) {
      throw new AppException(
        ErrorCode.PASSWORD_CONFIRMATION_MISMATCH,
        'Xác nhận mật khẩu mới không trùng khớp',
        HttpStatus.BAD_REQUEST,
      );
    }
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    if (
      user.role !== UserRole.BUSINESS ||
      user.businessType !== BusinessType.GARDEN
    ) {
      throw new AppException(
        ErrorCode.GARDEN_ACCOUNT_REQUIRED,
        'Chỉ tài khoản Chủ vườn được sử dụng chức năng này',
        HttpStatus.FORBIDDEN,
      );
    }
    if (user.status !== UserStatus.ACTIVE || !user.passwordHash) {
      throw new AppException(
        ErrorCode.CURRENT_PASSWORD_INVALID,
        'Mật khẩu hiện tại không đúng',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const matches = await argon2
      .verify(user.passwordHash, dto.currentPassword)
      .catch(() => false);
    if (!matches) {
      throw new AppException(
        ErrorCode.CURRENT_PASSWORD_INVALID,
        'Mật khẩu hiện tại không đúng',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const passwordHash = await argon2.hash(dto.newPassword);
    await this.userRepository.changeOwnPasswordAndRevokeSessions({
      userId,
      passwordHash,
    });
  }

  async createPasswordResetTokenForEmail(params: {
    email: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<string | null> {
    const user = await this.userRepository.findByEmail(params.email);
    if (!user || user.status !== UserStatus.ACTIVE) return null;
    await this.userRepository.createPasswordResetToken({
      userId: user.id,
      tokenHash: params.tokenHash,
      expiresAt: params.expiresAt,
    });
    return user.email;
  }

  async resetPasswordWithToken(params: {
    tokenHash: string;
    passwordHash: string;
  }): Promise<boolean> {
    const user = await this.userRepository.consumePasswordResetToken(params);
    return user !== null;
  }

  async touchLastLogin(userId: string): Promise<void> {
    await this.userRepository.touchLastLogin(userId);
  }

  async findZaloIdById(userId: string): Promise<string | null> {
    const user = await this.userRepository.findById(userId);
    return user?.zaloId ?? null;
  }
}

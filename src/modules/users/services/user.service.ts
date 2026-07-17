import { Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '../../../../generated/prisma';
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

  async touchLastLogin(userId: string): Promise<void> {
    await this.userRepository.touchLastLogin(userId);
  }
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { UserRole, UserStatus } from '../../../../generated/prisma';
import type { UserEntity } from '../entities/user.entity';

export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional({ nullable: true })
  zaloId: string | null;

  @ApiPropertyOptional({ nullable: true })
  phone: string | null;

  @ApiPropertyOptional({ nullable: true })
  email: string | null;

  @ApiProperty()
  displayName: string;

  @ApiPropertyOptional({ nullable: true })
  avatarUrl: string | null;

  @ApiProperty({ enum: ['USER', 'BUSINESS', 'MODERATOR', 'ADMIN'] })
  role: UserRole;

  @ApiProperty({ enum: ['ACTIVE', 'BLOCKED', 'PENDING'] })
  status: UserStatus;

  @ApiPropertyOptional({ nullable: true })
  lastLoginAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(entity: UserEntity): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = entity.id;
    dto.zaloId = entity.zaloId;
    dto.phone = entity.phone;
    dto.email = entity.email;
    dto.displayName = entity.displayName;
    dto.avatarUrl = entity.avatarUrl;
    dto.role = entity.role;
    dto.status = entity.status;
    dto.lastLoginAt = entity.lastLoginAt;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}

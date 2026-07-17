import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { SessionEntity } from '../entities/session.entity';

export class SessionResponseDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional({ nullable: true })
  userAgent: string | null;

  @ApiPropertyOptional({ nullable: true })
  ipAddress: string | null;

  @ApiProperty()
  issuedAt: Date;

  @ApiProperty()
  expiresAt: Date;

  static fromEntity(entity: SessionEntity): SessionResponseDto {
    const dto = new SessionResponseDto();
    dto.id = entity.id;
    dto.userAgent = entity.userAgent;
    dto.ipAddress = entity.ipAddress;
    dto.issuedAt = entity.issuedAt;
    dto.expiresAt = entity.expiresAt;
    return dto;
  }
}

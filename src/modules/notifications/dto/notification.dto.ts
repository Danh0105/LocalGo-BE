import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import type { Notification } from '../../../../generated/prisma';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { NotificationType, type NotificationData } from '../notification-types';

export class QueryNotificationsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Chỉ lấy thông báo chưa đọc' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  unreadOnly?: boolean;
}

export class NotificationResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: Object.values(NotificationType) })
  type: string;
  @ApiProperty() title: string;
  @ApiProperty() body: string;
  @ApiPropertyOptional({
    nullable: true,
    description:
      'Dữ liệu điều hướng. Với tin giao thương dùng tradePostId, tradePostSlug, slug (legacy), tradePostTarget và tradePostAvailable.',
  })
  data: NotificationData | null;
  @ApiPropertyOptional({ nullable: true }) readAt: Date | null;
  @ApiProperty() createdAt: Date;

  static fromRecord(
    record: Notification,
    resolvedData?: NotificationData | null,
  ): NotificationResponseDto {
    const dto = new NotificationResponseDto();
    dto.id = record.id;
    dto.type = record.type;
    dto.title = record.title;
    dto.body = record.body;
    dto.data =
      resolvedData === undefined
        ? ((record.data as NotificationData | null) ?? null)
        : resolvedData;
    dto.readAt = record.readAt;
    dto.createdAt = record.createdAt;
    return dto;
  }
}

export class UnreadCountResponseDto {
  @ApiProperty() unreadCount: number;
}

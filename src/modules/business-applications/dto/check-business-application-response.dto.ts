import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { BusinessApplicationStatus } from '../../../../generated/prisma';

export class CheckBusinessApplicationResponseDto {
  @ApiProperty({
    description: 'Zalo ID này đã từng nộp hồ sơ Business hay chưa',
  })
  exists: boolean;

  @ApiPropertyOptional({
    nullable: true,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    description: 'Trạng thái hồ sơ gần nhất, null nếu chưa từng nộp',
  })
  status: BusinessApplicationStatus | null;
}

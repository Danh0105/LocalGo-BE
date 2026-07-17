import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { TradeReviewStatus } from '../../../../../generated/prisma';

export class ModerateTradeReviewDto {
  @ApiProperty({
    enum: [TradeReviewStatus.PUBLISHED, TradeReviewStatus.HIDDEN],
  })
  @IsIn([TradeReviewStatus.PUBLISHED, TradeReviewStatus.HIDDEN])
  status: 'PUBLISHED' | 'HIDDEN';
}

import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import {
  TRADE_POST_INTERACTION_TYPES,
  type TradePostInteractionType,
} from '../../trade.constants';

export class RecordTradePostInteractionDto {
  @ApiProperty({
    enum: TRADE_POST_INTERACTION_TYPES,
    description:
      'Loại tương tác: CONTACT_PHONE (bấm gọi điện), CONTACT_ZALO (bấm liên hệ Zalo), SHARE (chia sẻ).',
  })
  @IsIn(TRADE_POST_INTERACTION_TYPES)
  type: TradePostInteractionType;
}

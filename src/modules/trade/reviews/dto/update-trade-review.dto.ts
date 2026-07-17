import { PartialType } from '@nestjs/swagger';
import { CreateTradeReviewDto } from './create-trade-review.dto';

export class UpdateTradeReviewDto extends PartialType(CreateTradeReviewDto) {}

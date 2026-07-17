import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { MAX_TRADE_REVIEW_IMAGES } from '../../trade.constants';

export class CreateTradeReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ maxLength: 500 })
  @IsString()
  @Length(1, 500)
  content: string;

  @ApiPropertyOptional({
    description: `Danh sách id ảnh đã tải lên qua POST /media/images (tối đa ${MAX_TRADE_REVIEW_IMAGES})`,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TRADE_REVIEW_IMAGES)
  @IsUUID('4', { each: true })
  imageIds?: string[];
}

import { ApiProperty } from '@nestjs/swagger';
import type { TradePostEntity } from '../../posts/entities/trade-post.entity';
import { TradePostResponseDto } from '../../posts/dto/trade-post-response.dto';

/** A post in "Tin đã lưu": the post plus when it was saved and whether it is still public. */
export class SavedTradePostResponseDto extends TradePostResponseDto {
  @ApiProperty({ description: 'Thời điểm lưu tin' })
  savedAt: Date;

  @ApiProperty({
    description:
      'Tin còn hiển thị công khai không (false: đã ẩn, hết hạn, lưu trữ hoặc chờ duyệt lại)',
  })
  isAvailable: boolean;

  static fromSaved(saved: {
    post: TradePostEntity;
    savedAt: Date;
    isAvailable: boolean;
  }): SavedTradePostResponseDto {
    const dto = Object.assign(
      new SavedTradePostResponseDto(),
      TradePostResponseDto.fromEntity(saved.post),
    );
    dto.isSaved = true;
    dto.savedAt = saved.savedAt;
    dto.isAvailable = saved.isAvailable;
    return dto;
  }
}

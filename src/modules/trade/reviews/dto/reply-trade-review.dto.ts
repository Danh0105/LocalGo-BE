import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class ReplyTradeReviewDto {
  @ApiProperty({
    example: 'Cảm ơn bạn đã tin tưởng...',
    minLength: 1,
    maxLength: 500,
    description: 'Được trim trước khi kiểm tra độ dài và lưu.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 500)
  content: string;
}

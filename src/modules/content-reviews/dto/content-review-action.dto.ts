import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsString, Length } from 'class-validator';
import { ContentReviewStatus } from '../../../../generated/prisma';

export class ModerateContentReviewDto {
  @ApiProperty({ enum: ContentReviewStatus })
  @IsEnum(ContentReviewStatus)
  status: ContentReviewStatus;
}

export class ReplyContentReviewDto {
  @ApiProperty({
    example: 'Cảm ơn bạn đã ghé thăm và chia sẻ cảm nhận...',
    minLength: 1,
    maxLength: 1000,
    description: 'Được trim trước khi kiểm tra độ dài và lưu.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 1000)
  content: string;
}

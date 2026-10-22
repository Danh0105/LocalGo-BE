import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { MAX_CONTENT_REVIEW_IMAGES } from '../content-review.constants';

export class CreateContentReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({
    minLength: 1,
    maxLength: 1000,
    description: 'Nội dung bình luận, được trim trước khi kiểm tra độ dài.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 1000)
  content: string;

  @ApiPropertyOptional({
    description: `Id ảnh đã tải lên qua POST /media/images hoặc POST /media/images/batch (tối đa ${MAX_CONTENT_REVIEW_IMAGES}). Khi cập nhật, mảng này thay thế toàn bộ ảnh cũ.`,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_CONTENT_REVIEW_IMAGES)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  imageIds?: string[];
}

export class UpdateContentReviewDto extends PartialType(
  CreateContentReviewDto,
) {}

import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class CreateTradeReviewCustomerReplyDto {
  @ApiProperty({
    example: 'Cảm ơn chủ tin, mình đã nhận được hỗ trợ.',
    minLength: 1,
    maxLength: 500,
    description: 'Nội dung được trim trước khi kiểm tra độ dài và lưu.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 500)
  content: string;
}

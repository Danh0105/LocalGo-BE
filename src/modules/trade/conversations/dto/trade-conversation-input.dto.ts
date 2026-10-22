import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, IsUUID, Length } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateTradeConversationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  tradePostId: string;

  @ApiProperty({
    example: 'Sản phẩm này còn hàng không?',
    minLength: 1,
    maxLength: 1000,
    description: 'Tin nhắn đầu tiên (được trim).',
  })
  @Transform(trim)
  @IsString()
  @Length(1, 1000)
  message: string;
}

export class SendTradeMessageDto {
  @ApiProperty({
    example: 'Sản phẩm hiện vẫn còn hàng.',
    minLength: 1,
    maxLength: 1000,
    description: 'Được trim trước khi lưu.',
  })
  @Transform(trim)
  @IsString()
  @Length(1, 1000)
  content: string;
}

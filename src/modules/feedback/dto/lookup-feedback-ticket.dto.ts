import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class LookupFeedbackTicketDto {
  @ApiProperty({ example: 'PH-A7K9QX' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  @Matches(/^[A-Za-z0-9-]+$/, { message: 'ticketCode không hợp lệ' })
  ticketCode: string;

  @ApiProperty({ maxLength: 30 })
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  @Matches(/^\+?[0-9\s]+$/, {
    message: 'phone chỉ được chứa chữ số, khoảng trắng và dấu + ở đầu',
  })
  phone: string;
}

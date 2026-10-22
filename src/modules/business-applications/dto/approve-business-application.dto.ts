import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { BusinessApplicationDocumentInputDto } from './business-application-document-input.dto';

export class ApproveBusinessApplicationDto {
  @ApiPropertyOptional({
    deprecated: true,
    writeOnly: true,
    description:
      'Không còn sử dụng. Backend luôn tự sinh mật khẩu; field cũ được chấp nhận nhưng bị bỏ qua để tương thích client chưa cập nhật.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  initialPassword?: string;

  @ApiPropertyOptional({
    type: [BusinessApplicationDocumentInputDto],
    description:
      'Tài liệu admin bổ sung cho hồ sơ khi duyệt (ví dụ khi người dân đăng ký trực tiếp tại UBND và admin nhập hộ) — tải lên qua POST /media/images bằng tài khoản admin trước, rồi đưa mediaId vào đây. Được cộng thêm vào tài liệu đã có, không thay thế.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => BusinessApplicationDocumentInputDto)
  documents?: BusinessApplicationDocumentInputDto[];
}

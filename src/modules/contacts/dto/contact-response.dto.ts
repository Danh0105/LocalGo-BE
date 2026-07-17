import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ContactCategoryLabel } from '../contact.constants';

export class ContactListItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({
    enum: ['Hành chính', 'Khẩn cấp', 'Du lịch', 'Nông nghiệp', 'Phản ánh'],
  })
  category: ContactCategoryLabel;

  @ApiProperty()
  role: string;

  @ApiProperty()
  phone: string;

  @ApiPropertyOptional({ nullable: true })
  email: string | null;

  @ApiProperty()
  address: string;

  @ApiProperty()
  workingTime: string;

  @ApiProperty()
  summary: string;

  @ApiPropertyOptional({ nullable: true })
  imageUrl: string | null;

  @ApiProperty()
  imageAlt: string;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  updatedAt: Date;
}

export class ContactResponseDto extends ContactListItemResponseDto {
  @ApiProperty({ type: [String] })
  description: string[];

  @ApiProperty({ type: [String] })
  supportTopics: string[];

  @ApiProperty()
  note: string;
}

export class ContactAdminResponseDto extends ContactResponseDto {
  @ApiPropertyOptional({ nullable: true })
  mediaId: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  version: number;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional({ nullable: true })
  createdBy: string | null;

  @ApiPropertyOptional({ nullable: true })
  updatedBy: string | null;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { CategoryEntity } from '../entities/category.entity';

export class CategoryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  domain: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiPropertyOptional({ nullable: true })
  icon: string | null;

  @ApiPropertyOptional({ nullable: true })
  parentId: string | null;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  isActive: boolean;

  static fromEntity(entity: CategoryEntity): CategoryResponseDto {
    const dto = new CategoryResponseDto();
    dto.id = entity.id;
    dto.domain = entity.domain;
    dto.slug = entity.slug;
    dto.name = entity.name;
    dto.description = entity.description;
    dto.icon = entity.icon;
    dto.parentId = entity.parentId;
    dto.sortOrder = entity.sortOrder;
    dto.isActive = entity.isActive;
    return dto;
  }
}

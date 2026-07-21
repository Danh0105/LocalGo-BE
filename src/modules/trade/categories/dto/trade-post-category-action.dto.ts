import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class UpdateTradePostCategoryStatusDto {
  @ApiProperty()
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version: number;
}

export class ReorderTradePostCategoryItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id: string;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  sortOrder: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;
}

export class ReorderTradePostCategoriesDto {
  @ApiProperty({ type: [ReorderTradePostCategoryItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReorderTradePostCategoryItemDto)
  items: ReorderTradePostCategoryItemDto[];
}

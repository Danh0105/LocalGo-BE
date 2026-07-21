import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TradePostCategoryEntity } from '../entities/trade-post-category.entity';

export class TradePostCategoryResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'PRODUCT' }) code: string;
  @ApiProperty({ example: 'Sản phẩm' }) name: string;
  @ApiPropertyOptional({
    nullable: true,
    example: 'Đặc sản và sản phẩm địa phương',
  })
  description: string | null;
  @ApiProperty({ minimum: 0 }) sortOrder: number;
  @ApiProperty() requiresPromotionDetails: boolean;

  static fromEntity(
    entity: TradePostCategoryEntity,
  ): TradePostCategoryResponseDto {
    return {
      id: entity.id,
      code: entity.code,
      name: entity.name,
      description: entity.description,
      sortOrder: entity.sortOrder,
      requiresPromotionDetails: entity.requiresPromotionDetails,
    };
  }
}

export class TradePostCategoryAdminResponseDto extends TradePostCategoryResponseDto {
  @ApiProperty() isActive: boolean;
  @ApiProperty({ minimum: 1 }) version: number;
  @ApiProperty({ minimum: 0 }) postCount: number;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiPropertyOptional({ nullable: true }) deletedAt: Date | null;

  static override fromEntity(
    entity: TradePostCategoryEntity,
  ): TradePostCategoryAdminResponseDto {
    return {
      ...TradePostCategoryResponseDto.fromEntity(entity),
      isActive: entity.isActive,
      version: entity.version,
      postCount: entity.postCount ?? 0,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      deletedAt: entity.deletedAt,
    };
  }
}

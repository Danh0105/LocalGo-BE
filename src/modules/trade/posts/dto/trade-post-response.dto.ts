import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BusinessType,
  TradePostPurpose,
  type TradePostPriceType,
  type TradePostStatus,
} from '../../../../../generated/prisma';
import { TradePostCategoryResponseDto } from '../../categories/dto/trade-post-category-response.dto';
import type {
  TradePostEntity,
  TradePostImageView,
  TradePostOwnerView,
} from '../entities/trade-post.entity';

export class TradePostOwnerResponseDto implements TradePostOwnerView {
  @ApiProperty() id: string;
  @ApiProperty() displayName: string;
  @ApiPropertyOptional({ nullable: true }) email: string | null;
  @ApiPropertyOptional({ nullable: true }) phone: string | null;
  @ApiPropertyOptional({ nullable: true }) avatarUrl: string | null;
  @ApiProperty({ enum: ['USER', 'BUSINESS', 'MODERATOR', 'ADMIN'] })
  role: TradePostOwnerView['role'];
  @ApiPropertyOptional({ enum: BusinessType, nullable: true })
  businessType: TradePostOwnerView['businessType'];
  @ApiProperty({ enum: ['ACTIVE', 'BLOCKED', 'PENDING'] })
  status: TradePostOwnerView['status'];
}

export class TradePostResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() slug: string;
  @ApiProperty() ownerId: string;
  @ApiProperty({
    example: 'PRODUCT',
    description: 'Public stable category code.',
  })
  category: string;
  @ApiProperty({ type: () => TradePostCategoryResponseDto })
  categoryInfo: TradePostCategoryResponseDto;
  @ApiProperty() title: string;
  @ApiProperty() summary: string;
  @ApiProperty() description: string;
  @ApiProperty({ enum: TradePostPurpose })
  purpose: TradePostPurpose;
  @ApiPropertyOptional({
    enum: ['FIXED', 'NEGOTIABLE', 'CONTACT'],
    nullable: true,
    description: 'null với tin NON_PROFIT',
  })
  priceType: TradePostPriceType | null;
  @ApiPropertyOptional({ nullable: true }) price: string | null;
  @ApiPropertyOptional({ nullable: true }) priceLabel: string | null;
  @ApiProperty() address: string;
  @ApiPropertyOptional({
    nullable: true,
    example: 'https://maps.app.goo.gl/example',
    description: 'Link Google Maps của địa điểm.',
  })
  googleMapsUrl: string | null;
  @ApiPropertyOptional({ nullable: true }) lat: string | null;
  @ApiPropertyOptional({ nullable: true }) lng: string | null;
  @ApiProperty() contactName: string;
  @ApiProperty() contactPhone: string;
  @ApiPropertyOptional({ nullable: true }) contactZalo: string | null;
  @ApiPropertyOptional({ nullable: true }) thumbnailUrl: string | null;
  @ApiProperty({
    enum: [
      'DRAFT',
      'PENDING',
      'PUBLISHED',
      'HIDDEN',
      'REJECTED',
      'EXPIRED',
      'ARCHIVED',
    ],
  })
  status: TradePostStatus;
  @ApiProperty() featured: boolean;
  @ApiPropertyOptional({ nullable: true }) promotionPercent: number | null;
  @ApiPropertyOptional({ nullable: true }) promotionStartAt: Date | null;
  @ApiPropertyOptional({ nullable: true }) promotionEndAt: Date | null;
  @ApiPropertyOptional({ nullable: true }) eventStartAt: Date | null;
  @ApiPropertyOptional({ nullable: true }) eventEndAt: Date | null;
  @ApiPropertyOptional({ nullable: true }) expiresAt: Date | null;
  @ApiProperty() viewCount: number;
  @ApiProperty({ description: 'Số người đang lưu tin này' })
  saveCount: number;
  @ApiProperty() averageRating: string;
  @ApiProperty() reviewCount: number;
  @ApiPropertyOptional({ nullable: true }) publishedAt: Date | null;
  @ApiPropertyOptional({ nullable: true }) rejectedReason: string | null;
  @ApiPropertyOptional({ nullable: true }) approvedById: string | null;
  @ApiPropertyOptional({ nullable: true }) approvedAt: Date | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiPropertyOptional({ type: () => Object, isArray: true })
  images?: TradePostImageView[];
  @ApiPropertyOptional({ type: () => TradePostOwnerResponseDto })
  owner?: TradePostOwnerView;
  @ApiPropertyOptional({
    description:
      'Người đang xem đã lưu tin này chưa. Có trên danh sách/chi tiết công khai và danh sách đã lưu; false khi chưa đăng nhập.',
  })
  isSaved?: boolean;

  static fromEntity(entity: TradePostEntity): TradePostResponseDto {
    const dto = new TradePostResponseDto();
    dto.id = entity.id;
    dto.slug = entity.slug;
    dto.ownerId = entity.ownerId;
    dto.category = entity.category;
    dto.categoryInfo = entity.categoryInfo;
    dto.title = entity.title;
    dto.summary = entity.summary;
    dto.description = entity.description;
    dto.purpose = entity.purpose;
    dto.priceType = entity.priceType;
    dto.price = entity.price ? entity.price.toString() : null;
    dto.priceLabel = entity.priceLabel;
    dto.address = entity.address;
    dto.googleMapsUrl = entity.googleMapsUrl;
    dto.lat = entity.lat ? entity.lat.toString() : null;
    dto.lng = entity.lng ? entity.lng.toString() : null;
    dto.contactName = entity.contactName;
    dto.contactPhone = entity.contactPhone;
    dto.contactZalo = entity.contactZalo;
    dto.thumbnailUrl = entity.thumbnailUrl;
    dto.status = entity.status;
    dto.featured = entity.featured;
    dto.promotionPercent = entity.promotionPercent;
    dto.promotionStartAt = entity.promotionStartAt;
    dto.promotionEndAt = entity.promotionEndAt;
    dto.eventStartAt = entity.eventStartAt;
    dto.eventEndAt = entity.eventEndAt;
    dto.expiresAt = entity.expiresAt;
    dto.viewCount = entity.viewCount;
    dto.saveCount = entity.saveCount;
    dto.averageRating = entity.averageRating.toString();
    dto.reviewCount = entity.reviewCount;
    dto.publishedAt = entity.publishedAt;
    dto.rejectedReason = entity.rejectedReason;
    dto.approvedById = entity.approvedById;
    dto.approvedAt = entity.approvedAt;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    dto.images = entity.images;
    dto.owner = entity.owner;
    return dto;
  }
}

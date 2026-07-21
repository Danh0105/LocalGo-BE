import type {
  Media,
  Prisma,
  TradePost,
  TradePostCategory,
  TradePostImage,
  TradePostPriceType,
  TradePostStatus,
  User,
  UserRole,
  UserStatus,
} from '../../../../../generated/prisma';
import type { TradePostCategoryInfoView } from '../../categories/entities/trade-post-category.entity';

export interface TradePostImageView {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  sortOrder: number;
}

export type TradePostWithImages = TradePost & {
  category: TradePostCategory;
  images: (TradePostImage & { media: Media })[];
};

export interface TradePostOwnerView {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
}

export type TradePostWithOwner = TradePost & {
  category: TradePostCategory;
  owner: Pick<
    User,
    'id' | 'displayName' | 'email' | 'phone' | 'avatarUrl' | 'role' | 'status'
  >;
};

export type TradePostWithImagesAndOwner = TradePostWithImages &
  TradePostWithOwner;

export type TradePostWithCategory = TradePost & {
  category: TradePostCategory;
};

/**
 * Domain-shape mapper: DB row -> safe internal object. `images` is only
 * populated when the repository query actually joined the gallery (detail
 * views) — list views deliberately skip that join and rely on the
 * denormalized `thumbnailUrl` instead, to avoid an N+1/over-fetch on every
 * list row.
 */
export class TradePostEntity {
  id: string;
  slug: string;
  ownerId: string;
  category: string;
  categoryId: string;
  categoryInfo: TradePostCategoryInfoView;
  title: string;
  summary: string;
  description: string;
  priceType: TradePostPriceType;
  price: Prisma.Decimal | null;
  priceLabel: string | null;
  address: string;
  lat: Prisma.Decimal | null;
  lng: Prisma.Decimal | null;
  contactName: string;
  contactPhone: string;
  contactZalo: string | null;
  thumbnailUrl: string | null;
  status: TradePostStatus;
  featured: boolean;
  promotionPercent: number | null;
  promotionStartAt: Date | null;
  promotionEndAt: Date | null;
  expiresAt: Date | null;
  viewCount: number;
  averageRating: Prisma.Decimal;
  reviewCount: number;
  publishedAt: Date | null;
  rejectedReason: string | null;
  approvedById: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  images?: TradePostImageView[];
  owner?: TradePostOwnerView;

  constructor(
    post:
      | TradePostWithCategory
      | TradePostWithImages
      | TradePostWithOwner
      | TradePostWithImagesAndOwner,
  ) {
    this.id = post.id;
    this.slug = post.slug;
    this.ownerId = post.ownerId;
    this.categoryId = post.categoryId;
    if (!('category' in post)) {
      throw new Error(
        'TradePostEntity requires category relation to be loaded',
      );
    }
    this.category = post.category.code;
    this.categoryInfo = {
      id: post.category.id,
      code: post.category.code,
      name: post.category.name,
      description: post.category.description,
      sortOrder: post.category.sortOrder,
      requiresPromotionDetails: post.category.requiresPromotionDetails,
    };
    this.title = post.title;
    this.summary = post.summary;
    this.description = post.description;
    this.priceType = post.priceType;
    this.price = post.price;
    this.priceLabel = post.priceLabel;
    this.address = post.address;
    this.lat = post.lat;
    this.lng = post.lng;
    this.contactName = post.contactName;
    this.contactPhone = post.contactPhone;
    this.contactZalo = post.contactZalo;
    this.thumbnailUrl = post.thumbnailUrl;
    this.status = post.status;
    this.featured = post.featured;
    this.promotionPercent = post.promotionPercent;
    this.promotionStartAt = post.promotionStartAt;
    this.promotionEndAt = post.promotionEndAt;
    this.expiresAt = post.expiresAt;
    this.viewCount = post.viewCount;
    this.averageRating = post.averageRating;
    this.reviewCount = post.reviewCount;
    this.publishedAt = post.publishedAt;
    this.rejectedReason = post.rejectedReason;
    this.approvedById = post.approvedById;
    this.approvedAt = post.approvedAt;
    this.createdAt = post.createdAt;
    this.updatedAt = post.updatedAt;

    if ('images' in post) {
      this.images = post.images
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((image) => ({
          id: image.mediaId,
          url: image.media.originalUrl,
          thumbnailUrl: image.media.thumbnailUrl,
          sortOrder: image.sortOrder,
        }));
    }
    if ('owner' in post) {
      this.owner = { ...post.owner };
    }
  }
}

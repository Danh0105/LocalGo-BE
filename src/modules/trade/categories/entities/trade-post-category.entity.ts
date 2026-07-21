import type { TradePostCategory } from '../../../../../generated/prisma';

export interface TradePostCategoryInfoView {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  requiresPromotionDetails: boolean;
}

export class TradePostCategoryEntity implements TradePostCategoryInfoView {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  requiresPromotionDetails: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  postCount?: number;

  constructor(category: TradePostCategory & { postCount?: number | null }) {
    this.id = category.id;
    this.code = category.code;
    this.name = category.name;
    this.description = category.description;
    this.sortOrder = category.sortOrder;
    this.isActive = category.isActive;
    this.requiresPromotionDetails = category.requiresPromotionDetails;
    this.version = category.version;
    this.createdAt = category.createdAt;
    this.updatedAt = category.updatedAt;
    this.deletedAt = category.deletedAt;
    if (category.postCount !== undefined) {
      this.postCount = category.postCount ?? 0;
    }
  }

  toInfo(): TradePostCategoryInfoView {
    return {
      id: this.id,
      code: this.code,
      name: this.name,
      description: this.description,
      sortOrder: this.sortOrder,
      requiresPromotionDetails: this.requiresPromotionDetails,
    };
  }
}

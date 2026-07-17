import type { Category } from '../../../../generated/prisma';

export class CategoryEntity {
  id: string;
  domain: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  constructor(category: Category) {
    this.id = category.id;
    this.domain = category.domain;
    this.slug = category.slug;
    this.name = category.name;
    this.description = category.description;
    this.icon = category.icon;
    this.parentId = category.parentId;
    this.sortOrder = category.sortOrder;
    this.isActive = category.isActive;
    this.createdAt = category.createdAt;
    this.updatedAt = category.updatedAt;
  }
}

import { Injectable } from '@nestjs/common';
import type { Category, Prisma } from '../../../../generated/prisma';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class CategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany(where: Prisma.CategoryWhereInput): Promise<Category[]> {
    return this.prisma.category.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  findById(id: string): Promise<Category | null> {
    return this.prisma.category.findFirst({ where: { id, deletedAt: null } });
  }

  findByDomainAndSlug(domain: string, slug: string): Promise<Category | null> {
    return this.prisma.category.findFirst({
      where: { domain, slug, deletedAt: null },
    });
  }

  create(data: Prisma.CategoryUncheckedCreateInput): Promise<Category> {
    return this.prisma.category.create({ data });
  }

  update(
    id: string,
    data: Prisma.CategoryUncheckedUpdateInput,
  ): Promise<Category> {
    return this.prisma.category.update({ where: { id }, data });
  }

  softDelete(id: string): Promise<Category> {
    return this.prisma.category.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}

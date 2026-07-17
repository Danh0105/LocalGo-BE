import { HttpStatus, Injectable } from '@nestjs/common';
import { ErrorCode } from '../../../common/constants/error-codes.constant';
import { AppException } from '../../../common/exceptions/app.exception';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { CategoryEntity } from '../entities/category.entity';
import { CategoryRepository } from '../repositories/category.repository';

@Injectable()
export class CategoryService {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async listByDomain(domain?: string): Promise<CategoryEntity[]> {
    const categories = await this.categoryRepository.findMany({
      deletedAt: null,
      isActive: true,
      ...(domain ? { domain } : {}),
    });
    return categories.map((category) => new CategoryEntity(category));
  }

  /** Moderator/admin only — includes inactive categories so they can be reactivated. */
  async listForAdmin(domain?: string): Promise<CategoryEntity[]> {
    const categories = await this.categoryRepository.findMany({
      deletedAt: null,
      ...(domain ? { domain } : {}),
    });
    return categories.map((category) => new CategoryEntity(category));
  }

  async create(dto: CreateCategoryDto): Promise<CategoryEntity> {
    const existing = await this.categoryRepository.findByDomainAndSlug(
      dto.domain,
      dto.slug,
    );
    if (existing) {
      throw new AppException(
        ErrorCode.RESOURCE_ALREADY_EXISTS,
        'Danh mục với slug này đã tồn tại trong domain',
        HttpStatus.CONFLICT,
      );
    }

    const category = await this.categoryRepository.create({
      domain: dto.domain,
      slug: dto.slug,
      name: dto.name,
      description: dto.description,
      icon: dto.icon,
      parentId: dto.parentId,
      sortOrder: dto.sortOrder ?? 0,
    });
    return new CategoryEntity(category);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryEntity> {
    await this.getOrThrow(id);

    const category = await this.categoryRepository.update(id, {
      ...(dto.domain !== undefined ? { domain: dto.domain } : {}),
      ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description }
        : {}),
      ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
      ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    });
    return new CategoryEntity(category);
  }

  async remove(id: string): Promise<void> {
    await this.getOrThrow(id);
    // Phase 1: no content-domain module references Category yet, so there is
    // nothing to check "in use" against. Phase 2 content modules must add a
    // real reference check here (throw CATEGORY_IN_USE) once they exist.
    await this.categoryRepository.softDelete(id);
  }

  private async getOrThrow(id: string): Promise<CategoryEntity> {
    const category = await this.categoryRepository.findById(id);
    if (!category) {
      throw new AppException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Không tìm thấy danh mục',
        HttpStatus.NOT_FOUND,
      );
    }
    return new CategoryEntity(category);
  }
}

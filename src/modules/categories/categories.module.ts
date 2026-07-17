import { Module } from '@nestjs/common';
import { CategoriesAdminController } from './controllers/categories-admin.controller';
import { CategoriesController } from './controllers/categories.controller';
import { CategoryRepository } from './repositories/category.repository';
import { CategoryService } from './services/category.service';

@Module({
  controllers: [CategoriesController, CategoriesAdminController],
  providers: [CategoryRepository, CategoryService],
  exports: [CategoryService],
})
export class CategoriesModule {}

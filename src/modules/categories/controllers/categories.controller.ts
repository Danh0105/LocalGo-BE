import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { CategoryResponseDto } from '../dto/category-response.dto';
import { CategoryService } from '../services/category.service';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoryService: CategoryService) {}

  @Public()
  @ApiOperation({ summary: 'Danh sách tất cả danh mục đang hoạt động' })
  @Get()
  async list(): Promise<CategoryResponseDto[]> {
    const categories = await this.categoryService.listByDomain();
    return categories.map((category) =>
      CategoryResponseDto.fromEntity(category),
    );
  }

  @Public()
  @ApiOperation({ summary: 'Danh sách danh mục theo domain/loại nội dung' })
  @Get(':type')
  async listByType(
    @Param('type') type: string,
  ): Promise<CategoryResponseDto[]> {
    const categories = await this.categoryService.listByDomain(type);
    return categories.map((category) =>
      CategoryResponseDto.fromEntity(category),
    );
  }
}

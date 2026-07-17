import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '../../../../generated/prisma';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CategoryResponseDto } from '../dto/category-response.dto';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { QueryCategoryDto } from '../dto/query-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { CategoryService } from '../services/category.service';

@ApiTags('admin-categories')
@ApiBearerAuth()
@Roles(UserRole.MODERATOR, UserRole.ADMIN)
@Controller('admin/categories')
export class CategoriesAdminController {
  constructor(private readonly categoryService: CategoryService) {}

  @ApiOperation({
    summary:
      '[Admin] Danh sách danh mục theo domain (bao gồm cả đã vô hiệu hóa)',
  })
  @Get()
  async list(@Query() query: QueryCategoryDto): Promise<CategoryResponseDto[]> {
    const categories = await this.categoryService.listForAdmin(query.domain);
    return categories.map((category) =>
      CategoryResponseDto.fromEntity(category),
    );
  }

  @ApiOperation({ summary: '[Admin] Tạo danh mục mới' })
  @Post()
  async create(@Body() dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    const category = await this.categoryService.create(dto);
    return CategoryResponseDto.fromEntity(category);
  }

  @ApiOperation({ summary: '[Admin] Cập nhật danh mục' })
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    const category = await this.categoryService.update(id, dto);
    return CategoryResponseDto.fromEntity(category);
  }

  @ApiOperation({ summary: '[Admin] Xóa (vô hiệu hóa) danh mục' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    await this.categoryService.remove(id);
  }
}

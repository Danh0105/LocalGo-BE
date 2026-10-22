import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '../../../../generated/prisma';
import { Roles } from '../../../common/decorators/roles.decorator';
import { QuerySearchDto } from '../dto/query-search.dto';
import { SearchResultDto } from '../dto/search-response.dto';
import { SearchService } from '../services/search.service';

@ApiTags('admin-search')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
@Controller('admin/search')
export class SearchAdminController {
  constructor(private readonly service: SearchService) {}

  @Get()
  @ApiOperation({
    summary:
      '[Admin] Tìm kiếm toàn cục nội dung, gồm cả bản ẩn, nháp và lên lịch',
  })
  @ApiResponse({ status: 200, type: [SearchResultDto] })
  search(@Query() query: QuerySearchDto) {
    return this.service.adminSearch(query);
  }
}

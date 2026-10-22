import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../../common/decorators/public.decorator';
import { QuerySearchDto } from '../dto/query-search.dto';
import { SearchResultDto } from '../dto/search-response.dto';
import { SearchService } from '../services/search.service';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly service: SearchService) {}

  @Public()
  @Get()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Tìm kiếm toàn cục trên mọi nội dung đang công khai',
  })
  @ApiResponse({ status: 200, type: [SearchResultDto] })
  search(@Query() query: QuerySearchDto) {
    return this.service.publicSearch(query);
  }
}

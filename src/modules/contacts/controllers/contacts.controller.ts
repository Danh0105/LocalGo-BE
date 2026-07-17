import { Controller, Get, Headers, Param, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { QueryContactPublicDto } from '../dto/query-contact.dto';
import {
  ContactListItemResponseDto,
  ContactResponseDto,
} from '../dto/contact-response.dto';
import { ContactService } from '../services/contact.service';

@ApiTags('contacts')
@Controller('contacts')
export class ContactsController {
  constructor(private readonly service: ContactService) {}

  @Public()
  @Get()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Danh sách liên hệ đang hiển thị' })
  @ApiResponse({ status: 200, type: [ContactListItemResponseDto] })
  list(
    @Query() query: QueryContactPublicDto,
  ): Promise<ContactListItemResponseDto[]> {
    return this.service.publicList(query);
  }

  @Public()
  @Get(':id')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Chi tiết một liên hệ đang hiển thị' })
  @ApiResponse({ status: 200, type: ContactResponseDto })
  @ApiResponse({ status: 404, description: 'CONTACT_NOT_FOUND' })
  async detail(
    @Param('id') id: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ContactResponseDto | void> {
    const data = await this.service.publicDetail(id);
    const etag = `"contact-${data.id}-${data.updatedAt.getTime()}"`;
    response.setHeader('ETag', etag);
    response.setHeader('Cache-Control', 'public, max-age=60, must-revalidate');
    if (ifNoneMatch === etag) {
      response.status(304).end();
      return;
    }
    return data;
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { UserRole } from '../../../../../generated/prisma';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import type { AuthenticatedUser } from '../../../auth/types/authenticated-user.interface';

import { TradeConversationAdminService } from '../services/trade-conversation-admin.service';

@ApiTags('admin-trade-conversations')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
@Controller('admin/trade-conversations')
export class TradeConversationsAdminController {
  constructor(private readonly service: TradeConversationAdminService) {}

  @Get()
  @ApiOperation({
    summary: '[Admin] Danh sách hội thoại',
  })
  list(
    @Query() pagination: PaginationQueryDto,
    @Query('tradePostId') tradePostId?: string,
  ) {
    return this.service.list(pagination.page, pagination.limit, tradePostId);
  }

  @Get(':id')
  @ApiOperation({
    summary: '[Admin] Chi tiết hội thoại',
  })
  detail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.detail(user.id, id);
  }

  @Get(':id/messages')
  @ApiOperation({
    summary: '[Admin] Lịch sử tin nhắn',
  })
  messages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.service.messages(
      user.id,
      id,
      pagination.page,
      pagination.limit,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '[Admin] Xóa mềm hội thoại',
  })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ): Promise<void> {
    await this.service.remove(user.id, id, body?.reason);
  }
}

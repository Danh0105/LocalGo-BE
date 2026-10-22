import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import type { AuthenticatedUser } from '../../../auth/types/authenticated-user.interface';
import {
  CreateTradeConversationDto,
  SendTradeMessageDto,
} from '../dto/trade-conversation-input.dto';
import {
  TradeConversationResponseDto,
  TradeMessageResponseDto,
} from '../dto/trade-conversation-response.dto';
import { TradeConversationService } from '../services/trade-conversation.service';

/** Chat between a customer and the owner of a trade post. */
@ApiTags('trade-conversations')
@ApiBearerAuth()
@Controller('trade-conversations')
export class TradeConversationsController {
  constructor(private readonly service: TradeConversationService) {}

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Nhắn tin cho người đăng tin (tạo hoặc dùng lại hội thoại)',
    description:
      'Tin phải đang PUBLISHED và hiển thị công khai. Người đăng không thể tự nhắn cho tin của mình (403 CANNOT_MESSAGE_OWN_POST).',
  })
  @Post()
  open(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTradeConversationDto,
  ): Promise<TradeConversationResponseDto> {
    return this.service.open(user, dto);
  }

  @ApiOperation({
    summary:
      'Hội thoại của tôi (là khách hoặc người đăng), mới nhất trước, kèm unreadCount',
  })
  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<{ data: TradeConversationResponseDto[]; meta: unknown }> {
    const result = await this.service.list(user, query.page, query.limit);
    return { data: result.data, meta: result.meta };
  }

  @ApiOperation({
    summary: 'Tin nhắn của một hội thoại',
    description:
      'Trang 1 là các tin mới nhất; trong mỗi trang tin được sắp theo thời gian tăng dần. Trang 2 chứa các tin cũ hơn.',
  })
  @Get(':id/messages')
  async listMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<{ data: TradeMessageResponseDto[]; meta: unknown }> {
    const result = await this.service.listMessages(
      user,
      id,
      query.page,
      query.limit,
    );
    return { data: result.data, meta: result.meta };
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Gửi tin nhắn trong hội thoại' })
  @Post(':id/messages')
  send(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SendTradeMessageDto,
  ): Promise<TradeMessageResponseDto> {
    return this.service.send(user, id, dto.content);
  }

  @ApiOperation({
    summary: 'Đánh dấu đã đọc các tin nhắn của đối phương',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch(':id/read')
  async markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.markRead(user, id);
  }
}

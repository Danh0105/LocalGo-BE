import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import {
  NotificationResponseDto,
  QueryNotificationsDto,
  UnreadCountResponseDto,
} from '../dto/notification.dto';
import { NotificationService } from '../services/notification.service';

/** The mini app bell. Realtime pushes arrive on the /notifications socket namespace. */
@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationService) {}

  @ApiOperation({ summary: 'Thông báo của tôi, mới nhất trước' })
  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryNotificationsDto,
  ): Promise<{ data: NotificationResponseDto[]; meta: unknown }> {
    const result = await this.service.list(
      user.id,
      query.page,
      query.limit,
      query.unreadOnly ?? false,
    );
    return { data: result.data, meta: result.meta };
  }

  @ApiOperation({ summary: 'Số thông báo chưa đọc (badge chuông)' })
  @Get('unread-count')
  async unreadCount(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UnreadCountResponseDto> {
    return { unreadCount: await this.service.unreadCount(user.id) };
  }

  @ApiOperation({ summary: 'Đánh dấu tất cả đã đọc' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch('read-all')
  async markAllRead(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.service.markAllRead(user.id);
  }

  @ApiOperation({ summary: 'Đánh dấu một thông báo đã đọc' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch(':id/read')
  async markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.markRead(user.id, id);
  }

  @ApiOperation({ summary: 'Chi tiết một thông báo của tôi' })
  @Get(':id')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<NotificationResponseDto> {
    return this.service.get(user.id, id);
  }
}

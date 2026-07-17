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
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '../../../../generated/prisma';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import {
  ReorderFeedbackChannelsDto,
  UpdateFeedbackChannelStatusDto,
} from '../dto/feedback-channel-action.dto';
import { QueryFeedbackChannelAdminDto } from '../dto/query-feedback-channel.dto';
import { FeedbackChannelAdminResponseDto } from '../dto/feedback-channel-response.dto';
import {
  CreateFeedbackChannelDto,
  UpdateFeedbackChannelDto,
} from '../dto/upsert-feedback-channel.dto';
import { FeedbackChannelService } from '../services/feedback-channel.service';

@ApiTags('admin-feedback-channels')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
@Controller('admin/feedback/channels')
export class FeedbackChannelsAdminController {
  constructor(private readonly service: FeedbackChannelService) {}

  @Get()
  @ApiOperation({ summary: '[Admin] Danh sách đầy đủ kênh phản hồi' })
  @ApiResponse({ status: 200, type: [FeedbackChannelAdminResponseDto] })
  list(@Query() query: QueryFeedbackChannelAdminDto) {
    return this.service.adminList(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '[Admin] Chi tiết kênh phản hồi' })
  @ApiResponse({ status: 200, type: FeedbackChannelAdminResponseDto })
  detail(@Param('id') id: string): Promise<FeedbackChannelAdminResponseDto> {
    return this.service.adminDetail(id);
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Tạo kênh phản hồi' })
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateFeedbackChannelDto,
  ): Promise<FeedbackChannelAdminResponseDto> {
    return this.service.create(actor.id, dto);
  }

  @Put(':id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Cập nhật với optimistic locking' })
  @ApiResponse({
    status: 409,
    description: 'FEEDBACK_CHANNEL_VERSION_CONFLICT',
  })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateFeedbackChannelDto,
  ): Promise<FeedbackChannelAdminResponseDto> {
    return this.service.update(actor.id, id, dto);
  }

  @Patch('reorder')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: '[Admin] Sắp xếp nhiều kênh phản hồi trong một transaction',
  })
  reorder(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: ReorderFeedbackChannelsDto,
  ): Promise<FeedbackChannelAdminResponseDto[]> {
    return this.service.reorder(actor.id, dto);
  }

  @Patch(':id/status')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '[Admin] Ẩn hoặc hiện kênh phản hồi' })
  updateStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateFeedbackChannelStatusDto,
  ): Promise<FeedbackChannelAdminResponseDto> {
    return this.service.updateStatus(actor.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Admin] Xóa kênh phản hồi' })
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.remove(actor.id, id);
  }
}

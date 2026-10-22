import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UnauthorizedException,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { isUUID } from 'class-validator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { MediaResponseDto } from '../../media/dto/media-response.dto';
import { LookupFeedbackTicketDto } from '../dto/lookup-feedback-ticket.dto';
import {
  ReplyFeedbackTicketDto,
  ReplyFeedbackTicketRouteDto,
} from '../dto/reply-feedback-ticket.dto';
import { SubmitFeedbackTicketDto } from '../dto/submit-feedback-ticket.dto';
import {
  FeedbackMessageResponseDto,
  FeedbackTicketLookupResponseDto,
  SubmitFeedbackTicketResponseDto,
} from '../dto/feedback-ticket-response.dto';
import { MAX_FEEDBACK_ATTACHMENTS } from '../feedback-ticket.constants';
import { FeedbackTicketService } from '../services/feedback-ticket.service';

@ApiTags('feedback-tickets')
@Controller('feedback/tickets')
export class FeedbackTicketsController {
  constructor(private readonly service: FeedbackTicketService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Gửi một phản hồi mới (ẩn danh, không cần đăng nhập)',
  })
  @ApiResponse({ status: 201, type: SubmitFeedbackTicketResponseDto })
  submit(
    @Body() dto: SubmitFeedbackTicketDto,
  ): Promise<SubmitFeedbackTicketResponseDto> {
    return this.service.submit(dto);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({
    summary: 'Danh sách phản hồi của người dùng đang đăng nhập',
  })
  @ApiResponse({ status: 200, type: [FeedbackTicketLookupResponseDto] })
  listMine(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FeedbackTicketLookupResponseDto[]> {
    return this.service.listMine(user.id);
  }

  @ApiBearerAuth()
  @Post('me')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Gửi một phản hồi mới và gắn với người dùng đang đăng nhập',
  })
  @ApiResponse({ status: 201, type: SubmitFeedbackTicketResponseDto })
  submitMine(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitFeedbackTicketDto,
  ): Promise<SubmitFeedbackTicketResponseDto> {
    return this.service.submitForUser(user.id, dto);
  }

  @ApiBearerAuth()
  @Post('me/:ticketCode/messages')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Gửi tin nhắn vào phản hồi của tài khoản hiện tại' })
  @ApiResponse({ status: 201, type: FeedbackMessageResponseDto })
  replyMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketCode') ticketCode: string,
    @Body() dto: ReplyFeedbackTicketDto,
  ): Promise<FeedbackMessageResponseDto> {
    return this.service.replyAsUser(user.id, ticketCode, dto);
  }

  @ApiBearerAuth()
  @Get(':id/messages')
  @ApiOperation({
    summary: 'Danh sách tin nhắn của ticket thuộc tài khoản hiện tại',
  })
  @ApiResponse({ status: 200, type: [FeedbackMessageResponseDto] })
  messages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<FeedbackMessageResponseDto[]> {
    return this.service.listMessagesAsUser(user.id, id);
  }

  @ApiBearerAuth()
  @Post(':id/realtime/read')
  @ApiOperation({
    summary: 'Đánh dấu đã đọc ticket thuộc tài khoản hiện tại bằng ID nội bộ',
  })
  readById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.markReadMineById(user.id, id);
  }

  @Public()
  @Post('attachments')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: `Tải lên ảnh/video đính kèm phản hồi (ẩn danh, tối đa ${MAX_FEEDBACK_ATTACHMENTS} tệp/lần, ảnh tối đa 5MB, video tối đa 50MB). Trả về id để đưa vào mediaIds khi gửi phản hồi.`,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: {
          type: 'array',
          maxItems: MAX_FEEDBACK_ATTACHMENTS,
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiResponse({ status: 201, type: [MediaResponseDto] })
  @UseInterceptors(FilesInterceptor('files', MAX_FEEDBACK_ATTACHMENTS))
  async uploadAttachments(
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ): Promise<MediaResponseDto[]> {
    if (!files?.length) {
      throw new BadRequestException('Không có tệp nào được tải lên');
    }
    const result: MediaResponseDto[] = [];
    for (const file of files) {
      const buffer = file.buffer;
      try {
        result.push(await this.service.uploadAttachment(buffer));
      } finally {
        file.buffer = Buffer.alloc(0);
      }
    }
    return result;
  }

  @Public()
  @Get('lookup')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Tra cứu một phản hồi theo ticketCode + phone (ẩn danh, không cần đăng nhập)',
  })
  @ApiResponse({ status: 200, type: FeedbackTicketLookupResponseDto })
  @ApiResponse({ status: 404, description: 'FEEDBACK_TICKET_NOT_FOUND' })
  lookup(
    @Query() dto: LookupFeedbackTicketDto,
  ): Promise<FeedbackTicketLookupResponseDto> {
    return this.service.lookup(dto);
  }

  @Public()
  @Post('realtime/access')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  realtimeAnonymous(@Body() body: { ticketCode: string; phone: string }) {
    return this.service.socketTokenAnonymous(
      body.ticketCode ?? '',
      body.phone ?? '',
    );
  }

  @Public()
  @Post('realtime/read')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  readAnonymous(@Body() body: { ticketCode: string; phone: string }) {
    return this.service.markReadAnonymous(
      body.ticketCode ?? '',
      body.phone ?? '',
    );
  }

  @Public()
  @Post('realtime/unread')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  unreadAnonymous(@Body() body: { ticketCode: string; phone: string }) {
    return this.service.unreadAnonymous(
      body.ticketCode ?? '',
      body.phone ?? '',
    );
  }

  @ApiBearerAuth()
  @Post('me/:ticketCode/realtime/access')
  realtimeMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketCode') code: string,
  ) {
    return this.service.socketTokenMine(user.id, code);
  }

  @ApiBearerAuth()
  @Post('me/:ticketCode/realtime/read')
  readMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketCode') code: string,
  ) {
    return this.service.markReadMine(user.id, code);
  }

  @ApiBearerAuth()
  @Get('me/:ticketCode/realtime/unread')
  unreadMine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketCode') code: string,
  ) {
    return this.service.unreadMine(user.id, code);
  }

  @Public()
  @Post(':identifier/messages')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Gửi tin nhắn bằng ID nội bộ + bearer token, hoặc ẩn danh bằng ticketCode + phone',
  })
  @ApiResponse({ status: 201, type: FeedbackMessageResponseDto })
  @ApiResponse({ status: 404, description: 'FEEDBACK_TICKET_NOT_FOUND' })
  replyAnonymous(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('identifier') identifier: string,
    @Body() dto: ReplyFeedbackTicketRouteDto,
  ): Promise<FeedbackMessageResponseDto> {
    if (isUUID(identifier)) {
      if (!user) throw new UnauthorizedException();
      return this.service.replyAsUserById(user.id, identifier, dto);
    }
    if (!dto.phone) {
      throw new BadRequestException('phone là bắt buộc khi gửi ẩn danh');
    }
    return this.service.replyAnonymous(identifier, {
      ...dto,
      phone: dto.phone,
    });
  }
}

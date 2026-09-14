import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
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
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { MediaResponseDto } from '../../media/dto/media-response.dto';
import { LookupFeedbackTicketDto } from '../dto/lookup-feedback-ticket.dto';
import { SubmitFeedbackTicketDto } from '../dto/submit-feedback-ticket.dto';
import {
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
    return Promise.all(
      files.map((file) => this.service.uploadAttachment(file.buffer)),
    );
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
}

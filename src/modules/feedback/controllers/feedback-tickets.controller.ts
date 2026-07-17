import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../../common/decorators/public.decorator';
import { LookupFeedbackTicketDto } from '../dto/lookup-feedback-ticket.dto';
import { SubmitFeedbackTicketDto } from '../dto/submit-feedback-ticket.dto';
import {
  FeedbackTicketLookupResponseDto,
  SubmitFeedbackTicketResponseDto,
} from '../dto/feedback-ticket-response.dto';
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

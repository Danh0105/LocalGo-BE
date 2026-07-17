import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '../../../../generated/prisma';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { QueryFeedbackTicketAdminDto } from '../dto/query-feedback-ticket.dto';
import { UpdateFeedbackTicketStatusDto } from '../dto/update-feedback-ticket-status.dto';
import { FeedbackTicketAdminResponseDto } from '../dto/feedback-ticket-response.dto';
import { FeedbackTicketService } from '../services/feedback-ticket.service';

@ApiTags('admin-feedback-tickets')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
@Controller('admin/feedback/tickets')
export class FeedbackTicketsAdminController {
  constructor(private readonly service: FeedbackTicketService) {}

  @Get()
  @ApiOperation({ summary: '[Admin] Danh sách ticket phản hồi' })
  @ApiResponse({ status: 200, type: [FeedbackTicketAdminResponseDto] })
  list(@Query() query: QueryFeedbackTicketAdminDto) {
    return this.service.adminList(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '[Admin] Chi tiết một ticket phản hồi' })
  @ApiResponse({ status: 200, type: FeedbackTicketAdminResponseDto })
  detail(@Param('id') id: string): Promise<FeedbackTicketAdminResponseDto> {
    return this.service.adminDetail(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: '[Admin] Cập nhật trạng thái xử lý ticket' })
  @ApiResponse({ status: 409, description: 'INVALID_STATUS_TRANSITION' })
  updateStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateFeedbackTicketStatusDto,
  ): Promise<FeedbackTicketAdminResponseDto> {
    return this.service.updateStatus(actor.id, id, dto);
  }
}

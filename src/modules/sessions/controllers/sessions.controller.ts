import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.interface';
import { SessionResponseDto } from '../dto/session-response.dto';
import { SessionService } from '../services/session.service';

@ApiTags('sessions')
@ApiBearerAuth()
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionService: SessionService) {}

  @ApiOperation({
    summary: 'Danh sách phiên đăng nhập đang hoạt động (thiết bị của tôi)',
  })
  @Get()
  async listMine(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SessionResponseDto[]> {
    const sessions = await this.sessionService.listActiveSessions(user.id);
    return sessions.map((session) => SessionResponseDto.fromEntity(session));
  }

  @ApiOperation({ summary: 'Thu hồi một phiên đăng nhập cụ thể' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.sessionService.revokeOwnedSession(id, user.id);
  }
}

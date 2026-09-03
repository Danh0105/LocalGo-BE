import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { ChatbotService } from './chatbot.service';
import { ChatRequestDto, ChatResponseDto } from './dto/chat.dto';

@ApiTags('chatbot')
@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Public()
  @Post('messages')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Gửi tin nhắn tới trợ lý AI LocalGo' })
  @ApiResponse({ status: 201, type: ChatResponseDto })
  @ApiResponse({ status: 503, description: 'Chatbot chưa sẵn sàng' })
  chat(@Body() dto: ChatRequestDto): Promise<ChatResponseDto> {
    return this.chatbotService.chat(dto);
  }
}

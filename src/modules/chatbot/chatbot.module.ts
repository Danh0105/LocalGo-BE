import { Module } from '@nestjs/common';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { ChatbotKnowledgeService } from './chatbot-knowledge.service';

@Module({
  controllers: [ChatbotController],
  providers: [ChatbotService, ChatbotKnowledgeService],
})
export class ChatbotModule {}

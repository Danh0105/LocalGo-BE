import { registerAs } from '@nestjs/config';

export interface ChatbotConfig {
  apiKey?: string;
  model: string;
  maxOutputTokens: number;
}

export default registerAs('chatbot', (): ChatbotConfig => ({
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.OPENAI_MODEL ?? 'gpt-5-nano',
  maxOutputTokens: Number(process.env.OPENAI_MAX_OUTPUT_TOKENS ?? 800),
}));

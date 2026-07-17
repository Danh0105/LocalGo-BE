import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { NewsAdminController } from './controllers/news-admin.controller';
import { NewsController } from './controllers/news.controller';
import { NewsService } from './services/news.service';

@Module({
  imports: [MediaModule],
  controllers: [NewsController, NewsAdminController],
  providers: [NewsService],
  exports: [NewsService],
})
export class NewsModule {}

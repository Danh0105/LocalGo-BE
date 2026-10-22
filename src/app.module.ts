import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import appConfig, { type AppConfig } from './config/app.config';
import authConfig from './config/auth.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import mediaConfig from './config/media.config';
import chatbotConfig from './config/chatbot.config';
import zaloOaConfig from './config/zalo-oa.config';
import { envValidationSchema } from './config/env.validation';
import { PrismaModule } from './database/prisma.module';
import { CommonModule } from './common/common.module';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { AuthModule } from './modules/auth/auth.module';
import { MediaModule } from './modules/media/media.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { TradeModule } from './modules/trade/trade.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { BusinessApplicationsModule } from './modules/business-applications/business-applications.module';
import { AboutModule } from './modules/about/about.module';
import { TemplesModule } from './modules/temples/temples.module';
import { SpecialtiesModule } from './modules/specialties/specialties.module';
import { HistoricalSitesModule } from './modules/historical-sites/historical-sites.module';
import { AgricultureModule } from './modules/agriculture/agriculture.module';
import { OcopModule } from './modules/ocop/ocop.module';
import { CraftVillagesModule } from './modules/craft-villages/craft-villages.module';
import { CuisineModule } from './modules/cuisine/cuisine.module';
import { FestivalsModule } from './modules/festivals/festivals.module';
import { ExperienceToursModule } from './modules/experience-tours/experience-tours.module';
import { ContentReviewsModule } from './modules/content-reviews/content-reviews.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { MapPlacesModule } from './modules/map-places/map-places.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { NewsModule } from './modules/news/news.module';
import { ChatbotModule } from './modules/chatbot/chatbot.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { MapLocationModule } from './modules/map-location/map-location.module';
import { HarvestBatchesModule } from './modules/harvest-batches/harvest-batches.module';
import { SearchModule } from './modules/search/search.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
      load: [
        appConfig,
        authConfig,
        databaseConfig,
        jwtConfig,
        mediaConfig,
        chatbotConfig,
        zaloOaConfig,
      ],
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false,
      },
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const config = configService.getOrThrow<AppConfig>('app');
        // Rate limiting is opt-in so deployments can bypass both the global
        // default and every per-route @Throttle() limit. Tests always bypass it.
        const skipRateLimit =
          !config.rateLimitEnabled || config.nodeEnv === 'test';
        return {
          throttlers: [
            {
              name: 'default',
              ttl: config.rateLimitTtlMs,
              limit: config.rateLimitLimit,
            },
          ],
          skipIf: () => skipRateLimit,
        };
      },
      inject: [ConfigService],
    }),
    CommonModule,
    PrismaModule,
    AuditLogModule,
    HealthModule,
    UsersModule,
    SessionsModule,
    AuthModule,
    MediaModule,
    CategoriesModule,
    TradeModule,
    BusinessApplicationsModule,
    AboutModule,
    TemplesModule,
    SpecialtiesModule,
    HistoricalSitesModule,
    AgricultureModule,
    OcopModule,
    CraftVillagesModule,
    CuisineModule,
    FestivalsModule,
    ExperienceToursModule,
    ContentReviewsModule,
    FeedbackModule,
    MapPlacesModule,
    ContactsModule,
    NewsModule,
    ChatbotModule,
    NotificationsModule,
    MapLocationModule,
    HarvestBatchesModule,
    SearchModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Express 5 / path-to-regexp v8 no longer accepts a bare '*' wildcard.
    consumer.apply(RequestContextMiddleware).forRoutes('/{*splat}');
  }
}

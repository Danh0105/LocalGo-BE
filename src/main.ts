import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { join } from 'node:path';
import { basename } from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { MediaResourceType } from '../generated/prisma';
import { AppModule } from './app.module';
import type { AppConfig } from './config/app.config';
import type { MediaConfig } from './config/media.config';
import { RequestContextService } from './common/context/request-context.service';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { PrismaService } from './database/prisma.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const appConfig = configService.getOrThrow<AppConfig>('app');
  const mediaConfig = configService.getOrThrow<MediaConfig>('media');

  // Business identity/legal documents are never served by the public static
  // route. Their short-lived URLs are resolved by the guarded document
  // controller below; this also blocks a previously returned upload URL once
  // that media has been attached to an application.
  const prisma = app.get(PrismaService);
  app.use(
    '/uploads/images/:key',
    async (request: Request, response: Response, next: NextFunction) => {
      const rawKey = request.params.key;
      const key = basename(Array.isArray(rawKey) ? (rawKey[0] ?? '') : rawKey);
      const originalKey = key.replace(/-thumb(?=\.[^.]+$)/, '');
      const sensitive = await prisma.media.findFirst({
        where: {
          storageKey: { in: [key, originalKey] },
          resourceType: MediaResourceType.BUSINESS_APPLICATION,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (sensitive) {
        response.status(404).end();
        return;
      }
      next();
    },
  );

  // Served outside the /api/v1 prefix (useStaticAssets is Express
  // middleware, not Nest routing) so image URLs stay short and stable.
  app.useStaticAssets(join(process.cwd(), mediaConfig.uploadDir), {
    prefix: '/uploads/',
  });

  app.setGlobalPrefix('api/v1');

  app.use(helmet());
  app.enableCors({
    origin: appConfig.corsOrigins.length > 0 ? appConfig.corsOrigins : false,
    credentials: true,
  });

  app.useBodyParser('json', { limit: appConfig.bodyLimit });
  app.useBodyParser('urlencoded', {
    limit: appConfig.bodyLimit,
    extended: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
    }),
  );

  const requestContext = app.get(RequestContextService);
  app.useGlobalFilters(new HttpExceptionFilter(requestContext));
  app.useGlobalInterceptors(new ResponseInterceptor());

  if (appConfig.swaggerEnabled) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('LocalGo API')
        .setDescription(
          'REST API cho ứng dụng LocalGo (Zalo Mini App quảng bá địa phương xã Truông Mít)',
        )
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }

  app.enableShutdownHooks();

  await app.listen(appConfig.port);
  Logger.log(
    `LocalGo backend đang chạy tại http://localhost:${appConfig.port}/api/v1`,
    'Bootstrap',
  );
  if (appConfig.swaggerEnabled) {
    Logger.log(
      `Swagger UI: http://localhost:${appConfig.port}/api/docs`,
      'Bootstrap',
    );
  }
}

bootstrap().catch((error: unknown) => {
  Logger.error(
    'Không thể khởi động ứng dụng',
    error instanceof Error ? error.stack : String(error),
  );
  process.exit(1);
});

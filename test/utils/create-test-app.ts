import { ValidationPipe, INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { RequestContextService } from '../../src/common/context/request-context.service';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';
import { AppModule } from '../../src/app.module';

/**
 * Mirrors the production bootstrap in src/main.ts (global prefix,
 * validation pipe, exception filter, response envelope interceptor) so e2e
 * tests exercise the real request/response shape, not a bare Nest app.
 * Deliberately skips Helmet/CORS/Swagger — irrelevant to API behavior tests.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  const requestContext = app.get(RequestContextService);
  app.useGlobalFilters(new HttpExceptionFilter(requestContext));
  app.useGlobalInterceptors(new ResponseInterceptor());

  await app.init();
  return app;
}

export function getConfigService(app: INestApplication): ConfigService {
  return app.get(ConfigService);
}

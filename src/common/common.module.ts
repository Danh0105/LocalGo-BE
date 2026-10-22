import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/app.config';
import { RequestContextService } from './context/request-context.service';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { OverloadProtection } from './overload/overload-protection';

@Global()
@Module({
  providers: [
    RequestContextService,
    HttpExceptionFilter,
    {
      provide: OverloadProtection,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new OverloadProtection(config.getOrThrow<AppConfig>('app')),
    },
  ],
  exports: [RequestContextService, HttpExceptionFilter, OverloadProtection],
})
export class CommonModule {}

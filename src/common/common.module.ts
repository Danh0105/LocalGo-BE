import { Global, Module } from '@nestjs/common';
import { RequestContextService } from './context/request-context.service';
import { HttpExceptionFilter } from './filters/http-exception.filter';

@Global()
@Module({
  providers: [RequestContextService, HttpExceptionFilter],
  exports: [RequestContextService, HttpExceptionFilter],
})
export class CommonModule {}

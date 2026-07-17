import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '../../../generated/prisma';
import { RequestContextService } from '../context/request-context.service';
import { ErrorCode } from '../constants/error-codes.constant';
import { AppException } from '../exceptions/app.exception';

interface ResolvedError {
  status: number;
  code: ErrorCode;
  message: string;
  details?: unknown[];
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly requestContext: RequestContextService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId =
      this.requestContext.getRequestId() ??
      (request.headers['x-request-id'] as string | undefined);

    const resolved = this.resolve(exception);

    if (resolved.status >= Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      this.logger.error(
        `${request.method} ${request.originalUrl} -> ${resolved.status} ${resolved.code}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(resolved.status).json({
      success: false,
      error: {
        code: resolved.code,
        message: resolved.message,
        details: resolved.details ?? [],
      },
      requestId,
    });
  }

  private resolve(exception: unknown): ResolvedError {
    if (exception instanceof AppException) {
      const body = exception.getResponse() as { message: string };
      return {
        status: exception.getStatus(),
        code: exception.code,
        message: body.message,
        details: exception.details,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.resolvePrismaError(exception);
    }

    if (exception instanceof HttpException) {
      return this.resolveHttpException(exception);
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Đã xảy ra lỗi hệ thống',
    };
  }

  private resolveHttpException(exception: HttpException): ResolvedError {
    const status = exception.getStatus();
    const body = exception.getResponse();

    if (typeof body === 'object' && body !== null) {
      const b = body as { message?: string | string[]; error?: string };
      const messages = Array.isArray(b.message)
        ? b.message
        : b.message
          ? [b.message]
          : [];
      return {
        status,
        code: this.mapStatusToCode(status),
        message: Array.isArray(b.message)
          ? 'Dữ liệu không hợp lệ'
          : (b.message ?? b.error ?? 'Đã xảy ra lỗi'),
        details: messages.length > 1 ? messages : undefined,
      };
    }

    return {
      status,
      code: this.mapStatusToCode(status),
      message: typeof body === 'string' ? body : 'Đã xảy ra lỗi',
    };
  }

  private resolvePrismaError(
    exception: Prisma.PrismaClientKnownRequestError,
  ): ResolvedError {
    switch (exception.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          code: ErrorCode.RESOURCE_ALREADY_EXISTS,
          message: 'Dữ liệu đã tồn tại',
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          code: ErrorCode.RESOURCE_NOT_FOUND,
          message: 'Không tìm thấy dữ liệu',
        };
      default:
        this.logger.error(
          `Unhandled Prisma error: ${exception.code}`,
          exception.message,
        );
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Đã xảy ra lỗi hệ thống',
        };
    }
  }

  private mapStatusToCode(status: number): ErrorCode {
    switch (status) {
      case Number(HttpStatus.BAD_REQUEST):
        return ErrorCode.VALIDATION_ERROR;
      case Number(HttpStatus.UNAUTHORIZED):
        return ErrorCode.UNAUTHORIZED;
      case Number(HttpStatus.FORBIDDEN):
        return ErrorCode.FORBIDDEN;
      case Number(HttpStatus.NOT_FOUND):
        return ErrorCode.RESOURCE_NOT_FOUND;
      case Number(HttpStatus.CONFLICT):
        return ErrorCode.RESOURCE_ALREADY_EXISTS;
      default:
        return ErrorCode.INTERNAL_ERROR;
    }
  }
}

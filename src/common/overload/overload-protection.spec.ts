import { EventEmitter } from 'node:events';
import type { NextFunction, Request, Response } from 'express';
import {
  OverloadProtection,
  type OverloadOptions,
} from './overload-protection';

class TestResponse extends EventEmitter {
  readonly headers = new Map<string, string | number | readonly string[]>();
  statusCode = 200;
  body: unknown;

  setHeader(name: string, value: string | number | readonly string[]): this {
    this.headers.set(name.toLowerCase(), value);
    return this;
  }

  getHeader(name: string): string | number | readonly string[] | undefined {
    return this.headers.get(name.toLowerCase());
  }

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  json(body: unknown): this {
    this.body = body;
    return this;
  }
}

const options: OverloadOptions = {
  maxConcurrentRequests: 2,
  maxConcurrentHeavyRequests: 1,
  maxConcurrentUploads: 1,
  maxRssMb: 16_384,
  maxEventLoopDelayMs: 10_000,
};

function request(
  path = '/api/v1/contacts',
  method = 'GET',
  contentType?: string,
): Request {
  return {
    path,
    method,
    headers: contentType ? { 'content-type': contentType } : {},
  } as Request;
}

function invoke(
  protection: OverloadProtection,
  req: Request,
): { response: TestResponse; next: jest.MockedFunction<NextFunction> } {
  const response = new TestResponse();
  const next = jest.fn();
  protection.middleware(req, response as unknown as Response, next);
  return { response, next };
}

describe('OverloadProtection', () => {
  const protections: OverloadProtection[] = [];

  afterEach(() => {
    protections.splice(0).forEach((protection) => protection.onModuleDestroy());
    jest.restoreAllMocks();
  });

  function create(overrides: Partial<OverloadOptions> = {}) {
    const protection = new OverloadProtection({ ...options, ...overrides });
    protections.push(protection);
    return protection;
  }

  it('rejects above the concurrency limit and accepts again after completion', () => {
    const protection = create({ maxConcurrentRequests: 1 });
    const first = invoke(protection, request());
    expect(first.next).toHaveBeenCalledTimes(1);

    const rejected = invoke(protection, request());
    expect(rejected.next).not.toHaveBeenCalled();
    expect(rejected.response.statusCode).toBe(503);
    expect(rejected.response.headers.get('retry-after')).toBe('2');
    expect(rejected.response.body).toMatchObject({
      success: false,
      error: { code: 'SERVER_BUSY' },
    });

    first.response.emit('finish');
    expect(invoke(protection, request()).next).toHaveBeenCalledTimes(1);
  });

  it('limits uploads before reading the next multipart body', () => {
    const protection = create();
    const contentType = 'multipart/form-data; boundary=test';
    const first = invoke(
      protection,
      request('/api/v1/media', 'POST', contentType),
    );
    const rejected = invoke(
      protection,
      request('/api/v1/media', 'POST', contentType),
    );

    expect(first.next).toHaveBeenCalledTimes(1);
    expect(rejected.response.statusCode).toBe(503);
    first.response.emit('finish');
  });

  it('keeps processing capacity reserved after a client disconnects', () => {
    const protection = create({ maxConcurrentRequests: 1 });
    const req = request();
    const first = invoke(protection, req);
    const complete = protection.trackProcessing(req);
    first.response.emit('close');

    expect(invoke(protection, request()).response.statusCode).toBe(503);
    complete();
    expect(invoke(protection, request()).next).toHaveBeenCalledTimes(1);
  });

  it('keeps liveness available when the memory circuit breaker is open', () => {
    jest.spyOn(process.memoryUsage, 'rss').mockReturnValue(500 * 1024 * 1024);
    const protection = create({ maxRssMb: 448 });

    expect(
      invoke(protection, request('/api/v1/health')).next,
    ).toHaveBeenCalledTimes(1);
    expect(invoke(protection, request()).response.statusCode).toBe(503);
  });
});

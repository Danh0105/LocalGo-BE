import type { Request } from 'express';
import { MulterError, type StorageEngine } from 'multer';

/** Bound the sum of all files, including chunked uploads without Content-Length. */
export class BoundedMemoryStorage implements StorageEngine {
  private readonly budgets = new WeakMap<
    Request,
    { bytes: number; exceeded: boolean }
  >();

  constructor(private readonly maxTotalBytes: number) {}

  _handleFile(
    request: Request,
    file: Express.Multer.File,
    callback: Parameters<StorageEngine['_handleFile']>[2],
  ): void {
    const budget = this.budgets.get(request) ?? { bytes: 0, exceeded: false };
    this.budgets.set(request, budget);
    const chunks: Buffer[] = [];
    let size = 0;
    let completed = false;

    const discard = () => {
      completed = true;
      chunks.length = 0;
      request.off('aborted', discard);
    };
    request.once('aborted', discard);
    file.stream.once('error', discard);
    file.stream.on('data', (chunk: Buffer) => {
      if (completed) return;
      budget.bytes += chunk.length;
      if (budget.exceeded || budget.bytes > this.maxTotalBytes) {
        budget.exceeded = true;
        discard();
        // Keep draining this stream so Multer can clean up its pending writes.
        callback(new MulterError('LIMIT_FILE_SIZE', file.fieldname));
        return;
      }
      size += chunk.length;
      chunks.push(chunk);
    });
    file.stream.once('end', () => {
      if (completed) return;
      const buffer = Buffer.concat(chunks, size);
      discard();
      callback(null, { buffer, size });
    });
  }

  _removeFile(
    _request: Request,
    file: Express.Multer.File,
    callback: (error: Error | null) => void,
  ): void {
    file.buffer = Buffer.alloc(0);
    callback(null);
  }
}

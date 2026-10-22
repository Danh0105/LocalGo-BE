import sharp from 'sharp';

// Upload admission is already serialized. Keeping libvips' decoded-image cache
// and additional worker threads only raises native RSS, which can remain high
// after a burst even when V8 has released every Buffer.
sharp.cache(false);
sharp.concurrency(1);

let imageProcessingQueue: Promise<void> = Promise.resolve();

function serializeImageProcessing<T>(work: () => Promise<T>): Promise<T> {
  const result = imageProcessingQueue.then(work, work);
  imageProcessingQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const MAX_ORIGINAL_WIDTH = 1600;
export const THUMBNAIL_WIDTH = 400;
// Compressed file size alone does not bound decoded image memory.
export const MAX_INPUT_PIXELS = 20_000_000;

export interface ProcessedImage {
  originalBuffer: Buffer;
  thumbnailBuffer: Buffer;
  width: number | null;
  height: number | null;
}

/**
 * Detects the real image type from magic bytes (not the client-supplied
 * MIME type or filename extension, which are trivially spoofable). Hand-rolled
 * rather than pulling in the `file-type` package: only 3 formats are ever
 * accepted, the signatures are a handful of fixed bytes each, and `file-type`
 * v22+ is ESM-only which conflicts with this project's CommonJS Jest setup.
 */
export function detectImageMimeType(buffer: Buffer): string | undefined {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  return undefined;
}

/**
 * Resizes to a max width, re-encodes as WebP, and (by not calling
 * `.withMetadata()`) strips EXIF/ICC/other metadata by sharp's default
 * behavior. `.rotate()` bakes in the EXIF orientation visually before that
 * metadata is discarded, so the output still displays right-side-up.
 */
export async function processUploadedImage(
  buffer: Buffer,
): Promise<ProcessedImage> {
  return serializeImageProcessing(() => processUploadedImageNow(buffer));
}

async function processUploadedImageNow(
  buffer: Buffer,
): Promise<ProcessedImage> {
  const originalBuffer = await sharp(buffer, {
    limitInputPixels: MAX_INPUT_PIXELS,
  })
    .rotate()
    .resize({ width: MAX_ORIGINAL_WIDTH, withoutEnlargement: true })
    .webp({ quality: 82 })
    .timeout({ seconds: 10 })
    .toBuffer();

  const thumbnailBuffer = await sharp(originalBuffer)
    .rotate()
    .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
    .webp({ quality: 80 })
    .timeout({ seconds: 10 })
    .toBuffer();

  const originalMeta = await sharp(originalBuffer).metadata();

  return {
    originalBuffer,
    thumbnailBuffer,
    width: originalMeta.width ?? null,
    height: originalMeta.height ?? null,
  };
}

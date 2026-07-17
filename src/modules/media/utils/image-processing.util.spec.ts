import sharp from 'sharp';
import {
  detectImageMimeType,
  processUploadedImage,
} from './image-processing.util';

describe('detectImageMimeType', () => {
  it('detects a real PNG from its magic bytes', async () => {
    const png = await sharp({
      create: { width: 10, height: 10, channels: 3, background: '#ff0000' },
    })
      .png()
      .toBuffer();

    expect(detectImageMimeType(png)).toBe('image/png');
  });

  it('detects a real JPEG from its magic bytes', async () => {
    const jpeg = await sharp({
      create: { width: 10, height: 10, channels: 3, background: '#00ff00' },
    })
      .jpeg()
      .toBuffer();

    expect(detectImageMimeType(jpeg)).toBe('image/jpeg');
  });

  it('detects a real WebP from its magic bytes', async () => {
    const webp = await sharp({
      create: { width: 10, height: 10, channels: 3, background: '#123456' },
    })
      .webp()
      .toBuffer();

    expect(detectImageMimeType(webp)).toBe('image/webp');
  });

  it('returns undefined for a non-image buffer disguised with an image extension', () => {
    const fakeImage = Buffer.from(
      '<html><body>this is not an image</body></html>',
      'utf-8',
    );

    expect(detectImageMimeType(fakeImage)).toBeUndefined();
  });
});

describe('processUploadedImage', () => {
  it('resizes an oversized image down to the max original/thumbnail widths', async () => {
    const large = await sharp({
      create: { width: 3000, height: 2000, channels: 3, background: '#0000ff' },
    })
      .jpeg()
      .toBuffer();

    const result = await processUploadedImage(large);

    expect(result.width).toBeLessThanOrEqual(1600);
    expect(result.height).toBeGreaterThan(0);

    const thumbMeta = await sharp(result.thumbnailBuffer).metadata();
    expect(thumbMeta.width).toBeLessThanOrEqual(400);
  });

  it('does not upscale an image smaller than the max width', async () => {
    const small = await sharp({
      create: { width: 200, height: 100, channels: 3, background: '#ffffff' },
    })
      .jpeg()
      .toBuffer();

    const result = await processUploadedImage(small);

    expect(result.width).toBe(200);
  });

  it('strips EXIF metadata from the processed output', async () => {
    const withExif = await sharp({
      create: { width: 800, height: 600, channels: 3, background: '#123456' },
    })
      .withMetadata({ exif: { IFD0: { Make: 'TestCam', Model: 'X100' } } })
      .jpeg()
      .toBuffer();

    const sourceMeta = await sharp(withExif).metadata();
    expect(sourceMeta.exif).toBeDefined();

    const result = await processUploadedImage(withExif);
    const outputMeta = await sharp(result.originalBuffer).metadata();

    expect(outputMeta.exif).toBeUndefined();
  });

  it('re-encodes output as webp', async () => {
    const jpeg = await sharp({
      create: { width: 400, height: 300, channels: 3, background: '#abcdef' },
    })
      .jpeg()
      .toBuffer();

    const result = await processUploadedImage(jpeg);
    const outputMeta = await sharp(result.originalBuffer).metadata();

    expect(outputMeta.format).toBe('webp');
  });
});

export const ALLOWED_VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

/** Maps a detected MIME type to the file extension used for its storage key. */
export const VIDEO_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

/**
 * Detects the real video container type from magic bytes (not the
 * client-supplied MIME type or filename extension, which are trivially
 * spoofable) — same rationale and approach as `detectImageMimeType`.
 *
 * MP4/MOV (ISO base media file format) both use an `ftyp` box starting at
 * byte offset 4; the following 4-byte "major brand" tells them apart
 * (`qt  ` for QuickTime/.mov, everything else treated as MP4). WebM/Matroska
 * files start with the EBML magic number 0x1A45DFA3.
 */
export function detectVideoMimeType(buffer: Buffer): string | undefined {
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12).trim();
    return brand === 'qt' ? 'video/quicktime' : 'video/mp4';
  }

  if (
    buffer.length >= 4 &&
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return 'video/webm';
  }

  return undefined;
}

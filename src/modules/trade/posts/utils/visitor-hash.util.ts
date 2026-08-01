import { createHash } from 'node:crypto';

/**
 * Derives a stable, non-reversible fingerprint for an anonymous visitor from
 * their IP + User-Agent, salted with a server secret. Used only to approximate
 * unique-visitor counts in trade-post analytics — the raw IP is never stored.
 *
 * Returns null when neither IP nor User-Agent is available (nothing to hash),
 * in which case the caller records the event without a visitor fingerprint.
 */
export function computeVisitorHash(
  secret: string,
  ip?: string | null,
  userAgent?: string | null,
): string | null {
  if (!ip && !userAgent) {
    return null;
  }
  return createHash('sha256')
    .update(`${secret}|${ip ?? ''}|${userAgent ?? ''}`)
    .digest('hex');
}

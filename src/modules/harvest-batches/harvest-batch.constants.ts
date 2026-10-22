import { randomBytes } from 'node:crypto';

// Excludes 0/O/1/I so the code printed under the QR can be read back or
// retyped without ambiguity.
const HARVEST_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const HARVEST_CODE_LENGTH = 8;

export const HARVEST_CODE_PATTERN = /^[2-9A-HJ-NP-Z]{8}$/;

/** Unguessable public code for a harvest batch (32^8 combinations). */
export function generateHarvestCode(): string {
  const bytes = randomBytes(HARVEST_CODE_LENGTH);
  let code = '';
  for (const byte of bytes) {
    code += HARVEST_CODE_ALPHABET[byte % HARVEST_CODE_ALPHABET.length];
  }
  return code;
}

const VIETNAM_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Today's calendar date in Vietnam as YYYY-MM-DD. */
export function todayInVietnam(now: Date = new Date()): string {
  return new Date(now.getTime() + VIETNAM_UTC_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

/** `@db.Date` columns round-trip as UTC midnight. */
export function toDateColumn(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function fromDateColumn(date: Date): string {
  return date.toISOString().slice(0, 10);
}

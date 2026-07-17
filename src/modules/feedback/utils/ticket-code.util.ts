import { randomBytes } from 'node:crypto';

// Excludes 0/O/1/I to avoid visual ambiguity when a citizen reads the code
// back over the phone or retypes it from a screenshot.
const TICKET_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const TICKET_CODE_LENGTH = 6;

/** Unguessable, non-sequential ticket code — not derived from Date.now(). */
export function generateTicketCode(): string {
  const bytes = randomBytes(TICKET_CODE_LENGTH);
  let suffix = '';
  for (const byte of bytes) {
    suffix += TICKET_CODE_ALPHABET[byte % TICKET_CODE_ALPHABET.length];
  }
  return `PH-${suffix}`;
}

/**
 * Normalizes a (typically Vietnamese) title into a URL-safe slug. `đ`/`Đ`
 * don't decompose under NFD normalization (they're distinct letters, not
 * base-letter + combining-mark pairs), so they need an explicit replace.
 */
export function slugify(input: string): string {
  const withoutDStroke = input.replace(/đ/g, 'd').replace(/Đ/g, 'D');
  const slug = withoutDStroke
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
  return slug || 'item';
}

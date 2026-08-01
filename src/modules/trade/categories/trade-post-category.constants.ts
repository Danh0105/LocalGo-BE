export const TRADE_POST_CATEGORY_CODE_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$/;

export function normalizeTradePostCategoryCode(code: string): string {
  return code.trim();
}

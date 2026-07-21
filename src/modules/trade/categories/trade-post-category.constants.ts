export const TRADE_POST_CATEGORY_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,49}$/;

export function normalizeTradePostCategoryCode(code: string): string {
  return code.trim().toUpperCase();
}

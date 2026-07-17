const SENSITIVE_KEY_PATTERN = /password|token|secret|hash/i;

/**
 * Strips any field whose *name* looks sensitive (password/token/secret/hash,
 * case-insensitive) before it's persisted to AuditLog.oldData/newData.
 * Applied unconditionally to every audit write, even if a caller accidentally
 * passes a raw entity containing e.g. refreshTokenHash — the audit table
 * must never contain these values regardless of caller discipline.
 */
export function redactAuditData(
  data: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null | undefined {
  if (data == null) {
    return data;
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    result[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[REDACTED]' : value;
  }
  return result;
}

import { redactAuditData } from './redact-audit-data.util';

describe('redactAuditData', () => {
  it('redacts fields whose name matches password/token/secret/hash', () => {
    const result = redactAuditData({
      email: 'user@example.com',
      passwordHash: 'argon2id$...',
      refreshTokenHash: 'argon2id$...',
      accessToken: 'eyJ...',
      apiSecret: 'xyz',
      displayName: 'Nguyen Van A',
    });

    expect(result).toEqual({
      email: 'user@example.com',
      passwordHash: '[REDACTED]',
      refreshTokenHash: '[REDACTED]',
      accessToken: '[REDACTED]',
      apiSecret: '[REDACTED]',
      displayName: 'Nguyen Van A',
    });
  });

  it('is case-insensitive on key names', () => {
    const result = redactAuditData({
      PASSWORD: 'x',
      Token: 'y',
      SecretKey: 'z',
    });
    expect(result).toEqual({
      PASSWORD: '[REDACTED]',
      Token: '[REDACTED]',
      SecretKey: '[REDACTED]',
    });
  });

  it('passes through null and undefined unchanged', () => {
    expect(redactAuditData(null)).toBeNull();
    expect(redactAuditData(undefined)).toBeUndefined();
  });

  it('leaves non-sensitive fields untouched', () => {
    const result = redactAuditData({ status: 'PUBLISHED', rating: 5 });
    expect(result).toEqual({ status: 'PUBLISHED', rating: 5 });
  });
});

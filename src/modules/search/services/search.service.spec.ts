import { normalizeSearchText } from '../../../common/utils/search-query.util';

describe('normalizeSearchText', () => {
  it('normalizes Vietnamese accents, case and punctuation', () => {
    expect(normalizeSearchText('  ĐẶC sản – Mãng cầu!  ')).toBe(
      'dac san mang cau',
    );
  });

  it('flattens searchable values without leaking object syntax into terms', () => {
    expect(
      normalizeSearchText(['Chùa Bà', { address: 'Truông Mít' }, null]),
    ).toContain('chua ba address truong mit');
  });
});

import {
  expandSearchQuery,
  matchesExpandedSearch,
  normalizeSearchText,
} from './search-query.util';

describe('search query utilities', () => {
  it('normalizes Vietnamese accents, case and punctuation', () => {
    expect(normalizeSearchText('  ĐẶC sản – Mãng cầu!  ')).toBe(
      'dac san mang cau',
    );
  });

  it('expands topic keywords without dropping the remaining terms', () => {
    expect(expandSearchQuery('ăn uống Truông Mít')).toContain(
      'am thuc truong mit',
    );
    expect(expandSearchQuery('chùa chiền')).toContain('chua');
    expect(expandSearchQuery('đi tham quan')).toContain('di du lich');
    expect(expandSearchQuery('du lịch')).toContain('tour trai nghiem');
  });

  it('maps the full administrative name to its common abbreviation', () => {
    expect(expandSearchQuery('ủy ban nhân dẫn')).toContain('ubnd');
    expect(
      matchesExpandedSearch(
        'UBND xã Truông Mít, trung tâm hành chính',
        'ủy ban nhân dẫn',
      ),
    ).toBe(true);
  });

  it('matches related categories, unordered prefixes and a minor typo', () => {
    expect(matchesExpandedSearch('Ẩm thực bò tơ', 'ăn uống')).toBe(true);
    expect(matchesExpandedSearch('Điểm du lịch sinh thái', 'tham quan')).toBe(
      true,
    );
    expect(matchesExpandedSearch('Chùa Bà', 'chùa chiền')).toBe(true);
    expect(matchesExpandedSearch('Khu vực hồ Dầu Tiếng', 'dau tien')).toBe(
      true,
    );
    expect(matchesExpandedSearch('Khu vực hồ Dầu Tiếng', 'dau tieng')).toBe(
      true,
    );
  });
});

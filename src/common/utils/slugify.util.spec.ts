import { slugify } from './slugify.util';

describe('slugify', () => {
  it('strips Vietnamese diacritics and lowercases', () => {
    expect(slugify('Bưởi Da Xanh')).toBe('buoi-da-xanh');
  });

  it('replaces đ/Đ (not decomposable via NFD)', () => {
    expect(slugify('Đặc sản Đông Nam Bộ')).toBe('dac-san-dong-nam-bo');
  });

  it('collapses non-alphanumeric runs into single hyphens', () => {
    expect(slugify('Xe máy Honda -- Wave Alpha (2020)!!')).toBe(
      'xe-may-honda-wave-alpha-2020',
    );
  });

  it('trims leading/trailing hyphens', () => {
    expect(slugify('  --Hello World--  ')).toBe('hello-world');
  });

  it('falls back to "item" for input with no alphanumeric characters', () => {
    expect(slugify('   ')).toBe('item');
    expect(slugify('!!!')).toBe('item');
  });
});

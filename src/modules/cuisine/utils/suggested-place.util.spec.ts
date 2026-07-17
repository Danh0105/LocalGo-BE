import { parseSuggestedPlaceDetails } from './suggested-place.util';

describe('parseSuggestedPlaceDetails', () => {
  it('returns [] for non-array input', () => {
    expect(parseSuggestedPlaceDetails(null, 'id')).toEqual([]);
    expect(parseSuggestedPlaceDetails('x', 'id')).toEqual([]);
    expect(parseSuggestedPlaceDetails({ a: 1 }, 'id')).toEqual([]);
  });

  it('converts legacy string entries into stable, slug-derived ids', () => {
    const result = parseSuggestedPlaceDetails(
      ['Quán ăn khu trung tâm xã', 'Quán B'],
      'id',
    );
    expect(result).toEqual([
      {
        id: 'quan-an-khu-trung-tam-xa',
        name: 'Quán ăn khu trung tâm xã',
        address: '',
        googleMapsUrl: '',
      },
      { id: 'quan-b', name: 'Quán B', address: '', googleMapsUrl: '' },
    ]);
  });

  it('deduplicates ids derived from identical legacy names', () => {
    const result = parseSuggestedPlaceDetails(['Quán A', 'Quán A'], 'id');
    expect(result.map((p) => p.id)).toEqual(['quan-a', 'quan-a-2']);
  });

  it('reads the new object shape as-is', () => {
    const result = parseSuggestedPlaceDetails(
      [
        {
          id: 'cho-thu-dau-mot',
          name: 'Chợ Thủ Dầu Một',
          address: 'Đường Hùng Vương',
          googleMapsUrl: 'https://maps.app.goo.gl/example',
        },
      ],
      'id',
    );
    expect(result).toEqual([
      {
        id: 'cho-thu-dau-mot',
        name: 'Chợ Thủ Dầu Một',
        address: 'Đường Hùng Vương',
        googleMapsUrl: 'https://maps.app.goo.gl/example',
      },
    ]);
  });

  it('reads a mixed array of legacy strings and new objects, preserving order', () => {
    const result = parseSuggestedPlaceDetails(
      [
        'Nơi cũ',
        {
          id: 'noi-moi',
          name: 'Nơi mới',
          address: '',
          googleMapsUrl: '',
        },
      ],
      'id',
    );
    expect(result.map((p) => p.name)).toEqual(['Nơi cũ', 'Nơi mới']);
  });

  it('skips malformed entries without throwing', () => {
    const result = parseSuggestedPlaceDetails(
      [
        42,
        null,
        {},
        { name: '   ' },
        { name: 'Hợp lệ', address: 1, googleMapsUrl: null },
      ],
      'id',
    );
    expect(result).toEqual([
      { id: 'hop-le', name: 'Hợp lệ', address: '', googleMapsUrl: '' },
    ]);
  });

  it('never throws for a circular-safe malformed nested array entry', () => {
    expect(() =>
      parseSuggestedPlaceDetails([['nested', 'array']], 'id'),
    ).not.toThrow();
  });
});

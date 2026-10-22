import { parseBuyPlaceDetails } from './buy-place.util';

describe('parseBuyPlaceDetails', () => {
  it('converts legacy names and assigns stable unique ids', () => {
    expect(
      parseBuyPlaceDetails(
        ['Chợ Truông Mít', 'Chợ Truông Mít'],
        'banh-trang-phoi-suong',
      ),
    ).toEqual([
      {
        id: 'cho-truong-mit',
        name: 'Chợ Truông Mít',
        address: '',
        googleMapsUrl: '',
        phone: '',
        email: '',
      },
      {
        id: 'cho-truong-mit-2',
        name: 'Chợ Truông Mít',
        address: '',
        googleMapsUrl: '',
        phone: '',
        email: '',
      },
    ]);
  });

  it('keeps the structured map and contact fields in their original order', () => {
    const places = [
      {
        id: 'cho-a',
        name: 'Chợ A',
        address: 'Địa chỉ A',
        googleMapsUrl: 'https://maps.app.goo.gl/cho-a',
        phone: '0900 123 456',
        email: 'cho-a@example.com',
      },
      {
        id: 'cua-hang-b',
        name: 'Cửa hàng B',
        address: 'Địa chỉ B',
        googleMapsUrl: 'https://www.google.com/maps/place/cua-hang-b',
        phone: '',
        email: '',
      },
    ];

    expect(parseBuyPlaceDetails(places, 'muoi-tom-tay-ninh')).toEqual(places);
  });

  it('skips malformed entries without rejecting the whole specialty', () => {
    expect(
      parseBuyPlaceDetails(
        [null, 123, {}, { name: '' }, { name: 'Điểm hợp lệ' }],
        'nem-buoi',
      ),
    ).toEqual([
      {
        id: 'diem-hop-le',
        name: 'Điểm hợp lệ',
        address: '',
        googleMapsUrl: '',
        phone: '',
        email: '',
      },
    ]);
  });
});

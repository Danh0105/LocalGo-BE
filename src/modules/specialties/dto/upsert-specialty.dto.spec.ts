import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateSpecialtyDto } from './upsert-specialty.dto';

const payload = (place: Record<string, unknown>) => ({
  name: 'Đặc sản kiểm thử',
  category: 'Món ăn',
  price: '20.000đ',
  season: 'Quanh năm',
  summary: 'Tóm tắt kiểm thử',
  description: ['Mô tả kiểm thử'],
  buyPlaceDetails: [place],
  imageAlt: 'Đặc sản kiểm thử',
});

describe('SpecialtyBuyPlaceDto validation', () => {
  it('trims full place and validates nested object', () => {
    const dto = plainToInstance(
      CreateSpecialtyDto,
      payload({
        id: 'cho-truong-mit',
        name: ' Chợ Truông Mít ',
        address: ' Trung tâm xã ',
        googleMapsUrl: ' https://maps.app.goo.gl/cho-truong-mit ',
        phone: ' 0900 123 456 ',
        email: ' lienhe@example.com ',
      }),
    );
    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.buyPlaceDetails?.[0]).toEqual({
      id: 'cho-truong-mit',
      name: 'Chợ Truông Mít',
      address: 'Trung tâm xã',
      googleMapsUrl: 'https://maps.app.goo.gl/cho-truong-mit',
      phone: '0900 123 456',
      email: 'lienhe@example.com',
    });
  });

  it('allows empty optional contact values', () => {
    const dto = plainToInstance(
      CreateSpecialtyDto,
      payload({
        id: 'cho-truong-mit',
        name: 'Chợ Truông Mít',
        googleMapsUrl: ' ',
        phone: ' ',
        email: ' ',
      }),
    );
    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.buyPlaceDetails?.[0].googleMapsUrl).toBeUndefined();
    expect(dto.buyPlaceDetails?.[0].phone).toBeUndefined();
    expect(dto.buyPlaceDetails?.[0].email).toBeUndefined();
  });

  it.each([
    ['googleMapsUrl', 'javascript:alert(1)'],
    ['phone', '0900-abc'],
    ['email', 'khong-phai-email'],
  ])('rejects invalid %s', (field, value) => {
    const dto = plainToInstance(
      CreateSpecialtyDto,
      payload({
        id: 'cho-truong-mit',
        name: 'Chợ Truông Mít',
        googleMapsUrl: 'https://maps.app.goo.gl/cho-truong-mit',
        [field]: value,
      }),
    );
    expect(validateSync(dto)).not.toHaveLength(0);
  });
});

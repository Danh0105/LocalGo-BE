import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateCuisineItemDto } from './upsert-cuisine.dto';

const validPayload = (overrides: Record<string, unknown> = {}) => ({
  name: 'Bánh canh Trảng Bàng',
  category: 'Món nước',
  priceRange: '35.000đ - 55.000đ',
  bestTime: 'Buổi sáng',
  suggestedPlaceDetails: [
    {
      id: 'quan-a',
      name: 'Quán A',
      address: 'Địa chỉ A',
      googleMapsUrl: 'https://maps.app.goo.gl/quan-a',
    },
  ],
  summary: 'Tóm tắt món ăn',
  description: ['Mô tả món ăn'],
  highlights: ['Điểm nổi bật'],
  tip: 'Dùng khi còn nóng',
  imageAlt: 'Bánh canh Trảng Bàng',
  ...overrides,
});

describe('CreateCuisineItemDto management fields', () => {
  it('accepts phone, gallery, menu and admin-managed reviews', () => {
    const dto = plainToInstance(
      CreateCuisineItemDto,
      validPayload({
        contactPhone: ' 0900 123 456 ',
        galleryMediaIds: [
          '1ec540ed-04f1-4fc8-ac9d-9a80fb42b9c6',
          '304cd8da-2eef-4e2a-8aca-a395ae4eb56a',
        ],
        menu: [
          {
            id: 'to-dac-biet',
            name: ' Tô đặc biệt ',
            price: ' 55.000đ ',
            description: ' Đầy đủ topping ',
          },
        ],
        reviews: [
          {
            id: 'review-1',
            reviewerName: ' Khách A ',
            rating: 5,
            feedback: ' Rất ngon ',
            adminResponse: ' Cảm ơn quý khách ',
          },
        ],
      }),
    );

    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.contactPhone).toBe('0900 123 456');
    expect(dto.menu?.[0]).toEqual({
      id: 'to-dac-biet',
      name: 'Tô đặc biệt',
      price: '55.000đ',
      description: 'Đầy đủ topping',
    });
    expect(dto.reviews?.[0]).toEqual({
      id: 'review-1',
      reviewerName: 'Khách A',
      rating: 5,
      feedback: 'Rất ngon',
      adminResponse: 'Cảm ơn quý khách',
    });
  });

  it.each([
    [{ contactPhone: '0900-abc' }],
    [
      {
        reviews: [
          {
            id: 'review-1',
            reviewerName: 'Khách A',
            rating: 6,
            feedback: 'Nội dung',
          },
        ],
      },
    ],
    [
      {
        galleryMediaIds: [
          '1ec540ed-04f1-4fc8-ac9d-9a80fb42b9c6',
          '1ec540ed-04f1-4fc8-ac9d-9a80fb42b9c6',
        ],
      },
    ],
  ])('rejects invalid management data', (overrides) => {
    const dto = plainToInstance(CreateCuisineItemDto, validPayload(overrides));
    expect(validateSync(dto)).not.toHaveLength(0);
  });
});

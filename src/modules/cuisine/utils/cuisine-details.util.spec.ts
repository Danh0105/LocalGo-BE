import { parseCuisineMenu, parseCuisineReviews } from './cuisine-details.util';

describe('cuisine details parsers', () => {
  it('normalizes menu and review optional fields', () => {
    expect(
      parseCuisineMenu(
        [{ id: 'mon-1', name: 'Món 1', price: '40.000đ' }],
        'cuisine-a',
      ),
    ).toEqual([
      {
        id: 'mon-1',
        name: 'Món 1',
        price: '40.000đ',
        description: '',
      },
    ]);
    expect(
      parseCuisineReviews(
        [
          {
            id: 'review-1',
            reviewerName: 'Khách A',
            rating: 5,
            feedback: 'Rất ngon',
          },
        ],
        'cuisine-a',
      ),
    ).toEqual([
      {
        id: 'review-1',
        reviewerName: 'Khách A',
        rating: 5,
        feedback: 'Rất ngon',
        adminResponse: '',
      },
    ]);
  });

  it('skips malformed and duplicate records safely', () => {
    expect(
      parseCuisineMenu(
        [
          null,
          { id: 'mon-1', name: 'Món 1', price: '40.000đ' },
          { id: 'mon-1', name: 'Món trùng', price: '50.000đ' },
        ],
        'cuisine-a',
      ),
    ).toHaveLength(1);
    expect(
      parseCuisineReviews(
        [
          { id: 'bad', reviewerName: 'A', rating: 9, feedback: 'Sai' },
          { id: 'ok', reviewerName: 'B', rating: 4, feedback: 'Ổn' },
        ],
        'cuisine-a',
      ),
    ).toHaveLength(1);
  });
});

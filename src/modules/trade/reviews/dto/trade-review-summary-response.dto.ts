import { ApiProperty } from '@nestjs/swagger';

export class TradeReviewSummaryResponseDto {
  @ApiProperty({ description: 'Điểm trung bình (0 nếu chưa có đánh giá)' })
  average: number;

  @ApiProperty({ description: 'Tổng số đánh giá đã duyệt' })
  total: number;

  @ApiProperty({
    description: 'Phần trăm mỗi mức sao (1-5), làm tròn tới số nguyên',
    example: { '1': 0, '2': 0, '3': 5, '4': 13, '5': 82 },
  })
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;

  @ApiProperty({
    description: 'Số lượng tuyệt đối mỗi mức sao (1-5)',
    example: { '1': 0, '2': 0, '3': 1, '4': 3, '5': 20 },
  })
  counts: Record<'1' | '2' | '3' | '4' | '5', number>;
}

import { ApiProperty } from '@nestjs/swagger';
import type { TradePostStatus } from '../../../../../generated/prisma';

export class AnalyticsRangeDto {
  @ApiProperty() from: Date;
  @ApiProperty() to: Date;
}

export class AnalyticsTotalsDto {
  @ApiProperty({ description: 'Tổng lượt xem trong khoảng thời gian.' })
  views: number;
  @ApiProperty({ description: 'Ước lượng khách duy nhất (xem).' })
  uniqueVisitors: number;
  @ApiProperty({ description: 'Số lần bấm gọi điện.' })
  contactPhone: number;
  @ApiProperty({ description: 'Số lần bấm liên hệ Zalo.' })
  contactZalo: number;
  @ApiProperty({ description: 'Số lần chia sẻ.' })
  share: number;
  @ApiProperty({ description: 'Số lượt lưu tin trong khoảng thời gian.' })
  save: number;
}

export class AnalyticsTimeseriesPointDto {
  @ApiProperty({ example: '2026-07-01', description: 'Ngày (múi giờ VN).' })
  date: string;
  @ApiProperty() views: number;
  @ApiProperty() contactPhone: number;
  @ApiProperty() contactZalo: number;
  @ApiProperty() share: number;
  @ApiProperty() save: number;
}

export class AnalyticsTopPostDto {
  @ApiProperty() tradePostId: string;
  @ApiProperty() title: string;
  @ApiProperty() slug: string;
  @ApiProperty({ nullable: true }) thumbnailUrl: string | null;
  @ApiProperty() views: number;
}

export class AnalyticsReviewsDto {
  @ApiProperty({ description: 'Tổng số đánh giá đã xuất bản (snapshot).' })
  count: number;
}

export class TradePostAnalyticsSummaryDto {
  @ApiProperty({ type: () => AnalyticsRangeDto })
  range: AnalyticsRangeDto;
  @ApiProperty({ description: 'Số tin trong phạm vi thống kê.' })
  postCount: number;
  @ApiProperty({ type: () => AnalyticsTotalsDto })
  totals: AnalyticsTotalsDto;
  @ApiProperty({ type: () => AnalyticsReviewsDto })
  reviews: AnalyticsReviewsDto;
  @ApiProperty({ type: () => AnalyticsTopPostDto, isArray: true })
  topPosts: AnalyticsTopPostDto[];
  @ApiProperty({ type: () => AnalyticsTimeseriesPointDto, isArray: true })
  timeseries: AnalyticsTimeseriesPointDto[];
}

export class AnalyticsPostInfoDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty() slug: string;
  @ApiProperty() status: TradePostStatus;
  @ApiProperty({ description: 'Tổng lượt xem tích lũy (snapshot).' })
  viewCount: number;
  @ApiProperty({ description: 'Số người đang lưu (snapshot).' })
  saveCount: number;
  @ApiProperty() reviewCount: number;
  @ApiProperty() averageRating: string;
}

export class TradePostAnalyticsDetailDto {
  @ApiProperty({ type: () => AnalyticsPostInfoDto })
  post: AnalyticsPostInfoDto;
  @ApiProperty({ type: () => AnalyticsRangeDto })
  range: AnalyticsRangeDto;
  @ApiProperty({ type: () => AnalyticsTotalsDto })
  totals: AnalyticsTotalsDto;
  @ApiProperty({ type: () => AnalyticsTimeseriesPointDto, isArray: true })
  timeseries: AnalyticsTimeseriesPointDto[];
}

import { HistoricalSiteRank } from '../generated/prisma';

export interface HistoricalSiteSeedItem {
  id: string;
  name: string;
  rank: HistoricalSiteRank;
  address: string;
  recognizedYear: number | null;
  summary: string;
  history: string[];
  highlights: string[];
}

export const HISTORICAL_SITE_SEED_DATA: HistoricalSiteSeedItem[] = [
  {
    id: 'dia-dao-truong-mit',
    name: 'Địa đạo Truông Mít',
    rank: HistoricalSiteRank.CAP_TINH,
    address: 'Ấp Thuận Bình, xã Truông Mít',
    recognizedYear: 2014,
    summary:
      'Hệ thống địa đạo từng là nơi trú ẩn, hội họp và bảo vệ lực lượng cách mạng trong thời kỳ kháng chiến.',
    history: [
      'Địa đạo Truông Mít được người dân và lực lượng cách mạng địa phương đào trong những năm kháng chiến. Các đoạn hầm liên kết với hầm bí mật, nơi cất giữ lương thực và điểm liên lạc.',
      'Di tích là minh chứng cho tinh thần đoàn kết, sự kiên cường và sáng tạo của quân dân địa phương trong điều kiện chiến tranh gian khó.',
    ],
    highlights: [
      'Đoạn địa đạo được phục dựng',
      'Không gian trưng bày hiện vật',
      'Điểm sinh hoạt truyền thống cho học sinh',
    ],
  },
  {
    id: 'bia-tuong-niem-loc-trung',
    name: 'Bia tưởng niệm Lộc Trung',
    rank: HistoricalSiteRank.CAP_TINH,
    address: 'Ấp Lộc Trung, xã Truông Mít',
    recognizedYear: 2018,
    summary:
      'Công trình ghi dấu sự hy sinh của cán bộ, chiến sĩ và người dân địa phương qua các thời kỳ đấu tranh bảo vệ quê hương.',
    history: [
      'Bia tưởng niệm được xây dựng tại địa điểm từng diễn ra nhiều hoạt động cách mạng quan trọng của vùng Lộc Trung.',
      'Hằng năm, chính quyền và người dân tổ chức dâng hương, thăm viếng vào các ngày lễ lớn để tưởng nhớ những người đã hy sinh.',
    ],
    highlights: [
      'Không gian tưởng niệm trang nghiêm',
      'Danh sách liệt sĩ địa phương',
      'Nơi tổ chức lễ dâng hương hằng năm',
    ],
  },
  {
    id: 'can-cu-ba-bau',
    name: 'Căn cứ Bàu Bầu',
    rank: HistoricalSiteRank.CHUA_XEP_HANG,
    address: 'Ấp Thuận An, xã Truông Mít',
    recognizedYear: null,
    summary:
      'Địa điểm từng che chở cơ sở cách mạng, gắn với mạng lưới giao liên và vận chuyển lương thực của địa phương.',
    history: [
      'Nhờ địa hình cây cối rậm rạp và gần các tuyến giao thông thủy, khu vực Bàu Bầu từng là điểm dừng chân an toàn của cán bộ giao liên.',
      'Người dân quanh vùng đã bí mật cung cấp lương thực, thuốc men và bảo vệ lực lượng hoạt động tại căn cứ.',
    ],
    highlights: [
      'Dấu tích hầm trú ẩn',
      'Cảnh quan tự nhiên còn được bảo tồn',
      'Câu chuyện của các nhân chứng địa phương',
    ],
  },
  {
    id: 'nha-truyen-thong-truong-mit',
    name: 'Nhà truyền thống Truông Mít',
    rank: HistoricalSiteRank.CHUA_XEP_HANG,
    address: 'Trung tâm xã Truông Mít',
    recognizedYear: null,
    summary:
      'Nơi lưu giữ hình ảnh, tư liệu và hiện vật kể lại quá trình hình thành, đấu tranh và phát triển của địa phương.',
    history: [
      'Nhà truyền thống được xây dựng nhằm tập hợp và giới thiệu các tư liệu quý do người dân, cựu chiến binh và gia đình chính sách trao tặng.',
      'Không gian trưng bày được chia theo từng giai đoạn, từ buổi đầu khai phá đến công cuộc xây dựng nông thôn mới.',
    ],
    highlights: [
      'Bộ sưu tập ảnh tư liệu',
      'Hiện vật qua các thời kỳ',
      'Không gian giáo dục lịch sử địa phương',
    ],
  },
];

import { TempleType } from '../generated/prisma';

export interface TempleSeedItem {
  id: string;
  name: string;
  type: TempleType;
  address: string;
  openHours: string;
  summary: string;
  description: string[];
  events: Array<{ time: string; name: string }>;
}

export const TEMPLE_SEED_DATA: TempleSeedItem[] = [
  {
    id: 'dinh-truong-mit',
    name: 'Đình Truông Mít',
    type: TempleType.DINH,
    address: 'Ấp Thuận Bình, xã Truông Mít',
    openHours: '05:00 - 18:00 hằng ngày',
    summary:
      'Ngôi đình cổ hơn 100 năm tuổi, nơi thờ Thành hoàng bổn cảnh và tổ chức lễ Kỳ Yên hằng năm.',
    description: [
      'Đình Truông Mít được xây dựng từ đầu thế kỷ XX, là trung tâm sinh hoạt tín ngưỡng lâu đời nhất của người dân trong xã. Đình thờ Thành hoàng bổn cảnh cùng các bậc tiền hiền, hậu hiền có công khai hoang lập ấp.',
      'Kiến trúc đình mang đậm phong cách Nam Bộ với mái ngói âm dương, hàng cột gỗ căm xe và các bức hoành phi, câu đối sơn son thếp vàng còn được gìn giữ nguyên vẹn.',
    ],
    events: [
      { time: '16/3 âm lịch', name: 'Lễ Kỳ Yên (cầu an)' },
      { time: '16/12 âm lịch', name: 'Lễ cúng Tất niên' },
    ],
  },
  {
    id: 'chua-phuoc-lam',
    name: 'Chùa Phước Lâm',
    type: TempleType.CHUA,
    address: 'Ấp Lộc Trung, xã Truông Mít',
    openHours: '04:30 - 20:00 hằng ngày',
    summary:
      'Ngôi chùa lớn nhất xã, không gian thanh tịnh với vườn cây cổ thụ và tượng Phật Quan Âm cao 12m.',
    description: [
      'Chùa Phước Lâm được khai sơn vào năm 1958, trải qua nhiều lần trùng tu đã trở thành điểm sinh hoạt Phật giáo lớn nhất của xã và các vùng lân cận.',
      'Khuôn viên chùa rộng hơn 2ha với vườn cây cổ thụ rợp bóng, hồ sen và tượng Phật Quan Âm lộ thiên cao 12m — điểm nhấn được nhiều du khách tìm đến chiêm bái, chụp ảnh.',
    ],
    events: [
      { time: '15/1 âm lịch', name: 'Lễ Thượng nguyên' },
      { time: '15/4 âm lịch', name: 'Đại lễ Phật Đản' },
      { time: '15/7 âm lịch', name: 'Lễ Vu Lan báo hiếu' },
    ],
  },
  {
    id: 'chua-long-tho',
    name: 'Chùa Long Thọ',
    type: TempleType.CHUA,
    address: 'Ấp Thuận An, xã Truông Mít',
    openHours: '05:00 - 19:00 hằng ngày',
    summary:
      'Ngôi chùa nhỏ yên bình bên kênh Đông, nổi tiếng với lớp học tình thương cho trẻ em địa phương.',
    description: [
      'Chùa Long Thọ tọa lạc bên bờ kênh Đông, được thành lập vào thập niên 1970. Chùa giữ nét kiến trúc giản dị, gần gũi với đời sống người dân vùng nông thôn.',
      'Ngoài hoạt động tôn giáo, chùa còn duy trì lớp học tình thương và bếp ăn từ thiện, trở thành địa chỉ nhân ái quen thuộc của bà con trong vùng.',
    ],
    events: [{ time: 'Chủ nhật hằng tuần', name: 'Khóa tu một ngày an lạc' }],
  },
  {
    id: 'mieu-ba-chua-xu',
    name: 'Miếu Bà Chúa Xứ',
    type: TempleType.MIEU,
    address: 'Ấp Thuận Hòa, xã Truông Mít',
    openHours: '05:00 - 18:00 hằng ngày',
    summary:
      'Ngôi miếu linh thiêng thờ Bà Chúa Xứ, thu hút đông đảo người dân đến cầu tài lộc, bình an.',
    description: [
      'Miếu Bà Chúa Xứ được người dân lập nên từ những ngày đầu khai hoang, thờ Bà Chúa Xứ — vị thần bảo hộ theo tín ngưỡng dân gian Nam Bộ.',
      'Lễ vía Bà hằng năm diễn ra trang trọng với nghi thức thỉnh sắc, hát bóng rỗi, thu hút hàng nghìn lượt khách thập phương về dự.',
    ],
    events: [{ time: '23 - 25/4 âm lịch', name: 'Lễ vía Bà Chúa Xứ' }],
  },
  {
    id: 'mieu-ong-ta',
    name: 'Miếu Ông Tà',
    type: TempleType.MIEU,
    address: 'Ấp Lộc Hiệp, xã Truông Mít',
    openHours: 'Mở cửa tự do',
    summary:
      'Ngôi miếu nhỏ dưới gốc cây da cổ thụ, gắn với tín ngưỡng thờ Ông Tà giữ đất của cư dân Nam Bộ.',
    description: [
      'Miếu Ông Tà nằm dưới tán cây da cổ thụ hàng trăm năm tuổi, là dấu tích của tín ngưỡng thờ Neak Tà — vị thần giữ đất, giữ làng có nguồn gốc từ văn hóa Khmer.',
      'Tuy quy mô nhỏ nhưng miếu là điểm dừng chân quen thuộc của nông dân trước mỗi vụ mùa, cầu mong mưa thuận gió hòa, ruộng đồng tươi tốt.',
    ],
    events: [{ time: '16/2 âm lịch', name: 'Lễ cúng Ông Tà đầu vụ' }],
  },
  {
    id: 'dinh-thuan-loi',
    name: 'Đình Thuận Lợi',
    type: TempleType.DINH,
    address: 'Ấp Thuận Lợi, xã Truông Mít',
    openHours: '05:30 - 17:30 hằng ngày',
    summary:
      'Ngôi đình gắn liền với lịch sử khai phá vùng đất Thuận Lợi, lưu giữ sắc phong thời Nguyễn.',
    description: [
      'Đình Thuận Lợi được dựng vào cuối thế kỷ XIX, hiện còn lưu giữ sắc phong thời Nguyễn cùng nhiều hiện vật gỗ chạm khắc tinh xảo.',
      'Hằng năm, lễ Kỳ Yên tại đình quy tụ đông đảo người dân trong ấp, là dịp tri ân các bậc tiền nhân và thắt chặt tình làng nghĩa xóm.',
    ],
    events: [{ time: '12/2 âm lịch', name: 'Lễ Kỳ Yên' }],
  },
];

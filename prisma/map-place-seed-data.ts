import { MapPlaceCategory } from '../generated/prisma';

export interface MapPlaceSeedItem {
  id: string;
  name: string;
  category: MapPlaceCategory;
  address: string;
  lat: number;
  lng: number;
  openTime: string;
  distanceFromCenter: string;
  summary: string;
  description: string[];
  highlights: string[];
  directionNote: string;
}

export const MAP_PLACE_SEED_DATA: MapPlaceSeedItem[] = [
  {
    id: 'ubnd-xa-truong-mit',
    name: 'UBND xã Truông Mít',
    category: MapPlaceCategory.HANH_CHINH,
    address: 'Trung tâm xã Truông Mít',
    lat: 11.2418,
    lng: 106.2024,
    openTime: 'Thứ 2 - Thứ 6, 07:00 - 17:00',
    distanceFromCenter: '0 km',
    summary:
      'Điểm trung tâm hành chính, phù hợp làm mốc xuất phát khi tra cứu các địa điểm trong xã.',
    description: [
      'UBND xã là mốc trung tâm để người dân và du khách định vị các tuyến đường, điểm tham quan, điểm dịch vụ trong khu vực.',
      'Khi kết nối API bản đồ, điểm này có thể dùng làm vị trí mặc định để tính khoảng cách và chỉ đường.',
    ],
    highlights: [
      'Mốc trung tâm xã',
      'Gần các điểm dịch vụ cơ bản',
      'Phù hợp làm điểm hẹn khi tham gia tour',
    ],
    directionNote:
      'Tọa độ hiện là dữ liệu mẫu; cần thay bằng tọa độ chính xác khi tích hợp bản đồ thật.',
  },
  {
    id: 'ho-dau-tieng',
    name: 'Khu vực hồ Dầu Tiếng',
    category: MapPlaceCategory.DU_LICH,
    address: 'Phía bắc xã Truông Mít',
    lat: 11.3156,
    lng: 106.1972,
    openTime: 'Cả ngày',
    distanceFromCenter: 'Khoảng 8 km',
    summary:
      'Không gian mặt nước rộng, thích hợp cắm trại, ngắm bình minh, hoàng hôn và chụp ảnh cuối tuần.',
    description: [
      'Khu vực ven hồ Dầu Tiếng là điểm đến thiên nhiên nổi bật với cảnh quan rộng thoáng, phù hợp cho các hoạt động ngoài trời.',
      'Trong app, địa điểm này có thể liên kết với chức năng Điểm du lịch và Tour trải nghiệm.',
    ],
    highlights: [
      'Cắm trại ven hồ',
      'Chụp ảnh bình minh, hoàng hôn',
      'Kết nối tuyến tham quan cuối tuần',
    ],
    directionNote:
      'Nên kiểm tra đường đi và thời tiết trước khi đến, đặc biệt trong mùa mưa.',
  },
  {
    id: 'kenh-dong-truong-mit',
    name: 'Tuyến kênh Đông',
    category: MapPlaceCategory.DU_LICH,
    address: 'Chạy dọc xã Truông Mít',
    lat: 11.2582,
    lng: 106.2141,
    openTime: 'Cả ngày',
    distanceFromCenter: 'Khoảng 2 - 5 km tùy điểm',
    summary:
      'Tuyến kênh xanh mát, phù hợp đạp xe, chạy bộ, check-in đồng quê và ngắm cảnh ven đường.',
    description: [
      'Kênh Đông là tuyến thủy lợi quan trọng, đồng thời tạo cảnh quan xanh mát dọc các vùng sản xuất của xã.',
      'Đây là điểm có thể dùng làm tuyến gợi ý cho tour đạp xe và các hoạt động trải nghiệm nông nghiệp.',
    ],
    highlights: [
      'Đạp xe ven kênh',
      'Check-in đồng ruộng theo mùa',
      'Gần các vùng sản xuất nông nghiệp',
    ],
    directionNote:
      'Một số đoạn đường ven kênh nhỏ; nên đi chậm và tránh di chuyển khi trời tối.',
  },
  {
    id: 'dia-dao-truong-mit',
    name: 'Địa đạo Truông Mít',
    category: MapPlaceCategory.DI_TICH,
    address: 'Ấp Thuận Bình, xã Truông Mít',
    lat: 11.2369,
    lng: 106.1898,
    openTime: 'Theo lịch tham quan địa phương',
    distanceFromCenter: 'Khoảng 3 km',
    summary:
      'Điểm di tích lịch sử gắn với hoạt động cách mạng địa phương, phù hợp tham quan giáo dục truyền thống.',
    description: [
      'Địa đạo Truông Mít là điểm gợi ý cho các tuyến tham quan lịch sử, đặc biệt với học sinh và đoàn thể.',
      'Dữ liệu bản đồ có thể liên kết trực tiếp sang trang Di tích lịch sử để xem thêm câu chuyện và điểm nổi bật.',
    ],
    highlights: [
      'Giáo dục truyền thống',
      'Phù hợp tour học sinh',
      'Có thể kết hợp với nhà truyền thống địa phương',
    ],
    directionNote:
      'Nên liên hệ trước để xác nhận thời gian mở cửa hoặc người hướng dẫn tại điểm.',
  },
  {
    id: 'cho-truong-mit',
    name: 'Chợ Truông Mít',
    category: MapPlaceCategory.DICH_VU,
    address: 'Khu trung tâm xã Truông Mít',
    lat: 11.2427,
    lng: 106.2046,
    openTime: 'Sáng sớm - chiều',
    distanceFromCenter: 'Khoảng 0.5 km',
    summary:
      'Điểm mua sắm, ăn sáng, mua nông sản và đặc sản địa phương trong khu vực trung tâm xã.',
    description: [
      'Chợ là nơi tập trung nhiều hoạt động mua bán hằng ngày, phù hợp để khách tìm món ăn sáng, trái cây, nông sản và đặc sản mang về.',
      'Sau này có thể bổ sung danh sách gian hàng, số điện thoại và trạng thái mở cửa theo dữ liệu API.',
    ],
    highlights: [
      'Ăn sáng và mua đồ dùng thiết yếu',
      'Mua nông sản, đặc sản địa phương',
      'Gần các điểm hành chính trung tâm',
    ],
    directionNote: 'Buổi sáng thường đông hơn; nên gửi xe đúng khu vực quy định.',
  },
  {
    id: 'quan-bo-to-784',
    name: 'Cụm quán bò tơ tỉnh lộ 784',
    category: MapPlaceCategory.AM_THUC,
    address: 'Dọc tỉnh lộ 784, xã Truông Mít',
    lat: 11.2294,
    lng: 106.2119,
    openTime: '10:00 - 21:00',
    distanceFromCenter: 'Khoảng 2 km',
    summary:
      'Khu gợi ý dùng bữa với các món bò tơ, món nướng và món cuốn đặc trưng vùng Tây Ninh.',
    description: [
      'Các quán ăn dọc tuyến 784 phù hợp cho khách đi theo nhóm, gia đình hoặc đoàn tham quan muốn dùng bữa sau lịch trình trải nghiệm.',
      'Điểm này có thể liên kết sang chức năng Ẩm thực để xem món gợi ý và khoảng giá.',
    ],
    highlights: [
      'Phù hợp bữa trưa hoặc tối',
      'Có món cuốn bánh tráng rau rừng',
      'Thuận tiện di chuyển bằng xe máy/ô tô',
    ],
    directionNote: 'Nên gọi trước nếu đi đoàn đông để quán chuẩn bị chỗ ngồi.',
  },
];

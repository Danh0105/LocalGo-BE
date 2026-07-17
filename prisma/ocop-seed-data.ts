import { OcopCategory, OcopRating } from '../generated/prisma';

export interface OcopSeedItem {
  id: string;
  name: string;
  category: OcopCategory;
  rating: OcopRating;
  producer: string;
  address: string;
  priceRange: string;
  summary: string;
  description: string[];
  highlights: string[];
  contactNote: string;
}

export const OCOP_SEED_DATA: OcopSeedItem[] = [
  {
    id: 'mat-ong-rung-truong-mit',
    name: 'Mật ong rừng Truông Mít',
    category: OcopCategory.THUC_PHAM,
    rating: OcopRating.FOUR,
    producer: 'Tổ hợp tác ong mật Thuận Bình',
    address: 'Ấp Thuận Bình, xã Truông Mít',
    priceRange: '120.000đ - 180.000đ/chai',
    summary:
      'Mật ong khai thác theo mùa, vị ngọt thanh, phù hợp dùng hằng ngày hoặc làm quà tặng địa phương.',
    description: [
      'Mật ong rừng Truông Mít được thu từ các đàn ong đặt gần vườn cây ăn trái và khu cây tự nhiên, có màu vàng hổ phách và mùi thơm nhẹ.',
      'Sản phẩm được lọc thô, đóng chai nhỏ gọn, hướng đến nhóm khách mua làm quà và người dân sử dụng trong gia đình.',
    ],
    highlights: [
      'Đóng chai tiện lợi, dễ trưng bày tại điểm bán',
      'Có thể phát triển tem truy xuất nguồn gốc',
      'Phù hợp kết hợp bán cùng sản phẩm du lịch trải nghiệm',
    ],
    contactNote:
      'Thông tin giá và tồn kho là dữ liệu mẫu; khi có API có thể cập nhật theo từng cơ sở sản xuất.',
  },
  {
    id: 'tra-la-sa-ke',
    name: 'Trà lá sa kê sấy khô',
    category: OcopCategory.DO_UONG,
    rating: OcopRating.THREE,
    producer: 'Cơ sở thảo mộc Lộc Trung',
    address: 'Ấp Lộc Trung, xã Truông Mít',
    priceRange: '65.000đ - 90.000đ/gói',
    summary:
      'Sản phẩm trà thảo mộc sấy khô, dùng pha uống nóng hoặc lạnh, định hướng phát triển quà tặng sức khỏe.',
    description: [
      'Lá sa kê được chọn lọc, rửa sạch, cắt nhỏ và sấy ở nhiệt độ phù hợp để giữ màu sắc tự nhiên.',
      'Sản phẩm hiện phù hợp bán tại các điểm giới thiệu nông sản, hội chợ địa phương và kênh đặt hàng trực tuyến.',
    ],
    highlights: [
      'Bao bì nhỏ gọn, dễ vận chuyển',
      'Nguyên liệu địa phương, quy trình đơn giản dễ mở rộng',
      'Có tiềm năng nâng hạng khi chuẩn hóa hồ sơ sản phẩm',
    ],
    contactNote:
      'Có thể bổ sung trường chứng nhận, ngày sản xuất và hạn dùng khi kết nối API quản lý sản phẩm.',
  },
  {
    id: 'sau-rieng-thuan-binh',
    name: 'Sầu riêng Thuận Bình',
    category: OcopCategory.NONG_SAN_TUOI,
    rating: OcopRating.FOUR,
    producer: 'Nhóm hộ vườn cây ăn trái Thuận Bình',
    address: 'Ấp Thuận Bình, xã Truông Mít',
    priceRange: 'Theo mùa vụ',
    summary:
      'Sầu riêng canh tác tại vườn địa phương, thu hoạch theo mùa, phù hợp đặt trước cho khách tham quan và thương lái.',
    description: [
      'Vùng vườn Thuận Bình có nhiều hộ trồng sầu riêng xen canh cây ăn trái khác, thuận lợi xây dựng tuyến tham quan và mua hàng tại vườn.',
      'Sản phẩm tươi cần cập nhật mùa vụ, sản lượng dự kiến và số điện thoại chủ vườn để khách hàng đặt trước.',
    ],
    highlights: [
      'Có thể gắn lịch mùa vụ theo thời gian thực',
      'Phù hợp bán tại vườn và theo đơn đặt trước',
      'Dễ kết nối với chức năng du lịch trải nghiệm',
    ],
    contactNote:
      'Sau này service có thể lấy sản lượng, giá ngày và trạng thái còn hàng từ API.',
  },
  {
    id: 'muoi-ot-xanh',
    name: 'Muối ớt xanh Truông Mít',
    category: OcopCategory.SAN_PHAM_CHE_BIEN,
    rating: OcopRating.THREE,
    producer: 'Cơ sở chế biến gia vị gia đình',
    address: 'Trung tâm xã Truông Mít',
    priceRange: '35.000đ - 55.000đ/hũ',
    summary:
      'Gia vị chấm trái cây và món nướng, đóng hũ nhỏ, dễ bán kèm tại các điểm đặc sản địa phương.',
    description: [
      'Muối ớt xanh được chế biến từ ớt tươi, muối, đường và gia vị cân chỉnh theo khẩu vị địa phương.',
      'Sản phẩm có lợi thế dễ sản xuất theo mẻ nhỏ, bao bì linh hoạt và phù hợp làm sản phẩm phụ trợ trong giỏ quà OCOP.',
    ],
    highlights: [
      'Chi phí sản xuất thấp, dễ nhân rộng',
      'Có thể bán kèm trái cây, đặc sản và đồ nướng',
      'Phù hợp phát triển nhãn nhận diện riêng',
    ],
    contactNote:
      'Dữ liệu hiện là mẫu; có thể bổ sung giấy phép, hạn dùng và tồn kho khi tích hợp API.',
  },
  {
    id: 'banh-trang-phoi-suong',
    name: 'Bánh tráng phơi sương',
    category: OcopCategory.SAN_PHAM_CHE_BIEN,
    rating: OcopRating.FIVE,
    producer: 'Cơ sở bánh tráng truyền thống',
    address: 'Xã Truông Mít',
    priceRange: '45.000đ - 80.000đ/xấp',
    summary:
      'Sản phẩm bánh tráng mềm dẻo, dùng cuốn rau, thịt luộc hoặc đặc sản địa phương, phù hợp làm quà.',
    description: [
      'Bánh tráng phơi sương là sản phẩm quen thuộc của Tây Ninh, có thể đưa vào nhóm sản phẩm tiêu biểu để giới thiệu với khách du lịch.',
      'Phiên bản dữ liệu mẫu này giúp kiểm thử màn hình OCOP trước khi thay bằng danh sách sản phẩm thật từ hệ thống quản trị.',
    ],
    highlights: [
      'Sản phẩm nhận diện mạnh với đặc sản Tây Ninh',
      'Dễ đóng gói theo combo quà tặng',
      'Có thể liên kết sang chức năng Đặc sản',
    ],
    contactNote:
      'Khi có API, nên quản lý thêm ảnh thật, điểm bán, trạng thái còn hàng và đánh giá sản phẩm.',
  },
];

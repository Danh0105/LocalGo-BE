import { AgricultureCategory } from '../generated/prisma';

export interface AgricultureSeedItem {
  id: string;
  name: string;
  category: AgricultureCategory;
  location: string;
  season: string;
  scale: string;
  summary: string;
  description: string[];
  highlights: string[];
  support: string;
}

export const AGRICULTURE_SEED_DATA: AgricultureSeedItem[] = [
  {
    id: 'vung-nguyen-lieu-mia',
    name: 'Vùng nguyên liệu mía Lộc Trung',
    category: AgricultureCategory.CAY_TRONG_CHU_LUC,
    location: 'Ấp Lộc Trung và các khu sản xuất lân cận',
    season: 'Trồng mới từ tháng 4 - 6, thu hoạch tháng 11 - 3',
    scale: 'Khoảng 420 ha',
    summary:
      'Vùng mía tập trung của xã, cung cấp nguyên liệu ổn định cho các cơ sở thu mua và chế biến trong khu vực.',
    description: [
      'Mía là cây trồng quen thuộc của Truông Mít nhờ phù hợp với thổ nhưỡng, khí hậu nắng nhiều và hệ thống kênh tưới tương đối thuận lợi.',
      'Các hộ sản xuất đang chuyển dần sang giống mía có chữ đường cao, áp dụng cơ giới hóa ở khâu làm đất, chăm sóc và vận chuyển để giảm chi phí lao động.',
    ],
    highlights: [
      'Có vùng sản xuất tập trung, thuận lợi liên kết tiêu thụ',
      'Ứng dụng tưới tiết kiệm ở một số diện tích',
      'Tận dụng phụ phẩm lá mía để che phủ đất, giữ ẩm',
    ],
    support:
      'Khuyến khích hộ dân đăng ký tham gia tổ liên kết để được cập nhật lịch thu mua, giống mới và hướng dẫn kỹ thuật.',
  },
  {
    id: 'vuon-cay-an-trai-thuan-binh',
    name: 'Vườn cây ăn trái Thuận Bình',
    category: AgricultureCategory.CAY_TRONG_CHU_LUC,
    location: 'Ấp Thuận Bình',
    season: 'Chăm sóc quanh năm, thu hoạch rộ tháng 5 - 8',
    scale: 'Khoảng 75 ha',
    summary:
      'Khu vườn cây ăn trái với sầu riêng, măng cụt, chôm chôm, định hướng kết hợp nông nghiệp sạch và trải nghiệm vườn.',
    description: [
      'Các vườn cây ăn trái tại Thuận Bình phát triển theo hướng đa cây, giúp phân tán rủi ro mùa vụ và tạo nguồn thu ổn định hơn cho nông hộ.',
      'Một số hộ đã ghi chép nhật ký canh tác, hạn chế thuốc bảo vệ thực vật và cải tạo hệ thống mương tưới để nâng chất lượng trái.',
    ],
    highlights: [
      'Có tiềm năng kết hợp du lịch trải nghiệm',
      'Ưu tiên phân hữu cơ và che phủ gốc',
      'Sản phẩm phù hợp xây dựng điểm bán nông sản địa phương',
    ],
    support:
      'Hộ dân có thể đăng ký tư vấn quy trình VietGAP, tem truy xuất nguồn gốc và kết nối tiêu thụ theo mùa.',
  },
  {
    id: 'mo-hinh-chan-nuoi-bo',
    name: 'Mô hình chăn nuôi bò sinh sản',
    category: AgricultureCategory.CHAN_NUOI,
    location: 'Các hộ chăn nuôi phân bố tại Thuận An, Thuận Bình',
    season: 'Chăm sóc quanh năm',
    scale: 'Quy mô hộ gia đình 5 - 20 con',
    summary:
      'Mô hình chăn nuôi bò sinh sản tận dụng phụ phẩm nông nghiệp, tạo thêm nguồn thu và phân hữu cơ cho sản xuất.',
    description: [
      'Chăn nuôi bò sinh sản phù hợp với điều kiện hộ gia đình có đất trồng cỏ hoặc tận dụng được phụ phẩm từ mía, bắp và cây ăn trái.',
      'Định hướng của xã là khuyến khích chuồng trại sạch, xử lý chất thải bằng hầm biogas hoặc ủ phân, đồng thời tiêm phòng đầy đủ theo khuyến cáo thú y.',
    ],
    highlights: [
      'Tận dụng nguồn thức ăn xanh tại địa phương',
      'Tạo phân chuồng phục vụ canh tác hữu cơ',
      'Dễ nhân rộng theo quy mô hộ',
    ],
    support:
      'Liên hệ cán bộ thú y xã để cập nhật lịch tiêm phòng, vệ sinh chuồng trại và kỹ thuật phối giống.',
  },
  {
    id: 'kenh-tuoi-noi-dong',
    name: 'Hệ thống kênh tưới nội đồng',
    category: AgricultureCategory.THUY_LOI,
    location: 'Dọc các tuyến sản xuất chính của xã',
    season: 'Vận hành cao điểm mùa khô',
    scale: 'Phục vụ nhiều vùng mía, lúa và cây ăn trái',
    summary:
      'Mạng lưới kênh mương hỗ trợ điều tiết nước tưới, góp phần ổn định sản xuất trong mùa khô.',
    description: [
      'Nguồn nước từ các tuyến kênh giúp nhiều vùng sản xuất chủ động hơn trong lịch xuống giống, chăm sóc cây trồng và phòng hạn.',
      'Công tác nạo vét, khơi thông dòng chảy và bảo vệ hành lang kênh được xem là nhiệm vụ quan trọng để duy trì năng lực tưới tiêu.',
    ],
    highlights: [
      'Hỗ trợ tưới cho vùng cây trồng chủ lực',
      'Giảm rủi ro thiếu nước trong cao điểm nắng nóng',
      'Cần cộng đồng cùng bảo vệ, không xả rác xuống kênh',
    ],
    support:
      'Người dân phản ánh tình trạng nghẽn dòng, sạt lở hoặc thiếu nước qua tổ thủy nông/ban ấp để được xử lý kịp thời.',
  },
  {
    id: 'to-hop-tac-nong-san-sach',
    name: 'Tổ hợp tác nông sản sạch',
    category: AgricultureCategory.MO_HINH_SAN_XUAT,
    location: 'Trung tâm xã và các điểm sản xuất liên kết',
    season: 'Tuyển hộ tham gia theo từng đợt mùa vụ',
    scale: 'Dữ liệu mẫu, có thể cập nhật theo API',
    summary:
      'Mô hình liên kết hộ sản xuất để chuẩn hóa quy trình, xây dựng nhãn nhận diện và mở rộng đầu ra cho nông sản địa phương.',
    description: [
      'Tổ hợp tác giúp các hộ nhỏ lẻ có tiếng nói chung trong việc chọn giống, lịch xuống giống, tiêu chuẩn chăm sóc và thương lượng đầu ra.',
      'Khi kết nối API, mục này có thể hiển thị danh sách tổ nhóm, sản phẩm đang bán, sản lượng dự kiến và thông tin liên hệ theo thời gian thực.',
    ],
    highlights: [
      'Phù hợp để gắn tem truy xuất nguồn gốc',
      'Dễ cập nhật sản lượng, mùa vụ và điểm bán',
      'Tạo nền cho sàn nông sản địa phương sau này',
    ],
    support:
      'Dữ liệu hiện là mẫu; khi có API chỉ cần thay service, cấu trúc page vẫn giữ nguyên.',
  },
];

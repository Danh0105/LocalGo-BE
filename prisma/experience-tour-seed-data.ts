import { ExperienceTourCategory } from '../generated/prisma';

export interface ExperienceTourSeedItem {
  id: string;
  name: string;
  category: ExperienceTourCategory;
  duration: string;
  startTime: string;
  priceRange: string;
  meetingPoint: string;
  summary: string;
  description: string[];
  itinerary: string[];
  included: string[];
  note: string;
}

export const EXPERIENCE_TOUR_SEED_DATA: ExperienceTourSeedItem[] = [
  {
    id: 'mot-ngay-lam-nong-dan',
    name: 'Một ngày làm nông dân Truông Mít',
    category: ExperienceTourCategory.NONG_NGHIEP,
    duration: '1 ngày',
    startTime: '07:30 - 16:30',
    priceRange: '250.000đ - 380.000đ/người',
    meetingPoint: 'Trung tâm xã Truông Mít',
    summary:
      'Tour trải nghiệm làm vườn, tham quan kênh tưới, dùng bữa quê và tìm hiểu nông sản địa phương.',
    description: [
      'Tour phù hợp với gia đình, học sinh và nhóm khách muốn thử một ngày sinh hoạt gần gũi với ruộng vườn.',
      'Khách được nghe giới thiệu về cây trồng chủ lực, tự tay tham gia một số công việc nhẹ như tưới cây, thu hoạch rau/trái theo mùa và thưởng thức bữa cơm quê.',
    ],
    itinerary: [
      'Đón khách tại trung tâm xã, giới thiệu chương trình',
      'Tham quan vườn cây ăn trái hoặc vùng mía theo mùa',
      'Trải nghiệm chăm sóc cây, thu hoạch nông sản',
      'Dùng bữa trưa với món ăn địa phương',
      'Mua nông sản/OCOP và kết thúc chương trình',
    ],
    included: [
      'Hướng dẫn viên địa phương',
      'Bữa trưa quê',
      'Nước uống cơ bản',
      'Dụng cụ trải nghiệm tại điểm tham quan',
    ],
    note: 'Dữ liệu hiện là mẫu; khi có API có thể cập nhật ngày khởi hành, số chỗ còn lại và form đặt tour.',
  },
  {
    id: 'dap-xe-kenh-dong',
    name: 'Đạp xe ven kênh Đông',
    category: ExperienceTourCategory.NUA_NGAY,
    duration: '3 - 4 giờ',
    startTime: '05:30 hoặc 15:30',
    priceRange: '120.000đ - 180.000đ/người',
    meetingPoint: 'Điểm hẹn ven kênh Đông',
    summary:
      'Hành trình đạp xe nhẹ nhàng dọc kênh Đông, ngắm đồng ruộng, chụp ảnh và thưởng thức nước mía địa phương.',
    description: [
      'Cung đường ven kênh Đông ít xe, nhiều bóng cây và có cảnh đồng ruộng thay đổi theo mùa, rất hợp cho tour ngắn buổi sáng hoặc chiều.',
      'Tour có nhịp độ nhẹ, ưu tiên trải nghiệm cảnh quan và giao lưu với người dân thay vì vận động cường độ cao.',
    ],
    itinerary: [
      'Tập trung, nhận xe và phổ biến an toàn',
      'Đạp xe dọc tuyến kênh Đông',
      'Dừng chụp ảnh tại ruộng mía/cánh đồng theo mùa',
      'Thưởng thức nước mía hoặc món ăn nhẹ',
      'Quay về điểm hẹn ban đầu',
    ],
    included: [
      'Xe đạp tiêu chuẩn',
      'Nón bảo hiểm',
      'Nước uống',
      'Người dẫn đường',
    ],
    note: 'Nên tổ chức vào sáng sớm hoặc chiều muộn để tránh nắng; cần kiểm tra thời tiết trước khi khởi hành.',
  },
  {
    id: 'lam-banh-trang-va-am-thuc',
    name: 'Làm bánh tráng và thưởng thức ẩm thực',
    category: ExperienceTourCategory.GIA_DINH,
    duration: 'Nửa ngày',
    startTime: '08:00 - 11:30',
    priceRange: '180.000đ - 260.000đ/người',
    meetingPoint: 'Hộ làm nghề/điểm sinh hoạt cộng đồng',
    summary:
      'Trải nghiệm tráng bánh, phơi bánh, tự cuốn món ăn dân dã và mua đặc sản làm quà.',
    description: [
      'Tour kết nối giữa Làng nghề, Ẩm thực và Đặc sản, giúp khách hiểu cách một sản phẩm quen thuộc được làm ra từ những công đoạn thủ công.',
      'Khách có thể tự thử tráng bánh đơn giản, nghe câu chuyện nghề và thưởng thức món cuốn với rau, thịt, nước chấm địa phương.',
    ],
    itinerary: [
      'Giới thiệu nghề làm bánh tráng',
      'Tham quan quy trình tráng, phơi, đóng gói',
      'Trải nghiệm thao tác làm bánh cơ bản',
      'Thưởng thức món cuốn bánh tráng',
      'Mua đặc sản/OCOP tại điểm tham quan',
    ],
    included: [
      'Hướng dẫn tại cơ sở nghề',
      'Nguyên liệu trải nghiệm',
      'Phần ăn nhẹ',
      'Ảnh check-in tại điểm nghề',
    ],
    note: 'Nên đặt trước để cơ sở chuẩn bị nguyên liệu và bố trí người hướng dẫn.',
  },
  {
    id: 'hoc-sinh-kham-pha-que-huong',
    name: 'Học sinh khám phá quê hương',
    category: ExperienceTourCategory.HOC_SINH,
    duration: '1 ngày',
    startTime: '07:00 - 15:30',
    priceRange: 'Theo số lượng đoàn',
    meetingPoint: 'Trường học hoặc nhà văn hóa xã',
    summary:
      'Chương trình giáo dục trải nghiệm cho học sinh với điểm lịch sử, nông nghiệp, làng nghề và trò chơi tập thể.',
    description: [
      'Tour được thiết kế cho trường học, ưu tiên nội dung an toàn, dễ hiểu và có hoạt động nhóm để học sinh vừa học vừa chơi.',
      'Lịch trình có thể linh hoạt theo độ tuổi, thời tiết và điểm tham quan đang sẵn sàng đón đoàn.',
    ],
    itinerary: [
      'Sinh hoạt đầu ngày, chia nhóm và phổ biến nội quy',
      'Tham quan điểm di tích/nhà truyền thống',
      'Tìm hiểu mô hình nông nghiệp hoặc làng nghề',
      'Dùng bữa trưa, nghỉ ngơi',
      'Trò chơi tập thể và tổng kết bài học',
    ],
    included: [
      'Điều phối chương trình',
      'Tài liệu/phiếu hoạt động mẫu',
      'Nước uống',
      'Hỗ trợ tổ chức trò chơi',
    ],
    note: 'Cần xác nhận số lượng học sinh, giáo viên phụ trách và yêu cầu an toàn trước khi tổ chức.',
  },
  {
    id: 'checkin-hoang-hon-dong-que',
    name: 'Check-in hoàng hôn đồng quê',
    category: ExperienceTourCategory.NUA_NGAY,
    duration: '2 - 3 giờ',
    startTime: '16:00 - 18:30',
    priceRange: '80.000đ - 150.000đ/người',
    meetingPoint: 'Khu vực cánh đồng/ven kênh theo mùa',
    summary:
      'Tour ngắn cho khách trẻ: chụp ảnh đồng quê, ngắm hoàng hôn, thưởng thức ăn vặt và nghe câu chuyện địa phương.',
    description: [
      'Tour tập trung vào trải nghiệm nhẹ, nhiều góc ảnh và nhịp đi chậm để khách tận hưởng không khí đồng quê lúc chiều muộn.',
      'Điểm chụp có thể thay đổi theo mùa lúa, mía, cao su hoặc cảnh quan ven kênh.',
    ],
    itinerary: [
      'Đón khách tại điểm hẹn',
      'Di chuyển đến điểm check-in theo mùa',
      'Chụp ảnh, nghe giới thiệu cảnh quan',
      'Thưởng thức ăn vặt/nước uống địa phương',
      'Ngắm hoàng hôn và kết thúc tour',
    ],
    included: [
      'Người dẫn đường',
      'Nước uống hoặc món ăn nhẹ',
      'Gợi ý góc chụp ảnh',
      'Hỗ trợ kết nối điểm bán đặc sản gần đó',
    ],
    note: 'Tour phụ thuộc thời tiết; nên có phương án đổi lịch nếu trời mưa hoặc đường ruộng khó đi.',
  },
];

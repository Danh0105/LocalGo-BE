import { CraftVillageCategory } from '../generated/prisma';

export interface CraftVillageSeedItem {
  id: string;
  name: string;
  category: CraftVillageCategory;
  address: string;
  workingTime: string;
  mainProducts: string;
  summary: string;
  description: string[];
  highlights: string[];
  visitorNote: string;
}

export const CRAFT_VILLAGE_SEED_DATA: CraftVillageSeedItem[] = [
  {
    id: 'banh-trang-truong-mit',
    name: 'Nghề làm bánh tráng Truông Mít',
    category: CraftVillageCategory.THU_CONG_TRUYEN_THONG,
    address: 'Các hộ sản xuất tại trung tâm xã Truông Mít',
    workingTime: '05:00 - 15:00 hằng ngày',
    mainProducts: 'Bánh tráng phơi sương, bánh tráng nhúng, bánh tráng cuốn',
    summary:
      'Nghề làm bánh tráng quy mô hộ gia đình, giữ nét thủ công và có tiềm năng kết hợp trải nghiệm cho du khách.',
    description: [
      'Các hộ làm bánh tráng thường bắt đầu từ sáng sớm với các công đoạn xay bột, tráng bánh, phơi và đóng gói.',
      'Mỗi mẻ bánh phụ thuộc nhiều vào tay nghề, độ nắng và kinh nghiệm canh lửa, tạo nên nét riêng của sản phẩm thủ công địa phương.',
    ],
    highlights: [
      'Có thể tham quan quy trình tráng và phơi bánh',
      'Dễ kết nối với sản phẩm OCOP và đặc sản',
      'Phù hợp xây dựng điểm trải nghiệm ngắn trong ngày',
    ],
    visitorNote:
      'Nên liên hệ trước với hộ sản xuất để sắp xếp thời gian tham quan, tránh khung giờ đang giao hàng.',
  },
  {
    id: 'muoi-ot-gia-dinh',
    name: 'Cơ sở làm muối ớt gia đình',
    category: CraftVillageCategory.SAN_PHAM_GIA_DINH,
    address: 'Khu dân cư trung tâm xã Truông Mít',
    workingTime: 'Theo đơn đặt hàng',
    mainProducts: 'Muối ớt xanh, muối ớt đỏ, gia vị chấm trái cây',
    summary:
      'Mô hình sản xuất nhỏ, tận dụng nguyên liệu địa phương để tạo sản phẩm gia vị dễ bán tại điểm du lịch và chợ phiên.',
    description: [
      'Muối ớt được chế biến theo mẻ nhỏ, chú trọng vị cay thơm, độ mặn vừa phải và bao bì tiện sử dụng.',
      'Đây là nhóm nghề phù hợp hỗ trợ chuẩn hóa nhãn mác, hạn dùng và tem truy xuất để nâng khả năng tiêu thụ.',
    ],
    highlights: [
      'Chi phí đầu tư thấp, dễ nhân rộng',
      'Có thể bán kèm trái cây và đặc sản địa phương',
      'Phù hợp phát triển theo nhóm hộ phụ nữ',
    ],
    visitorNote:
      'Khi kết nối API, mục này có thể hiển thị trạng thái nhận đơn, tồn kho và số điện thoại cơ sở.',
  },
  {
    id: 'dan-lat-tre-truc',
    name: 'Đan lát tre trúc',
    category: CraftVillageCategory.THU_CONG_TRUYEN_THONG,
    address: 'Ấp Thuận An, xã Truông Mít',
    workingTime: '08:00 - 17:00',
    mainProducts: 'Rổ, nia, giỏ, vật dụng trang trí từ tre',
    summary:
      'Nghề đan lát thủ công phục vụ sinh hoạt gia đình, đang được định hướng làm sản phẩm lưu niệm và trang trí.',
    description: [
      'Nguyên liệu tre trúc được chọn, chẻ nan, vót mỏng rồi đan thành các vật dụng dân dã phục vụ đời sống hằng ngày.',
      'Một số mẫu mới có thể được cải tiến về kiểu dáng, kích thước và màu sắc để phù hợp thị trường quà tặng.',
    ],
    highlights: [
      'Giữ được kỹ thuật thủ công truyền thống',
      'Có thể tổ chức trải nghiệm đan sản phẩm đơn giản',
      'Phù hợp phát triển dòng quà lưu niệm xanh',
    ],
    visitorNote:
      'Khách tham quan nên đặt trước nếu muốn trải nghiệm tự tay đan sản phẩm nhỏ.',
  },
  {
    id: 'say-trai-cay-thuan-binh',
    name: 'Sấy trái cây Thuận Bình',
    category: CraftVillageCategory.CHE_BIEN_NONG_SAN,
    address: 'Ấp Thuận Bình, xã Truông Mít',
    workingTime: 'Theo mùa trái cây',
    mainProducts: 'Chuối sấy, mít sấy, trái cây sấy dẻo',
    summary:
      'Mô hình chế biến giúp tận dụng nguồn trái cây theo mùa, tăng thời gian bảo quản và mở thêm kênh tiêu thụ.',
    description: [
      'Nguồn trái cây từ các vườn địa phương được sơ chế, cắt lát và sấy để tạo sản phẩm ăn vặt, quà tặng.',
      'Mô hình này phù hợp liên kết với vùng cây ăn trái và có thể phát triển thành điểm giới thiệu nông sản sạch.',
    ],
    highlights: [
      'Tăng giá trị cho nông sản theo mùa',
      'Dễ đóng gói thành combo quà tặng',
      'Có thể cập nhật sản phẩm theo từng mùa vụ',
    ],
    visitorNote:
      'Dữ liệu hiện là mẫu; khi có API có thể bổ sung lịch sản xuất, giá bán và hình ảnh sản phẩm thật.',
  },
  {
    id: 'trai-nghiem-lam-banh',
    name: 'Trải nghiệm làm bánh dân gian',
    category: CraftVillageCategory.DICH_VU_TRAI_NGHIEM,
    address: 'Nhà văn hóa/điểm sinh hoạt cộng đồng xã',
    workingTime: 'Cuối tuần hoặc theo đoàn đăng ký',
    mainProducts:
      'Bánh dân gian, hoạt động hướng dẫn cho học sinh và du khách',
    summary:
      'Hoạt động trải nghiệm ngắn giúp khách tìm hiểu nghề, thử làm sản phẩm và mua quà địa phương.',
    description: [
      'Mô hình trải nghiệm có thể tổ chức theo nhóm nhỏ, kết hợp giới thiệu câu chuyện làng nghề và hướng dẫn thao tác cơ bản.',
      'Khi app kết nối API, nội dung này có thể trở thành lịch đặt trải nghiệm, hiển thị số chỗ còn lại và thông tin hướng dẫn viên.',
    ],
    highlights: [
      'Phù hợp đoàn học sinh, gia đình và khách cuối tuần',
      'Kết nối tốt với mục Đặc sản, OCOP và Tour trải nghiệm',
      'Tạo thêm đầu ra cho hộ làm nghề',
    ],
    visitorNote:
      'Nên đặt lịch trước ít nhất 1 ngày để chuẩn bị nguyên liệu và người hướng dẫn.',
  },
];

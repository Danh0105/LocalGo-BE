import { FestivalCategory } from '../generated/prisma';

export interface FestivalSeedItem {
  id: string;
  name: string;
  category: FestivalCategory;
  time: string;
  location: string;
  scale: string;
  summary: string;
  description: string[];
  activities: string[];
  note: string;
}

export const FESTIVAL_SEED_DATA: FestivalSeedItem[] = [
  {
    id: 'le-hoi-dinh-lang-truong-mit',
    name: 'Lễ hội đình làng Truông Mít',
    category: FestivalCategory.LE_TRUYEN_THONG,
    time: 'Tháng Giêng âm lịch hằng năm',
    location: 'Khu vực đình/nhà văn hóa xã Truông Mít',
    scale: 'Cấp xã',
    summary:
      'Lễ hội truyền thống đầu năm với nghi thức dâng hương, cầu an và các hoạt động giao lưu văn nghệ cộng đồng.',
    description: [
      'Lễ hội đình làng là dịp người dân địa phương cùng tưởng nhớ tiền nhân, cầu mong năm mới bình an, mùa màng thuận lợi và cộng đồng gắn kết.',
      'Bên cạnh phần lễ trang nghiêm, phần hội thường có văn nghệ, trò chơi dân gian và các gian hàng giới thiệu sản phẩm địa phương.',
    ],
    activities: [
      'Dâng hương, cầu an đầu năm',
      'Giao lưu văn nghệ quần chúng',
      'Trò chơi dân gian và gian hàng địa phương',
    ],
    note: 'Dữ liệu hiện là mẫu; khi có API có thể cập nhật lịch tổ chức, đơn vị phụ trách và sơ đồ khu vực lễ hội.',
  },
  {
    id: 'tet-trong-cay',
    name: 'Ngày hội Tết trồng cây',
    category: FestivalCategory.VAN_HOA_CONG_DONG,
    time: 'Sau Tết Nguyên đán',
    location: 'Các tuyến đường, trường học và khu dân cư',
    scale: 'Cộng đồng dân cư',
    summary:
      'Hoạt động cộng đồng nhằm trồng cây xanh, chỉnh trang cảnh quan và lan tỏa ý thức bảo vệ môi trường.',
    description: [
      'Ngày hội Tết trồng cây thường huy động đoàn viên, học sinh, người dân và các tổ chức địa phương cùng tham gia trồng, chăm sóc cây xanh.',
      'Hoạt động này phù hợp đưa lên Mini App để thông báo thời gian, địa điểm tập trung và ghi nhận số lượng cây đã trồng.',
    ],
    activities: [
      'Trồng cây xanh ven đường và khu sinh hoạt cộng đồng',
      'Dọn vệ sinh, chỉnh trang cảnh quan',
      'Tuyên truyền bảo vệ môi trường',
    ],
    note: 'Có thể bổ sung chức năng đăng ký tham gia và thống kê đóng góp khi kết nối API.',
  },
  {
    id: 'hoi-thi-am-thuc-que',
    name: 'Hội thi ẩm thực quê',
    category: FestivalCategory.VAN_HOA_CONG_DONG,
    time: 'Dịp lễ lớn hoặc ngày hội đại đoàn kết',
    location: 'Nhà văn hóa xã Truông Mít',
    scale: 'Các ấp, tổ hội và hộ gia đình',
    summary:
      'Không gian thi nấu ăn, giới thiệu món ngon địa phương và kết nối với các chức năng Ẩm thực, Đặc sản, OCOP.',
    description: [
      'Hội thi ẩm thực quê giúp các ấp, tổ hội và hộ dân giới thiệu món ăn quen thuộc, cách chế biến và câu chuyện phía sau từng món.',
      'Đây là hoạt động có tính kết nối cao, dễ phát triển thành nội dung truyền thông cho du lịch cộng đồng và sản phẩm địa phương.',
    ],
    activities: [
      'Thi nấu món ăn truyền thống',
      'Trưng bày đặc sản và sản phẩm OCOP',
      'Chấm điểm, trao giải và giao lưu khách tham quan',
    ],
    note: 'Nên quản lý thêm danh sách đội thi, món dự thi và kết quả giải thưởng qua API sau này.',
  },
  {
    id: 'hoi-thao-nong-dan',
    name: 'Hội thao nông dân',
    category: FestivalCategory.THE_THAO_VUI_CHOI,
    time: 'Theo kế hoạch phong trào hằng năm',
    location: 'Sân thể thao/nhà văn hóa xã',
    scale: 'Các ấp và đoàn thể',
    summary:
      'Sân chơi rèn luyện sức khỏe, giao lưu giữa các ấp với các môn kéo co, bóng chuyền, đi xe đạp chậm và trò chơi dân gian.',
    description: [
      'Hội thao nông dân tạo không khí vui tươi sau mùa vụ, khuyến khích người dân tham gia hoạt động thể chất và tăng tinh thần đoàn kết.',
      'Trên Mini App, hội thao có thể hiển thị lịch thi đấu, đội tham gia, kết quả từng môn và hình ảnh sau sự kiện.',
    ],
    activities: [
      'Bóng chuyền, kéo co, chạy tiếp sức',
      'Trò chơi dân gian cho thiếu nhi',
      'Trao giải và giao lưu văn nghệ',
    ],
    note: 'Khi tích hợp API, nên tách lịch thi đấu thành dữ liệu con để cập nhật kết quả theo thời gian thực.',
  },
  {
    id: 'ngay-hoi-nong-san',
    name: 'Ngày hội nông sản Truông Mít',
    category: FestivalCategory.SU_KIEN_NONG_SAN,
    time: 'Theo mùa thu hoạch',
    location: 'Khu trung tâm xã hoặc điểm giới thiệu sản phẩm',
    scale: 'Hộ sản xuất, tổ hợp tác và cơ sở kinh doanh',
    summary:
      'Sự kiện giới thiệu trái cây, sản phẩm chế biến, OCOP và các mô hình nông nghiệp tiêu biểu của địa phương.',
    description: [
      'Ngày hội nông sản là dịp quảng bá sản phẩm địa phương, kết nối hộ sản xuất với người mua và tạo thêm điểm nhấn cho du khách.',
      'Nội dung này có thể liên thông với Nông nghiệp, OCOP và Làng nghề để tạo thành hệ sinh thái thông tin thống nhất.',
    ],
    activities: [
      'Trưng bày, bán thử sản phẩm nông sản',
      'Kết nối tiêu thụ và đặt hàng theo mùa',
      'Giới thiệu mô hình sản xuất sạch',
    ],
    note: 'Sau này có thể gắn danh sách gian hàng, sản phẩm, vị trí booth và form đăng ký tham gia.',
  },
];

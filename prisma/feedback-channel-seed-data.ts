import { FeedbackChannelCategory } from '../generated/prisma';

export interface FeedbackChannelSeedItem {
  id: string;
  title: string;
  category: FeedbackChannelCategory;
  responseTime: string;
  requiredInfo: string[];
  summary: string;
  description: string[];
  examples: string[];
  note: string;
}

export const FEEDBACK_CHANNEL_SEED_DATA: FeedbackChannelSeedItem[] = [
  {
    id: 'gop-y-chung',
    title: 'Góp ý chung cho địa phương',
    category: FeedbackChannelCategory.GOP_Y_CHUNG,
    responseTime: 'Tiếp nhận trong giờ hành chính',
    requiredInfo: ['Họ tên', 'Số điện thoại', 'Nội dung góp ý'],
    summary:
      'Kênh tiếp nhận ý kiến đóng góp về hoạt động cộng đồng, thông tin địa phương và các đề xuất cải thiện.',
    description: [
      'Người dân có thể gửi góp ý về các hoạt động chung của xã, nội dung truyền thông, phong trào cộng đồng hoặc đề xuất ý tưởng mới.',
      'Khi kết nối API, loại phản hồi này có thể được chuyển thành ticket để cán bộ phụ trách phân loại và cập nhật trạng thái xử lý.',
    ],
    examples: [
      'Đề xuất bổ sung thông tin về lịch sinh hoạt cộng đồng',
      'Góp ý cách trình bày thông tin trên Mini App',
      'Đề nghị cập nhật thêm địa điểm dịch vụ trong xã',
    ],
    note: 'Nội dung nên rõ ràng, ngắn gọn và có thông tin liên hệ để tiện phản hồi.',
  },
  {
    id: 'phan-anh-ha-tang',
    title: 'Phản ánh hạ tầng, môi trường',
    category: FeedbackChannelCategory.PHAN_ANH_HA_TANG,
    responseTime: 'Ưu tiên xử lý theo mức độ ảnh hưởng',
    requiredInfo: ['Vị trí', 'Mô tả sự việc', 'Ảnh minh họa nếu có'],
    summary:
      'Kênh phản ánh các vấn đề về đường giao thông, chiếu sáng, vệ sinh môi trường, kênh mương và cảnh quan.',
    description: [
      'Người dân có thể phản ánh vị trí hư hỏng, mất an toàn, rác thải, đèn chiếu sáng hoặc tình trạng ảnh hưởng đến sinh hoạt chung.',
      'Dữ liệu sau này nên lưu kèm tọa độ, hình ảnh, trạng thái tiếp nhận và đơn vị xử lý để theo dõi minh bạch hơn.',
    ],
    examples: [
      'Đèn đường không hoạt động',
      'Đường có ổ gà, ngập nước hoặc xuống cấp',
      'Rác thải tồn đọng tại khu dân cư',
    ],
    note: 'Nên ghi rõ vị trí cụ thể hoặc chọn điểm trên bản đồ khi chức năng bản đồ được tích hợp.',
  },
  {
    id: 'dich-vu-cong',
    title: 'Góp ý dịch vụ công',
    category: FeedbackChannelCategory.DICH_VU_CONG,
    responseTime: 'Theo lịch tiếp nhận của bộ phận chuyên môn',
    requiredInfo: ['Bộ phận liên quan', 'Nội dung góp ý', 'Thông tin liên hệ'],
    summary:
      'Kênh ghi nhận trải nghiệm của người dân khi liên hệ thủ tục, tiếp nhận hồ sơ hoặc nhận hướng dẫn hành chính.',
    description: [
      'Mục này giúp người dân phản ánh khó khăn, góp ý thái độ phục vụ, quy trình hướng dẫn hoặc đề xuất cải thiện dịch vụ công.',
      'Khi mount API, có thể bổ sung trường mã hồ sơ, bộ phận xử lý, mức độ hài lòng và lịch sử phản hồi.',
    ],
    examples: [
      'Góp ý quy trình hướng dẫn hồ sơ',
      'Đề nghị bổ sung hướng dẫn trực tuyến',
      'Phản ánh thời gian chờ xử lý',
    ],
    note: 'Không nên gửi thông tin nhạy cảm công khai; chỉ nhập thông tin cần thiết cho việc xử lý.',
  },
  {
    id: 'du-lich-trai-nghiem',
    title: 'Phản hồi du lịch, trải nghiệm',
    category: FeedbackChannelCategory.DU_LICH,
    responseTime: 'Tổng hợp định kỳ để cải thiện dịch vụ',
    requiredInfo: ['Điểm tham quan/tour', 'Mức độ hài lòng', 'Góp ý cụ thể'],
    summary:
      'Kênh nhận đánh giá về điểm du lịch, tour trải nghiệm, ẩm thực, làng nghề và sản phẩm địa phương.',
    description: [
      'Du khách có thể chia sẻ cảm nhận sau khi tham quan, dùng bữa, mua sản phẩm hoặc tham gia tour trải nghiệm tại Truông Mít.',
      'Phản hồi này hữu ích cho việc nâng chất lượng điểm đến, cập nhật dữ liệu bản đồ và cải thiện dịch vụ du lịch cộng đồng.',
    ],
    examples: [
      'Đánh giá tour đạp xe ven kênh',
      'Góp ý điểm check-in hoặc nơi ăn uống',
      'Đề xuất thêm hoạt động cho trẻ em',
    ],
    note: 'Nên nêu rõ thời gian trải nghiệm để địa phương dễ đối chiếu và cải thiện.',
  },
  {
    id: 'loi-mini-app',
    title: 'Báo lỗi Mini App',
    category: FeedbackChannelCategory.MINI_APP,
    responseTime: 'Tiếp nhận và tổng hợp theo phiên bản',
    requiredInfo: ['Màn hình gặp lỗi', 'Mô tả lỗi', 'Thiết bị đang dùng'],
    summary:
      'Kênh báo lỗi hiển thị, sai thông tin, lỗi điều hướng hoặc đề xuất cải thiện tính năng Mini App.',
    description: [
      'Người dùng có thể phản ánh lỗi giao diện, nội dung chưa đúng, nút không hoạt động hoặc đề xuất chức năng mới cho Mini App.',
      'Khi có API, phản hồi có thể lưu cùng phiên bản ứng dụng, thiết bị, ảnh chụp màn hình và trạng thái xử lý.',
    ],
    examples: [
      'Nút điều hướng chưa mở đúng trang',
      'Thông tin địa điểm bị sai',
      'Giao diện bị lệch trên thiết bị nhỏ',
    ],
    note: 'Nếu có thể, hãy gửi kèm ảnh chụp màn hình để đội kỹ thuật kiểm tra nhanh hơn.',
  },
];

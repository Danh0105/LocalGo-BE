import { ContactCategory } from '../generated/prisma';

export interface ContactSeedItem {
  id: string;
  name: string;
  category: ContactCategory;
  role: string;
  phone: string;
  email?: string;
  address: string;
  workingTime: string;
  summary: string;
  description: string[];
  supportTopics: string[];
  note: string;
}

/**
 * Số điện thoại/email dưới đây là dữ liệu mẫu (ví dụ 0276 000 000, đuôi
 * @example.vn) — đơn vị vận hành PHẢI xác nhận và cập nhật lại thông tin
 * thật qua admin API trước khi phát hành chính thức.
 */
export const CONTACT_SEED_DATA: ContactSeedItem[] = [
  {
    id: 'ubnd-xa-truong-mit',
    name: 'UBND xã Truông Mít',
    category: ContactCategory.HANH_CHINH,
    role: 'Tiếp nhận thông tin hành chính, thủ tục và liên hệ chung',
    phone: '0276 000 000',
    email: 'ubnd.truongmit@example.vn',
    address: 'Trung tâm xã Truông Mít',
    workingTime: 'Thứ 2 - Thứ 6, 07:00 - 17:00',
    summary:
      'Kênh liên hệ chung cho người dân khi cần hỏi thông tin thủ tục, lịch làm việc và các đầu mối tại xã.',
    description: [
      'UBND xã là đầu mối tiếp nhận và hướng dẫn các thông tin liên quan đến hành chính, lịch tiếp công dân và các hoạt động chung của địa phương.',
      'Thông tin hiện là dữ liệu mẫu, có thể thay bằng số điện thoại, email và địa chỉ chính thức khi kết nối API quản trị.',
    ],
    supportTopics: [
      'Hỏi thông tin thủ tục hành chính',
      'Lịch tiếp công dân',
      'Liên hệ các bộ phận chuyên môn',
    ],
    note: 'Nên gọi trong giờ hành chính để được hỗ trợ nhanh hơn.',
  },
  {
    id: 'cong-an-xa',
    name: 'Công an xã',
    category: ContactCategory.KHAN_CAP,
    role: 'Tiếp nhận thông tin an ninh trật tự',
    phone: '0276 111 111',
    address: 'Khu trung tâm xã Truông Mít',
    workingTime: 'Trực tiếp nhận thông tin khẩn cấp',
    summary:
      'Kênh liên hệ khi cần phản ánh tình hình an ninh trật tự, mất giấy tờ, sự cố hoặc hỗ trợ khẩn cấp.',
    description: [
      'Công an xã hỗ trợ người dân trong các vấn đề liên quan đến an ninh trật tự, xác minh thông tin và tiếp nhận phản ánh sự cố.',
      'Với các tình huống khẩn cấp, người dân nên gọi trực tiếp để được hướng dẫn kịp thời.',
    ],
    supportTopics: [
      'An ninh trật tự',
      'Sự cố khẩn cấp',
      'Hỗ trợ xác minh, phản ánh',
    ],
    note: 'Nếu nguy hiểm tức thời, hãy ưu tiên gọi số khẩn cấp theo hướng dẫn địa phương.',
  },
  {
    id: 'tram-y-te-xa',
    name: 'Trạm y tế xã',
    category: ContactCategory.KHAN_CAP,
    role: 'Tư vấn y tế ban đầu và hỗ trợ chăm sóc sức khỏe cộng đồng',
    phone: '0276 222 222',
    address: 'Trung tâm xã Truông Mít',
    workingTime: 'Giờ hành chính và theo lịch trực',
    summary:
      'Kênh liên hệ khi cần hỏi lịch khám, tiêm chủng, tư vấn y tế ban đầu hoặc thông tin chăm sóc sức khỏe.',
    description: [
      'Trạm y tế xã là đầu mối chăm sóc sức khỏe ban đầu, truyền thông y tế cộng đồng và hỗ trợ các chương trình tiêm chủng, phòng bệnh.',
      'Người dân nên liên hệ trước để xác nhận lịch làm việc hoặc lịch triển khai từng chương trình y tế.',
    ],
    supportTopics: [
      'Lịch khám và tư vấn ban đầu',
      'Tiêm chủng, phòng bệnh',
      'Thông tin y tế cộng đồng',
    ],
    note: 'Thông tin này không thay thế tư vấn cấp cứu chuyên môn trong tình huống nguy hiểm.',
  },
  {
    id: 'du-lich-cong-dong',
    name: 'Tổ hỗ trợ du lịch cộng đồng',
    category: ContactCategory.DU_LICH,
    role: 'Hỗ trợ tour trải nghiệm, điểm tham quan và thông tin lưu trú',
    phone: '0900 123 456',
    email: 'dulich.truongmit@example.vn',
    address: 'Điểm thông tin du lịch xã Truông Mít',
    workingTime: '08:00 - 17:00 hằng ngày',
    summary:
      'Kênh gợi ý lịch trình, điểm đến, tour trải nghiệm và kết nối cơ sở dịch vụ địa phương.',
    description: [
      'Tổ hỗ trợ du lịch cộng đồng giúp du khách chọn lịch trình phù hợp, liên hệ điểm trải nghiệm và nắm các lưu ý trước khi tham quan.',
      'Sau này mục này có thể liên kết trực tiếp với Tour trải nghiệm, Bản đồ và phản hồi khách tham quan.',
    ],
    supportTopics: [
      'Gợi ý điểm tham quan',
      'Đặt tour trải nghiệm',
      'Kết nối điểm ăn uống, đặc sản',
    ],
    note: 'Nên liên hệ trước ít nhất 1 ngày nếu đi theo nhóm đông.',
  },
  {
    id: 'khuyen-nong-xa',
    name: 'Cán bộ khuyến nông',
    category: ContactCategory.NONG_NGHIEP,
    role: 'Tư vấn kỹ thuật sản xuất và thông tin mùa vụ',
    phone: '0900 234 567',
    address: 'Bộ phận nông nghiệp xã Truông Mít',
    workingTime: 'Thứ 2 - Thứ 6, 07:30 - 16:30',
    summary:
      'Kênh hỗ trợ hộ sản xuất về cây trồng, chăn nuôi, thủy lợi, mô hình liên kết và thông tin tiêu thụ.',
    description: [
      'Cán bộ khuyến nông hỗ trợ người dân cập nhật kỹ thuật canh tác, lịch mùa vụ, phòng trừ sâu bệnh và thông tin các mô hình sản xuất.',
      'Dữ liệu có thể mở rộng thêm chuyên môn phụ trách, vùng quản lý và lịch tư vấn khi kết nối API.',
    ],
    supportTopics: [
      'Kỹ thuật cây trồng, chăn nuôi',
      'Thông tin mùa vụ',
      'Mô hình liên kết sản xuất',
    ],
    note: 'Nên chuẩn bị ảnh hiện trạng cây trồng/vật nuôi nếu cần tư vấn từ xa.',
  },
  {
    id: 'duong-day-phan-anh',
    name: 'Đường dây tiếp nhận phản ánh',
    category: ContactCategory.PHAN_ANH,
    role: 'Tiếp nhận góp ý, phản ánh và kiến nghị của người dân',
    phone: '0900 345 678',
    email: 'phananh.truongmit@example.vn',
    address: 'UBND xã Truông Mít',
    workingTime: 'Tiếp nhận trong giờ hành chính',
    summary:
      'Kênh tiếp nhận phản ánh về môi trường, hạ tầng, dịch vụ công và các vấn đề cộng đồng.',
    description: [
      'Người dân có thể liên hệ đường dây phản ánh khi phát hiện vấn đề về vệ sinh môi trường, hạ tầng, an toàn giao thông hoặc dịch vụ công.',
      'Khi có API, chức năng này có thể kết nối với biểu mẫu phản hồi, trạng thái xử lý và lịch sử phản ánh.',
    ],
    supportTopics: [
      'Phản ánh môi trường, hạ tầng',
      'Góp ý dịch vụ công',
      'Kiến nghị cộng đồng',
    ],
    note: 'Nên cung cấp nội dung rõ ràng, vị trí, hình ảnh hoặc thời gian xảy ra sự việc nếu có.',
  },
];

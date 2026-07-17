import { CuisineCategory } from '../generated/prisma';

export interface CuisineSuggestedPlaceSeedItem {
  id: string;
  name: string;
  address: string;
  googleMapsUrl: string;
}

export interface CuisineSeedItem {
  id: string;
  name: string;
  category: CuisineCategory;
  priceRange: string;
  bestTime: string;
  suggestedPlaces: CuisineSuggestedPlaceSeedItem[];
  summary: string;
  description: string[];
  highlights: string[];
  tip: string;
}

export const CUISINE_SEED_DATA: CuisineSeedItem[] = [
  {
    id: 'banh-canh-trang-bang',
    name: 'Bánh canh Trảng Bàng',
    category: CuisineCategory.MON_NUOC,
    priceRange: '35.000đ - 55.000đ/tô',
    bestTime: 'Buổi sáng hoặc chiều tối',
    suggestedPlaces: [
      {
        id: 'quan-an-khu-trung-tam-xa',
        name: 'Quán ăn khu trung tâm xã',
        address: '',
        googleMapsUrl: '',
      },
      {
        id: 'cac-diem-an-sang-doc-tinh-lo-784',
        name: 'Các điểm ăn sáng dọc tỉnh lộ 784',
        address: '',
        googleMapsUrl: '',
      },
    ],
    summary:
      'Tô bánh canh nóng với sợi mềm, nước dùng ngọt thanh và thịt heo thái mỏng, dễ ăn trong mọi thời điểm.',
    description: [
      'Bánh canh Trảng Bàng là món ăn quen thuộc của vùng Tây Ninh, nổi bật bởi nước dùng trong, vị ngọt từ xương và phần bánh mềm vừa phải.',
      'Khi đưa vào Mini App, món này có thể kết nối với danh sách quán ăn, giờ mở cửa và đánh giá của người dùng.',
    ],
    highlights: [
      'Phù hợp ăn sáng, ăn nhẹ hoặc dùng sau khi tham quan',
      'Hương vị dễ ăn với nhiều nhóm khách',
      'Có thể bán kèm bánh tráng, rau sống và nước chấm',
    ],
    tip: 'Nên ăn lúc còn nóng; nếu đi theo nhóm đông nên gọi trước để quán chuẩn bị nhanh hơn.',
  },
  {
    id: 'bo-to-nuong-rau-rung',
    name: 'Bò tơ nướng cuốn rau rừng',
    category: CuisineCategory.MON_NUONG,
    priceRange: '150.000đ - 300.000đ/phần',
    bestTime: 'Buổi trưa hoặc tối',
    suggestedPlaces: [
      {
        id: 'cac-quan-bo-to-doc-tinh-lo-784',
        name: 'Các quán bò tơ dọc tỉnh lộ 784',
        address: '',
        googleMapsUrl: '',
      },
      {
        id: 'quan-an-gia-dinh-khu-trung-tam-xa',
        name: 'Quán ăn gia đình khu trung tâm xã',
        address: '',
        googleMapsUrl: '',
      },
    ],
    summary:
      'Thịt bò tơ nướng mềm ngọt, cuốn cùng bánh tráng và rau rừng, là món đãi khách đậm chất Tây Ninh.',
    description: [
      'Bò tơ được nướng vừa chín tới để giữ độ mềm, sau đó cuốn cùng bánh tráng, rau rừng, dưa leo và chấm mắm nêm.',
      'Món này phù hợp nhóm khách gia đình hoặc đoàn tham quan muốn dùng bữa no, có trải nghiệm ẩm thực địa phương rõ nét.',
    ],
    highlights: [
      'Hợp với nhóm đông và bữa ăn gia đình',
      'Kết hợp tốt với bánh tráng phơi sương',
      'Có thể giới thiệu như món ăn chủ lực trong tour trải nghiệm',
    ],
    tip: 'Nên hỏi quán về khẩu phần trước khi gọi để tránh dư món khi đi nhóm ít người.',
  },
  {
    id: 'goi-cuon-banh-trang-phoi-suong',
    name: 'Gỏi cuốn bánh tráng phơi sương',
    category: CuisineCategory.MON_CUON,
    priceRange: '60.000đ - 120.000đ/phần',
    bestTime: 'Buổi trưa, chiều hoặc tiệc nhẹ',
    suggestedPlaces: [
      {
        id: 'cac-ho-lam-banh-trang',
        name: 'Các hộ làm bánh tráng',
        address: '',
        googleMapsUrl: '',
      },
      {
        id: 'quan-an-phuc-vu-mon-cuon-tai-xa',
        name: 'Quán ăn phục vụ món cuốn tại xã',
        address: '',
        googleMapsUrl: '',
      },
    ],
    summary:
      'Bánh tráng mềm dẻo cuốn thịt luộc, rau sống và chấm nước mắm pha, dân dã mà rất dễ ghiền.',
    description: [
      'Điểm ngon của món cuốn nằm ở bánh tráng mềm, rau tươi và nước chấm cân bằng giữa mặn, ngọt, chua, cay.',
      'Đây là món có thể liên kết chặt với chức năng Làng nghề và Đặc sản vì dùng trực tiếp sản phẩm bánh tráng địa phương.',
    ],
    highlights: [
      'Dễ tổ chức thành trải nghiệm tự cuốn',
      'Nguyên liệu quen thuộc, dễ chuẩn bị',
      'Phù hợp khách muốn ăn nhẹ nhưng vẫn có màu sắc địa phương',
    ],
    tip: 'Nếu mang đi xa, nên để riêng rau, bánh và nước chấm để giữ độ ngon.',
  },
  {
    id: 'banh-trang-tron',
    name: 'Bánh tráng trộn',
    category: CuisineCategory.AN_VAT,
    priceRange: '20.000đ - 35.000đ/phần',
    bestTime: 'Buổi chiều, tối',
    suggestedPlaces: [
      {
        id: 'khu-vuc-cho-truong-mit',
        name: 'Khu vực chợ Truông Mít',
        address: '',
        googleMapsUrl: '',
      },
      {
        id: 'cac-xe-an-vat-gan-truong-hoc-va-khu-dan-cu',
        name: 'Các xe ăn vặt gần trường học và khu dân cư',
        address: '',
        googleMapsUrl: '',
      },
    ],
    summary:
      'Món ăn vặt phổ biến với bánh tráng, rau răm, xoài, trứng cút, khô bò và muối ớt cay thơm.',
    description: [
      'Bánh tráng trộn là món ăn vặt gần gũi, giá dễ tiếp cận và có thể biến tấu theo khẩu vị từng người.',
      'Trong app, món này có thể dùng để giới thiệu các điểm ăn vặt buổi chiều và kết nối với sản phẩm muối ớt OCOP.',
    ],
    highlights: [
      'Giá bình dân, phù hợp học sinh và khách trẻ',
      'Dễ bán tại chợ, điểm dừng chân và sự kiện',
      'Có nhiều biến thể như bánh tráng cuốn, bánh tráng chấm',
    ],
    tip: 'Có thể dặn giảm cay nếu đi cùng trẻ nhỏ hoặc khách không quen ăn cay.',
  },
  {
    id: 'nem-buoi-chay',
    name: 'Nem bưởi chay',
    category: CuisineCategory.MON_CHAY,
    priceRange: '25.000đ - 45.000đ/chục',
    bestTime: 'Quanh năm',
    suggestedPlaces: [
      {
        id: 'cho-truong-mit',
        name: 'Chợ Truông Mít',
        address: '',
        googleMapsUrl: '',
      },
      {
        id: 'co-so-lam-nem-chay-trong-xa',
        name: 'Cơ sở làm nem chay trong xã',
        address: '',
        googleMapsUrl: '',
      },
      {
        id: 'diem-ban-dac-san-dia-phuong',
        name: 'Điểm bán đặc sản địa phương',
        address: '',
        googleMapsUrl: '',
      },
    ],
    summary:
      'Nem chay từ vỏ bưởi và đu đủ xanh, vị chua cay giòn nhẹ, hợp làm món ăn chơi hoặc quà mang về.',
    description: [
      'Nem bưởi chay có vị chua dịu, cay thơm, kết cấu giòn sật và là món ăn đặc trưng gắn với văn hóa ăn chay của vùng Tây Ninh.',
      'Món này có thể đặt trong cả nhóm Ẩm thực và Đặc sản, nhưng ở chức năng Ẩm thực sẽ nhấn mạnh cách thưởng thức và điểm ăn.',
    ],
    highlights: [
      'Phù hợp khách ăn chay',
      'Dễ mua mang về làm quà',
      'Có thể dùng kèm rau răm, tỏi, ớt để tăng vị',
    ],
    tip: 'Nên kiểm tra ngày sản xuất nếu mua mang đi xa; bảo quản mát để giữ vị ngon.',
  },
];

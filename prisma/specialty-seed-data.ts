import { SpecialtyCategory } from '../generated/prisma';

export interface SpecialtyBuyPlaceSeedItem {
  id: string;
  name: string;
  address: string;
  googleMapsUrl: string;
  phone: string;
  email: string;
}

export interface SpecialtySeedItem {
  id: string;
  name: string;
  category: SpecialtyCategory;
  price: string;
  season: string;
  summary: string;
  description: string[];
  buyPlaces: SpecialtyBuyPlaceSeedItem[];
}

const buyPlace = (id: string, name: string): SpecialtyBuyPlaceSeedItem => ({
  id,
  name,
  address: '',
  googleMapsUrl: '',
  phone: '',
  email: '',
});

export const SPECIALTY_SEED_DATA: SpecialtySeedItem[] = [
  {
    id: 'banh-trang-phoi-suong',
    name: 'Bánh tráng phơi sương',
    category: SpecialtyCategory.MON_AN,
    price: '35.000 - 50.000đ/xấp',
    season: 'Quanh năm',
    summary:
      'Bánh tráng dẻo mềm phơi qua sương đêm, cuốn cùng rau rừng và thịt luộc — tinh hoa ẩm thực Tây Ninh.',
    description: [
      'Bánh tráng phơi sương được tráng hai lớp, nướng sơ trên than rồi phơi qua sương đêm để đạt độ dẻo mềm đặc trưng. Nghề làm bánh đòi hỏi sự tỉ mỉ từ khâu chọn gạo đến canh giờ phơi sương.',
      'Bánh ngon nhất khi cuốn với thịt heo luộc, rau rừng và chấm nước mắm pha — món ăn đã làm nên danh tiếng ẩm thực của vùng đất Tây Ninh.',
    ],
    buyPlaces: [
      buyPlace(
        'cac-lo-banh-trang-ap-thuan-binh',
        'Các lò bánh tráng ấp Thuận Bình',
      ),
      buyPlace('cho-truong-mit', 'Chợ Truông Mít'),
      buyPlace('cua-hang-ocop-xa', 'Cửa hàng OCOP xã'),
    ],
  },
  {
    id: 'muoi-tom-tay-ninh',
    name: 'Muối ớt tôm',
    category: SpecialtyCategory.QUA_MANG_VE,
    price: '40.000 - 80.000đ/hũ',
    season: 'Quanh năm',
    summary:
      'Muối ớt tôm đỏ au, thơm cay đậm đà — thức chấm trứ danh đi kèm mọi loại trái cây.',
    description: [
      'Muối ớt tôm được rang từ muối hạt, tôm khô xay, ớt và tỏi theo tỉ lệ gia truyền, cho ra màu đỏ gạch bắt mắt và vị mặn - cay - ngọt hài hòa.',
      'Đây là món quà được du khách mua nhiều nhất khi ghé Tây Ninh: chấm trái cây, ăn với bánh tráng hay nêm nếm món ăn đều hợp.',
    ],
    buyPlaces: [
      buyPlace('co-so-muoi-tom-ap-loc-trung', 'Cơ sở muối tôm ấp Lộc Trung'),
      buyPlace('cho-truong-mit', 'Chợ Truông Mít'),
      buyPlace('cua-hang-ocop-xa', 'Cửa hàng OCOP xã'),
    ],
  },
  {
    id: 'mang-cau-na',
    name: 'Mãng cầu (na) dai',
    category: SpecialtyCategory.TRAI_CAY,
    price: '45.000 - 70.000đ/kg',
    season: 'Tháng 6 - tháng 9 (rộ nhất tháng 7 - 8)',
    summary:
      'Mãng cầu dai vùng đất xám Tây Ninh — múi to, ngọt thanh, ít hạt, đạt chuẩn trái cây đặc sản của tỉnh.',
    description: [
      'Thổ nhưỡng đất xám pha cát cùng khí hậu nắng nhiều của vùng cho ra trái mãng cầu dai vỏ mỏng, múi to, vị ngọt thanh và thơm đặc trưng, khác hẳn mãng cầu các vùng khác.',
      'Nhiều nhà vườn trong xã đang canh tác theo chuẩn VietGAP, cho trái quanh năm nhờ kỹ thuật xử lý ra hoa, nhưng vụ chính vẫn ngon và rẻ nhất.',
    ],
    buyPlaces: [
      buyPlace('nha-vuon-ap-thuan-an', 'Nhà vườn ấp Thuận An'),
      buyPlace('cho-truong-mit', 'Chợ Truông Mít'),
      buyPlace('sap-trai-cay-doc-tinh-lo-784', 'Sạp trái cây dọc tỉnh lộ 784'),
    ],
  },
  {
    id: 'sau-rieng-thuan-binh',
    name: 'Sầu riêng Thuận Bình',
    category: SpecialtyCategory.TRAI_CAY,
    price: '80.000 - 120.000đ/kg',
    season: 'Tháng 5 - tháng 8',
    summary:
      'Sầu riêng Ri6 và Monthong trồng trên đất phù sa ven kênh Đông, cơm vàng, hạt lép, béo ngọt đậm đà.',
    description: [
      'Vùng đất ven kênh Đông với nguồn nước tưới dồi dào rất hợp với cây sầu riêng. Các vườn ở ấp Thuận Bình chủ yếu trồng giống Ri6 và Monthong, chăm theo hướng hữu cơ.',
      'Sầu riêng ở đây được để chín rụng tự nhiên nên cơm vàng óng, béo ngọt và thơm lâu — mua tại vườn còn được chủ vườn đích thân chọn trái.',
    ],
    buyPlaces: [
      buyPlace('vuon-trai-cay-thuan-binh', 'Vườn trái cây Thuận Bình'),
      buyPlace('cho-truong-mit-vao-vu', 'Chợ Truông Mít (vào vụ)'),
      buyPlace('lien-he-qua-mini-app', 'Đặt qua mục Liên hệ của Mini App'),
    ],
  },
  {
    id: 'bo-to-nuong',
    name: 'Bò tơ nướng',
    category: SpecialtyCategory.MON_AN,
    price: '150.000 - 300.000đ/phần',
    season: 'Quanh năm',
    summary:
      'Bò tơ thả đồng thịt mềm ngọt, nướng mọi cuốn bánh tráng rau rừng — món đãi khách nức tiếng của vùng.',
    description: [
      'Bò tơ được chăn thả tự nhiên trên các đồng cỏ ven hồ Dầu Tiếng nên thịt mềm, ngọt và ít mỡ. Bò tơ nướng mọi giữ trọn vị ngọt nguyên bản của thịt.',
      'Thịt nướng chín tới được cuốn cùng bánh tráng phơi sương, rau rừng và chấm mắm nêm — bộ ba đặc sản hội tụ trong một món ăn.',
    ],
    buyPlaces: [
      buyPlace(
        'cac-quan-bo-to-doc-tinh-lo-784',
        'Các quán bò tơ dọc tỉnh lộ 784',
      ),
      buyPlace('quan-an-khu-trung-tam-xa', 'Quán ăn khu trung tâm xã'),
    ],
  },
  {
    id: 'nem-buoi',
    name: 'Nem bưởi chay',
    category: SpecialtyCategory.QUA_MANG_VE,
    price: '25.000 - 40.000đ/chục',
    season: 'Quanh năm',
    summary:
      'Nem chay làm từ vỏ bưởi và đu đủ xanh, chua cay giòn sật — món quà quê độc đáo chỉ có ở Tây Ninh.',
    description: [
      'Nem bưởi là món chay đặc sắc ra đời từ truyền thống ăn chay lâu đời của người Tây Ninh. Vỏ bưởi bào sợi trộn đu đủ xanh, khế, ớt và tiêu, gói lá chuối ủ chua tự nhiên.',
      'Nem có vị chua dịu, cay nồng, giòn sật lạ miệng, để được cả tuần — rất được ưa chuộng làm quà biếu.',
    ],
    buyPlaces: [
      buyPlace('co-so-nem-buoi-ap-thuan-hoa', 'Cơ sở nem bưởi ấp Thuận Hòa'),
      buyPlace('cho-truong-mit', 'Chợ Truông Mít'),
      buyPlace('cua-hang-ocop-xa', 'Cửa hàng OCOP xã'),
    ],
  },
];

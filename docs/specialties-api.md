# API Đặc sản

Module `specialties` quản lý danh sách nhiều đặc sản địa phương (Món ăn, Trái cây, Quà mang về). Mọi endpoint dùng prefix `/api/v1` và response envelope chung của dự án.

## Endpoints

| Method | Endpoint                                               | Quyền            | Mô tả                                                      |
| ------ | ------------------------------------------------------ | ---------------- | ---------------------------------------------------------- |
| GET    | `/specialties?category=Món ăn`                         | Public           | Chỉ bản ghi active, sắp xếp `sortOrder`, `createdAt`, `id` |
| GET    | `/specialties/:id`                                     | Public           | Chi tiết active, gồm mô tả và địa điểm mua                 |
| GET    | `/admin/specialties?page=1&limit=20&category=&search=` | ADMIN, MODERATOR | Danh sách gồm cả bản ghi ẩn                                |
| GET    | `/admin/specialties/:id`                               | ADMIN, MODERATOR | Chi tiết và `version` hiện tại                             |
| POST   | `/admin/specialties`                                   | ADMIN, MODERATOR | Tạo mới, tự sinh slug nếu không gửi `id`                   |
| PUT    | `/admin/specialties/:id`                               | ADMIN, MODERATOR | Cập nhật toàn bộ với optimistic locking                    |
| PATCH  | `/admin/specialties/:id/status`                        | ADMIN, MODERATOR | Ẩn/hiện với optimistic locking                             |
| PATCH  | `/admin/specialties/reorder`                           | ADMIN, MODERATOR | Cập nhật thứ tự hàng loạt trong transaction                |
| DELETE | `/admin/specialties/:id`                               | ADMIN, MODERATOR | Xóa đặc sản                                                |

Public list chỉ trả dữ liệu cần cho thẻ danh sách. Public detail trả thêm `description`, `buyPlaceDetails` (địa điểm mua kèm bản đồ và liên hệ) và `buyPlaces` tương thích ngược. Public API không phân biệt bản ghi không tồn tại và bản ghi đang ẩn: cả hai đều trả `404 SPECIALTY_NOT_FOUND`.

Tin giao thương của tài khoản **Chủ vườn – nhà vườn** được lấy bằng
`GET /api/v1/trade-posts?section=specialties`. Xem
`docs/trade-post-section-integration.md`.

`GET /specialties/:id` trả `ETag: "specialty-{id}-{updatedAtMillis}"` và `Cache-Control: public, max-age=60, must-revalidate`. Mọi thao tác cập nhật làm đổi `updatedAt`, vì vậy ETag cũ tự mất hiệu lực.

`category` chỉ nhận một trong ba giá trị cố định: `Món ăn`, `Trái cây`, `Quà mang về`.

## Request cập nhật

```json
{
  "version": 2,
  "name": "Bánh tráng phơi sương",
  "category": "Món ăn",
  "price": "35.000 - 50.000đ/xấp",
  "season": "Quanh năm",
  "summary": "Bánh tráng dẻo mềm phơi qua sương đêm...",
  "description": ["Đoạn 1", "Đoạn 2"],
  "buyPlaceDetails": [
    {
      "id": "lo-banh-trang-thuan-binh",
      "name": "Lò bánh tráng Thuận Bình",
      "address": "Ấp Thuận Bình, xã Truông Mít",
      "googleMapsUrl": "https://maps.app.goo.gl/example",
      "phone": "0900 123 456",
      "email": "lienhe@example.com"
    }
  ],
  "mediaId": "uuid-media",
  "galleryMediaIds": ["uuid-media-2", "uuid-media-3"],
  "imageAlt": "Bánh tráng phơi sương",
  "isActive": true
}
```

`id`/slug của một đặc sản không đổi khi cập nhật tên. Khi `version` cũ, API trả `409 SPECIALTY_VERSION_CONFLICT`; `error.details[0].latest` chứa bản ghi mới nhất để giao diện cảnh báo và cho phép tải lại mà không ghi đè âm thầm.

## Giới hạn validation

- `name` tối đa 150 ký tự, `price` và `season` tối đa 100 ký tự, `summary` tối đa 300 ký tự.
- `description`: tối đa 20 đoạn, mỗi đoạn tối đa 5.000 ký tự.
- `buyPlaceDetails`: tối đa 20 phần tử. Mỗi địa điểm có `id`, `name`, `address`, `googleMapsUrl`, `phone`, `email`; `id` không được trùng trong cùng đặc sản.
- `googleMapsUrl` phải là link HTTPS Google Maps hợp lệ. Đặc sản đang hiển thị không được có địa điểm thiếu link; bản nháp (`isActive: false`) có thể để rỗng để nhập dần.
- `phone` tối đa 30 ký tự, chỉ gồm chữ số, khoảng trắng và tối đa một dấu `+` ở đầu. `email` phải đúng định dạng và tối đa 255 ký tự. Hai trường liên hệ có thể để trống.
- `buyPlaces: string[]` đã deprecated nhưng vẫn được nhận/trả để client cũ hoạt động. Nếu cùng gửi cả hai field, `buyPlaceDetails` được ưu tiên; response `buyPlaces` luôn được suy ra từ `buyPlaceDetails[].name`.
- `category` phải thuộc enum cố định, giá trị khác trả `400 VALIDATION_ERROR`.
- Slug tạo mới (nếu gửi tường minh) chỉ chấp nhận `a-z0-9-`; nếu không gửi, backend tự sinh từ `name` (bỏ dấu, kebab-case) và kiểm tra trùng.

## Media

1. Upload JPEG/PNG/WebP bằng `POST /api/v1/media/images` với Bearer token.
2. Dùng `data.id` làm `mediaId` khi tạo/cập nhật Đặc sản.
3. Backend xác minh media chưa xóa, MIME bắt đầu bằng `image/`, thuộc người gọi và chưa được nội dung khác sử dụng. Media được claim thành resource `SPECIALTY` trong cùng transaction ghi nội dung.

Có thể upload tối đa 10 ảnh/lần qua `POST /api/v1/media/images/batch` (multipart field `files`). `mediaId` là ảnh đại diện; `galleryMediaIds` chứa tối đa 10 ảnh thư viện theo thứ tự hiển thị và không được lặp ảnh đại diện. Public/admin detail trả `galleryImages`; admin response trả thêm `galleryMediaIds`.

Seed không hard-code domain CDN hay đường dẫn máy local. Có thể upload một ảnh placeholder vào media storage của môi trường, sau đó đặt `SPECIALTY_PLACEHOLDER_MEDIA_ID` trước khi chạy seed. Nếu không đặt, seed vẫn tạo đủ nội dung với `mediaId = null`; admin có thể gắn ảnh sau.

## Migration và seed

```powershell
npx.cmd prisma migrate deploy
npm.cmd run db:seed
```

Seed idempotent tạo đúng 6 slug hiện tại: `banh-trang-phoi-suong`, `muoi-tom-tay-ninh`, `mang-cau-na`, `sau-rieng-thuan-binh`, `bo-to-nuong`, `nem-buoi`, giữ nguyên `description` và tên địa điểm từ Mini App. Các trường bản đồ/liên hệ chưa có dữ liệu thật được để rỗng để admin bổ sung, không tự tạo link hoặc số liên hệ giả.

## Rollout dữ liệu địa điểm

Trường JSON trong database vẫn tên là `buyPlaces`, vì vậy không cần migration phá vỡ dữ liệu. Backend đọc được cả mảng chuỗi cũ và mảng object mới. Sau khi backend được deploy, admin cập nhật từng đặc sản bằng `buyPlaceDetails`; lần ghi tiếp theo sẽ lưu cấu trúc mới. Mini App nên đọc `buyPlaceDetails` và chỉ dùng `buyPlaces` trong giai đoạn tương thích.

## Error codes

- `SPECIALTY_NOT_FOUND`: không tồn tại hoặc đang ẩn trên public API.
- `SPECIALTY_SLUG_EXISTS`: slug tạo mới bị trùng.
- `SPECIALTY_VERSION_CONFLICT`: version cập nhật/status đã cũ.
- `INVALID_SPECIALTY_MEDIA`: media thiếu, sai MIME, đã xóa hoặc không có quyền dùng.
- `VALIDATION_ERROR`: enum, giới hạn chuỗi/mảng, slug hoặc cấu trúc request không hợp lệ.

# API Đặc sản

Module `specialties` quản lý danh sách nhiều đặc sản địa phương (Món ăn, Trái cây, Quà mang về). Mọi endpoint dùng prefix `/api/v1` và response envelope chung của dự án.

## Endpoints

| Method | Endpoint                                           | Quyền            | Mô tả                                                       |
| ------ | --------------------------------------------------- | ---------------- | ------------------------------------------------------------ |
| GET    | `/specialties?category=Món ăn`                       | Public           | Chỉ bản ghi active, sắp xếp `sortOrder`, `createdAt`, `id`   |
| GET    | `/specialties/:id`                                   | Public           | Chi tiết active, gồm `description` và `buyPlaces`             |
| GET    | `/admin/specialties?page=1&limit=20&category=&search=` | ADMIN, MODERATOR | Danh sách gồm cả bản ghi ẩn                                  |
| GET    | `/admin/specialties/:id`                             | ADMIN, MODERATOR | Chi tiết và `version` hiện tại                                |
| POST   | `/admin/specialties`                                 | ADMIN, MODERATOR | Tạo mới, tự sinh slug nếu không gửi `id`                      |
| PUT    | `/admin/specialties/:id`                             | ADMIN, MODERATOR | Cập nhật toàn bộ với optimistic locking                       |
| PATCH  | `/admin/specialties/:id/status`                      | ADMIN, MODERATOR | Ẩn/hiện với optimistic locking                                 |
| PATCH  | `/admin/specialties/reorder`                         | ADMIN, MODERATOR | Cập nhật thứ tự hàng loạt trong transaction                    |
| DELETE | `/admin/specialties/:id`                             | ADMIN, MODERATOR | Xóa đặc sản                                                     |

Public list chỉ trả dữ liệu cần cho thẻ danh sách. Public detail trả thêm `description` (nhiều đoạn văn) và `buyPlaces` (danh sách địa điểm mua). Public API không phân biệt bản ghi không tồn tại và bản ghi đang ẩn: cả hai đều trả `404 SPECIALTY_NOT_FOUND`.

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
  "buyPlaces": ["Các lò bánh tráng ấp Thuận Bình", "Chợ Truông Mít"],
  "mediaId": "uuid-media",
  "imageAlt": "Bánh tráng phơi sương",
  "isActive": true
}
```

`id`/slug của một đặc sản không đổi khi cập nhật tên. Khi `version` cũ, API trả `409 SPECIALTY_VERSION_CONFLICT`; `error.details[0].latest` chứa bản ghi mới nhất để giao diện cảnh báo và cho phép tải lại mà không ghi đè âm thầm.

## Giới hạn validation

- `name` tối đa 150 ký tự, `price` và `season` tối đa 100 ký tự, `summary` tối đa 300 ký tự.
- `description`: tối đa 20 đoạn, mỗi đoạn tối đa 5.000 ký tự.
- `buyPlaces`: tối đa 20 phần tử, mỗi phần tử tối đa 200 ký tự.
- `category` phải thuộc enum cố định, giá trị khác trả `400 VALIDATION_ERROR`.
- Slug tạo mới (nếu gửi tường minh) chỉ chấp nhận `a-z0-9-`; nếu không gửi, backend tự sinh từ `name` (bỏ dấu, kebab-case) và kiểm tra trùng.

## Media

1. Upload JPEG/PNG/WebP bằng `POST /api/v1/media/images` với Bearer token.
2. Dùng `data.id` làm `mediaId` khi tạo/cập nhật Đặc sản.
3. Backend xác minh media chưa xóa, MIME bắt đầu bằng `image/`, thuộc người gọi và chưa được nội dung khác sử dụng. Media được claim thành resource `SPECIALTY` trong cùng transaction ghi nội dung.

Seed không hard-code domain CDN hay đường dẫn máy local. Có thể upload một ảnh placeholder vào media storage của môi trường, sau đó đặt `SPECIALTY_PLACEHOLDER_MEDIA_ID` trước khi chạy seed. Nếu không đặt, seed vẫn tạo đủ nội dung với `mediaId = null`; admin có thể gắn ảnh sau.

## Migration và seed

```powershell
npx.cmd prisma migrate deploy
npm.cmd run db:seed
```

Seed idempotent tạo đúng 6 slug hiện tại: `banh-trang-phoi-suong`, `muoi-tom-tay-ninh`, `mang-cau-na`, `sau-rieng-thuan-binh`, `bo-to-nuong`, `nem-buoi`, giữ nguyên `description` và `buyPlaces` từ Mini App.

## Error codes

- `SPECIALTY_NOT_FOUND`: không tồn tại hoặc đang ẩn trên public API.
- `SPECIALTY_SLUG_EXISTS`: slug tạo mới bị trùng.
- `SPECIALTY_VERSION_CONFLICT`: version cập nhật/status đã cũ.
- `INVALID_SPECIALTY_MEDIA`: media thiếu, sai MIME, đã xóa hoặc không có quyền dùng.
- `VALIDATION_ERROR`: enum, giới hạn chuỗi/mảng, slug hoặc cấu trúc request không hợp lệ.

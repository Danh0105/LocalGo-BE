# API Làng nghề

Module `craft-villages` quản lý danh sách làng nghề/cơ sở sản xuất thủ công. Mọi endpoint dùng prefix `/api/v1` và response envelope chung của dự án.

## Endpoints

| Method | Endpoint                                                     | Quyền            | Mô tả                                                       |
| ------ | -------------------------------------------------------------- | ---------------- | ------------------------------------------------------------ |
| GET    | `/craft-villages?category=Thủ công truyền thống`               | Public           | Chỉ bản ghi active, sắp xếp `sortOrder`, `createdAt`, `id`   |
| GET    | `/craft-villages/:id`                                           | Public           | Chi tiết active, gồm `description`, `highlights`, `visitorNote` |
| GET    | `/admin/craft-villages?page=1&limit=20&category=&search=`      | ADMIN, MODERATOR | Danh sách gồm cả bản ghi ẩn, tìm theo tên/địa chỉ            |
| GET    | `/admin/craft-villages/:id`                                     | ADMIN, MODERATOR | Chi tiết và `version` hiện tại                                |
| POST   | `/admin/craft-villages`                                         | ADMIN, MODERATOR | Tạo mới, tự sinh slug nếu không gửi `id`                      |
| PUT    | `/admin/craft-villages/:id`                                     | ADMIN, MODERATOR | Cập nhật toàn bộ với optimistic locking                       |
| PATCH  | `/admin/craft-villages/:id/status`                              | ADMIN, MODERATOR | Ẩn/hiện với optimistic locking                                |
| PATCH  | `/admin/craft-villages/reorder`                                 | ADMIN, MODERATOR | Cập nhật thứ tự hàng loạt trong transaction                   |
| DELETE | `/admin/craft-villages/:id`                                     | ADMIN, MODERATOR | Xóa làng nghề                                                  |

Public list chỉ trả dữ liệu cần cho thẻ danh sách. Public detail trả thêm `description`, `highlights` và `visitorNote`. Public API không phân biệt bản ghi không tồn tại và bản ghi đang ẩn: cả hai đều trả `404 CRAFT_VILLAGE_NOT_FOUND`.

`GET /craft-villages/:id` trả `ETag: "craft-village-{id}-{updatedAtMillis}"` và `Cache-Control: public, max-age=60, must-revalidate`. Mọi thao tác cập nhật làm đổi `updatedAt`, vì vậy ETag cũ tự mất hiệu lực.

## Request tạo/cập nhật

```json
{
  "version": 2,
  "name": "Nghề làm bánh tráng Truông Mít",
  "category": "Thủ công truyền thống",
  "address": "Các hộ sản xuất tại trung tâm xã Truông Mít",
  "workingTime": "05:00 - 15:00 hằng ngày",
  "mainProducts": "Bánh tráng phơi sương, bánh tráng nhúng, bánh tráng cuốn",
  "summary": "Nghề làm bánh tráng quy mô hộ gia đình...",
  "description": ["Đoạn 1", "Đoạn 2"],
  "highlights": ["Có thể tham quan quy trình tráng và phơi bánh"],
  "visitorNote": "Nên liên hệ trước với hộ sản xuất để sắp xếp thời gian tham quan.",
  "mediaId": "uuid-media",
  "imageAlt": "Nghề làm bánh tráng Truông Mít",
  "isActive": true
}
```

`category` chỉ nhận một trong bốn giá trị `Thủ công truyền thống | Chế biến nông sản | Dịch vụ trải nghiệm | Sản phẩm gia đình` (lưu dưới dạng enum Postgres, không phải free text). `address`, `workingTime`, `mainProducts`, `visitorNote` là chuỗi tự do. Slug của làng nghề không đổi khi cập nhật tên.

Khi `version` cũ, API trả `409 CRAFT_VILLAGE_VERSION_CONFLICT`; `error.details[0].latest` chứa bản ghi mới nhất để giao diện cảnh báo và cho phép tải lại mà không ghi đè âm thầm.

## Media

1. Upload JPEG/PNG/WebP bằng `POST /api/v1/media/images` với Bearer token.
2. Dùng `data.id` làm `mediaId` khi tạo/cập nhật làng nghề.
3. Backend xác minh media chưa xóa, MIME bắt đầu bằng `image/`, thuộc người gọi và chưa được nội dung khác sử dụng. Media được claim thành resource `CRAFT_VILLAGE` trong cùng transaction ghi nội dung.

Seed không hard-code domain CDN hay đường dẫn máy local. Có thể upload một ảnh placeholder vào media storage của môi trường, sau đó đặt `CRAFT_VILLAGE_PLACEHOLDER_MEDIA_ID` trước khi chạy seed. Nếu không đặt, seed vẫn tạo đủ nội dung với `mediaId = null`; admin có thể gắn ảnh sau.

## Migration và seed

```powershell
npx.cmd prisma migrate deploy
npm.cmd run db:seed
```

Seed idempotent tạo đúng 5 slug hiện tại: `banh-trang-truong-mit`, `muoi-ot-gia-dinh`, `dan-lat-tre-truc`, `say-trai-cay-thuan-binh`, `trai-nghiem-lam-banh`, giữ nguyên `description`, `highlights` và `visitorNote` từ Mini App.

## Error codes

- `CRAFT_VILLAGE_NOT_FOUND`: không tồn tại hoặc đang ẩn trên public API.
- `CRAFT_VILLAGE_SLUG_EXISTS`: slug tạo mới bị trùng.
- `CRAFT_VILLAGE_VERSION_CONFLICT`: version cập nhật/status đã cũ.
- `INVALID_CRAFT_VILLAGE_MEDIA`: media thiếu, sai MIME, đã xóa hoặc không có quyền dùng.
- `VALIDATION_ERROR`: enum, giới hạn chuỗi/mảng, slug hoặc cấu trúc request không hợp lệ.

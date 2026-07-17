# API Đền - Chùa - Miếu

Module `temples` quản lý danh sách nhiều điểm du lịch. Mọi endpoint dùng prefix `/api/v1` và response envelope chung của dự án.

## Endpoints

| Method | Endpoint                                       | Quyền            | Mô tả                                                      |
| ------ | ---------------------------------------------- | ---------------- | ---------------------------------------------------------- |
| GET    | `/temples?type=Đình`                           | Public           | Chỉ bản ghi active, sắp xếp `sortOrder`, `createdAt`, `id` |
| GET    | `/temples/:id`                                 | Public           | Chi tiết active, gồm `description` và `events`             |
| GET    | `/admin/temples?page=1&limit=20&type=&search=` | ADMIN, MODERATOR | Danh sách gồm cả bản ghi ẩn                                |
| GET    | `/admin/temples/:id`                           | ADMIN, MODERATOR | Chi tiết và `version` hiện tại                             |
| POST   | `/admin/temples`                               | ADMIN, MODERATOR | Tạo mới, tự sinh slug nếu không gửi `id`                   |
| PUT    | `/admin/temples/:id`                           | ADMIN, MODERATOR | Cập nhật toàn bộ với optimistic locking                    |
| PATCH  | `/admin/temples/:id/status`                    | ADMIN, MODERATOR | Ẩn/hiện với optimistic locking                             |
| PATCH  | `/admin/temples/reorder`                       | ADMIN, MODERATOR | Cập nhật thứ tự hàng loạt trong transaction                |
| DELETE | `/admin/temples/:id`                           | ADMIN, MODERATOR | Xóa điểm và cascade toàn bộ sự kiện con                    |

Public list chỉ trả dữ liệu cần cho thẻ danh sách. Public detail trả thêm `description` và `events`. Public API không phân biệt bản ghi không tồn tại và bản ghi đang ẩn: cả hai đều trả `404 TEMPLE_NOT_FOUND`.

`GET /temples/:id` trả `ETag: "temple-{id}-{updatedAtMillis}"` và `Cache-Control: public, max-age=60, must-revalidate`. Mọi thao tác cập nhật làm đổi `updatedAt`, vì vậy ETag cũ tự mất hiệu lực.

## Request cập nhật

```json
{
  "version": 2,
  "name": "Đình Truông Mít",
  "type": "Đình",
  "address": "Ấp Thuận Bình, xã Truông Mít",
  "openHours": "05:00 - 18:00 hằng ngày",
  "summary": "Ngôi đình cổ hơn 100 năm tuổi...",
  "description": ["Đoạn 1", "Đoạn 2"],
  "events": [
    {
      "id": "uuid-của-sự-kiện-cũ",
      "time": "16/3 âm lịch",
      "name": "Lễ Kỳ Yên"
    },
    { "time": "16/12 âm lịch", "name": "Lễ cúng Tất niên" }
  ],
  "mediaId": "uuid-media",
  "imageAlt": "Đình Truông Mít",
  "isActive": true
}
```

`id` sự kiện hiện hữu được giữ bền vững. Sự kiện không gửi `id` được tạo mới; sự kiện cũ không còn trong mảng sẽ bị xóa. Slug của Temple không đổi khi cập nhật tên.

Khi `version` cũ, API trả `409 TEMPLE_VERSION_CONFLICT`; `error.details[0].latest` chứa bản ghi mới nhất để giao diện cảnh báo và cho phép tải lại mà không ghi đè âm thầm.

## Media

1. Upload JPEG/PNG/WebP bằng `POST /api/v1/media/images` với Bearer token.
2. Dùng `data.id` làm `mediaId` khi tạo/cập nhật Temple.
3. Backend xác minh media chưa xóa, MIME bắt đầu bằng `image/`, thuộc người gọi và chưa được nội dung khác sử dụng. Media được claim thành resource `TEMPLE` trong cùng transaction ghi nội dung.

Seed không hard-code domain CDN hay đường dẫn máy local. Có thể upload một ảnh placeholder vào media storage của môi trường, sau đó đặt `TEMPLE_PLACEHOLDER_MEDIA_ID` trước khi chạy seed. Nếu không đặt, seed vẫn tạo đủ nội dung với `mediaId = null`; admin có thể gắn ảnh sau.

## Migration và seed

```powershell
npx.cmd prisma migrate deploy
npm.cmd run db:seed
```

Seed idempotent tạo đúng 6 slug hiện tại: `dinh-truong-mit`, `chua-phuoc-lam`, `chua-long-tho`, `mieu-ba-chua-xu`, `mieu-ong-ta`, `dinh-thuan-loi`, giữ nguyên mô tả và sự kiện từ Mini App.

## Error codes

- `TEMPLE_NOT_FOUND`: không tồn tại hoặc đang ẩn trên public API.
- `TEMPLE_SLUG_EXISTS`: slug tạo mới bị trùng.
- `TEMPLE_VERSION_CONFLICT`: version cập nhật/status đã cũ.
- `INVALID_TEMPLE_MEDIA`: media thiếu, sai MIME, đã xóa hoặc không có quyền dùng.
- `VALIDATION_ERROR`: enum, giới hạn chuỗi/mảng, slug hoặc cấu trúc request không hợp lệ.

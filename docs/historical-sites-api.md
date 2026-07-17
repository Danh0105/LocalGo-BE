# API Di tích lịch sử

Module `historical-sites` quản lý danh sách nhiều di tích lịch sử. Mọi endpoint dùng prefix `/api/v1` và response envelope chung của dự án.

## Endpoints

| Method | Endpoint                                             | Quyền            | Mô tả                                                       |
| ------ | ----------------------------------------------------- | ---------------- | ------------------------------------------------------------ |
| GET    | `/historical-sites?rank=Cấp tỉnh`                     | Public           | Chỉ bản ghi active, sắp xếp `sortOrder`, `createdAt`, `id`   |
| GET    | `/historical-sites/:id`                                | Public           | Chi tiết active, gồm `history` và `highlights`               |
| GET    | `/admin/historical-sites?page=1&limit=20&rank=&search=` | ADMIN, MODERATOR | Danh sách gồm cả bản ghi ẩn, tìm theo tên/địa chỉ            |
| GET    | `/admin/historical-sites/:id`                          | ADMIN, MODERATOR | Chi tiết và `version` hiện tại                                |
| POST   | `/admin/historical-sites`                              | ADMIN, MODERATOR | Tạo mới, tự sinh slug nếu không gửi `id`                      |
| PUT    | `/admin/historical-sites/:id`                          | ADMIN, MODERATOR | Cập nhật toàn bộ với optimistic locking                       |
| PATCH  | `/admin/historical-sites/:id/status`                   | ADMIN, MODERATOR | Ẩn/hiện với optimistic locking                                |
| PATCH  | `/admin/historical-sites/reorder`                      | ADMIN, MODERATOR | Cập nhật thứ tự hàng loạt trong transaction                   |
| DELETE | `/admin/historical-sites/:id`                          | ADMIN, MODERATOR | Xóa di tích                                                   |

Public list chỉ trả dữ liệu cần cho thẻ danh sách. Public detail trả thêm `history` và `highlights`. Public API không phân biệt bản ghi không tồn tại và bản ghi đang ẩn: cả hai đều trả `404 HISTORICAL_SITE_NOT_FOUND`.

`GET /historical-sites/:id` trả `ETag: "historical-site-{id}-{updatedAtMillis}"` và `Cache-Control: public, max-age=60, must-revalidate`. Mọi thao tác cập nhật làm đổi `updatedAt`, vì vậy ETag cũ tự mất hiệu lực.

## Request tạo/cập nhật

```json
{
  "version": 2,
  "name": "Địa đạo Truông Mít",
  "rank": "Cấp tỉnh",
  "address": "Ấp Thuận Bình, xã Truông Mít",
  "recognizedYear": 2014,
  "summary": "Hệ thống địa đạo từng là nơi trú ẩn...",
  "history": ["Đoạn 1", "Đoạn 2"],
  "highlights": ["Đoạn địa đạo được phục dựng", "Không gian trưng bày hiện vật"],
  "mediaId": "uuid-media",
  "imageAlt": "Địa đạo Truông Mít",
  "isActive": true
}
```

`rank` chỉ nhận một trong ba giá trị `Cấp quốc gia | Cấp tỉnh | Chưa xếp hạng` (lưu dưới dạng enum Postgres, không phải free text). `recognizedYear` là số nguyên tùy chọn trong khoảng `1900` đến năm hiện tại; bỏ trống khi chưa xếp hạng. Slug của di tích không đổi khi cập nhật tên.

Khi `version` cũ, API trả `409 HISTORICAL_SITE_VERSION_CONFLICT`; `error.details[0].latest` chứa bản ghi mới nhất để giao diện cảnh báo và cho phép tải lại mà không ghi đè âm thầm.

## Media

1. Upload JPEG/PNG/WebP bằng `POST /api/v1/media/images` với Bearer token.
2. Dùng `data.id` làm `mediaId` khi tạo/cập nhật di tích.
3. Backend xác minh media chưa xóa, MIME bắt đầu bằng `image/`, thuộc người gọi và chưa được nội dung khác sử dụng. Media được claim thành resource `HISTORICAL_SITE` trong cùng transaction ghi nội dung.

Seed không hard-code domain CDN hay đường dẫn máy local. Có thể upload một ảnh placeholder vào media storage của môi trường, sau đó đặt `HISTORICAL_SITE_PLACEHOLDER_MEDIA_ID` trước khi chạy seed. Nếu không đặt, seed vẫn tạo đủ nội dung với `mediaId = null`; admin có thể gắn ảnh sau.

## Migration và seed

```powershell
npx.cmd prisma migrate deploy
npm.cmd run db:seed
```

Seed idempotent tạo đúng 4 slug hiện tại: `dia-dao-truong-mit`, `bia-tuong-niem-loc-trung`, `can-cu-ba-bau`, `nha-truyen-thong-truong-mit`, giữ nguyên `history` và `highlights` từ Mini App.

## Error codes

- `HISTORICAL_SITE_NOT_FOUND`: không tồn tại hoặc đang ẩn trên public API.
- `HISTORICAL_SITE_SLUG_EXISTS`: slug tạo mới bị trùng.
- `HISTORICAL_SITE_VERSION_CONFLICT`: version cập nhật/status đã cũ.
- `INVALID_HISTORICAL_SITE_MEDIA`: media thiếu, sai MIME, đã xóa hoặc không có quyền dùng.
- `VALIDATION_ERROR`: enum, giới hạn chuỗi/mảng, `recognizedYear` ngoài khoảng, slug hoặc cấu trúc request không hợp lệ.

# API Bản đồ

Module `map-places` quản lý danh sách điểm hiển thị trên bản đồ (marker). Mọi endpoint dùng prefix `/api/v1` và response envelope chung của dự án.

## Endpoints

| Method | Endpoint                                              | Quyền            | Mô tả                                                       |
| ------ | -------------------------------------------------------- | ---------------- | ------------------------------------------------------------ |
| GET    | `/map-places?category=Du lịch`                            | Public           | Chỉ bản ghi active, sắp xếp `sortOrder`, `createdAt`, `id`   |
| GET    | `/map-places/:id`                                          | Public           | Chi tiết active, gồm `description`, `highlights`, `directionNote` |
| GET    | `/admin/map-places?page=1&limit=20&category=&search=`     | ADMIN, MODERATOR | Danh sách gồm cả bản ghi ẩn, tìm theo tên/địa chỉ             |
| GET    | `/admin/map-places/:id`                                    | ADMIN, MODERATOR | Chi tiết và `version` hiện tại                                |
| POST   | `/admin/map-places`                                        | ADMIN, MODERATOR | Tạo mới, tự sinh slug nếu không gửi `id`                      |
| PUT    | `/admin/map-places/:id`                                    | ADMIN, MODERATOR | Cập nhật toàn bộ với optimistic locking                       |
| PATCH  | `/admin/map-places/:id/status`                             | ADMIN, MODERATOR | Ẩn/hiện với optimistic locking                                |
| PATCH  | `/admin/map-places/reorder`                                | ADMIN, MODERATOR | Cập nhật thứ tự hàng loạt trong transaction                   |
| DELETE | `/admin/map-places/:id`                                    | ADMIN, MODERATOR | Xóa điểm bản đồ                                                |

Public list trả cả `coordinates` cho mỗi bản ghi (cần thiết để vẽ marker ngay ở màn danh sách/bản đồ), cùng `name`, `category`, `address`, `openTime`, `distanceFromCenter`, `summary`, `imageUrl`, `imageAlt`, `sortOrder`, `updatedAt`. Public detail trả thêm `description`, `highlights`, `directionNote`. Public API không phân biệt bản ghi không tồn tại và bản ghi đang ẩn: cả hai đều trả `404 MAP_PLACE_NOT_FOUND`.

`GET /map-places/:id` trả `ETag: "map-place-{id}-{updatedAtMillis}"` và `Cache-Control: public, max-age=60, must-revalidate`. Mọi thao tác cập nhật làm đổi `updatedAt`, vì vậy ETag cũ tự mất hiệu lực.

Ở quy mô dữ liệu hiện tại (vài chục điểm), public list trả toàn bộ bản ghi active thay vì hỗ trợ `bbox`/bán kính; nếu số điểm tăng lớn, bổ sung lọc theo vùng nhìn thấy sau, không cần đổi response envelope.

## Tọa độ (`coordinates`)

`coordinates` là object `{ lat, lng }`, tái sử dụng đúng decorator tọa độ đã có trong dự án (`@IsLatitude()`/`@IsLongitude()` từ `class-validator`, đang dùng cho `lat`/`lng` tùy chọn của `TradePost`). Lưu trong Postgres dưới dạng `Decimal(9,6)` (3 chữ số nguyên + 6 chữ số thập phân) — cùng kiểu cột `lat`/`lng` đã dùng cho `TradePost`, đủ độ chính xác cho hiển thị bản đồ.

- `coordinates.lat` bắt buộc, số hợp lệ trong `[-90, 90]`.
- `coordinates.lng` bắt buộc, số hợp lệ trong `[-180, 180]`.
- Thiếu một trục, sai kiểu (chuỗi không phải số, `NaN`) hoặc ngoài khoảng đều bị từ chối `400 VALIDATION_ERROR`.

## Request tạo/cập nhật

```json
{
  "version": 2,
  "name": "UBND xã Truông Mít",
  "category": "Hành chính",
  "address": "Trung tâm xã Truông Mít",
  "coordinates": { "lat": 11.2418, "lng": 106.2024 },
  "openTime": "Thứ 2 - Thứ 6, 07:00 - 17:00",
  "distanceFromCenter": "0 km",
  "summary": "Điểm trung tâm hành chính...",
  "description": ["Đoạn 1", "Đoạn 2"],
  "highlights": ["Mốc trung tâm xã"],
  "directionNote": "Cần thay bằng tọa độ chính xác khi tích hợp bản đồ thật.",
  "mediaId": "uuid-media",
  "imageAlt": "UBND xã Truông Mít",
  "isActive": true
}
```

`category` chỉ nhận `Hành chính | Du lịch | Di tích | Ẩm thực | Dịch vụ` (enum Postgres). `openTime`, `distanceFromCenter`, `directionNote` là chuỗi tự do, không ép kiểu ngày giờ/số. Slug của điểm không đổi khi cập nhật tên.

Giới hạn độ dài: `name` 150, `address` 255, `openTime` 150, `distanceFromCenter` 100, `summary` 300, `directionNote` 2.000, mỗi đoạn `description` 5.000, mỗi phần tử `highlights` 200 ký tự. Giới hạn số phần tử: tối đa 20 `description`, 20 `highlights`.

Khi `version` cũ, API trả `409 MAP_PLACE_VERSION_CONFLICT`; `error.details[0].latest` chứa bản ghi mới nhất để giao diện cảnh báo và cho phép tải lại mà không ghi đè âm thầm.

**Lưu ý về `dia-dao-truong-mit`**: bảng `MapPlace` và bảng `HistoricalSite` là hai bảng độc lập, mỗi bảng tự quản lý `id`/slug riêng dù cùng mô tả một địa danh (Địa đạo Truông Mít) cho hai mục đích hiển thị khác nhau (marker bản đồ vs. trang di tích). Không có khóa ngoại chéo giữa hai bảng; nếu sau này cần điều hướng chéo, chỉ nên thêm một trường tham chiếu slug tùy chọn, không ép buộc và không cascade.

## Media

1. Upload JPEG/PNG/WebP bằng `POST /api/v1/media/images` với Bearer token.
2. Dùng `data.id` làm `mediaId` khi tạo/cập nhật điểm bản đồ.
3. Backend xác minh media chưa xóa, MIME bắt đầu bằng `image/`, thuộc người gọi và chưa được nội dung khác sử dụng. Media được claim thành resource `MAP_PLACE` trong cùng transaction ghi nội dung.

Seed không hard-code domain CDN hay đường dẫn máy local. Có thể upload một ảnh placeholder vào media storage của môi trường, sau đó đặt `MAP_PLACE_PLACEHOLDER_MEDIA_ID` trước khi chạy seed. Nếu không đặt, seed vẫn tạo đủ nội dung với `mediaId = null`; admin có thể gắn ảnh sau.

## Migration và seed

```powershell
npx.cmd prisma migrate deploy
npm.cmd run db:seed
```

Seed idempotent tạo đúng 6 slug hiện tại: `ubnd-xa-truong-mit`, `ho-dau-tieng`, `kenh-dong-truong-mit`, `dia-dao-truong-mit`, `cho-truong-mit`, `quan-bo-to-784`, giữ nguyên `coordinates`, `description`, `highlights` và `directionNote` từ Mini App (tọa độ hiện là dữ liệu mẫu; cập nhật tọa độ thật qua admin API, không cần sửa lại migration).

## Error codes

- `MAP_PLACE_NOT_FOUND`: không tồn tại hoặc đang ẩn trên public API.
- `MAP_PLACE_SLUG_EXISTS`: slug tạo mới bị trùng.
- `MAP_PLACE_VERSION_CONFLICT`: version cập nhật/status đã cũ.
- `INVALID_MAP_PLACE_MEDIA`: media thiếu, sai MIME, đã xóa hoặc không có quyền dùng.
- `VALIDATION_ERROR`: enum, giới hạn chuỗi/mảng, tọa độ thiếu trục/ngoài khoảng hợp lệ, slug, hoặc cấu trúc request không hợp lệ.

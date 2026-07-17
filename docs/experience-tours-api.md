# API Tour trải nghiệm

Module `experience-tours` quản lý danh sách tour trải nghiệm địa phương. Mọi endpoint dùng prefix `/api/v1` và response envelope chung của dự án.

## Endpoints

| Method | Endpoint                                                     | Quyền            | Mô tả                                                       |
| ------ | ------------------------------------------------------------- | ---------------- | ------------------------------------------------------------ |
| GET    | `/experience-tours?category=Nông nghiệp`                      | Public           | Chỉ bản ghi active, sắp xếp `sortOrder`, `createdAt`, `id`   |
| GET    | `/experience-tours/:id`                                        | Public           | Chi tiết active, gồm `description`, `itinerary`, `included`, `note` |
| GET    | `/admin/experience-tours?page=1&limit=20&category=&search=`   | ADMIN, MODERATOR | Danh sách gồm cả bản ghi ẩn, tìm theo tên/điểm hẹn            |
| GET    | `/admin/experience-tours/:id`                                  | ADMIN, MODERATOR | Chi tiết và `version` hiện tại                                |
| POST   | `/admin/experience-tours`                                      | ADMIN, MODERATOR | Tạo mới, tự sinh slug nếu không gửi `id`                      |
| PUT    | `/admin/experience-tours/:id`                                  | ADMIN, MODERATOR | Cập nhật toàn bộ với optimistic locking                       |
| PATCH  | `/admin/experience-tours/:id/status`                           | ADMIN, MODERATOR | Ẩn/hiện với optimistic locking                                |
| PATCH  | `/admin/experience-tours/reorder`                              | ADMIN, MODERATOR | Cập nhật thứ tự hàng loạt (cấp bản ghi) trong transaction     |
| DELETE | `/admin/experience-tours/:id`                                  | ADMIN, MODERATOR | Xóa tour trải nghiệm                                           |

Public list chỉ trả dữ liệu cần cho thẻ danh sách (`name`, `category`, `duration`, `startTime`, `priceRange`, `meetingPoint`, `summary`, `imageUrl`, `imageAlt`, `sortOrder`, `updatedAt`). Public detail trả thêm `description`, `itinerary`, `included`, `note` và `contactPhone`. Public API không phân biệt bản ghi không tồn tại và bản ghi đang ẩn: cả hai đều trả `404 EXPERIENCE_TOUR_NOT_FOUND`.

`GET /experience-tours/:id` trả `ETag: "experience-tour-{id}-{updatedAtMillis}"` và `Cache-Control: public, max-age=60, must-revalidate`. Mọi thao tác cập nhật làm đổi `updatedAt`, vì vậy ETag cũ tự mất hiệu lực.

### Thứ tự `itinerary`

`itinerary` là các bước lịch trình theo đúng **trình tự thực hiện trong tour** (khác với `sortOrder` — thứ tự hiển thị tour trong danh sách). Mảng được lưu dưới dạng JSON và trả về nguyên vẹn theo đúng thứ tự đã nhập, không bị sắp xếp lại theo alphabet hay tiêu chí khác. `included` cũng giữ nguyên thứ tự nhập của admin nhưng không có ràng buộc trình tự nghiệp vụ chặt như `itinerary`.

Một tour chỉ được kích hoạt hiển thị (`isActive = true`, khi tạo mới hoặc qua `PUT`/`PATCH .../status`) nếu có tối thiểu 1 bước `itinerary` **và** đã có `contactPhone`; nếu không, API trả `400 VALIDATION_ERROR`.

## Request tạo/cập nhật

```json
{
  "version": 2,
  "name": "Một ngày làm nông dân Truông Mít",
  "category": "Nông nghiệp",
  "duration": "1 ngày",
  "startTime": "07:30 - 16:30",
  "priceRange": "250.000đ - 380.000đ/người",
  "meetingPoint": "Trung tâm xã Truông Mít",
  "summary": "Tour trải nghiệm làm vườn...",
  "description": ["Đoạn 1", "Đoạn 2"],
  "itinerary": ["Đón khách tại trung tâm xã, giới thiệu chương trình", "Tham quan vườn cây ăn trái"],
  "included": ["Hướng dẫn viên địa phương", "Bữa trưa quê"],
  "note": "Cập nhật ngày khởi hành và số chỗ còn lại.",
  "contactPhone": "0900 123 456",
  "mediaId": "uuid-media",
  "imageAlt": "Một ngày làm nông dân Truông Mít",
  "isActive": true
}
```

`category` chỉ nhận một trong năm giá trị `Nửa ngày | Một ngày | Gia đình | Học sinh | Nông nghiệp` (lưu dưới dạng enum Postgres, không phải free text). `duration`, `startTime`, `priceRange`, `meetingPoint`, `note` là chuỗi tự do, không ép kiểu số/ngày (`priceRange` có thể là "Theo số lượng đoàn"). Slug của tour không đổi khi cập nhật tên.

Giới hạn độ dài: `name` 150, `duration`/`startTime`/`priceRange` 100, `meetingPoint` 255, `summary` 300, `note` 2.000, mỗi đoạn `description` 5.000, mỗi phần tử `itinerary`/`included` 300 ký tự. Giới hạn số phần tử: tối đa 20 `description`, 30 `itinerary`, 20 `included`.

`contactPhone` là số điện thoại liên hệ để khách gọi đặt tour — **bắt buộc** trên cả tạo mới và cập nhật, tối đa 30 ký tự, server tự trim khoảng trắng đầu/cuối, chỉ chấp nhận chữ số/khoảng trắng và tối đa một dấu `+` ở đầu (`^\+?[0-9\s]+$`, cùng quy tắc với field `phone` của module Contacts) — ví dụ hợp lệ: `0900 123 456`, `+84 900 123 456`. Không tự chuẩn hóa/loại bỏ số `0` đầu; chuỗi được lưu và trả về đúng như Admin nhập, Mini App tự loại ký tự phân cách khi tạo `tel:` URI.

Khi `version` cũ, API trả `409 EXPERIENCE_TOUR_VERSION_CONFLICT`; `error.details[0].latest` chứa bản ghi mới nhất để giao diện cảnh báo và cho phép tải lại mà không ghi đè âm thầm.

## Media

1. Upload JPEG/PNG/WebP bằng `POST /api/v1/media/images` với Bearer token.
2. Dùng `data.id` làm `mediaId` khi tạo/cập nhật tour trải nghiệm.
3. Backend xác minh media chưa xóa, MIME bắt đầu bằng `image/`, thuộc người gọi và chưa được nội dung khác sử dụng. Media được claim thành resource `EXPERIENCE_TOUR` trong cùng transaction ghi nội dung.

Seed không hard-code domain CDN hay đường dẫn máy local. Có thể upload một ảnh placeholder vào media storage của môi trường, sau đó đặt `EXPERIENCE_TOUR_PLACEHOLDER_MEDIA_ID` trước khi chạy seed. Nếu không đặt, seed vẫn tạo đủ nội dung với `mediaId = null`; admin có thể gắn ảnh sau.

## Migration và seed

```powershell
npx.cmd prisma migrate deploy
npm.cmd run db:seed
```

Seed idempotent tạo đúng 5 slug hiện tại: `mot-ngay-lam-nong-dan`, `dap-xe-kenh-dong`, `lam-banh-trang-va-am-thuc`, `hoc-sinh-kham-pha-que-huong`, `checkin-hoang-hon-dong-que`, giữ nguyên `description`, `itinerary` (đúng thứ tự), `included` và `note` từ Mini App.

## Error codes

- `EXPERIENCE_TOUR_NOT_FOUND`: không tồn tại hoặc đang ẩn trên public API.
- `EXPERIENCE_TOUR_SLUG_EXISTS`: slug tạo mới bị trùng.
- `EXPERIENCE_TOUR_VERSION_CONFLICT`: version cập nhật/status đã cũ.
- `INVALID_EXPERIENCE_TOUR_MEDIA`: media thiếu, sai MIME, đã xóa hoặc không có quyền dùng.
- `VALIDATION_ERROR`: enum, giới hạn chuỗi/mảng, slug, itinerary rỗng khi kích hoạt, `contactPhone` thiếu/sai định dạng, cố kích hoạt bản ghi chưa có `contactPhone`, hoặc cấu trúc request không hợp lệ.

## Rollout `contactPhone` (phase 1/2)

Cột `contactPhone` hiện đang ở **phase 1**: cột Postgres nullable (`VARCHAR(30)`, không backfill số
giả). `POST`/`PUT` bắt buộc nhập; `PATCH .../status` chặn chuyển một bản ghi sang `isActive: true`
nếu bản ghi đó chưa có `contactPhone` (trả `400 VALIDATION_ERROR`, cùng cơ chế với guard `itinerary`
rỗng). Các bản ghi active được tạo **trước** khi triển khai field này (bao gồm 5 slug seed hiện tại)
có thể tạm thời trả `contactPhone: null` ở public/admin detail cho tới khi Admin sửa qua `PUT`.

**Checklist vận hành trước khi chạy phase 2** (đặt `ALTER COLUMN "contactPhone" SET NOT NULL`):

1. Rà soát toàn bộ `ExperienceTour` đang `isActive = true` có `contactPhone IS NULL`, yêu cầu Admin
   bổ sung số qua UI (bao gồm 5 slug seed: `mot-ngay-lam-nong-dan`, `dap-xe-kenh-dong`,
   `lam-banh-trang-va-am-thuc`, `hoc-sinh-kham-pha-que-huong`, `checkin-hoang-hon-dong-que`).
2. Xác nhận không còn bản ghi active nào thiếu số trước khi chạy migration đặt `NOT NULL`.
3. Sau khi đặt `NOT NULL`, nới lại kiểu response DTO của `contactPhone` từ `string | null` về
   `string` (bỏ `nullable: true`).

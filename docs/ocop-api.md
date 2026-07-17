# API OCOP

Module `ocop` quản lý danh sách sản phẩm OCOP (One Commune One Product). Mọi endpoint dùng prefix `/api/v1` và response envelope chung của dự án.

## Endpoints

| Method | Endpoint                                              | Quyền            | Mô tả                                                       |
| ------ | ------------------------------------------------------ | ---------------- | ------------------------------------------------------------ |
| GET    | `/ocop?category=Thực phẩm&rating=4`                    | Public           | Chỉ bản ghi active, sắp xếp `sortOrder`, `createdAt`, `id`   |
| GET    | `/ocop/:id`                                             | Public           | Chi tiết active, gồm `description`, `highlights`, `contactNote` |
| GET    | `/admin/ocop?page=1&limit=20&category=&rating=&search=` | ADMIN, MODERATOR | Danh sách gồm cả bản ghi ẩn, tìm theo tên/nhà sản xuất       |
| GET    | `/admin/ocop/:id`                                       | ADMIN, MODERATOR | Chi tiết và `version` hiện tại                                |
| POST   | `/admin/ocop`                                           | ADMIN, MODERATOR | Tạo mới, tự sinh slug nếu không gửi `id`                      |
| PUT    | `/admin/ocop/:id`                                       | ADMIN, MODERATOR | Cập nhật toàn bộ với optimistic locking                       |
| PATCH  | `/admin/ocop/:id/status`                                | ADMIN, MODERATOR | Ẩn/hiện với optimistic locking                                |
| PATCH  | `/admin/ocop/reorder`                                   | ADMIN, MODERATOR | Cập nhật thứ tự hàng loạt trong transaction                   |
| DELETE | `/admin/ocop/:id`                                       | ADMIN, MODERATOR | Xóa sản phẩm OCOP                                              |

Public list chỉ trả dữ liệu cần cho thẻ danh sách. Public detail trả thêm `description`, `highlights`, `contactNote` và `contactPhone`. Public API không phân biệt bản ghi không tồn tại và bản ghi đang ẩn: cả hai đều trả `404 OCOP_PRODUCT_NOT_FOUND`.

`GET /ocop/:id` trả `ETag: "ocop-{id}-{updatedAtMillis}"` và `Cache-Control: public, max-age=60, must-revalidate`. Mọi thao tác cập nhật làm đổi `updatedAt`, vì vậy ETag cũ tự mất hiệu lực.

## Request tạo/cập nhật

```json
{
  "version": 2,
  "name": "Mật ong rừng Truông Mít",
  "category": "Thực phẩm",
  "rating": 4,
  "producer": "Tổ hợp tác ong mật Thuận Bình",
  "address": "Ấp Thuận Bình, xã Truông Mít",
  "priceRange": "120.000đ - 180.000đ/chai",
  "summary": "Mật ong khai thác theo mùa...",
  "description": ["Đoạn 1", "Đoạn 2"],
  "highlights": ["Đóng chai tiện lợi, dễ trưng bày tại điểm bán"],
  "contactNote": "Liên hệ tổ hợp tác để đặt hàng số lượng lớn.",
  "contactPhone": "0900 123 456",
  "mediaId": "uuid-media",
  "imageAlt": "Mật ong rừng Truông Mít",
  "isActive": true
}
```

`category` chỉ nhận một trong bốn giá trị `Thực phẩm | Đồ uống | Nông sản tươi | Sản phẩm chế biến` (lưu dưới dạng enum Postgres). `rating` là hạng sao OCOP chính thức, chỉ nhận số nguyên `3`, `4` hoặc `5` (cũng lưu dưới dạng enum Postgres `THREE|FOUR|FIVE`, không phải rating trung bình do người dùng bình chọn) — mọi giá trị khác (1, 2, số thập phân) bị từ chối `400 VALIDATION_ERROR`. `producer`, `address`, `priceRange`, `contactNote` là chuỗi tự do. Slug của sản phẩm không đổi khi cập nhật tên.

`contactPhone` là số điện thoại liên hệ để khách gọi đặt mua sản phẩm — **bắt buộc** trên cả tạo mới và cập nhật, tối đa 30 ký tự, server tự trim khoảng trắng đầu/cuối, chỉ chấp nhận chữ số/khoảng trắng và tối đa một dấu `+` ở đầu (`^\+?[0-9\s]+$`, cùng quy tắc với field `phone` của module Contacts) — ví dụ hợp lệ: `0900 123 456`, `+84 900 123 456`. Không tự chuẩn hóa/loại bỏ số `0` đầu; chuỗi được lưu và trả về đúng như Admin nhập, Mini App tự loại ký tự phân cách khi tạo `tel:` URI.

Khi `version` cũ, API trả `409 OCOP_PRODUCT_VERSION_CONFLICT`; `error.details[0].latest` chứa bản ghi mới nhất để giao diện cảnh báo và cho phép tải lại mà không ghi đè âm thầm.

## Media

1. Upload JPEG/PNG/WebP bằng `POST /api/v1/media/images` với Bearer token.
2. Dùng `data.id` làm `mediaId` khi tạo/cập nhật sản phẩm OCOP.
3. Backend xác minh media chưa xóa, MIME bắt đầu bằng `image/`, thuộc người gọi và chưa được nội dung khác sử dụng. Media được claim thành resource `OCOP` trong cùng transaction ghi nội dung.

Seed không hard-code domain CDN hay đường dẫn máy local. Có thể upload một ảnh placeholder vào media storage của môi trường, sau đó đặt `OCOP_PLACEHOLDER_MEDIA_ID` trước khi chạy seed. Nếu không đặt, seed vẫn tạo đủ nội dung với `mediaId = null`; admin có thể gắn ảnh sau.

## Migration và seed

```powershell
npx.cmd prisma migrate deploy
npm.cmd run db:seed
```

Seed idempotent tạo đúng 5 slug hiện tại: `mat-ong-rung-truong-mit`, `tra-la-sa-ke`, `sau-rieng-thuan-binh`, `muoi-ot-xanh`, `banh-trang-phoi-suong`, giữ nguyên `description`, `highlights` và `contactNote` từ Mini App.

Hai slug `sau-rieng-thuan-binh` và `banh-trang-phoi-suong` trùng tên với hai bản ghi bên module Đặc sản (`docs/specialties-api.md`) nhưng nằm ở bảng `OcopProduct` độc lập, không chia sẻ khóa chính hay khóa ngoại với bảng `Specialty`.

## Error codes

- `OCOP_PRODUCT_NOT_FOUND`: không tồn tại hoặc đang ẩn trên public API.
- `OCOP_PRODUCT_SLUG_EXISTS`: slug tạo mới bị trùng.
- `OCOP_PRODUCT_VERSION_CONFLICT`: version cập nhật/status đã cũ.
- `INVALID_OCOP_PRODUCT_MEDIA`: media thiếu, sai MIME, đã xóa hoặc không có quyền dùng.
- `VALIDATION_ERROR`: enum, `rating` ngoài tập `{3,4,5}`, giới hạn chuỗi/mảng, slug, `contactPhone` thiếu/sai định dạng, cố kích hoạt bản ghi chưa có `contactPhone`, hoặc cấu trúc request không hợp lệ.

## Rollout `contactPhone` (phase 1/2)

Cột `contactPhone` hiện đang ở **phase 1**: cột Postgres nullable (`VARCHAR(30)`, không backfill số
giả). `POST`/`PUT` bắt buộc nhập; `PATCH .../status` chặn chuyển một bản ghi sang `isActive: true`
nếu bản ghi đó chưa có `contactPhone` (trả `400 VALIDATION_ERROR`). Các bản ghi active được tạo
**trước** khi triển khai field này (bao gồm 5 slug seed hiện tại) có thể tạm thời trả
`contactPhone: null` ở public/admin detail cho tới khi Admin sửa qua `PUT`.

**Checklist vận hành trước khi chạy phase 2** (đặt `ALTER COLUMN "contactPhone" SET NOT NULL`):

1. Rà soát toàn bộ `OcopProduct` đang `isActive = true` có `contactPhone IS NULL`, yêu cầu Admin bổ
   sung số qua UI (bao gồm 5 slug seed: `mat-ong-rung-truong-mit`, `tra-la-sa-ke`,
   `sau-rieng-thuan-binh`, `muoi-ot-xanh`, `banh-trang-phoi-suong`).
2. Xác nhận không còn bản ghi active nào thiếu số trước khi chạy migration đặt `NOT NULL`.
3. Sau khi đặt `NOT NULL`, nới lại kiểu response DTO của `contactPhone` từ `string | null` về
   `string` (bỏ `nullable: true`).

# API Nông nghiệp

Module `agriculture` quản lý danh sách nhiều nội dung nông nghiệp (cây trồng, chăn nuôi, thủy lợi, mô hình sản xuất). Mọi endpoint dùng prefix `/api/v1` và response envelope chung của dự án.

## Endpoints

| Method | Endpoint                                              | Quyền            | Mô tả                                                       |
| ------ | ------------------------------------------------------ | ---------------- | ------------------------------------------------------------ |
| GET    | `/agriculture?category=Chăn nuôi`                       | Public           | Chỉ bản ghi active, sắp xếp `sortOrder`, `createdAt`, `id`   |
| GET    | `/agriculture/:id`                                      | Public           | Chi tiết active, gồm `description`, `highlights`, `support`  |
| GET    | `/admin/agriculture?page=1&limit=20&category=&search=`  | ADMIN, MODERATOR | Danh sách gồm cả bản ghi ẩn, tìm theo tên/khu vực            |
| GET    | `/admin/agriculture/:id`                                | ADMIN, MODERATOR | Chi tiết và `version` hiện tại                                |
| POST   | `/admin/agriculture`                                    | ADMIN, MODERATOR | Tạo mới, tự sinh slug nếu không gửi `id`                      |
| PUT    | `/admin/agriculture/:id`                                | ADMIN, MODERATOR | Cập nhật toàn bộ với optimistic locking                       |
| PATCH  | `/admin/agriculture/:id/status`                         | ADMIN, MODERATOR | Ẩn/hiện với optimistic locking                                |
| PATCH  | `/admin/agriculture/reorder`                            | ADMIN, MODERATOR | Cập nhật thứ tự hàng loạt trong transaction                   |
| DELETE | `/admin/agriculture/:id`                                | ADMIN, MODERATOR | Xóa mục nông nghiệp                                           |

Public list chỉ trả dữ liệu cần cho thẻ danh sách. Public detail trả thêm `description`, `highlights` và `support`. Public API không phân biệt bản ghi không tồn tại và bản ghi đang ẩn: cả hai đều trả `404 AGRICULTURE_ITEM_NOT_FOUND`.

`GET /agriculture/:id` trả `ETag: "agriculture-{id}-{updatedAtMillis}"` và `Cache-Control: public, max-age=60, must-revalidate`. Mọi thao tác cập nhật làm đổi `updatedAt`, vì vậy ETag cũ tự mất hiệu lực.

## Request tạo/cập nhật

```json
{
  "version": 2,
  "name": "Vùng nguyên liệu mía Lộc Trung",
  "category": "Cây trồng chủ lực",
  "location": "Ấp Lộc Trung và các khu sản xuất lân cận",
  "season": "Trồng mới từ tháng 4 - 6, thu hoạch tháng 11 - 3",
  "scale": "Khoảng 420 ha",
  "summary": "Vùng mía tập trung của xã...",
  "description": ["Đoạn 1", "Đoạn 2"],
  "highlights": ["Có vùng sản xuất tập trung, thuận lợi liên kết tiêu thụ"],
  "support": "Khuyến khích hộ dân đăng ký tham gia tổ liên kết...",
  "mediaId": "uuid-media",
  "imageAlt": "Vùng nguyên liệu mía Lộc Trung",
  "isActive": true
}
```

`category` chỉ nhận một trong bốn giá trị `Cây trồng chủ lực | Chăn nuôi | Thủy lợi | Mô hình sản xuất` (lưu dưới dạng enum Postgres, không phải free text). `location`, `season`, `scale`, `support` là chuỗi tự do, không ép kiểu số/ngày. Slug của mục không đổi khi cập nhật tên.

Khi `version` cũ, API trả `409 AGRICULTURE_ITEM_VERSION_CONFLICT`; `error.details[0].latest` chứa bản ghi mới nhất để giao diện cảnh báo và cho phép tải lại mà không ghi đè âm thầm.

## Media

1. Upload JPEG/PNG/WebP bằng `POST /api/v1/media/images` với Bearer token.
2. Dùng `data.id` làm `mediaId` khi tạo/cập nhật mục nông nghiệp.
3. Backend xác minh media chưa xóa, MIME bắt đầu bằng `image/`, thuộc người gọi và chưa được nội dung khác sử dụng. Media được claim thành resource `AGRICULTURE` trong cùng transaction ghi nội dung.

Seed không hard-code domain CDN hay đường dẫn máy local. Có thể upload một ảnh placeholder vào media storage của môi trường, sau đó đặt `AGRICULTURE_PLACEHOLDER_MEDIA_ID` trước khi chạy seed. Nếu không đặt, seed vẫn tạo đủ nội dung với `mediaId = null`; admin có thể gắn ảnh sau.

## Migration và seed

```powershell
npx.cmd prisma migrate deploy
npm.cmd run db:seed
```

Seed idempotent tạo đúng 5 slug hiện tại: `vung-nguyen-lieu-mia`, `vuon-cay-an-trai-thuan-binh`, `mo-hinh-chan-nuoi-bo`, `kenh-tuoi-noi-dong`, `to-hop-tac-nong-san-sach`, giữ nguyên `description`, `highlights` và `support` từ Mini App.

## Error codes

- `AGRICULTURE_ITEM_NOT_FOUND`: không tồn tại hoặc đang ẩn trên public API.
- `AGRICULTURE_ITEM_SLUG_EXISTS`: slug tạo mới bị trùng.
- `AGRICULTURE_ITEM_VERSION_CONFLICT`: version cập nhật/status đã cũ.
- `INVALID_AGRICULTURE_ITEM_MEDIA`: media thiếu, sai MIME, đã xóa hoặc không có quyền dùng.
- `VALIDATION_ERROR`: enum, giới hạn chuỗi/mảng, slug hoặc cấu trúc request không hợp lệ.

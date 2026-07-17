# API Lễ hội

Module `festivals` quản lý danh sách lễ hội/sự kiện địa phương. Mọi endpoint dùng prefix `/api/v1` và response envelope chung của dự án.

## Endpoints

| Method | Endpoint                                             | Quyền            | Mô tả                                                       |
| ------ | ------------------------------------------------------ | ---------------- | ------------------------------------------------------------ |
| GET    | `/festivals?category=Lễ truyền thống`                   | Public           | Chỉ bản ghi active, sắp xếp `sortOrder`, `createdAt`, `id`   |
| GET    | `/festivals/:id`                                         | Public           | Chi tiết active, gồm `description`, `activities`, `note`     |
| GET    | `/admin/festivals?page=1&limit=20&category=&search=`    | ADMIN, MODERATOR | Danh sách gồm cả bản ghi ẩn, tìm theo tên/địa điểm            |
| GET    | `/admin/festivals/:id`                                   | ADMIN, MODERATOR | Chi tiết và `version` hiện tại                                |
| POST   | `/admin/festivals`                                       | ADMIN, MODERATOR | Tạo mới, tự sinh slug nếu không gửi `id`                      |
| PUT    | `/admin/festivals/:id`                                   | ADMIN, MODERATOR | Cập nhật toàn bộ với optimistic locking                       |
| PATCH  | `/admin/festivals/:id/status`                            | ADMIN, MODERATOR | Ẩn/hiện với optimistic locking                                |
| PATCH  | `/admin/festivals/reorder`                               | ADMIN, MODERATOR | Cập nhật thứ tự hàng loạt trong transaction                   |
| DELETE | `/admin/festivals/:id`                                   | ADMIN, MODERATOR | Xóa lễ hội                                                     |

Public list chỉ trả dữ liệu cần cho thẻ danh sách. Public detail trả thêm `description`, `activities` và `note`. Public API không phân biệt bản ghi không tồn tại và bản ghi đang ẩn: cả hai đều trả `404 FESTIVAL_NOT_FOUND`.

`GET /festivals/:id` trả `ETag: "festival-{id}-{updatedAtMillis}"` và `Cache-Control: public, max-age=60, must-revalidate`. Mọi thao tác cập nhật làm đổi `updatedAt`, vì vậy ETag cũ tự mất hiệu lực.

## Request tạo/cập nhật

```json
{
  "version": 2,
  "name": "Lễ hội đình làng Truông Mít",
  "category": "Lễ truyền thống",
  "time": "Tháng Giêng âm lịch hằng năm",
  "location": "Khu vực đình/nhà văn hóa xã Truông Mít",
  "scale": "Cấp xã",
  "summary": "Lễ hội truyền thống đầu năm...",
  "description": ["Đoạn 1", "Đoạn 2"],
  "activities": ["Dâng hương, cầu an đầu năm"],
  "note": "Cập nhật lịch tổ chức, đơn vị phụ trách và sơ đồ khu vực lễ hội.",
  "mediaId": "uuid-media",
  "imageAlt": "Lễ hội đình làng Truông Mít",
  "isActive": true
}
```

`category` chỉ nhận một trong bốn giá trị `Lễ truyền thống | Văn hóa cộng đồng | Thể thao - vui chơi | Sự kiện nông sản` (lưu dưới dạng enum Postgres, không phải free text). `time`, `location`, `scale`, `note` là chuỗi tự do, không ép kiểu ngày giờ. Slug của lễ hội không đổi khi cập nhật tên.

Khi `version` cũ, API trả `409 FESTIVAL_VERSION_CONFLICT`; `error.details[0].latest` chứa bản ghi mới nhất để giao diện cảnh báo và cho phép tải lại mà không ghi đè âm thầm.

## Media

1. Upload JPEG/PNG/WebP bằng `POST /api/v1/media/images` với Bearer token.
2. Dùng `data.id` làm `mediaId` khi tạo/cập nhật lễ hội.
3. Backend xác minh media chưa xóa, MIME bắt đầu bằng `image/`, thuộc người gọi và chưa được nội dung khác sử dụng. Media được claim thành resource `FESTIVAL` trong cùng transaction ghi nội dung.

Seed không hard-code domain CDN hay đường dẫn máy local. Có thể upload một ảnh placeholder vào media storage của môi trường, sau đó đặt `FESTIVAL_PLACEHOLDER_MEDIA_ID` trước khi chạy seed. Nếu không đặt, seed vẫn tạo đủ nội dung với `mediaId = null`; admin có thể gắn ảnh sau.

## Migration và seed

```powershell
npx.cmd prisma migrate deploy
npm.cmd run db:seed
```

Seed idempotent tạo đúng 5 slug hiện tại: `le-hoi-dinh-lang-truong-mit`, `tet-trong-cay`, `hoi-thi-am-thuc-que`, `hoi-thao-nong-dan`, `ngay-hoi-nong-san`, giữ nguyên `description`, `activities` và `note` từ Mini App.

## Error codes

- `FESTIVAL_NOT_FOUND`: không tồn tại hoặc đang ẩn trên public API.
- `FESTIVAL_SLUG_EXISTS`: slug tạo mới bị trùng.
- `FESTIVAL_VERSION_CONFLICT`: version cập nhật/status đã cũ.
- `INVALID_FESTIVAL_MEDIA`: media thiếu, sai MIME, đã xóa hoặc không có quyền dùng.
- `VALIDATION_ERROR`: enum, giới hạn chuỗi/mảng, slug hoặc cấu trúc request không hợp lệ.

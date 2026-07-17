# About CMS API

Module `about` quản lý một trang singleton có khóa `about`. Dữ liệu nháp và dữ liệu đã xuất bản được lưu thành hai snapshot độc lập; bảng `AboutRevision` lưu lịch sử các lần xuất bản.

## Endpoints

Tất cả endpoint dùng prefix `/api/v1` và response envelope chung của dự án.

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/about` | Public | Snapshot đã xuất bản; chỉ trả item active, sắp xếp theo `sortOrder`, `id` |
| GET | `/admin/about` | ADMIN, MODERATOR | Bản nháp, version và metadata published |
| PUT | `/admin/about` | ADMIN, MODERATOR | Lưu toàn bộ draft với optimistic locking |
| GET | `/admin/about/preview` | ADMIN, MODERATOR | Preview draft đã resolve URL ảnh |
| POST | `/admin/about/publish` | ADMIN, MODERATOR | Xuất bản draft atomically và tạo revision |
| POST | `/admin/about/discard-draft` | ADMIN, MODERATOR | Khôi phục draft từ snapshot published |

`GET /about` trả `ETag: "about-{version}"` và `Cache-Control: public, max-age=60, must-revalidate`. Client có thể gửi `If-None-Match`; ETag thay đổi sau mỗi lần publish có nội dung mới.

## Optimistic locking

Body `PUT /admin/about` phải gửi `version` lấy từ `GET /admin/about`. Sau khi lưu thành công version tăng 1. Nếu version đã cũ, API trả `409 ABOUT_VERSION_CONFLICT` với:

```json
{
  "success": false,
  "error": {
    "code": "ABOUT_VERSION_CONFLICT",
    "message": "Bản nháp đã được người khác cập nhật, vui lòng tải lại",
    "details": [{ "latestVersion": 4 }]
  }
}
```

## Ảnh

1. Upload JPEG/PNG/WebP bằng `POST /api/v1/media/images` với Bearer token của admin.
2. Lấy `data.id` trong response làm `hero.mediaId` hoặc `highlights[].mediaId`.
3. Gửi `PUT /api/v1/admin/about`. Backend kiểm tra media tồn tại, MIME là ảnh, chưa bị xóa và thuộc admin hoặc đã được gắn với trang `about`.

Seed không hard-code CDN/domain hoặc đường dẫn máy local. Vì vậy ảnh seed ban đầu để `mediaId = null` và public DTO trả `imageUrl = ""`. Sau deploy, admin upload asset của môi trường theo ba bước trên rồi publish. Storage dùng `MEDIA_STORAGE_PROVIDER` và `UPLOAD_DIR` như module media hiện có.

## Migration và seed

```powershell
npx.cmd prisma migrate deploy
npm.cmd run db:seed
```

Seed idempotent khởi tạo tiêu đề, hai đoạn tổng quan, bốn chỉ số, bốn điểm nổi bật và các mốc 1979/2015/2021/2025; đồng thời tạo revision published đầu tiên nếu chưa có.

## Error codes

- `ABOUT_NOT_PUBLISHED`: chưa có public snapshot.
- `ABOUT_NOT_INITIALIZED`: chưa chạy seed.
- `ABOUT_VERSION_CONFLICT`: draft version đã cũ.
- `INVALID_ABOUT_CONTENT`: dữ liệu trống, trùng ID hoặc chứa HTML.
- `INVALID_ABOUT_MEDIA`: media thiếu, sai MIME hoặc không có quyền sử dụng.

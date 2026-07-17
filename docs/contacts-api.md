# API Liên hệ

Module `contacts` quản lý danh sách đầu mối liên hệ. Mọi endpoint dùng prefix `/api/v1` và response envelope chung của dự án.

## Endpoints

| Method | Endpoint                                            | Quyền            | Mô tả                                                       |
| ------ | ------------------------------------------------------ | ---------------- | ------------------------------------------------------------ |
| GET    | `/contacts?category=Du lịch`                            | Public           | Chỉ bản ghi active, sắp xếp `sortOrder`, `createdAt`, `id`   |
| GET    | `/contacts/:id`                                          | Public           | Chi tiết active, gồm `description`, `supportTopics`, `note`   |
| GET    | `/admin/contacts?page=1&limit=20&category=&search=`     | ADMIN, MODERATOR | Danh sách gồm cả bản ghi ẩn, tìm theo tên/số điện thoại       |
| GET    | `/admin/contacts/:id`                                    | ADMIN, MODERATOR | Chi tiết và `version` hiện tại                                |
| POST   | `/admin/contacts`                                        | ADMIN, MODERATOR | Tạo mới, tự sinh slug nếu không gửi `id`                      |
| PUT    | `/admin/contacts/:id`                                    | ADMIN, MODERATOR | Cập nhật toàn bộ với optimistic locking                       |
| PATCH  | `/admin/contacts/:id/status`                             | ADMIN, MODERATOR | Ẩn/hiện với optimistic locking                                |
| PATCH  | `/admin/contacts/reorder`                                | ADMIN, MODERATOR | Cập nhật thứ tự hàng loạt trong transaction                   |
| DELETE | `/admin/contacts/:id`                                    | ADMIN, MODERATOR | Xóa đầu mối liên hệ                                            |

Public list trả `name`, `category`, `role`, `phone`, `email`, `address`, `workingTime`, `summary`, `imageUrl`, `imageAlt`, `sortOrder`, `updatedAt`. Public detail trả thêm `description`, `supportTopics`, `note`. Public API không phân biệt bản ghi không tồn tại và bản ghi đang ẩn: cả hai đều trả `404 CONTACT_NOT_FOUND`.

`GET /contacts/:id` trả `ETag: "contact-{id}-{updatedAtMillis}"` và `Cache-Control: public, max-age=60, must-revalidate`. Mọi thao tác cập nhật làm đổi `updatedAt`, vì vậy ETag cũ tự mất hiệu lực.

## `phone`/`email` — không phải chuỗi trưng bày thuần túy

`contact-detail.tsx` ở Mini App dựng trực tiếp `tel:{phone đã strip khoảng trắng}` và `mailto:{email}` từ hai trường này, nên chúng được validate chặt hơn các trường tự do khác:

- `phone`: bắt buộc, chỉ chứa chữ số, khoảng trắng và tối đa một dấu `+` ở đầu (regex `^\+?[0-9\s]+$`, cùng pattern đã dùng cho `phone` ở ticket phản hồi), tối đa 30 ký tự. Lưu nguyên định dạng có khoảng trắng để giữ khả năng đọc (ví dụ `"0276 000 000"`).
- `email`: tùy chọn (`nullable`). Nếu có giá trị phải đúng định dạng email (`@IsEmail()` — cùng validator đang dùng cho email ở `auth`/`business-applications`). Gửi chuỗi rỗng `""` được xem như không có email và lưu `null`; sai định dạng bị từ chối `400 VALIDATION_ERROR`.

## Request tạo/cập nhật

```json
{
  "version": 2,
  "name": "UBND xã Truông Mít",
  "category": "Hành chính",
  "role": "Tiếp nhận thông tin hành chính, thủ tục và liên hệ chung",
  "phone": "0276 000 000",
  "email": "ubnd.truongmit@example.vn",
  "address": "Trung tâm xã Truông Mít",
  "workingTime": "Thứ 2 - Thứ 6, 07:00 - 17:00",
  "summary": "Kênh liên hệ chung cho người dân...",
  "description": ["Đoạn 1", "Đoạn 2"],
  "supportTopics": ["Hỏi thông tin thủ tục hành chính"],
  "note": "Nên gọi trong giờ hành chính để được hỗ trợ nhanh hơn.",
  "mediaId": "uuid-media",
  "imageAlt": "UBND xã Truông Mít",
  "isActive": true
}
```

`category` chỉ nhận `Hành chính | Khẩn cấp | Du lịch | Nông nghiệp | Phản ánh` (enum Postgres). `role`, `address`, `workingTime`, `note` là chuỗi tự do. Slug của liên hệ không đổi khi cập nhật tên.

Giới hạn độ dài: `name` 150, `role` 255, `phone` 30, `email` 255, `address` 255, `workingTime` 150, `summary` 300, `note` 2.000, mỗi đoạn `description` 5.000, mỗi phần tử `supportTopics` 200 ký tự. Giới hạn số phần tử: tối đa 20 `description`, 20 `supportTopics`.

Khi `version` cũ, API trả `409 CONTACT_VERSION_CONFLICT`; `error.details[0].latest` chứa bản ghi mới nhất để giao diện cảnh báo và cho phép tải lại mà không ghi đè âm thầm.

**Lưu ý về `ubnd-xa-truong-mit`**: bảng `Contact` và bảng `MapPlace` là hai bảng độc lập, mỗi bảng tự quản lý `id`/slug riêng dù cùng mô tả UBND xã cho hai mục đích khác nhau (liên hệ vs. định vị bản đồ). Không có khóa ngoại chéo giữa hai bảng.

## Media

1. Upload JPEG/PNG/WebP bằng `POST /api/v1/media/images` với Bearer token.
2. Dùng `data.id` làm `mediaId` khi tạo/cập nhật liên hệ.
3. Backend xác minh media chưa xóa, MIME bắt đầu bằng `image/`, thuộc người gọi và chưa được nội dung khác sử dụng. Media được claim thành resource `CONTACT` trong cùng transaction ghi nội dung.

Seed không hard-code domain CDN hay đường dẫn máy local. Có thể upload một ảnh placeholder vào media storage của môi trường, sau đó đặt `CONTACT_PLACEHOLDER_MEDIA_ID` trước khi chạy seed. Nếu không đặt, seed vẫn tạo đủ nội dung với `mediaId = null`; admin có thể gắn ảnh sau.

## Migration và seed

```powershell
npx.cmd prisma migrate deploy
npm.cmd run db:seed
```

Seed idempotent tạo đúng 6 slug hiện tại: `ubnd-xa-truong-mit`, `cong-an-xa`, `tram-y-te-xa`, `du-lich-cong-dong`, `khuyen-nong-xa`, `duong-day-phan-anh`, giữ nguyên `description`, `supportTopics` và `note` từ Mini App.

**⚠️ Cảnh báo vận hành**: số điện thoại (`0276 000 000`, `0900 1xx xxx`...) và email (`@example.vn`) trong `prisma/contact-seed-data.ts` là **dữ liệu mẫu**, không phải số/hộp thư thật của địa phương. Đơn vị vận hành phải xác nhận và cập nhật lại thông tin liên hệ thật qua admin API (`PUT /admin/contacts/:id`) trước khi phát hành chính thức — nếu không, nút "Gọi ngay"/"Gửi email" trên Mini App sẽ dẫn đến số/hộp thư không có thật.

## Error codes

- `CONTACT_NOT_FOUND`: không tồn tại hoặc đang ẩn trên public API.
- `CONTACT_SLUG_EXISTS`: slug tạo mới bị trùng.
- `CONTACT_VERSION_CONFLICT`: version cập nhật/status đã cũ.
- `INVALID_CONTACT_MEDIA`: media thiếu, sai MIME, đã xóa hoặc không có quyền dùng.
- `VALIDATION_ERROR`: enum, giới hạn chuỗi/mảng, `phone` sai định dạng, `email` sai định dạng, slug, hoặc cấu trúc request không hợp lệ.

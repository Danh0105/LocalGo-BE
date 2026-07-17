# API Tin tức

Module `news` quản lý tin tức/bài viết theo dòng thời gian (feed). Mọi endpoint dùng prefix `/api/v1` và response envelope chung của dự án.

## Khác biệt so với các module danh sách trước (Festivals, Experience Tours, Map Places, Contacts...)

- **Không có `sortOrder`/`reorder`**: thứ tự hiển thị đến từ `publishedAt`, không phải sắp xếp thủ công. Không có `PATCH .../reorder`.
- **Public list có phân trang** (`page`/`limit`), khác các module trước trả nguyên mảng — vì tin tức tích lũy theo thời gian, không giới hạn vài chục bản ghi như danh sách địa điểm/sản phẩm.
- **Trường `sortOrder` trong query** (kế thừa từ `PaginationQueryDto`, `asc | desc`, mặc định `desc`) được dùng làm **chiều sắp xếp theo `publishedAt`** — đây là điểm tái sử dụng: các module trước có field này trong DTO nhưng không dùng tới (vì họ sort theo cột `sortOrder` cấp bản ghi cố định); ở đây nó có ý nghĩa thực sự vì tin tức không có cột `sortOrder`.
- **Public chỉ thấy bài đã đến giờ đăng**: ngoài `isActive = true`, còn phải `publishedAt <= now`. Admin list thấy toàn bộ (kể cả ẩn và lên lịch tương lai).

## Endpoints

| Method | Endpoint                                            | Quyền            | Mô tả                                                       |
| ------ | ------------------------------------------------------ | ---------------- | ------------------------------------------------------------ |
| GET    | `/news?category=Du lịch&page=1&limit=20&sortOrder=desc` | Public           | Chỉ bài active và đã đến giờ đăng, sắp theo `publishedAt`    |
| GET    | `/news/:id`                                              | Public           | Chi tiết active + đã đến giờ đăng, gồm `content`, `tags`, `relatedLinks` |
| GET    | `/admin/news?page=1&limit=20&category=&search=`         | ADMIN, MODERATOR | Danh sách gồm cả bài ẩn và lên lịch tương lai, tìm theo `title` |
| GET    | `/admin/news/:id`                                        | ADMIN, MODERATOR | Chi tiết và `version` hiện tại                                |
| POST   | `/admin/news`                                            | ADMIN, MODERATOR | Tạo mới, tự sinh slug nếu không gửi `id`                      |
| PUT    | `/admin/news/:id`                                        | ADMIN, MODERATOR | Cập nhật toàn bộ với optimistic locking                       |
| PATCH  | `/admin/news/:id/status`                                 | ADMIN, MODERATOR | Ẩn/hiện với optimistic locking                                |
| DELETE | `/admin/news/:id`                                        | ADMIN, MODERATOR | Xóa bài viết                                                   |

Public list trả `title`, `category`, `publishedAt`, `author`, `summary`, `imageUrl`, `imageAlt`, `updatedAt` cho mỗi bài (bọc trong envelope phân trang chuẩn `{ data, meta }` — dùng chung `PaginatedResultDto`/`ResponseInterceptor` như các API admin phân trang khác). Public detail trả thêm `content`, `tags`, `relatedLinks`. Public API không phân biệt bài không tồn tại, đang ẩn, hay chưa tới giờ đăng: cả ba đều trả `404 NEWS_ARTICLE_NOT_FOUND`.

`GET /news/:id` trả `ETag: "news-{id}-{updatedAtMillis}"` và `Cache-Control: public, max-age=60, must-revalidate`.

## `publishedAt` — datetime chuẩn, không phải chuỗi `dd/mm/yyyy`

Dữ liệu mẫu cũ ở frontend từng lưu `publishedAt` dạng chuỗi hiển thị `"09/07/2026"`. Backend **luôn** lưu và trả `publishedAt` dưới dạng ISO 8601 datetime (`"2026-07-09T00:00:00.000Z"`); việc format sang `dd/mm/yyyy` để hiển thị được thực hiện ở tầng `src/services/news.ts` phía frontend, không lưu chuỗi định dạng sẵn ở DB.

Admin có thể đặt `publishedAt` ở tương lai để **lên lịch đăng bài** — bài vẫn `isActive = true` nhưng public API không trả cho tới khi `publishedAt <= now`.

## Request tạo/cập nhật

```json
{
  "version": 2,
  "title": "Ra mắt Mini App giới thiệu xã Truông Mít",
  "category": "Chuyển đổi số",
  "publishedAt": "2026-07-09T00:00:00.000Z",
  "author": "Ban biên tập xã Truông Mít",
  "summary": "Mini App hỗ trợ người dân và du khách tra cứu thông tin địa phương...",
  "content": ["Đoạn 1", "Đoạn 2"],
  "tags": ["Mini App", "Chuyển đổi số"],
  "relatedLinks": ["Giới thiệu", "Bản đồ"],
  "mediaId": "uuid-media",
  "imageAlt": "Ra mắt Mini App giới thiệu xã Truông Mít",
  "isActive": true
}
```

`category` chỉ nhận `Thông báo | Hoạt động xã | Du lịch | Nông nghiệp | Chuyển đổi số` (enum Postgres). `relatedLinks` hiện chỉ là **nhãn hiển thị dạng text** (Mini App render bằng `<span>`, không có `onClick`/`navigate`) — không validate theo URL/route thật, giữ nguyên hành vi này cho tới khi có yêu cầu nâng cấp thành deep-link tường minh.

Giới hạn độ dài: `title` 200, `author` 150, `summary` 300, mỗi đoạn `content` 5.000, mỗi phần tử `tags`/`relatedLinks` 100 ký tự. Giới hạn số phần tử: tối đa 30 `content`, 15 `tags`, 15 `relatedLinks`.

Khi `version` cũ, API trả `409 NEWS_ARTICLE_VERSION_CONFLICT`; `error.details[0].latest` chứa bản ghi mới nhất.

## Media

1. Upload JPEG/PNG/WebP bằng `POST /api/v1/media/images` với Bearer token.
2. Dùng `data.id` làm `mediaId` khi tạo/cập nhật bài viết.
3. Backend xác minh media chưa xóa, MIME bắt đầu bằng `image/`, thuộc người gọi và chưa được nội dung khác sử dụng. Media được claim thành resource `NEWS_ARTICLE` trong cùng transaction ghi nội dung.

Seed không hard-code domain CDN hay đường dẫn máy local. Có thể upload một ảnh placeholder vào media storage của môi trường, sau đó đặt `NEWS_PLACEHOLDER_MEDIA_ID` trước khi chạy seed. Nếu không đặt, seed vẫn tạo đủ nội dung với `mediaId = null`; admin có thể gắn ảnh sau.

## Migration và seed

```powershell
npx.cmd prisma migrate deploy
npm.cmd run db:seed
```

Seed idempotent tạo đúng 5 slug hiện tại: `ra-mat-mini-app-truong-mit`, `thong-bao-lich-tiep-cong-dan`, `ngay-hoi-nong-san-dia-phuong`, `goi-y-tour-cuoi-tuan`, `ra-quan-ve-sinh-moi-truong`, giữ nguyên `content`, `tags`, `relatedLinks`, và chuyển đúng `publishedAt` từ `dd/mm/yyyy` sang ISO datetime, đúng thứ tự thời gian gốc.

## Error codes

- `NEWS_ARTICLE_NOT_FOUND`: không tồn tại, đang ẩn, hoặc chưa tới giờ đăng trên public API.
- `NEWS_ARTICLE_SLUG_EXISTS`: slug tạo mới bị trùng.
- `NEWS_ARTICLE_VERSION_CONFLICT`: version cập nhật/status đã cũ.
- `INVALID_NEWS_ARTICLE_MEDIA`: media thiếu, sai MIME, đã xóa hoặc không có quyền dùng.
- `VALIDATION_ERROR`: enum, giới hạn chuỗi/mảng, `publishedAt` không parse được thành datetime, slug, hoặc cấu trúc request không hợp lệ.

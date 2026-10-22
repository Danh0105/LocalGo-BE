# API Bình luận đánh giá nội dung

Module `content-reviews` cho phép người dùng mini app chấm sao (1–5) và bình luận, kèm tối đa 3 ảnh, cho 8 mục nội dung. Mọi endpoint dùng prefix `/api/v1` và response envelope chung của dự án.

## Mục được hỗ trợ (`targetType`)

`targetType` trùng với đoạn đường dẫn public của từng mục, nên từ một đánh giá có thể mở thẳng `/{targetType}/{targetId}`.

| `targetType`       | Mục               | Public detail tương ứng       |
| ------------------ | ----------------- | ----------------------------- |
| `temples`          | Đền - Chùa - Miếu | `GET /temples/:id`            |
| `specialties`      | Đặc sản           | `GET /specialties/:id`        |
| `historical-sites` | Di tích lịch sử   | `GET /historical-sites/:id`   |
| `agriculture`      | Nông nghiệp       | `GET /agriculture/:id`        |
| `craft-villages`   | Làng nghề         | `GET /craft-villages/:id`     |
| `cuisine`          | Ẩm thực           | `GET /cuisine/:id`            |
| `festivals`        | Lễ hội            | `GET /festivals/:id`          |
| `experience-tours` | Tour trải nghiệm  | `GET /experience-tours/:id`   |

`targetId` là `id` (slug) của mục đó. Giá trị `targetType` khác (ví dụ `ocop`) trả `404 CONTENT_REVIEW_TARGET_NOT_FOUND`.

## Endpoints mini app

| Method | Endpoint                                              | Quyền  | Mô tả                                                                 |
| ------ | ----------------------------------------------------- | ------ | --------------------------------------------------------------------- |
| GET    | `/content-reviews/:targetType/:targetId?page=&limit=&sortOrder=` | Public | Danh sách đánh giá đang hiển thị, mới nhất trước (mặc định `desc`) |
| GET    | `/content-reviews/:targetType/:targetId/summary`      | Public | Điểm trung bình, tổng số, số lượng và % từng mức sao                  |
| GET    | `/content-reviews/ratings?targetType=temples&ids=a,b` | Public | Điểm trung bình + số đánh giá của nhiều mục, dùng cho thẻ danh sách  |
| GET    | `/content-reviews/:targetType/:targetId/me`           | Bearer | Đánh giá của tôi cho mục này (`data: null` nếu chưa có)               |
| POST   | `/content-reviews/:targetType/:targetId`              | Bearer | Gửi đánh giá (mỗi người một đánh giá cho mỗi mục)                     |
| PATCH  | `/content-reviews/:id`                                | Bearer | Sửa đánh giá của chính mình                                           |
| DELETE | `/content-reviews/:id`                                | Bearer | Xóa đánh giá của chính mình (204)                                     |
| GET    | `/content-reviews/me?page=&limit=`                    | Bearer | Mọi đánh giá của tôi, kèm thông tin mục (`target`)                    |

Danh sách, summary và gửi đánh giá trả `404 CONTENT_REVIEW_TARGET_NOT_FOUND` khi mục không tồn tại hoặc đang ẩn. `ratings` không kiểm tra mục: khi gửi `ids`, kết quả có đủ từng id theo đúng thứ tự (mục chưa có đánh giá trả `average: 0, total: 0`); khi bỏ `ids`, chỉ trả các mục đã có đánh giá. Tối đa 100 id mỗi lần.

### Gửi / sửa đánh giá

```json
{
  "rating": 5,
  "content": "Cảnh chùa rất đẹp, yên bình.",
  "imageIds": ["uuid-media-1", "uuid-media-2"]
}
```

- `rating`: số nguyên 1–5.
- `content`: 1–1000 ký tự, được trim trước khi kiểm tra.
- `imageIds` (tùy chọn): tối đa 3 id ảnh, không trùng nhau. Upload trước bằng `POST /media/images` hoặc `POST /media/images/batch`. Ảnh phải do chính người gọi upload, chưa bị xóa và chưa được nội dung khác sử dụng, nếu không API trả `400 INVALID_CONTENT_REVIEW_MEDIA`.
- `PATCH` nhận cùng các trường nhưng đều tùy chọn. Khi gửi `imageIds`, mảng mới thay thế toàn bộ ảnh cũ (gửi `[]` để xóa hết ảnh); bỏ `imageIds` thì giữ nguyên ảnh.

Đánh giá hiển thị công khai ngay khi gửi (`status: PUBLISHED`), admin có thể ẩn sau. Người dùng sửa một đánh giá đang bị ẩn thì đánh giá vẫn ẩn.

Gửi lần thứ hai cho cùng một mục trả `409 REVIEW_ALREADY_EXISTS`; giao diện nên gọi `.../me` để hiện nút "Sửa đánh giá". Sau khi người dùng xóa đánh giá cũ, họ có thể gửi đánh giá mới.

Chỉ tác giả được sửa/xóa đánh giá qua các endpoint này (người khác nhận `403 RESOURCE_NOT_OWNED`, kể cả admin — admin dùng endpoint `/admin/...` bên dưới).

### Response một đánh giá

```json
{
  "id": "uuid",
  "targetType": "temples",
  "targetId": "chua-ba-thien-hau",
  "userId": "uuid",
  "rating": 5,
  "content": "Cảnh chùa rất đẹp, yên bình.",
  "status": "PUBLISHED",
  "replyContent": "Cảm ơn bạn đã ghé thăm!",
  "repliedAt": "2026-10-21T08:00:00.000Z",
  "images": [
    { "id": "uuid-media", "url": "https://...", "thumbnailUrl": "https://...", "sortOrder": 0 }
  ],
  "reviewer": { "id": "uuid", "displayName": "Nguyễn Văn A", "avatarUrl": null },
  "createdAt": "2026-10-21T07:00:00.000Z",
  "updatedAt": "2026-10-21T07:00:00.000Z"
}
```

`replyContent` là phản hồi công khai của ban quản lý; response public không tiết lộ admin nào đã viết. `GET /content-reviews/me` trả thêm `target`:

```json
{
  "target": {
    "targetType": "temples",
    "id": "chua-ba-thien-hau",
    "name": "Chùa Bà Thiên Hậu",
    "imageUrl": "https://...",
    "isActive": true,
    "deleted": false
  }
}
```

### Summary

```json
{
  "average": 4.3,
  "total": 24,
  "counts": { "1": 0, "2": 1, "3": 2, "4": 8, "5": 13 },
  "distribution": { "1": 0, "2": 4, "3": 8, "4": 33, "5": 54 }
}
```

Chỉ tính đánh giá đang hiển thị. `average` làm tròn 1 chữ số thập phân, `distribution` là phần trăm làm tròn tới số nguyên.

## Endpoints admin (MODERATOR, ADMIN)

| Method | Endpoint                                                                                   | Mô tả                                                    |
| ------ | ------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| GET    | `/admin/content-reviews?page=&limit=&sortOrder=&targetType=&targetId=&status=&rating=&search=` | Danh sách đánh giá chưa xóa, mọi trạng thái           |
| GET    | `/admin/content-reviews/stats?targetType=&targetId=`                                       | Số đánh giá theo trạng thái, theo mục, số chưa phản hồi  |
| GET    | `/admin/content-reviews/:id`                                                               | Chi tiết một đánh giá                                    |
| PATCH  | `/admin/content-reviews/:id/status`                                                        | `{ "status": "HIDDEN" }` hoặc `{ "status": "PUBLISHED" }` |
| PUT    | `/admin/content-reviews/:id/reply`                                                         | `{ "content": "..." }` — tạo hoặc sửa phản hồi (1–1000 ký tự) |
| DELETE | `/admin/content-reviews/:id/reply`                                                         | Xóa phản hồi (204)                                       |
| DELETE | `/admin/content-reviews/:id`                                                               | Xóa mềm đánh giá (204)                                   |

`search` tìm trong nội dung bình luận và tên người đánh giá. Response admin gồm các trường public cộng thêm:

- `target`: như trên; `name: null, deleted: true` khi mục đã bị xóa.
- `user`: `id`, `displayName`, `avatarUrl`, `email`, `phone`, `status` của người đánh giá.
- `repliedBy`: `{ id, displayName }` của admin đã phản hồi, hoặc `null`.

`stats` trả:

```json
{
  "total": 13,
  "byStatus": { "PUBLISHED": 12, "HIDDEN": 1 },
  "byTargetType": { "temples": 5, "specialties": 0, "historical-sites": 0, "agriculture": 0, "craft-villages": 0, "cuisine": 8, "festivals": 0, "experience-tours": 0 },
  "unreplied": 7
}
```

`unreplied` đếm đánh giá đang hiển thị chưa có phản hồi. Chỉ phản hồi được đánh giá đang hiển thị: phản hồi một đánh giá đang ẩn trả `409 REVIEW_REPLY_NOT_ALLOWED`.

Ẩn/hiện, phản hồi, xóa phản hồi và xóa đánh giá đều ghi audit log (`CONTENT_REVIEW_HIDDEN`, `CONTENT_REVIEW_PUBLISHED`, `CONTENT_REVIEW_REPLY`, `CONTENT_REVIEW_REPLY_DELETE`, `CONTENT_REVIEW_DELETE`). Đổi sang đúng trạng thái hiện tại không ghi gì và không gửi thông báo.

## Thông báo

Người đánh giá nhận thông báo chuông khi admin ẩn (`CONTENT_REVIEW_HIDDEN`), hiện lại (`CONTENT_REVIEW_UNHIDDEN`), xóa (`CONTENT_REVIEW_DELETED`) hoặc phản hồi (`CONTENT_REVIEW_REPLIED`). `data` gồm `reviewId`, `targetType`, `targetId` để mở đúng màn hình chi tiết. Xem `docs/notifications-api.md`.

## Khi mục nội dung bị xóa

Đền - Chùa - Miếu, Di tích, Nông nghiệp, Làng nghề, Ẩm thực, Lễ hội và Tour bị xóa cứng; đánh giá của mục bị xóa cùng transaction (kèm ảnh đánh giá không còn được dùng ở đâu khác), vì slug có thể được dùng lại cho mục mới. Đặc sản chỉ xóa mềm nên đánh giá được giữ lại; mini app không thấy chúng nữa, admin thấy với `target.deleted: true`.

## Ghi chú

- Mảng `reviews` có sẵn trong Ẩm thực (do admin nhập ở form Ẩm thực) là dữ liệu riêng và không thay đổi. `averageRating`/`reviewCount` trong response `/cuisine` vẫn tính từ mảng đó, không tính từ đánh giá của người dùng.
- Ràng buộc "mỗi người một đánh giá đang hoạt động cho mỗi mục" là partial unique index viết tay `content_review_active_unique` trong migration `20261021120000_content_reviews` (Prisma không biểu diễn được trong schema), giống `trade_review_active_unique`. Không regenerate migration này.

## Mã lỗi

| HTTP | `error.code`                      | Khi nào                                               |
| ---- | --------------------------------- | ----------------------------------------------------- |
| 400  | `VALIDATION_ERROR`                | Sai `rating`, `content`, `imageIds` hoặc query        |
| 400  | `INVALID_CONTENT_REVIEW_MEDIA`    | Ảnh không hợp lệ hoặc không thuộc người gọi           |
| 403  | `RESOURCE_NOT_OWNED`              | Sửa/xóa đánh giá của người khác                       |
| 404  | `CONTENT_REVIEW_TARGET_NOT_FOUND` | `targetType` không hỗ trợ, mục không tồn tại hoặc đang ẩn |
| 404  | `CONTENT_REVIEW_NOT_FOUND`        | Đánh giá không tồn tại hoặc đã xóa                    |
| 409  | `REVIEW_ALREADY_EXISTS`           | Đã đánh giá mục này                                   |
| 409  | `REVIEW_REPLY_NOT_ALLOWED`        | Phản hồi đánh giá đang ẩn                             |

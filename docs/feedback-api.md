# API Phản hồi

Module `feedback` gồm hai phần độc lập, dùng chung prefix `/api/v1` và response envelope chung của dự án.

- **Phần A — Kênh phản hồi** (`FeedbackChannel`): nội dung tĩnh do admin quản trị, CRUD giống các danh sách khác (Lễ hội, Tour trải nghiệm...).
- **Phần B — Ticket phản hồi** (`FeedbackTicket`): dữ liệu người dùng thật, phát sinh khi Mini App gửi phản hồi. Không có CRUD nội dung, chỉ có nộp mới (public) và cập nhật trạng thái xử lý (admin).

## Phần A — Kênh phản hồi

| Method | Endpoint                                                      | Quyền            | Mô tả                                                     |
| ------ | -------------------------------------------------------------- | ---------------- | ------------------------------------------------------------ |
| GET    | `/feedback/channels?category=Du lịch`                           | Public           | Chỉ kênh active, sắp xếp `sortOrder`, `createdAt`, `id`       |
| GET    | `/feedback/channels/:id`                                        | Public           | Chi tiết active, gồm `requiredInfo`, `description`, `examples`, `note` |
| GET    | `/admin/feedback/channels?page=1&limit=20&category=&search=`   | ADMIN, MODERATOR | Danh sách gồm cả kênh ẩn, tìm theo `title`                    |
| GET    | `/admin/feedback/channels/:id`                                  | ADMIN, MODERATOR | Chi tiết và `version` hiện tại                                |
| POST   | `/admin/feedback/channels`                                      | ADMIN, MODERATOR | Tạo mới, tự sinh slug nếu không gửi `id`                      |
| PUT    | `/admin/feedback/channels/:id`                                  | ADMIN, MODERATOR | Cập nhật toàn bộ với optimistic locking                       |
| PATCH  | `/admin/feedback/channels/:id/status`                           | ADMIN, MODERATOR | Ẩn/hiện với optimistic locking                                |
| PATCH  | `/admin/feedback/channels/reorder`                              | ADMIN, MODERATOR | Cập nhật thứ tự hàng loạt trong transaction                   |
| DELETE | `/admin/feedback/channels/:id`                                  | ADMIN, MODERATOR | Xóa kênh phản hồi                                              |

`category` chỉ nhận `Góp ý chung | Phản ánh hạ tầng | Dịch vụ công | Du lịch | Mini App` (enum Postgres). Public API không phân biệt kênh không tồn tại và đang ẩn: cả hai đều trả `404 FEEDBACK_CHANNEL_NOT_FOUND`. `GET /feedback/channels/:id` trả `ETag`/`Cache-Control` giống các module danh sách khác.

Khi `version` cũ, API trả `409 FEEDBACK_CHANNEL_VERSION_CONFLICT` kèm `error.details[0].latest`.

### Media (Phần A)

Giống các module trước: upload qua `POST /api/v1/media/images`, dùng `data.id` làm `mediaId`, media được claim thành resource `FEEDBACK_CHANNEL`. Seed hỗ trợ `FEEDBACK_CHANNEL_PLACEHOLDER_MEDIA_ID` tùy chọn; nếu không đặt, seed vẫn chạy với `mediaId = null`.

## Phần B — Ticket phản hồi

### Public

`POST /feedback/tickets` — không yêu cầu đăng nhập.

```json
{
  "channelId": "gop-y-chung",
  "fullName": "Nguyễn Văn A",
  "phone": "0900 123 456",
  "content": "Nội dung phản hồi của người dân."
}
```

- `channelId` tùy chọn; nếu gửi, phải tồn tại trong bảng `FeedbackChannel` (không cần đang `isActive`) — sai sẽ trả `400 VALIDATION_ERROR`.
- `fullName`: bắt buộc, trim, tối đa 150 ký tự.
- `phone`: bắt buộc, chỉ chữ số/khoảng trắng/dấu `+` ở đầu, tối đa 30 ký tự.
- `content`: bắt buộc, trim, tối thiểu 5 ký tự, tối đa 5.000 ký tự.

Response:

```json
{ "success": true, "ticketCode": "PH-A7K9QX" }
```

Không có `id` nội bộ hay trường quản trị nào khác trong response. `ticketCode` sinh ngẫu nhiên (6 ký tự từ bảng chữ cái 32 ký tự bỏ `0/O/1/I`, ~2^30 khả năng) — không dùng `Date.now()`, không đoán được tuần tự.

**Rate limit**: `@Throttle 5 request/phút theo IP` (khớp mức đang dùng cho các endpoint public nhạy cảm khác như `/auth/zalo`). Vượt giới hạn trả `429`. Vì bộ test e2e toàn dự án tắt `ThrottlerGuard` khi `NODE_ENV=test` (để cho phép nhiều lượt đăng nhập nhanh trong các fixture test khác — xem comment trong `app.module.ts`), rate limit của endpoint này được kiểm chứng bằng một Nest app cô lập trong `test/feedback-ticket-throttle.e2e-spec.ts` (chỉ mount `FeedbackTicketsController` phía sau `ThrottlerGuard` không bị tắt), thay vì qua `createTestApp()` dùng chung.

Không có public API nào để tra cứu danh sách/chi tiết ticket theo `ticketCode` hay bất kỳ tiêu chí nào khác — chỉ admin mới xem được.

### Admin

| Method | Endpoint                              | Quyền            | Mô tả                                                          |
| ------ | ---------------------------------------- | ---------------- | ------------------------------------------------------------------- |
| GET    | `/admin/feedback/tickets`                | ADMIN, MODERATOR | Phân trang, lọc `status`/`channelId`/`fromDate`/`toDate`, tìm theo `fullName`/`phone`/`ticketCode`, mặc định `createdAt` giảm dần |
| GET    | `/admin/feedback/tickets/:id`             | ADMIN, MODERATOR | Chi tiết một ticket (bao gồm `fullName`/`phone`/`content`)            |
| PATCH  | `/admin/feedback/tickets/:id/status`      | ADMIN, MODERATOR | Cập nhật `status`, có thể kèm `adminNote`                             |

Không có endpoint xóa hay sửa nội dung gốc của ticket — ticket phản ánh đúng những gì người dân đã gửi; chỉ `status`, `adminNote`, `handledBy` thay đổi được.

`status` là `new | in_progress | resolved | closed`. Luồng hợp lệ:

```
new -> in_progress -> resolved -> closed
new -> resolved (bỏ qua in_progress cho ticket xử lý nhanh)
new | in_progress -> closed (đóng trực tiếp không cần resolve)
```

`resolved`/`closed` không quay lại trạng thái trước (không cho reopen). Chuyển trạng thái không hợp lệ trả `409 INVALID_STATUS_TRANSITION` (dùng lại mã lỗi chung của dự án, giống `trade-post-status.service.ts`). Khi chuyển sang `resolved`, `resolvedAt` được set lần đầu tiên; `handledBy` luôn cập nhật theo admin thực hiện thao tác gần nhất.

## Migration và seed

```powershell
npx.cmd prisma migrate deploy
npm.cmd run db:seed
```

Seed idempotent tạo đúng 5 slug kênh hiện tại: `gop-y-chung`, `phan-anh-ha-tang`, `dich-vu-cong`, `du-lich-trai-nghiem`, `loi-mini-app`, giữ nguyên `requiredInfo`, `description`, `examples`, `note` từ Mini App. Bảng `FeedbackTicket` **không seed dữ liệu mẫu** — đây là dữ liệu người dùng thật phát sinh sau khi launch.

## Error codes

- `FEEDBACK_CHANNEL_NOT_FOUND` / `FEEDBACK_CHANNEL_SLUG_EXISTS` / `FEEDBACK_CHANNEL_VERSION_CONFLICT` / `INVALID_FEEDBACK_CHANNEL_MEDIA`: giống convention các module danh sách khác, áp dụng cho Phần A.
- `FEEDBACK_TICKET_NOT_FOUND`: không tìm thấy ticket khi admin xem chi tiết/cập nhật trạng thái.
- `INVALID_STATUS_TRANSITION`: chuyển trạng thái ticket không hợp lệ (mã lỗi dùng chung với `trade-post`).
- `VALIDATION_ERROR`: sai định dạng `fullName`/`phone`/`content`, `channelId` không tồn tại, hoặc cấu trúc request không hợp lệ.

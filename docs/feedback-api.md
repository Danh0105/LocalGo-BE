# API Phản hồi

Module `feedback` gồm hai phần độc lập, dùng chung prefix `/api/v1` và response envelope chung của dự án.

- **Phần A — Kênh phản hồi** (`FeedbackChannel`): nội dung tĩnh do admin quản trị, CRUD giống các danh sách khác (Lễ hội, Tour trải nghiệm...).
- **Phần B — Hộp thư phản hồi** (`FeedbackTicket`, `FeedbackMessage`): mỗi phản hồi là một kênh trao đổi hai chiều giữa người gửi và admin, hỗ trợ tin nhắn và ảnh.

## Phần A — Kênh phản hồi

| Method | Endpoint                                                     | Quyền            | Mô tả                                                                  |
| ------ | ------------------------------------------------------------ | ---------------- | ---------------------------------------------------------------------- |
| GET    | `/feedback/channels?category=Du lịch`                        | Public           | Chỉ kênh active, sắp xếp `sortOrder`, `createdAt`, `id`                |
| GET    | `/feedback/channels/:id`                                     | Public           | Chi tiết active, gồm `requiredInfo`, `description`, `examples`, `note` |
| GET    | `/admin/feedback/channels?page=1&limit=20&category=&search=` | ADMIN, MODERATOR | Danh sách gồm cả kênh ẩn, tìm theo `title`                             |
| GET    | `/admin/feedback/channels/:id`                               | ADMIN, MODERATOR | Chi tiết và `version` hiện tại                                         |
| POST   | `/admin/feedback/channels`                                   | ADMIN, MODERATOR | Tạo mới, tự sinh slug nếu không gửi `id`                               |
| PUT    | `/admin/feedback/channels/:id`                               | ADMIN, MODERATOR | Cập nhật toàn bộ với optimistic locking                                |
| PATCH  | `/admin/feedback/channels/:id/status`                        | ADMIN, MODERATOR | Ẩn/hiện với optimistic locking                                         |
| PATCH  | `/admin/feedback/channels/reorder`                           | ADMIN, MODERATOR | Cập nhật thứ tự hàng loạt trong transaction                            |
| DELETE | `/admin/feedback/channels/:id`                               | ADMIN, MODERATOR | Xóa kênh phản hồi                                                      |

`category` chỉ nhận `Góp ý chung | Phản ánh hạ tầng | Dịch vụ công | Du lịch | Mini App` (enum Postgres). Public API không phân biệt kênh không tồn tại và đang ẩn: cả hai đều trả `404 FEEDBACK_CHANNEL_NOT_FOUND`. `GET /feedback/channels/:id` trả `ETag`/`Cache-Control` giống các module danh sách khác.

Khi `version` cũ, API trả `409 FEEDBACK_CHANNEL_VERSION_CONFLICT` kèm `error.details[0].latest`.

### Media (Phần A)

Giống các module trước: upload qua `POST /api/v1/media/images`, dùng `data.id` làm `mediaId`, media được claim thành resource `FEEDBACK_CHANNEL`. Seed hỗ trợ `FEEDBACK_CHANNEL_PLACEHOLDER_MEDIA_ID` tùy chọn; nếu không đặt, seed vẫn chạy với `mediaId = null`.

## Phần B — Ticket phản hồi

### Tạo và xem hộp thư

`POST /feedback/tickets` — tạo phản hồi ẩn danh, không yêu cầu đăng nhập.

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

Nội dung và ảnh/video ban đầu được lưu đồng thời làm tin nhắn đầu tiên trong `messages`. Hai cách truy cập hộp thư:

| Method | Endpoint                                                         | Quyền     | Mô tả                                                 |
| ------ | ---------------------------------------------------------------- | --------- | ----------------------------------------------------- |
| GET    | `/feedback/tickets/lookup?ticketCode=PH-A7K9QX&phone=0900123456` | Public    | Xem một hộp thư ẩn danh bằng mã phiếu + số điện thoại |
| POST   | `/feedback/tickets/:ticketCode/messages`                         | Public    | Gửi tin nhắn ẩn danh; body phải có `phone` đúng       |
| GET    | `/feedback/tickets/me`                                           | Đăng nhập | Danh sách hộp thư do tài khoản hiện tại tạo           |
| POST   | `/feedback/tickets/me`                                           | Đăng nhập | Tạo phản hồi gắn với tài khoản hiện tại               |
| POST   | `/feedback/tickets/me/:ticketCode/messages`                      | Đăng nhập | Gửi tin nhắn vào hộp thư thuộc tài khoản hiện tại     |
| GET    | `/feedback/tickets/:id/messages`                                 | Đăng nhập | Lấy tin nhắn bằng ID nội bộ; kiểm tra chủ sở hữu      |
| POST   | `/feedback/tickets/:id/messages`                                 | Đăng nhập | Gửi tin nhắn bằng ID nội bộ; kiểm tra chủ sở hữu      |
| POST   | `/feedback/tickets/:id/realtime/read`                            | Đăng nhập | Đánh dấu đã đọc bằng ID nội bộ; kiểm tra chủ sở hữu   |

Sai `ticketCode`, sai số điện thoại hoặc truy cập phiếu của tài khoản khác đều trả cùng `404 FEEDBACK_TICKET_NOT_FOUND`, tránh làm lộ sự tồn tại/chủ sở hữu của phiếu.

`GET /feedback/tickets/lookup` và `GET /feedback/tickets/me` luôn trả trường
`id` không rỗng lấy trực tiếp từ `FeedbackTicket.id`. `ticketCode` chỉ dùng để
tra cứu và không thay thế cho ID nội bộ của các route hội thoại theo `:id`.

### Tin nhắn và ảnh

Body tin nhắn của tài khoản/admin:

```json
{
  "content": "Tôi xin bổ sung ảnh hiện trường.",
  "mediaIds": ["uuid-anh-da-upload"]
}
```

Tin nhắn ẩn danh thêm trường `phone`. Mỗi tin nhắn phải có `content` hoặc ít nhất một ảnh; `content` tối đa 2.000 ký tự, `mediaIds` tối đa 5 ảnh duy nhất. Tin nhắn mới không nhận video.

- Người gửi ẩn danh tải ảnh qua `POST /feedback/tickets/attachments`; endpoint này vẫn nhận ảnh/video vì phản hồi ban đầu hỗ trợ cả hai.
- Tài khoản và admin có thể tải ảnh qua `POST /media/images` hoặc dùng ảnh chưa được sử dụng từ endpoint attachment.
- Media được claim trong cùng transaction với tin nhắn; không thể dùng lại một ảnh hoặc dùng ảnh của tài khoản khác.

Các response chi tiết có thêm mảng `messages`, sắp xếp cũ đến mới:

```json
{
  "id": "message-id",
  "senderRole": "admin",
  "senderName": "Quản trị viên A",
  "content": "Đã tiếp nhận và chuyển đơn vị xử lý.",
  "attachments": [],
  "createdAt": "2026-10-20T05:00:00.000Z"
}
```

Tin nhắn là lịch sử bất biến, không có API sửa/xóa. Phiếu `closed` không nhận thêm tin nhắn và trả `409 FEEDBACK_CONVERSATION_CLOSED`; phiếu `resolved` vẫn cho phép trao đổi tiếp. Khi admin trả lời phiếu `new`, trạng thái tự chuyển sang `in_progress` và admin được ghi nhận vào `handledBy`.

### Admin

| Method | Endpoint                               | Quyền            | Mô tả                                                                                                                                     |
| ------ | -------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/admin/feedback/tickets`              | ADMIN, MODERATOR | Phân trang, lọc `status`/`channelId`/`fromDate`/`toDate`, tìm theo `fullName`/`phone`/`ticketCode`; hộp thư hoạt động mới nhất đứng trước |
| GET    | `/admin/feedback/tickets/:id`          | ADMIN, MODERATOR | Chi tiết một ticket (bao gồm `fullName`/`phone`/`content`)                                                                                |
| POST   | `/admin/feedback/tickets/:id/messages` | ADMIN, MODERATOR | Trả lời bằng nội dung và tối đa 5 ảnh                                                                                                     |
| PATCH  | `/admin/feedback/tickets/:id/status`   | ADMIN, MODERATOR | Cập nhật `status`, có thể kèm `adminNote`                                                                                                 |

Không có endpoint xóa hay sửa nội dung gốc của ticket — ticket phản ánh đúng những gì người dân đã gửi; chỉ `status`, `adminNote`, `handledBy` thay đổi được.

`status` là `new | in_progress | resolved | closed`. Luồng hợp lệ:

```
new -> in_progress -> resolved -> closed
new -> resolved (bỏ qua in_progress cho ticket xử lý nhanh)
new | in_progress -> closed (đóng trực tiếp không cần resolve)
```

`resolved`/`closed` không quay lại trạng thái trước (không cho reopen). Chuyển trạng thái không hợp lệ trả `409 INVALID_STATUS_TRANSITION` (dùng lại mã lỗi chung của dự án, giống `trade-post-status.service.ts`). Khi chuyển sang `resolved`, `resolvedAt` được set lần đầu tiên; `handledBy` luôn cập nhật theo admin thực hiện thao tác gần nhất. Mỗi lần admin trả lời đều có audit log `FEEDBACK_TICKET_REPLIED`.

## Migration và seed

```powershell
npx.cmd prisma migrate deploy
npm.cmd run db:seed
```

Seed idempotent tạo đúng 5 slug kênh hiện tại: `gop-y-chung`, `phan-anh-ha-tang`, `dich-vu-cong`, `du-lich-trai-nghiem`, `loi-mini-app`, giữ nguyên `requiredInfo`, `description`, `examples`, `note` từ Mini App. Bảng `FeedbackTicket` **không seed dữ liệu mẫu** — đây là dữ liệu người dùng thật phát sinh sau khi launch.

## Error codes

- `FEEDBACK_CHANNEL_NOT_FOUND` / `FEEDBACK_CHANNEL_SLUG_EXISTS` / `FEEDBACK_CHANNEL_VERSION_CONFLICT` / `INVALID_FEEDBACK_CHANNEL_MEDIA`: giống convention các module danh sách khác, áp dụng cho Phần A.
- `FEEDBACK_TICKET_NOT_FOUND`: không tìm thấy ticket khi admin xem chi tiết/cập nhật trạng thái.
- `INVALID_FEEDBACK_ATTACHMENT`: ảnh không tồn tại, đã dùng, không thuộc người gửi hoặc không phải định dạng ảnh.
- `FEEDBACK_CONVERSATION_CLOSED`: cố gửi tin nhắn vào hộp thư đã đóng.
- `INVALID_STATUS_TRANSITION`: chuyển trạng thái ticket không hợp lệ (mã lỗi dùng chung với `trade-post`).
- `VALIDATION_ERROR`: sai định dạng `fullName`/`phone`/`content`, `channelId` không tồn tại, hoặc cấu trúc request không hợp lệ.

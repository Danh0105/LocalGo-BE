# Notifications API (chuông thông báo mini app và Admin)

Thông báo được lưu bền (bảng `Notification`, mỗi người nhận một dòng) và đẩy realtime qua Socket.IO. Code nằm trong `src/modules/notifications/`.

## REST (Bearer, prefix `/api/v1`)

| Method | Endpoint                                  | Ghi chú                             |
| ------ | ----------------------------------------- | ----------------------------------- |
| GET    | `/notifications?page=&limit=&unreadOnly=` | Mới nhất trước, có `meta`           |
| GET    | `/notifications/unread-count`             | `{ unreadCount }`                   |
| GET    | `/notifications/:id`                      | Chi tiết thông báo thuộc tài khoản  |
| PATCH  | `/notifications/:id/read`                 | 204. Thông báo của người khác → 404 |
| PATCH  | `/notifications/read-all`                 | 204                                 |

Mini app và Admin dùng chung các endpoint trên; mỗi tài khoản chỉ đọc/đánh dấu đã đọc thông báo của chính mình.

Notification: `{ id, type, title, body, data, readAt, createdAt }`. `data` có thể chứa `applicationId`, `tradePostId`, `slug`, `tradePostSlug`, `tradePostTarget`, `tradePostAvailable`, `tradePostUnavailableReason`, `tradePostStatus`, `reviewId`, `targetType`, `targetId`, `conversationId`, `feedbackTicketId`, `feedbackMessageId`, `ticketCode`, `harvestBatchId`, `harvestCode`, `submittedById`, `reason`.

## Contract điều hướng tin giao thương

BE luôn đối chiếu `tradePostId` với database trước khi lưu/phát thông báo và khi trả danh sách/chi tiết thông báo. `tradePostSlug` là slug hiện tại lấy trực tiếp từ bản ghi; trường `slug` cũ vẫn được giữ để tương thích và luôn bằng `tradePostSlug`. Hai trường không được URL-encode trong payload.

| `tradePostTarget` | Cách Mini App/Admin xử lý                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_DETAIL`   | Chỉ mở `/trade/{encodeURIComponent(tradePostSlug)}` khi `tradePostAvailable=true`. API `GET /trade-posts/:slug` là public.                                                      |
| `OWNER_MANAGE`    | Mở màn quản lý/chỉnh sửa của chủ tin bằng `tradePostId`; dùng cho tin chờ xử lý, bị từ chối, bị ẩn và các thông báo nghiệp vụ của chủ tin. Màn hình phải kiểm tra quyền sở hữu. |
| `ADMIN_MANAGE`    | Mở màn quản trị bằng `tradePostId`; dùng cho tin/đánh giá được gửi duyệt.                                                                                                       |

Khi `tradePostAvailable=false`, client vô hiệu hóa liên kết và hiển thị “Tin đăng không còn tồn tại hoặc đã được gỡ.” `tradePostUnavailableReason` có một trong các giá trị:

- `NOT_FOUND`: không còn bản ghi tương ứng với `tradePostId`; BE không trả slug giả.
- `DELETED`: bản ghi đã bị xóa mềm.
- `NOT_PUBLIC`: đích public chưa xuất bản, bị ẩn/lưu trữ, hết hạn hoặc danh mục không hoạt động.

Ví dụ payload cũ (giá trị minh họa, không chứa thông tin nhạy cảm):

```json
{
  "tradePostId": "<trade-post-id>",
  "slug": "<slug-cu-hoac-khong-chinh-xac>"
}
```

Payload sau khi resolve:

```json
{
  "tradePostId": "<trade-post-id>",
  "slug": "<slug-hien-tai-trong-database>",
  "tradePostSlug": "<slug-hien-tai-trong-database>",
  "tradePostTarget": "PUBLIC_DETAIL",
  "tradePostAvailable": true,
  "tradePostStatus": "PUBLISHED"
}
```

Thông báo cũ cũng được resolve theo `tradePostId` khi đọc và payload đã sửa được backfill best-effort vào database. Nếu slug đã đổi, thông báo trả slug mới. Nếu tin đã xóa hoặc không còn public, payload vẫn giữ đúng ID hiện có nhưng đánh dấu không khả dụng; không chuyển sang tin khác.

## Socket.IO

- URL: `https://api.localgo.skilltripx.com.vn/notifications`. Path mặc định `/socket.io`; nginx đã chuyển tiếp header Upgrade.
- Xác thực: `io(url, { auth: { token: <accessToken> }, transports: ['websocket'] })`. Ngoài ra chấp nhận header `Authorization: Bearer` hoặc `?token=`.
  - Token sai, hết hạn hoặc tài khoản bị khóa → `connect_error` với message `UNAUTHORIZED`.
  - Token chỉ được kiểm tra lúc bắt tay. Khi kết nối lại, client phải gửi token mới.
- Mỗi socket vào phòng `user:<id>`, nên mọi thiết bị của người dùng đều nhận sự kiện.

| Sự kiện (server → client)   | Payload                                    | Khi nào                                                                   |
| --------------------------- | ------------------------------------------ | ------------------------------------------------------------------------- |
| `notification.unread_count` | `{ unreadCount }`                          | Ngay sau khi kết nối; sau `read` / `read-all` (đồng bộ giữa các thiết bị) |
| `notification.new`          | `{ notification, unreadCount }`            | Có thông báo mới trên chuông                                              |
| `chat.message`              | `{ conversationId, tradePostId, message }` | Đối phương gửi tin nhắn. Chỉ là sự kiện socket, không vào chuông          |

Hạ tầng: pm2 chạy 1 tiến trình (fork) nên phòng nằm trong bộ nhớ. Nếu chạy cluster, cần socket.io Redis adapter. CORS cho kiểu polling dùng chung `CORS_ORIGINS` qua `CorsIoAdapter` (`src/common/adapters/cors-io.adapter.ts`).

## Các loại thông báo

| `type`                                                                         | Người nhận                                    | Phát sinh khi                                                                                                                                             |
| ------------------------------------------------------------------------------ | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BUSINESS_APPLICATION_SUBMITTED`                                               | mọi ADMIN/MODERATOR đang hoạt động            | Người dùng hoặc khách gửi/gửi lại hồ sơ Business (`data.applicationId`)                                                                                   |
| `BUSINESS_APPLICATION_APPROVED`                                                | tài khoản được duyệt/tạo                      | Admin duyệt hồ sơ                                                                                                                                         |
| `BUSINESS_APPLICATION_REJECTED`                                                | người nộp qua Zalo                            | Admin từ chối hồ sơ (`data.reason`)                                                                                                                       |
| `TRADE_POST_SUBMITTED`                                                         | mọi ADMIN/MODERATOR đang hoạt động            | Chủ tin gửi tin để duyệt hoặc sửa tin đã xuất bản khiến tin chờ duyệt lại                                                                                 |
| `TRADE_POST_NEW`                                                               | mọi USER/BUSINESS đang hoạt động, trừ chủ tin | Tin được duyệt **lần đầu** (duyệt lại sau khi sửa không gửi)                                                                                              |
| `TRADE_POST_APPROVED`                                                          | chủ tin                                       | Admin duyệt tin                                                                                                                                           |
| `TRADE_POST_REJECTED`                                                          | chủ tin                                       | Admin từ chối (`data.reason`)                                                                                                                             |
| `TRADE_POST_HIDDEN` / `TRADE_POST_UNHIDDEN`                                    | chủ tin                                       | Admin ẩn / hiện lại                                                                                                                                       |
| `TRADE_POST_ARCHIVED`                                                          | chủ tin                                       | Admin lưu trữ                                                                                                                                             |
| `TRADE_POST_DELETED`                                                           | chủ tin                                       | Admin xóa                                                                                                                                                 |
| `TRADE_POST_FEATURED`                                                          | chủ tin                                       | Admin bật nổi bật (chỉ khi đổi từ tắt sang bật)                                                                                                           |
| `TRADE_POST_SAVED`                                                             | chủ tin                                       | Người khác lưu tin (lần đầu)                                                                                                                              |
| `TRADE_REVIEW_RECEIVED`                                                        | chủ tin                                       | Có khách đánh giá tin (đánh giá hiển thị ngay, không cần duyệt)                                                                                           |
| `TRADE_REVIEW_SUBMITTED`                                                       | mọi ADMIN/MODERATOR đang hoạt động            | Người dùng gửi đánh giá giao thương mới                                                                                                                   |
| `TRADE_REVIEW_APPROVED` / `TRADE_REVIEW_HIDDEN` / `TRADE_REVIEW_DELETED`       | người đánh giá                                | Admin hiển thị lại / ẩn / xóa đánh giá                                                                                                                    |
| `TRADE_REVIEW_REPLIED`                                                         | người đánh giá                                | Chủ tin phản hồi                                                                                                                                          |
| `CONTENT_REVIEW_SUBMITTED`                                                     | mọi ADMIN/MODERATOR đang hoạt động            | Người dùng gửi bình luận đánh giá mới ở một mục nội dung                                                                                                  |
| `CONTENT_REVIEW_HIDDEN` / `CONTENT_REVIEW_UNHIDDEN` / `CONTENT_REVIEW_DELETED` | người đánh giá                                | Admin ẩn / hiện lại / xóa bình luận đánh giá ở các mục nội dung (`data.reviewId`, `data.targetType`, `data.targetId`) — xem `docs/content-reviews-api.md` |
| `CONTENT_REVIEW_REPLIED`                                                       | người đánh giá                                | Ban quản lý phản hồi bình luận đánh giá (cùng `data` như trên)                                                                                            |
| `TRADE_CONVERSATION_STARTED`                                                   | chủ tin                                       | Khách mở hội thoại mới (tin nhắn sau đó chỉ có `chat.message`)                                                                                            |
| `HARVEST_BATCH_SUBMITTED`                                                      | mọi ADMIN/MODERATOR đang hoạt động            | Chủ vườn khai báo lô hàng mới (`data.harvestBatchId`, `data.harvestCode`)                                                                                 |
| `FEEDBACK_MESSAGE_RECEIVED`                                                    | người gửi phản hồi hoặc nhân sự xử lý         | Có tin nhắn mới trong Hộp thư phản hồi (`data.feedbackTicketId`, `data.feedbackMessageId`, `data.ticketCode`)                                             |

Với Hộp thư phản hồi, phản hồi mới/tin nhắn của người dân được gửi tới
`ADMIN`/`MODERATOR` đang hoạt động. Sau khi ticket đã có người xử lý, tin nhắn
tiếp theo chỉ thông báo cho người xử lý đó. Câu trả lời của quản trị viên được
gửi tới tài khoản đã tạo ticket. Ticket ẩn danh không có tài khoản nhận chuông,
nhưng vẫn nhận sự kiện realtime khi đang kết nối vào phòng hội thoại.

Các thao tác tạo nội dung cần Admin theo dõi gồm: gửi/gửi lại hồ sơ Business, gửi tin giao thương để duyệt, đánh giá giao thương, đánh giá nội dung, khai báo lô hàng và gửi phản hồi/tin nhắn phản hồi. Tin nhắn giao thương, lưu tin, tương tác thống kê, tải tệp tạm và cập nhật hồ sơ cá nhân không phát chuông Admin.

Thêm loại mới: khai báo trong `notification-types.ts` rồi gọi `NotificationService.notify(...)`, `notifyStaff(...)` hoặc `notifyAllUsers(...)` **sau khi** thao tác chính thành công. Các hàm thông báo không làm hỏng thao tác nghiệp vụ; lỗi chỉ được ghi log.

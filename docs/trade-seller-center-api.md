# Trade seller center API

Quản lý tin giao thương cho người đăng (mô hình Seller Center): tin của tôi, thống kê, phản hồi đánh giá, chat với khách. Mọi endpoint có prefix `/api/v1`, dùng Bearer token và response envelope chuẩn (`{ success, data, meta? }`).

## Quyền truy cập

- Endpoint quản lý chỉ cho tài khoản **role `BUSINESS`, status `ACTIVE`** (`SellerAccessGuard`, `src/modules/trade/common/seller-access.guard.ts`).
  - Role khác → 403 `BUSINESS_PROFILE_REQUIRED`.
  - Status `PENDING` → 403 `ACCOUNT_NOT_ACTIVE`.
  - Tài khoản `BLOCKED` bị JWT từ chối (401).
- Các route ghi "+ staff" cho phép thêm `ADMIN`/`MODERATOR`; handler vẫn kiểm tra quyền sở hữu tài nguyên.

| Method | Endpoint                               | Quyền            | Ghi chú                                                                                                                                                                                                                      |
| ------ | -------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/trade-posts`                         | seller           | Tạo bản nháp                                                                                                                                                                                                                 |
| GET    | `/trade-posts/me`                      | seller           | `page, limit, status, category, search, purpose, sortBy, sortOrder`. `newest` sắp theo ngày tạo. `sortOrder` đảo chiều `newest/rating/popular`; `price_asc/price_desc` giữ chiều của mình                                    |
| GET    | `/trade-posts/:id/manage`              | seller + staff   | Chi tiết mọi trạng thái, không tăng lượt xem                                                                                                                                                                                 |
| PATCH  | `/trade-posts/:id`                     | seller + staff   | `null` xóa `price, priceLabel, contactZalo, promotionPercent, promotionStartAt, promotionEndAt, expiresAt, eventStartAt, eventEndAt`. Sửa nội dung quan trọng của tin PUBLISHED → PENDING. `status`/`featured` bị chặn (400) |
| PATCH  | `/trade-posts/:id/submit`              | seller (chủ tin) | DRAFT/REJECTED → PENDING                                                                                                                                                                                                     |
| DELETE | `/trade-posts/:id`                     | seller + staff   | Xóa mềm, 204                                                                                                                                                                                                                 |
| GET    | `/trade-posts/me/analytics?from=&to=`  | seller           | Tổng quan (range, postCount, totals, reviews, topPosts, timeseries)                                                                                                                                                          |
| GET    | `/trade-posts/:id/analytics?from=&to=` | seller + staff   | Thống kê một tin                                                                                                                                                                                                             |
| POST   | `/trade-posts/:idOrSlug/interactions`  | công khai        | `{ "type": "CONTACT_PHONE" \| "CONTACT_ZALO" \| "SHARE" }`. VIEW ghi khi mở chi tiết, SAVE từ chức năng lưu tin                                                                                                              |

## Field tạo/cập nhật tin

Các field **bắt buộc** khi gọi `POST /trade-posts` được đánh dấu rõ trong
Swagger bằng `required: true` và tiền tố `BẮT BUỘC`:

| Field           | Yêu cầu                                                                          |
| --------------- | -------------------------------------------------------------------------------- |
| `category`      | **Bắt buộc** — mã từ `GET /trade-post-categories`                                |
| `title`         | **Bắt buộc** — 1–200 ký tự sau khi trim                                          |
| `summary`       | **Bắt buộc** — 1–500 ký tự sau khi trim                                          |
| `description`   | **Bắt buộc** — 1–5000 ký tự sau khi trim                                         |
| `address`       | **Bắt buộc** — 1–300 ký tự sau khi trim                                          |
| `contactName`   | **Bắt buộc** — 1–120 ký tự sau khi trim                                          |
| `contactPhone`  | **Bắt buộc** — số điện thoại Việt Nam hợp lệ                                     |
| `priceType`     | **Bắt buộc có điều kiện** khi `purpose = COMMERCIAL`; không gửi cho `NON_PROFIT` |
| `googleMapsUrl` | Tùy chọn — link Google Maps HTTPS hợp lệ, tối đa 2048 ký tự                      |

`googleMapsUrl` nhận các dạng `https://www.google.com/maps/...`,
`https://maps.google.com/...`, `https://maps.app.goo.gl/...` hoặc
`https://goo.gl/maps/...`. `PATCH /trade-posts/:id` nhận `null` để xóa link.
Field này có trong mọi response danh sách/chi tiết/quản lý tin với kiểu
`string | null`.

## Phản hồi đánh giá của người bán

`TradeReview.replyContent` (VARCHAR 500) và `TradeReview.repliedAt`. Nội dung đánh giá của khách không bao giờ bị sửa.

| Method | Endpoint                                 | Ghi chú                                                                                               |
| ------ | ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| GET    | `/trade-management/reviews?page=&limit=` | Đánh giá **PUBLISHED** trên các tin (chưa xóa) của tôi, mới nhất trước, kèm `reviewer` và `tradePost` |
| PUT    | `/trade-management/reviews/:id/reply`    | `{ "content": "..." }`, trim rồi kiểm tra 1–500 ký tự. Gọi lại để sửa. Trả review                     |
| DELETE | `/trade-management/reviews/:id/reply`    | Xóa phản hồi chủ tin và trả review đã cập nhật, gồm cả `customerReplies` cũ                           |

- Chỉ chủ tin được phản hồi/xóa: người khác → 403 `REVIEW_REPLY_NOT_ALLOWED`.
- Đánh giá đã bị admin ẩn hoặc đã xóa → 404.

Shape công khai của review (`GET /trade-posts/:tradePostId/reviews` và các response review khác):

```json
{
  "id": "uuid",
  "tradePostId": "uuid",
  "userId": "uuid",
  "rating": 5,
  "content": "...",
  "status": "PUBLISHED",
  "replyContent": "...",
  "repliedAt": "ISO_DATE",
  "createdAt": "ISO_DATE",
  "updatedAt": "ISO_DATE",
  "images": [],
  "customerReplies": [],
  "reviewer": { "id": "uuid", "displayName": "...", "avatarUrl": null },
  "tradePost": { "id": "uuid", "title": "...", "slug": "..." }
}
```

Không trả `ownerId` hay email/SĐT người đánh giá. Admin (`/admin/reviews`) vẫn có thêm `user` và `tradePost` đầy đủ.

## Khách hàng trả lời phản hồi chủ tin

`POST /trade-posts/:tradePostId/reviews/:reviewId/replies` yêu cầu Bearer token,
throttle 10 lần/phút và body `{ "content": "..." }`. Nội dung được trim, dài
1–500 ký tự. Backend luôn lấy tác giả từ access token; field thừa như `userId`
bị validation từ chối.

Chỉ tạo được khi tin còn công khai, review `PUBLISHED` thuộc đúng tin và
`replyContent` của chủ tin còn tồn tại. Chủ tin nhận 403, thiếu phản hồi chủ tin
nhận 409. Người dùng khác tác giả review vẫn được trả lời. Các câu trả lời được
trả theo `createdAt ASC, id ASC` trong `customerReplies` của public review,
seller review và mọi response thêm/sửa/xóa phản hồi chủ tin:

```json
{
  "id": "reply-id",
  "reviewId": "review-id",
  "userId": "customer-id",
  "content": "Cảm ơn chủ tin, mình đã nhận được hỗ trợ.",
  "createdAt": "2026-10-21T03:00:00.000Z",
  "author": {
    "id": "customer-id",
    "displayName": "Khách hàng",
    "avatarUrl": null
  }
}
```

Nếu tài khoản tác giả bị xóa cứng, lịch sử vẫn còn với `userId: null` và
`author: null`. Xóa phản hồi chủ tin không xóa lịch sử nhưng chặn tin nhắn mới
cho tới khi chủ tin phản hồi lại. Customer reply không tác động `reviewCount`
hoặc `averageRating`.

## Chat khách ↔ người đăng

- Model `TradeConversation`: một hội thoại cho mỗi cặp (tin, khách), `ownerId` lưu sẵn từ tin.
- Model `TradeMessage`: nội dung VARCHAR 1000.
- Xóa cứng tin, hội thoại hoặc user sẽ xóa theo (cascade).

| Method | Endpoint                                         | Ghi chú                                                                                                                                                     |
| ------ | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/trade-conversations`                           | `{ "tradePostId", "message" }` → 201, trả conversation. Tạo mới hoặc dùng lại hội thoại, thêm tin nhắn đầu, cập nhật `lastMessageAt` trong cùng transaction |
| GET    | `/trade-conversations?page=&limit=`              | Hội thoại tôi là khách hoặc chủ tin, `lastMessageAt` giảm dần, có `meta`                                                                                    |
| GET    | `/trade-conversations/:id/messages?page=&limit=` | **Trang 1 là các tin mới nhất**, trang sau cũ hơn. Trong mỗi trang tin sắp theo thời gian tăng dần                                                          |
| POST   | `/trade-conversations/:id/messages`              | `{ "content" }`, trim, 1–1000 ký tự → 201, trả message                                                                                                      |
| PATCH  | `/trade-conversations/:id/read`                  | 204. Đánh dấu đã đọc các tin của **đối phương**, không đụng tin của người gọi                                                                               |

Quy tắc:

- Chỉ nhắn được tin **PUBLISHED và đang hiển thị công khai** (chưa hết hạn, danh mục hoạt động), nếu không trả 404.
- Chủ tin tự nhắn cho tin của mình → 403 `CANNOT_MESSAGE_OWN_POST`.
- Người ngoài hội thoại nhận 404, để không dò được id.
- Throttle: mở hội thoại 30/phút, gửi tin 60/phút.

Conversation:

```json
{
  "id": "uuid",
  "customerId": "uuid",
  "ownerId": "uuid",
  "tradePost": {
    "id": "uuid",
    "title": "...",
    "slug": "...",
    "thumbnailUrl": null,
    "status": "PUBLISHED"
  },
  "counterpart": { "id": "uuid", "displayName": "...", "avatarUrl": null },
  "lastMessage": {
    "id": "uuid",
    "conversationId": "uuid",
    "senderId": "uuid",
    "content": "...",
    "readAt": null,
    "createdAt": "ISO_DATE"
  },
  "unreadCount": 1,
  "lastMessageAt": "ISO_DATE",
  "createdAt": "ISO_DATE",
  "updatedAt": "ISO_DATE"
}
```

`counterpart` là phía bên kia so với người gọi. `unreadCount` đếm tin của đối phương chưa đọc.

## Migration

`prisma/migrations/20261019062041_trade_review_replies_and_conversations`: thêm `TradeReview.replyContent`, `TradeReview.repliedAt`, bảng `TradeConversation` (unique `tradePostId+customerId`, index `ownerId+lastMessageAt`, `customerId+lastMessageAt`) và `TradeMessage` (index `conversationId+createdAt`, `conversationId+senderId+readAt`), cùng foreign key cascade. Migration chỉ thêm cột/bảng, code cũ vẫn chạy được với schema mới.

`prisma/migrations/20261021170000_trade_review_customer_replies`: thêm bảng
`TradeReviewCustomerReply`, FK cascade theo review, FK `SET NULL` theo tác giả
và index `(reviewId, createdAt, id)` phục vụ tải replies theo lô/thứ tự ổn định.

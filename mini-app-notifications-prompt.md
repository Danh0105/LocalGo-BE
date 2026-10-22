Cập nhật Zalo Mini App LocalGo: chuông thông báo realtime (Socket.IO) cho hồ sơ đăng ký, tin giao thương mới, và mọi thao tác của khách hàng, người đăng tin, admin liên quan đến tin giao thương.

## Thông tin chung

- Base URL REST: `https://api.localgo.skilltripx.com.vn/api/v1`. Response: `{ success, data, meta? }`; lỗi: `{ success: false, error: { code, message } }`.
- Socket: `https://api.localgo.skilltripx.com.vn/notifications` (namespace `/notifications`, path mặc định `/socket.io`).
- Dùng **socket.io-client v4** (server là Socket.IO 4.8).
- **Cấu hình Zalo Mini App:** thêm `api.localgo.skilltripx.com.vn` (giao thức `wss://`) vào danh sách tên miền được phép kết nối trong trang quản lý mini app. Không có bước này thì socket không kết nối được.

## 1. Kết nối socket

```ts
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function connectNotifications(getAccessToken: () => string | null) {
  socket?.disconnect();
  socket = io('https://api.localgo.skilltripx.com.vn/notifications', {
    transports: ['websocket'],
    // Dùng hàm để mỗi lần reconnect đều lấy access token mới nhất.
    auth: (cb) => cb({ token: getAccessToken() }),
    reconnection: true,
    reconnectionDelay: 2000,
  });

  socket.on('notification.unread_count', ({ unreadCount }) =>
    setBadge(unreadCount),
  );
  socket.on('notification.new', ({ notification, unreadCount }) => {
    setBadge(unreadCount);
    prependToBellList(notification);
    showToast(notification.title, notification.body); // bấm toast → openNotification(notification)
  });
  socket.on('chat.message', ({ conversationId, message }) => {
    // Đang mở đúng hội thoại thì nối tin nhắn vào màn chat và gọi PATCH /trade-conversations/:id/read;
    // nếu không thì tăng unreadCount của hội thoại đó trong danh sách tin nhắn.
  });
  socket.on('connect_error', async (err) => {
    if (err.message === 'UNAUTHORIZED') {
      // Access token hết hạn: gọi POST /auth/refresh như luồng REST hiện có, rồi socket.connect().
    }
  });
}

export function disconnectNotifications() {
  socket?.disconnect();
  socket = null;
}
```

- Gọi `connectNotifications` sau khi đăng nhập Zalo thành công (đã có access token) và khi app mở lại từ nền.
- Gọi `disconnectNotifications` khi đăng xuất.
- Chỉ người dùng đã đăng nhập mới có chuông. Khách chưa đăng nhập không kết nối socket.
- Ngay sau khi kết nối, server gửi `notification.unread_count` để cập nhật badge.

## 2. Chuông thông báo (REST)

| Việc                                            | API                                                                                                      |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Badge khi mở app (dự phòng nếu socket chưa nối) | `GET /notifications/unread-count` → `{ unreadCount }`                                                    |
| Danh sách                                       | `GET /notifications?page=1&limit=20` (thêm `&unreadOnly=true` cho tab "Chưa đọc"), có `meta` để tải thêm |
| Bấm một thông báo                               | `PATCH /notifications/:id/read` (204), rồi mở màn hình tương ứng                                         |
| "Đánh dấu đã đọc tất cả"                        | `PATCH /notifications/read-all` (204)                                                                    |

Sau khi gọi `read` / `read-all`, server tự gửi `notification.unread_count` mới tới mọi thiết bị của người dùng, nên không cần tự trừ badge.

Mỗi thông báo có dạng:

```json
{
  "id": "uuid",
  "type": "TRADE_POST_APPROVED",
  "title": "Tin đã được duyệt",
  "body": "Tin \"Bưởi da xanh\" đã được duyệt và hiển thị công khai.",
  "data": { "tradePostId": "uuid", "slug": "buoi-da-xanh" },
  "readAt": null,
  "createdAt": "2026-10-19T08:00:00.000Z"
}
```

**Giao diện:**

- Icon chuông ở header có badge đỏ hiện `unreadCount`, quá 99 thì hiện "99+".
- Danh sách sắp mới nhất trước. Thông báo chưa đọc in đậm, có chấm xanh. Mỗi dòng hiện thời gian tương đối ("5 phút trước").
- Kéo để làm mới; cuộn xuống để tải trang tiếp.

## 3. Bấm thông báo mở màn hình nào

| `type`                                                              | Mở                                                                                                      |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `BUSINESS_APPLICATION_APPROVED`                                     | Màn "Đăng tin giao thương", gọi lại `GET /auth/me` để cập nhật role/businessType                        |
| `BUSINESS_APPLICATION_REJECTED`                                     | Màn hồ sơ đăng ký, hiện `data.reason`, cho sửa và gửi lại                                               |
| `TRADE_POST_NEW`                                                    | Chi tiết tin công khai (`data.slug` hoặc `data.tradePostId`)                                            |
| `TRADE_POST_APPROVED`, `TRADE_POST_FEATURED`, `TRADE_POST_UNHIDDEN` | Chi tiết tin của tôi                                                                                    |
| `TRADE_POST_REJECTED`                                               | Màn sửa tin của tôi, hiện `data.reason`                                                                 |
| `TRADE_POST_HIDDEN`, `TRADE_POST_ARCHIVED`, `TRADE_POST_DELETED`    | "Tin của tôi" (tin không còn công khai; tin đã xóa thì chỉ hiện thông báo)                              |
| `TRADE_POST_SAVED`                                                  | Thống kê / chi tiết tin của tôi                                                                         |
| `TRADE_REVIEW_RECEIVED`                                             | Màn quản lý đánh giá (`/trade-management/reviews`), cuộn tới `data.reviewId`                            |
| `TRADE_REVIEW_APPROVED`, `TRADE_REVIEW_REPLIED`                     | Chi tiết tin công khai, phần đánh giá, cuộn tới `data.reviewId`                                         |
| `TRADE_REVIEW_HIDDEN`, `TRADE_REVIEW_DELETED`                       | Chỉ đánh dấu đã đọc (đánh giá không còn hiển thị)                                                       |
| `TRADE_CONVERSATION_STARTED`                                        | Màn chat `data.conversationId`                                                                          |
| `FEEDBACK_MESSAGE_RECEIVED`                                         | Màn **Hộp thư phản hồi**, mở ticket `data.feedbackTicketId` và cuộn tới `data.feedbackMessageId` nếu có |
| Loại chưa biết                                                      | Chỉ đánh dấu đã đọc, không điều hướng (để app không lỗi khi backend thêm loại mới)                      |

Lưu ý: "Tin giao thương mới" (`TRADE_POST_NEW`) được gửi tới mọi người dùng mỗi khi một tin được duyệt lần đầu. Tin nhắn chat sau tin đầu tiên **không** vào chuông; chúng đến qua `chat.message` và hiển thị bằng `unreadCount` của từng hội thoại.

## Kiểm tra

- [ ] Đăng nhập → socket kết nối, badge đúng với `GET /notifications/unread-count`.
- [ ] Admin duyệt hồ sơ đăng ký của tài khoản đang mở app → toast hiện ngay, badge +1. Bấm vào thì mở màn đăng tin, và role đã là BUSINESS.
- [ ] Admin duyệt một tin → chủ tin nhận "Tin đã được duyệt"; tài khoản khác đang mở app nhận "Tin giao thương mới".
- [ ] Khách gửi tin nhắn đầu tiên → chủ tin nhận thông báo "Tin nhắn mới từ khách hàng". Các tin sau hiện ngay trong màn chat, không thêm thông báo vào chuông.
- [ ] Admin trả lời ticket có tài khoản → người gửi nhận `FEEDBACK_MESSAGE_RECEIVED`, bấm vào mở đúng hội thoại bằng `data.feedbackTicketId`.
- [ ] Mở app trên 2 thiết bị, đọc thông báo trên một máy → badge máy kia cập nhật theo.
- [ ] Để access token hết hạn rồi tắt/bật mạng → socket tự refresh token và kết nối lại.
- [ ] Đăng xuất → socket ngắt, không còn nhận thông báo của tài khoản cũ.

Bổ sung màn hình/mục "Lịch sử phản hồi của tôi" trong Zalo Mini App — hiện tại mục này chưa hiển thị dù backend đã có API.

## Hiện trạng
Backend đã có sẵn API trả về danh sách phản hồi của người dùng đang đăng nhập, nhưng Mini App chưa gọi/hiển thị nó ở đâu cả. Cần thêm màn hình hoặc mục trong màn "Gửi phản hồi" (ví dụ nút "Lịch sử phản hồi của tôi" hoặc tab riêng) để người dùng xem lại các phản hồi mình đã gửi.

## API sử dụng

**Lấy danh sách phản hồi của người dùng đang đăng nhập:**
```
GET /api/v1/feedback/tickets/me
Authorization: Bearer <accessToken>
```
- Bắt buộc phải có token đăng nhập Zalo hợp lệ (không phải API ẩn danh).
- Chỉ trả về các phản hồi được gửi qua **API có đăng nhập** (`POST /feedback/tickets/me`), xem mục "Lưu ý quan trọng" bên dưới.
- Response 200:
```json
{
  "success": true,
  "data": [
    {
      "ticketCode": "PH-A7K9QX",
      "status": "new",
      "channel": { "id": "...", "title": "...", "category": "..." },
      "content": "Nội dung phản hồi...",
      "attachments": [
        { "id": "...", "url": "...", "thumbnailUrl": "...|null", "mimeType": "image/webp", "size": 12345 }
      ],
      "createdAt": "2026-09-14T10:00:00.000Z",
      "updatedAt": "2026-09-14T10:00:00.000Z",
      "resolvedAt": null
    }
  ]
}
```
- `status` là một trong: `new`, `in_progress`, `resolved`, `closed` — map sang nhãn tiếng Việt để hiển thị (Mới / Đang xử lý / Đã giải quyết / Đã đóng).
- Mảng rỗng nếu người dùng chưa từng gửi phản hồi nào khi đã đăng nhập — hiển thị trạng thái rỗng phù hợp (ví dụ: "Bạn chưa gửi phản hồi nào").
- Danh sách đã được sắp xếp mới nhất trước, không cần sort lại phía client.

## ⚠️ Lưu ý quan trọng — phải sửa cả bước gửi phản hồi
Để phản hồi của người dùng xuất hiện trong lịch sử này, lúc **gửi** phản hồi (form "Gửi phản hồi") bắt buộc phải gọi đúng endpoint có gắn tài khoản đăng nhập:

```
POST /api/v1/feedback/tickets/me
Authorization: Bearer <accessToken>
```
(không phải `POST /api/v1/feedback/tickets` — endpoint đó gửi ẩn danh, không gắn với tài khoản, sẽ **không** hiện trong danh sách `GET /feedback/tickets/me`)

Payload gửi giống hệt như trước (channelId, fullName, phone, content, mediaIds) — chỉ khác đường dẫn và cần đính kèm token.

Nếu Mini App có luồng cho người dùng **chưa đăng nhập** vẫn gửi được phản hồi (ẩn danh), giữ nguyên `POST /feedback/tickets` cho luồng đó — nhưng phản hồi ẩn danh sẽ không bao giờ hiện trong "Lịch sử phản hồi của tôi", người dùng vẫn tra cứu được bằng mã ticket + số điện thoại qua:
```
GET /api/v1/feedback/tickets/lookup?ticketCode=PH-XXXXXX&phone=0900123456
```

## Yêu cầu UI
1. Thêm mục/nút "Lịch sử phản hồi của tôi" (chỉ hiện khi người dùng đã đăng nhập — nếu Mini App phân biệt trạng thái đăng nhập).
2. Màn hình danh sách: mỗi dòng hiển thị mã ticket, trạng thái (kèm màu/badge tương ứng), nội dung rút gọn, ngày gửi, icon nếu có đính kèm ảnh/video.
3. Bấm vào một dòng → xem chi tiết: nội dung đầy đủ, danh sách ảnh/video đính kèm (ảnh hiện thumbnail, video hiện icon play + có thể mở link `url` để xem), trạng thái, ngày cập nhật/giải quyết nếu có.
4. Trạng thái rỗng khi chưa có phản hồi nào.
5. Xử lý lỗi 401 (token hết hạn) bằng luồng đăng nhập lại hiện có của app.

## Việc cần làm
1. Đổi endpoint gửi phản hồi từ `POST /feedback/tickets` sang `POST /feedback/tickets/me` (kèm token) cho luồng người dùng đã đăng nhập, để phản hồi được gắn với tài khoản.
2. Thêm màn hình/API call tới `GET /feedback/tickets/me` để hiển thị lịch sử.
3. Thêm UI danh sách + chi tiết như mô tả.
4. Test: đăng nhập, gửi 1 phản hồi mới (có hoặc không kèm ảnh/video) → vào mục lịch sử phải thấy ngay phản hồi vừa gửi với đúng trạng thái "Mới" và đúng ảnh/video đã đính kèm.
5. Test: đăng xuất/tài khoản khác → không thấy phản hồi của tài khoản kia.

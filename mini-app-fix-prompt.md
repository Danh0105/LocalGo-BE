Sửa lỗi gọi API gửi phản hồi trong màn hình "Gửi phản hồi" (Lắng nghe người dân) của Zalo Mini App.

## Lỗi hiện tại
Khi bấm nút "Gửi phản hồi", app hiện lỗi:
```
Cannot POST /api/v1/feedback/tickets/me
```

## Nguyên nhân
Frontend đang gọi sai endpoint: `POST /api/v1/feedback/tickets/me`.
Endpoint đúng của backend là: `POST /api/v1/feedback/tickets` (không có `/me`).

Đây là API công khai (ẩn danh, không cần header Authorization/token).

## Yêu cầu sửa
Tìm trong code mini app phần gọi API submit phản hồi (thường ở file service/API client liên quan tới "feedback" hoặc "phản hồi", ví dụ `feedbackService`, `feedbackApi`, hoặc hàm `submitFeedback`), sửa URL từ:

```
POST /api/v1/feedback/tickets/me
```

thành:

```
POST /api/v1/feedback/tickets
```

Có thể do code này được copy từ một hàm submit khác có pattern `/me` (ví dụ API "hồ sơ của tôi") nên bị dính theo — kiểm tra xem hàm gọi API có đang dùng chung base path với logic thêm hậu tố `/me` hay không, và bỏ hậu tố đó riêng cho API feedback.

## Payload (body) đúng gửi lên
```json
{
  "channelId": "string (optional, id kênh phản hồi, có thể bỏ trống nếu chọn 'Khác / Không thuộc kênh nào')",
  "fullName": "string, 1-150 ký tự",
  "phone": "string, tối đa 30 ký tự, chỉ số/khoảng trắng/dấu + đầu",
  "content": "string, 5-5000 ký tự",
  "mediaIds": ["string (uuid)", "... tối đa 10 phần tử, optional"]
}
```

Response thành công (201):
```json
{
  "success": true,
  "data": {
    "success": true,
    "ticketCode": "PH-XXXXXX"
  }
}
```

## Tính năng đính kèm ảnh/video (nếu UI chưa có, bổ sung thêm)
Backend đã hỗ trợ đính kèm tối đa 10 ảnh/video khi gửi phản hồi (ảnh tối đa 5MB, video tối đa 50MB, định dạng ảnh JPG/PNG/WebP, video MP4/MOV/WebM). Quy trình 2 bước:

1. Tải từng file lên trước (có thể gọi nhiều file cùng lúc trong 1 request, field name là `files`, multipart/form-data):
```
POST /api/v1/feedback/tickets/attachments
Content-Type: multipart/form-data
files: (binary, có thể gửi nhiều file, tối đa 10 file/lần)
```
Response (201) — mảng object, lấy trường `id` của từng phần tử:
```json
[
  { "id": "uuid", "url": "...", "thumbnailUrl": "...|null", "mimeType": "image/webp", "size": 12345 }
]
```

2. Khi submit form phản hồi, đưa toàn bộ các `id` đã tải lên vào mảng `mediaIds` trong payload ở trên.

Lưu ý: các file tải lên ở bước 1 nhưng không được đưa vào `mediaIds` khi submit sẽ không được gắn vào ticket nào — nên chỉ gọi bước 1 khi người dùng thực sự chọn file, và chỉ giữ lại các id sẽ đưa vào submit.

## Việc cần làm
1. Sửa URL endpoint submit phản hồi như trên.
2. Test lại: điền form (họ tên, số điện thoại, nội dung), bấm "Gửi phản hồi" — phải nhận được `ticketCode` dạng `PH-XXXXXX`, không còn lỗi `Cannot POST`.
3. Nếu màn hình có UI chọn ảnh/video đính kèm, nối luồng theo đúng 2 bước ở trên (upload trước → lấy id → đưa vào `mediaIds` khi submit). Nếu UI chưa có phần chọn ảnh/video, có thể bổ sung thêm theo mô tả trên (không bắt buộc phải làm trong lần sửa lỗi này nếu ngoài phạm vi).

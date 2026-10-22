Bổ sung mục tải ảnh/video đính kèm vào màn hình "Gửi phản hồi" (Lắng nghe người dân) của Zalo Mini App.

## Hiện trạng
Backend đã hỗ trợ đầy đủ đính kèm ảnh/video cho phản hồi (đã deploy), nhưng màn hình "Gửi phản hồi" hiện tại (form có Kênh phản hồi / Họ tên / Số điện thoại / Nội dung / nút "Gửi phản hồi") **chưa có** UI để người dùng chọn ảnh/video đính kèm. Cần bổ sung.

## Yêu cầu UI
Thêm vào form, ngay dưới ô "Nội dung", một khối "Ảnh/video đính kèm (không bắt buộc)" gồm:
- Nút/khu vực để chọn ảnh hoặc video từ thư viện hoặc chụp/quay trực tiếp (tuỳ khả năng Mini App SDK, ít nhất phải hỗ trợ chọn từ thư viện).
- Cho phép chọn nhiều file cùng lúc, **tối đa 10 file** (ảnh + video cộng lại, không phải 10 ảnh và 10 video riêng).
- Sau khi chọn, hiển thị danh sách/lưới thumbnail các file đã chọn, mỗi file có nút xoá (X) để bỏ ra khỏi danh sách trước khi gửi.
- Với video, hiển thị icon "video" đè lên thumbnail (video không có ảnh xem trước từ server, xem mục "Preview trước khi upload" bên dưới).
- Validate phía client trước khi upload lên server (để phản hồi nhanh, đỡ tốn băng thông):
  - Ảnh: JPG, PNG, WebP — tối đa **5MB/ảnh**.
  - Video: MP4, MOV, WebM — tối đa **50MB/video**.
  - Vượt quá 10 file: chặn chọn thêm, hiện thông báo "Chỉ được đính kèm tối đa 10 ảnh/video".
  - Sai định dạng hoặc quá dung lượng: bỏ qua file đó, hiện thông báo lỗi tương ứng (ví dụ: "video1.mp4 vượt quá 50MB").

## Luồng gọi API (2 bước, bắt buộc theo đúng thứ tự)

**Bước 1 — Upload file lên server để lấy `id`:**
```
POST /api/v1/feedback/tickets/attachments
Content-Type: multipart/form-data
files: (binary, có thể đính kèm nhiều file trong 1 request, field name luôn là "files")
```
- Đây là API công khai, **không cần gửi token/Authorization**.
- Response 201 — mảng object theo đúng thứ tự file đã gửi:
```json
[
  {
    "id": "uuid",
    "url": "https://.../uploads/images/xxx.webp",
    "thumbnailUrl": "https://.../uploads/images/xxx-thumb.webp",
    "mimeType": "image/webp",
    "size": 123456,
    "width": 1200,
    "height": 800
  }
]
```
  Với video, `mimeType` là `video/mp4` | `video/quicktime` | `video/webm`, `thumbnailUrl`/`width`/`height` sẽ là `null` (server không tạo thumbnail cho video).
- Nên gọi API này **ngay khi người dùng chọn xong file** (không đợi tới lúc bấm "Gửi phản hồi"), để người dùng thấy tiến trình tải lên (loading/progress) trên từng thumbnail. Lưu lại `id` trả về, gắn với file tương ứng trong state.
- Nếu upload 1 file lỗi (sai định dạng/quá size — server trả 400 kèm `error.code` là `INVALID_FEEDBACK_ATTACHMENT` hoặc `VIDEO_SIZE_EXCEEDED`/`IMAGE_SIZE_EXCEEDED`), chỉ báo lỗi cho riêng file đó, không chặn các file khác.
- Nếu người dùng bấm nút xoá (X) trên một thumbnail đã upload xong, chỉ cần bỏ `id` đó ra khỏi state phía client — không cần gọi API xoá gì thêm, id không đưa vào bước 2 thì đơn giản không được gắn vào ticket nào.

**Bước 2 — Gửi form phản hồi, đính kèm `mediaIds`:**
```
POST /api/v1/feedback/tickets
Content-Type: application/json

{
  "channelId": "... (optional)",
  "fullName": "...",
  "phone": "...",
  "content": "...",
  "mediaIds": ["id-1", "id-2", "..."]
}
```
- `mediaIds` là mảng toàn bộ `id` thu được từ bước 1 cho các file người dùng còn giữ lại (đã bỏ các file bị xoá), tối đa 10 phần tử, có thể bỏ trống/không gửi field này nếu không có đính kèm nào.
- Nếu một `id` không hợp lệ hoặc đã được ticket khác dùng, server trả 400 với `error.code = "INVALID_FEEDBACK_ATTACHMENT"` — trường hợp gần như không xảy ra nếu luồng làm đúng thứ tự trên trong cùng 1 phiên gửi form.

Lưu ý: nếu Mini App hiện đang gọi `/feedback/tickets/me` thay vì `/feedback/tickets` (lỗi đã báo trước đó), giữ nguyên endpoint đang dùng — cả hai đều đã được hỗ trợ ở backend, `mediaIds` hoạt động như nhau trên cả hai.

## Preview trước khi upload (UX, không bắt buộc nhưng nên có)
Trước khi bước 1 hoàn tất (đang loading) hoặc để tiết kiệm việc chờ server, có thể hiển thị preview tạm bằng file cục bộ (`URL.createObjectURL` hoặc tương đương trong SDK Mini App) trong lúc chờ, rồi thay bằng `thumbnailUrl`/`url` thật từ server khi upload xong. Với video, có thể dùng frame đầu video cục bộ làm preview tạm, hoặc chỉ hiện icon video + tên file nếu không tiện lấy frame.

## Việc cần làm
1. Thêm UI chọn/hiển thị/xoá ảnh-video đính kèm vào form gửi phản hồi như mô tả.
2. Validate định dạng/dung lượng/số lượng phía client trước khi gọi API upload.
3. Gọi `POST /feedback/tickets/attachments` ngay khi chọn file, lưu `id` trả về theo từng file.
4. Khi bấm "Gửi phản hồi", đưa danh sách `id` còn lại (sau khi trừ các file đã xoá) vào `mediaIds` trong payload submit.
5. Test: gửi phản hồi kèm 1 ảnh + 1 video, kiểm tra trong trang quản trị (admin) mục chi tiết ticket hiển thị đúng 2 tệp đính kèm.
6. Test: chọn 11 file → bị chặn với thông báo lỗi tối đa 10; chọn video >50MB → bị chặn/báo lỗi riêng file đó; gửi phản hồi không đính kèm gì vẫn hoạt động bình thường như trước (không bắt buộc phải có ảnh/video).

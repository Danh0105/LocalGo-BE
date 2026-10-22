Đồng ý triển khai bản sửa backend trên nhánh `main`, commit `6b61805`.

Triển khai theo thứ tự an toàn như sau:

1. Backup hoặc đảm bảo có snapshot/rollback trước khi thao tác production.
2. Pull/deploy nhánh `main` tới commit `6b61805` (hoặc mới hơn nếu đã lên tiếp).
3. Cài dependency nếu cần (`npm install`).
4. Chạy migration production (`npx prisma migrate deploy`) — migration mới:
   `20260914160000_feedback_ticket_attachments` (thêm bảng `FeedbackTicketMedia`,
   enum `FEEDBACK_TICKET`, cho phép `Media.ownerId` NULL).
5. Chạy `npx prisma generate` rồi build backend (`npm run build`).
6. Restart service backend.
7. Kiểm tra healthcheck/API.
8. Test nhanh:
   - `POST /api/v1/feedback/tickets` (không cần đăng nhập) gửi phản hồi thành công, trả về `ticketCode` dạng `PH-XXXXXX`.
   - `POST /api/v1/feedback/tickets/me` (route alias ẩn danh, KHÔNG cần xác thực) — cùng hành vi như trên, dùng để vá lỗi mini app đang gọi sai đường dẫn `/me`. Đây không phải endpoint xác thực, không có "hồ sơ của tôi" hay lịch sử phản hồi theo user.
   - `POST /api/v1/feedback/tickets/attachments` (ẩn danh, multipart/form-data, field `files`, tối đa 10 file) trả về danh sách media id; ảnh tối đa 5MB, video tối đa 50MB.
   - Gửi phản hồi kèm `mediaIds` từ bước trên, sau đó vào trang admin xem chi tiết ticket phải thấy `attachments`.
   - Phản hồi cũ/mới vẫn tra cứu được qua `GET /api/v1/feedback/tickets/lookup?ticketCode=...&phone=...`.
9. Sau khi backend ổn định mới thông báo cho phía Mini App vá lại URL gọi API đúng chuẩn (`/feedback/tickets`, bỏ hậu tố `/me`) — xem chi tiết trong `mini-app-fix-prompt.md`.

Lưu ý:
- Không có endpoint `GET /feedback/tickets/me` và không có mục "Phản hồi của bạn" theo tài khoản đăng nhập — tính năng gửi phản hồi trong hệ thống này vẫn hoàn toàn ẩn danh, tra cứu bằng mã ticket + số điện thoại.
- Route `/feedback/tickets/me` chỉ là alias tạm thời để không chặn mini app trong lúc chờ họ sửa URL gọi API; có thể gỡ bỏ sau khi mini app đã cập nhật.
- Nếu gặp lỗi migration hoặc service restart, dừng triển khai và rollback backend theo snapshot/commit trước đó (`0e819bc`).

Thông tin truy cập server/backend:
[điền SSH/VPN/CI/CD hoặc hướng dẫn deploy hiện tại tại đây]

Sau khi deploy xong, gửi lại mình:
- commit đang chạy trên production,
- trạng thái migration,
- log restart service,
- kết quả test nhanh các endpoint feedback ở bước 8.

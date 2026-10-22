Sửa Zalo Mini App: tin giao thương đã duyệt nhưng không hiển thị, do form đăng tin gửi `expiresAt` = thời điểm hiện tại.

## Nguyên nhân (đã xác minh ở backend/DB)
- API công khai `GET /api/v1/trade-posts` chỉ trả tin `PUBLISHED` **chưa hết hạn** (`expiresAt` null hoặc ở tương lai). Detail `GET /trade-posts/:idOrSlug` cũng trả 404 với tin đã hết hạn.
- Hai tin đăng từ mini app ngày 19/10/2026 có giá trị như sau (giờ VN):
  | Tin | Tạo lúc | Duyệt lúc | expiresAt |
  |---|---|---|---|
  | Bdhdhb | 08:38:04 | 08:38:13 | **08:37:00** |
  | Ad | 08:30:37 | 08:32:34 | **08:30:00** |
- `expiresAt` luôn tròn phút và sớm hơn lúc tạo tin khoảng 1 phút, tức là thời điểm mở form. Rất có thể ô chọn "Ngày hết hạn" khởi tạo bằng `new Date()` và giá trị này luôn được gửi lên, dù người dùng không chọn gì (hoặc người dùng chọn "hôm nay" và ô chọn giữ nguyên giờ hiện tại). Tin vì vậy hết hạn ngay khi được tạo, admin duyệt xong cũng không hiện ra.

## Thay đổi phía backend (đi kèm bản sửa này)
- `POST /api/v1/trade-posts` và `PATCH /api/v1/trade-posts/:id`: nếu `expiresAt` không ở tương lai → **400** `error.code = "VALIDATION_ERROR"`, message: "Ngày hết hạn (expiresAt) phải sau thời điểm hiện tại. Bỏ trống nếu tin không có hạn."
- `PATCH /api/v1/trade-posts/:id` nhận `expiresAt: null` để **xóa hạn** (tin không hết hạn). Bỏ hẳn field `expiresAt` thì giá trị cũ được giữ nguyên.
- `PATCH /api/v1/trade-posts/:id/submit`: nếu tin đã quá hạn → **409** `error.code = "TRADE_POST_EXPIRED"`. Admin duyệt hoặc bỏ ẩn tin đã quá hạn cũng nhận lỗi này.

## Yêu cầu cập nhật Mini App

1. **Ô "Ngày hết hạn" là tùy chọn và mặc định để trống.**
   - Không khởi tạo bằng `new Date()` hay ngày hôm nay.
   - Khi tạo tin mà người dùng không chọn → **không gửi** field `expiresAt` (không gửi `""`, không gửi giá trị mặc định của ô chọn).
   - Có nút xóa ngày đã chọn. Khi sửa tin, nếu người dùng xóa ngày → gửi `expiresAt: null`.

2. **Nếu người dùng chọn ngày, gửi cuối ngày đó theo giờ máy.**
   - Ví dụ chọn 26/10/2026 → gửi `new Date(2026, 9, 26, 23, 59, 59).toISOString()` (ISO có múi giờ, không gửi chuỗi giờ không kèm múi giờ).
   - Ngày nhỏ nhất cho phép chọn là **ngày mai**, để tránh chọn trúng thời điểm đã qua.

3. **Kiểm tra phía client trước khi gửi:** nếu `expiresAt <= Date.now()` thì hiện lỗi ngay dưới ô ngày và không gọi API.

4. **Xử lý lỗi từ backend:**
   - `400 VALIDATION_ERROR` khi tạo/sửa tin → hiện `error.message` và giữ nguyên form để người dùng sửa.
   - Luồng "tạo tin rồi gửi duyệt ngay" (gọi `POST /trade-posts` rồi `PATCH /:id/submit`): nếu bước tạo lỗi thì **dừng**, không gọi submit.
   - `409 TRADE_POST_EXPIRED` khi gửi duyệt → hiện thông báo "Tin đã quá ngày hết hạn, vui lòng cập nhật ngày hết hạn" và mở màn sửa tin.

5. **Màn "Tin của tôi" (`GET /api/v1/trade-posts/me`):** tin có `expiresAt` khác null và `<= now` thì hiện nhãn **"Đã hết hạn"**, ghi chú "Tin không còn hiển thị công khai", kèm nút "Gia hạn" mở màn sửa tin tại ô ngày hết hạn. Tin ở trạng thái `PENDING` không sửa được (backend trả 409 `TRADE_POST_NOT_EDITABLE`), nên chỉ hiện nút này cho tin `DRAFT`, `REJECTED` hoặc `PUBLISHED`.

## Việc cần làm
1. Bỏ giá trị mặc định của ô "Ngày hết hạn", chỉ gửi `expiresAt` khi người dùng chọn.
2. Chuẩn hóa ngày đã chọn thành 23:59:59 giờ máy, rồi `toISOString()`.
3. Thêm kiểm tra client-side và xử lý `400 VALIDATION_ERROR` / `409 TRADE_POST_EXPIRED` như trên.
4. Thêm nhãn "Đã hết hạn" và nút "Gia hạn" ở màn "Tin của tôi".
5. Test:
   - Đăng tin **không chọn** ngày hết hạn → payload không có `expiresAt`. Admin duyệt xong, tin hiện ở danh sách giao thương.
   - Đăng tin chọn ngày hết hạn là ngày mai → payload có `expiresAt` = 23:59:59 ngày mai (giờ VN), tin hiện sau khi duyệt.
   - Ép gửi `expiresAt` ở quá khứ → app hiện lỗi, không tạo tin.
   - Sửa tin, xóa ngày hết hạn → payload có `expiresAt: null`, tin không còn hạn.

Cập nhật Zalo Mini App: bắt buộc đăng nhập khi đăng tin giao thương, và hướng dẫn đăng ký tài khoản BUSINESS khi chưa có.

## Hiện trạng backend (đã có sẵn, không cần chờ)
- `POST /api/v1/trade-posts` (tạo tin giao thương) **đã** yêu cầu đăng nhập (Bearer token) và role `BUSINESS` đã được duyệt. Nếu gọi khi chưa đăng nhập → 401. Nếu đã đăng nhập nhưng chưa có hồ sơ BUSINESS được duyệt → 403 với `error.code = "BUSINESS_PROFILE_REQUIRED"`.
- Có 2 cách để có tài khoản BUSINESS:
  1. **Đăng ký ngay trong app** (đã đăng nhập Zalo): `POST /api/v1/business-applications` — form đăng ký hồ sơ kinh doanh (đã có sẵn màn hình này trong app theo ảnh trước đó, chỉ cần dẫn người dùng tới đó).
  2. **Đăng ký trực tiếp tại UBND xã Truông Mít**: cán bộ UBND sẽ hỗ trợ nhập hồ sơ và tài liệu, admin duyệt và cấp tài khoản (kèm mật khẩu ban đầu) cho người không dùng Zalo hoặc muốn đăng ký trực tiếp tại chỗ.

## Yêu cầu cập nhật Mini App

1. **Chặn vào màn "Đăng tin giao thương" nếu chưa đăng nhập.**
   - Khi người dùng bấm nút "Đăng tin" / "Đăng tin giao thương" mà chưa đăng nhập Zalo trong app → không mở form, hiện dialog yêu cầu đăng nhập trước (dùng luồng đăng nhập Zalo hiện có của app).

2. **Nếu đã đăng nhập nhưng gọi `POST /trade-posts` trả về 403 `BUSINESS_PROFILE_REQUIRED`** (nghĩa là chưa có hoặc chưa được duyệt hồ sơ BUSINESS):
   - Hiện dialog/màn hình thông báo, có 2 lựa chọn rõ ràng cho người dùng:
     - **"Đăng ký ngay trong app"** → điều hướng tới màn hình đăng ký hồ sơ kinh doanh sẵn có (form `POST /business-applications`: loại hình cá nhân/tổ chức, tên, ngành nghề, liên hệ, tài liệu CCCD/giấy phép kinh doanh...).
     - **"Đăng ký trực tiếp tại UBND xã Truông Mít"** → hiện thông báo dạng:
       > "Bạn có thể đến UBND xã Truông Mít để được hỗ trợ đăng ký tài khoản kinh doanh trực tiếp. Cán bộ sẽ hướng dẫn và cấp tài khoản đăng nhập cho bạn."
       (có thể kèm địa chỉ/giờ làm việc cụ thể của UBND nếu app đã có sẵn thông tin liên hệ này ở đâu đó, ví dụ màn "Liên hệ").

3. **Kiểm tra trạng thái hồ sơ trước khi cho vào form đăng ký** (tránh gửi trùng): gọi `GET /api/v1/business-applications/check?zaloId=<zaloId của user>` trước khi hiện form đăng ký — nếu `exists: true` và `status` là `PENDING`, hiện thông báo "Hồ sơ của bạn đang chờ duyệt" thay vì cho đăng ký lại; nếu `status` là `REJECTED`, có thể cho sửa và nộp lại qua `PATCH /business-applications/:id`; nếu `APPROVED` mà vẫn bị 403 khi đăng tin, đó là lỗi hệ thống cần báo về backend.

## Việc cần làm
1. Thêm điều kiện đăng nhập trước khi mở form đăng tin giao thương.
2. Bắt lỗi 403 `BUSINESS_PROFILE_REQUIRED` từ `POST /trade-posts`, hiện dialog 2 lựa chọn như trên.
3. Nối UI dialog tới màn hình đăng ký hồ sơ kinh doanh sẵn có trong app cho lựa chọn "Đăng ký ngay trong app".
4. Test: tài khoản mới (chưa có hồ sơ BUSINESS) bấm "Đăng tin" → phải thấy dialog hướng dẫn, không được vào thẳng form đăng tin.
5. Test: tài khoản đã có hồ sơ BUSINESS được duyệt → đăng tin bình thường như cũ, không bị chặn oan.

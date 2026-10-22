Cập nhật Zalo Mini App LocalGo: chức năng **lưu tin giao thương** (bookmark) và màn hình **"Tin đã lưu"**.

## Backend (bản mới, cần deploy trước khi app phát hành)
- Base URL: `https://api.localgo.skilltripx.com.vn/api/v1`. Response: `{ success, data, meta? }`; lỗi: `{ success: false, error: { code, message } }`.

| Việc | API | Kết quả |
|---|---|---|
| Lưu tin | `POST /trade-posts/:idOrSlug/save` (Bearer) | 201 `{ saved: true, saveCount }`. Gọi lại khi đã lưu cũng không lỗi |
| Bỏ lưu | `DELETE /trade-posts/:idOrSlug/save` (Bearer) | 204. Bỏ lưu được cả tin không còn công khai |
| Tin đã lưu | `GET /trade-posts/me/saved?page=1&limit=20` (Bearer) | Danh sách tin, mới lưu trước, có `meta` |

- Danh sách `GET /trade-posts` và chi tiết `GET /trade-posts/:idOrSlug` giờ trả thêm:
  - `isSaved`: người đang xem đã lưu tin chưa. Luôn `false` nếu không gửi token.
  - `saveCount`: tổng số người đang lưu.
- **Hai endpoint công khai này phải gửi kèm `Authorization: Bearer <accessToken>` khi người dùng đã đăng nhập**, nếu không `isSaved` luôn là `false`. Token sai hoặc hết hạn không làm request lỗi; server chỉ coi như khách.
- Mỗi tin trong "Tin đã lưu" có thêm:
  - `savedAt`: thời điểm lưu.
  - `isAvailable`: `false` nếu tin đã bị ẩn, hết hạn, lưu trữ hoặc đang chờ duyệt lại.
  - `isSaved: true`.

  Tin đã bị xóa tự biến mất khỏi danh sách.
- Lỗi khi lưu:
  - 401: chưa đăng nhập.
  - 404 `RESOURCE_NOT_FOUND`: tin không còn hiển thị công khai.
  - 429: bấm quá nhanh (giới hạn 60 lần/phút).
- Chủ tin nhận thông báo "Có người lưu tin của bạn" ở chuông, **chỉ lần đầu** mỗi người lưu, nên bấm lưu/bỏ lưu nhiều lần không spam.

## Yêu cầu Mini App

### 1. Nút lưu
- Thêm icon lưu (bookmark/trái tim) ở:
  - **thẻ tin** trong danh sách giao thương, tin nổi bật, kết quả tìm kiếm;
  - **màn chi tiết tin**: cạnh nút chia sẻ, kèm "N người đã lưu" lấy từ `saveCount`.
- Trạng thái ban đầu lấy từ `isSaved` của API. Ẩn nút trên tin của chính mình (`ownerId === currentUser.id`).
- **Chưa đăng nhập:** bấm lưu thì mở luồng đăng nhập Zalo hiện có; đăng nhập xong tự thực hiện lại thao tác lưu.
- **Đã đăng nhập:**
  - Cập nhật giao diện ngay (optimistic): đổi icon, `saveCount` ±1.
  - Gọi API. Lỗi thì hoàn tác và hiện `error.message`. Riêng 404 thì báo "Tin không còn hiển thị" rồi bỏ tin khỏi danh sách đang xem.
  - Thành công: lưu thì lấy `saveCount` từ response; bỏ lưu (204) giữ số đã tự trừ.
  - Khóa nút trong lúc đang gọi API để tránh bấm đúp. Hiện toast ngắn "Đã lưu tin" / "Đã bỏ lưu".
- Giữ trạng thái lưu trong một store chung theo `tradePostId`, để lưu ở màn chi tiết thì thẻ ngoài danh sách và màn "Tin đã lưu" cập nhật theo, không cần tải lại.

### 2. Màn "Tin đã lưu"
- **Lối vào:** mục "Tin đã lưu" ở trang cá nhân/tài khoản, và icon bookmark ở header màn Giao thương. Chỉ hiện khi đã đăng nhập.
- **Danh sách:** `GET /trade-posts/me/saved`, cuộn để tải trang tiếp, kéo để làm mới.
- **Mỗi dòng:** ảnh, tiêu đề, giá (tin phi lợi nhuận thì hiện nhãn "Phi lợi nhuận"), và "Đã lưu 2 ngày trước" (từ `savedAt`).
- **`isAvailable === false`:** làm mờ, gắn nhãn "Tin không còn hiển thị", không mở chi tiết khi bấm, chỉ cho "Bỏ lưu".
- **Bỏ lưu:** bấm icon bookmark hoặc vuốt dòng → gọi `DELETE` → bỏ dòng khỏi danh sách (có "Hoàn tác" trong vài giây thì càng tốt, hoàn tác bằng `POST` lại).
- **Trống:** "Bạn chưa lưu tin nào", kèm nút "Khám phá tin giao thương".

### 3. Đồng bộ với chuông thông báo
Không cần thêm gì. Thông báo `TRADE_POST_SAVED` gửi chủ tin đã có trong phần chuông (xem `mini-app-notifications-prompt.md`).

## Kiểm tra
- [ ] Chưa đăng nhập: danh sách tin hiện icon chưa lưu; bấm lưu thì mở đăng nhập, đăng nhập xong tin được lưu.
- [ ] Đã đăng nhập: lưu ở thẻ danh sách → mở chi tiết thấy đã lưu và `saveCount` đúng; bỏ lưu ở chi tiết → quay lại danh sách thấy đã bỏ.
- [ ] Mở lại app → trạng thái lưu vẫn đúng (lấy từ `isSaved` của API, không phải bộ nhớ cục bộ).
- [ ] "Tin đã lưu" sắp mới lưu trước. Tin bị admin ẩn vẫn hiện nhưng mờ, có nhãn, và bỏ lưu được.
- [ ] Không thấy nút lưu trên tin của chính mình.
- [ ] Bấm lưu liên tục nhanh không gửi nhiều request trùng (nút bị khóa khi đang gọi API).

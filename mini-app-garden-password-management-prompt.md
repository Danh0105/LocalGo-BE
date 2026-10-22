Cập nhật Zalo Mini App LocalGo — quản lý mật khẩu cho tài khoản **Chủ vườn**.

Backend đã có API đổi mật khẩu, quên mật khẩu và đặt lại mật khẩu. Hãy tích hợp
đúng API thật, không tạo mock và không bổ sung bất kỳ chức năng xem/lấy lại mật
khẩu hiện tại nào.

## 1. Thông tin API chung

- Base URL production: `https://api.localgo.skilltripx.com.vn/api/v1`
- Thành công có body:

```json
{ "success": true, "data": {} }
```

- Một số API thành công trả `204 No Content`; không gọi `response.json()` khi
  status là 204.
- Lỗi:

```json
{
  "success": false,
  "error": {
    "code": "...",
    "message": "Thông báo tiếng Việt",
    "details": []
  },
  "requestId": "..."
}
```

- Có thể hiển thị `error.message` cho người dùng. Với
  `VALIDATION_ERROR`, dùng `error.details[]` để gắn lỗi đúng field nếu có.
- Dùng `GET /auth/me` hoặc `GET /users/me` để lấy tài khoản hiện tại. Chỉ coi
  là Chủ vườn khi đồng thời:

```ts
user.role === 'BUSINESS' && user.businessType === 'GARDEN';
```

Không suy luận từ tên, nội dung hồ sơ hay dữ liệu lưu cũ trên máy.

## 2. Thông tin đăng nhập nằm trong “Hồ sơ cơ sở”

Không tạo menu, tab hoặc màn hình **Tài khoản**, **Mật khẩu** hay **Mật khẩu và
bảo mật** riêng.

Trong màn **Hồ sơ cơ sở** hiện có của Chủ vườn, thêm section **“Thông tin đăng
nhập”** sau thông tin liên hệ của cơ sở:

- Chỉ hiện trong hồ sơ của chính chủ khi tài khoản có `role=BUSINESS` và
  `businessType=GARDEN`.
- Không đưa section này vào trang hồ sơ cơ sở công khai.
- Không hiển thị cho `USER`, `MODERATOR`, `ADMIN` hoặc BUSINESS thuộc loại hình
  khác.
- Hiện email đăng nhập lấy từ tài khoản/hồ sơ đã duyệt.
- Trong cùng section có mật khẩu ban đầu (chỉ một lần), nút sao chép trong lần
  hiển thị đầu tiên và form đổi mật khẩu.

### 2.1. Mật khẩu ban đầu sau khi hồ sơ được duyệt

Mục tiêu UX: ngay lần đầu Chủ vườn mở **Hồ sơ cơ sở** sau khi hồ sơ đăng ký
được duyệt, hệ thống tự tạo và hiển thị mật khẩu đăng nhập ban đầu, không yêu
cầu Admin nhập mật khẩu thủ công.

Không triển khai “xem mật khẩu hiện tại” vĩnh viễn. Backend lưu mật khẩu bằng
Argon2 nên không thể đọc ngược; lưu plaintext hoặc mật khẩu có thể giải mã là
không được phép. Mật khẩu chỉ được trả plaintext đúng trong luồng cấp ban đầu,
sau đó không API nào trả lại mật khẩu hiện tại.

#### Contract backend cần bổ sung

Backend hiện tại chưa có luồng cấp mật khẩu một lần này và Admin vẫn phải gửi
`initialPassword` khi duyệt một số hồ sơ. Cần sửa backend theo contract sau
trước khi nối UI production:

1. Khi duyệt hồ sơ `businessType=GARDEN`, không yêu cầu Admin nhập hoặc nhìn
   thấy `initialPassword`; đánh dấu tài khoản cần cấp mật khẩu ban đầu.
2. Khi Mini App của chính Chủ vườn yêu cầu lần đầu, backend sinh mật khẩu ngẫu
   nhiên bằng CSPRNG, dài ít nhất 12 ký tự, có chữ và số, loại ký tự dễ nhầm nếu
   cần; lưu duy nhất hash Argon2.
3. Plaintext chỉ tồn tại trong response cấp ban đầu, có
   `Cache-Control: no-store, private`; không ghi DB, audit log, notification,
   analytics hay application log.
4. Để không mất mật khẩu khi mạng ngắt sau response, dùng trạng thái
   `acknowledged`: trước khi người dùng xác nhận đã lưu, gọi lại endpoint được
   phép sinh mật khẩu mới và thay hash cũ; sau khi xác nhận thì cấm cấp/xem lại.
5. Audit chỉ ghi `INITIAL_PASSWORD_ISSUED` và
   `INITIAL_PASSWORD_ACKNOWLEDGED`, không ghi plaintext/hash.

API trạng thái riêng tư:

```http
GET /business-profiles/me/credentials
Authorization: Bearer <accessToken>
```

```json
{
  "email": "garden@example.com",
  "passwordConfigured": false,
  "initialPasswordAcknowledged": false,
  "canIssueInitialPassword": true
}
```

Không thêm các trường riêng tư này vào `GET /business-profiles/:id` công khai.

API sinh/cấp mật khẩu ban đầu:

```http
POST /business-profiles/me/credentials/initial-password
Authorization: Bearer <accessToken>
```

```json
{
  "password": "RandomGarden4827",
  "requiresAcknowledgement": true
}
```

API xác nhận người dùng đã lưu:

```http
POST /business-profiles/me/credentials/initial-password/acknowledge
Authorization: Bearer <accessToken>
```

Thành công trả `204 No Content`. Sau đó endpoint cấp ban đầu phải trả 409
`INITIAL_PASSWORD_ALREADY_ACKNOWLEDGED`; tuyệt đối không trả mật khẩu hiện tại.

#### Giao diện cấp mật khẩu ban đầu

Khi mở Hồ sơ cơ sở:

1. Gọi endpoint credential status.
2. Nếu `canIssueInitialPassword=true`, tự gọi endpoint cấp ban đầu một lần và
   mở khối nổi bật/modal **“Mật khẩu đăng nhập của bạn”**.
3. Hiện email và mật khẩu plaintext vừa nhận, mặc định che; có nút Hiện/Ẩn và
   Sao chép.
4. Cảnh báo rõ: **“Mật khẩu chỉ hiển thị ở bước này. Hãy lưu lại trước khi tiếp
   tục.”**
5. Có nút chính **“Tôi đã lưu mật khẩu”**. Chỉ khi người dùng bấm nút mới gọi
   API acknowledge, xóa plaintext khỏi state và đóng khối.
6. Nếu người dùng đóng Mini App trước khi acknowledge, lần mở sau được phép
   sinh một mật khẩu mới; mật khẩu vừa thấy trước đó trở thành không hợp lệ.
7. Không tự acknowledge theo timeout, khi unmount hoặc ngay sau khi copy.

Sau khi đã acknowledge, section chỉ hiển thị:

- Email đăng nhập.
- Mật khẩu: `••••••••••••` (placeholder cố định, không phải dữ liệu backend).
- Nút **“Đổi mật khẩu”** mở form ngay trong Hồ sơ cơ sở.
- Link **“Quên mật khẩu?”** dẫn tới luồng yêu cầu email reset.

Không có nút Hiện/Sao chép mật khẩu hiện tại sau khi đã acknowledge.
Nếu người dùng quên mật khẩu sau thời điểm này, dùng luồng **Quên mật khẩu**;
không mở lại mật khẩu ban đầu.

### 2.2. Đổi mật khẩu trong Hồ sơ cơ sở

Form đổi mật khẩu là panel/modal con của section **Thông tin đăng nhập**, không
phải một chức năng tài khoản độc lập.

Màn đổi mật khẩu gồm đúng ba field:

1. Mật khẩu hiện tại — `currentPassword`.
2. Mật khẩu mới — `newPassword`.
3. Xác nhận mật khẩu mới — `newPasswordConfirmation`.

Yêu cầu giao diện:

- Dùng input mật khẩu, mặc định che ký tự; cho phép bật/tắt hiển thị riêng từng
  field.
- Không lưu ba giá trị vào local storage, Zalo storage, log, analytics, crash
  report hoặc URL.
- Sau khi rời màn hình hoặc request hoàn tất, xóa giá trị password khỏi state.
- Nút “Đổi mật khẩu” có loading và chống bấm/gửi lặp.
- Validate trước khi gọi API:
  - tất cả field bắt buộc;
  - mật khẩu mới dài 8–128 ký tự;
  - có ít nhất một chữ cái và một chữ số;
  - xác nhận phải trùng mật khẩu mới.
- Hiển thị checklist ngắn dưới mật khẩu mới; không yêu cầu chữ hoa hoặc ký tự
  đặc biệt vì backend hiện không bắt buộc hai điều này.

Gọi API:

```http
PATCH /users/me/password
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "currentPassword": "Current-password-123",
  "newPassword": "New-password-456",
  "newPasswordConfirmation": "New-password-456"
}
```

Endpoint giới hạn 5 lần/phút. Thành công trả `204 No Content` và backend thu
hồi toàn bộ access/refresh token cũ.

### Xử lý sau khi đổi thành công

Ngay khi nhận 204:

1. Hiện thông báo: **“Đổi mật khẩu thành công. Vui lòng đăng nhập lại.”**
2. Xóa access token và refresh token LocalGo trên thiết bị.
3. Xóa user/auth state và cache dữ liệu riêng tư.
4. Điều hướng về màn đăng nhập.
5. Không tự gọi refresh token và không tự retry request đổi mật khẩu.

Nếu Mini App có interceptor tự refresh khi gặp 401, thêm cơ chế bỏ qua refresh
cho request đổi/reset mật khẩu và cho trạng thái “đang đăng xuất bắt buộc”, để
không tạo vòng lặp refresh.

### Mapping lỗi đổi mật khẩu

| HTTP | `error.code`                     | Cách hiển thị                                                                  |
| ---- | -------------------------------- | ------------------------------------------------------------------------------ |
| 400  | `VALIDATION_ERROR`               | Hiện lỗi tại field tương ứng; fallback dùng `error.message`.                   |
| 400  | `PASSWORD_CONFIRMATION_MISMATCH` | Báo dưới ô xác nhận: “Xác nhận mật khẩu mới không trùng khớp.”                 |
| 401  | `CURRENT_PASSWORD_INVALID`       | Báo dưới ô mật khẩu hiện tại: “Mật khẩu hiện tại không đúng.”                  |
| 401  | `UNAUTHORIZED`                   | Phiên không còn hợp lệ; xóa token và yêu cầu đăng nhập lại.                    |
| 403  | `GARDEN_ACCOUNT_REQUIRED`        | Ẩn/đóng màn hình và báo chức năng chỉ dành cho Chủ vườn.                       |
| 429  | `RATE_LIMIT_EXCEEDED`            | “Bạn thao tác quá nhiều lần. Vui lòng thử lại sau.”; giữ form, không tự retry. |

Không xóa nội dung người dùng vừa nhập khi lỗi validation/current password;
riêng mật khẩu hiện tại nên được focus để sửa. Tuyệt đối không đưa giá trị
password vào toast hoặc nội dung lỗi.

## 3. Quên mật khẩu

Trên màn đăng nhập bằng email/mật khẩu, thêm link **“Quên mật khẩu?”**. Không
đưa link này vào luồng đăng nhập Zalo tự động nếu màn đó không có form email.

Màn quên mật khẩu chỉ có email và nút “Gửi hướng dẫn”:

```http
POST /auth/forgot-password
Content-Type: application/json

{ "email": "garden@example.com" }
```

- Đây là API public, không gắn Bearer token.
- Giới hạn 3 lần/15 phút.
- Thành công trả `202 Accepted`:

```json
{
  "success": true,
  "data": {
    "message": "Nếu email tồn tại và đủ điều kiện, hướng dẫn đặt lại mật khẩu đã được gửi."
  }
}
```

- Luôn hiển thị nguyên thông báo chung trên, không thay bằng “Email không tồn
  tại”, không dò trạng thái tài khoản bằng API khác và không tiết lộ email có
  đăng ký hay không.
- Sau khi gửi thành công, có nút “Quay lại đăng nhập”. Không hiển thị countdown
  gửi lại giả nếu backend chưa trả thời gian cụ thể; khi nhận 429 thì báo thử
  lại sau.

## 4. Đặt lại mật khẩu từ liên kết email

Thêm route/màn hình reset password nhận query parameter `token`, ví dụ:

```text
/reset-password?token=<opaque-token>
```

Token là bí mật dùng một lần:

- Đọc token một lần rồi giữ trong memory của màn hình.
- Sau khi đọc, dùng router replace để xóa token khỏi URL hiển thị nếu nền tảng
  cho phép.
- Không lưu token vào local/Zalo storage, log, analytics, breadcrumb hoặc error
  tracking.
- Không decode hoặc kiểm tra nội dung token ở frontend.
- Nếu thiếu token, hiện “Liên kết đặt lại mật khẩu không hợp lệ” và nút yêu cầu
  liên kết mới.

Form chỉ gồm:

1. Mật khẩu mới.
2. Xác nhận mật khẩu mới.

Áp dụng cùng validation/checklist 8–128 ký tự, có chữ và số, xác nhận trùng
khớp. Gọi:

```http
POST /auth/reset-password
Content-Type: application/json

{
  "token": "token-nhan-tu-link-email",
  "newPassword": "Reset-password-789",
  "newPasswordConfirmation": "Reset-password-789"
}
```

API public, giới hạn 5 lần/15 phút. Thành công trả 204:

1. Xóa token/password khỏi state.
2. Xóa mọi access/refresh token LocalGo đang lưu trên thiết bị.
3. Hiện **“Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.”**
4. Điều hướng về đăng nhập; không tự refresh/retry.

Mapping lỗi:

- `INVALID_PASSWORD_RESET_TOKEN`: “Liên kết không hợp lệ hoặc đã hết hạn.” và
  nút “Gửi lại liên kết”.
- `PASSWORD_CONFIRMATION_MISMATCH`: gắn lỗi vào ô xác nhận.
- `VALIDATION_ERROR`: gắn lỗi theo `details`.
- `RATE_LIMIT_EXCEEDED`: báo thử lại sau, không tự gửi lại.

Không phân biệt token sai, hết hạn hay đã dùng; dùng chung message của backend.

## 5. Phạm vi không làm trong Mini App

- Không tạo menu/màn hình quản lý Tài khoản hoặc Mật khẩu riêng; mọi thao tác
  của Chủ vườn nằm trong Hồ sơ cơ sở.
- Chỉ cho xem/copy plaintext trong lần cấp mật khẩu ban đầu chưa acknowledge;
  không xem/copy/export mật khẩu hiện tại sau đó và không bao giờ hiển thị hash.
- Không thêm password vào response model `User`.
- Không thêm password vào payload đăng ký hồ sơ Business/Chủ vườn. Sau khi hồ
  sơ được duyệt, backend tự cấp mật khẩu bằng endpoint riêng; Admin không nhập
  và không xem mật khẩu.
- Không triển khai API Admin reset trong Mini App người dùng. API
  `PATCH /admin/users/:id/password` thuộc trang quản trị riêng.
- Không tự tạo endpoint hoặc lưu password phía frontend để “ghi nhớ đăng nhập”.

## 6. Cập nhật API client/auth store

- API client phải hỗ trợ response 202 và 204.
- Các trường mật khẩu và reset token phải nằm trong danh sách redact của logger
  (`password`, `currentPassword`, `newPassword`, `newPasswordConfirmation`,
  `token`, `refreshToken`). Tốt nhất không log request body auth.
- Response cấp mật khẩu ban đầu không được đưa vào query cache/persisted cache;
  chỉ giữ plaintext trong state memory đến khi acknowledge hoặc rời phiên.
- Khi bất kỳ request có Bearer token nhận 401:
  - bình thường chỉ refresh tối đa một lần;
  - nếu refresh thất bại, xóa toàn bộ auth state và về đăng nhập;
  - không refresh cho `/auth/login`, `/auth/forgot-password`,
    `/auth/reset-password`, `/users/me/password`;
  - gom các request 401 đồng thời vào một refresh promise, tránh dùng lặp refresh
    token và làm backend phát hiện replay.
- Refresh thành công phải ghi đè **cả access token lẫn refresh token** bằng cặp
  mới.

## 7. Kiểm thử bắt buộc

- [ ] Không có menu/màn hình Tài khoản hoặc Mật khẩu riêng; section Thông tin
      đăng nhập chỉ nằm trong Hồ sơ cơ sở của chính Chủ vườn.
- [ ] Hồ sơ Chủ vườn vừa được duyệt không yêu cầu Admin nhập mật khẩu; lần đầu
      mở Hồ sơ cơ sở tự sinh và hiển thị mật khẩu ban đầu.
- [ ] Plaintext ban đầu chỉ ở memory, không xuất hiện trong DB/log/cache/
      analytics và response có `Cache-Control: no-store`.
- [ ] Chưa acknowledge mà mở lại thì sinh mật khẩu mới và mật khẩu cũ không còn
      đăng nhập được.
- [ ] Bấm “Tôi đã lưu mật khẩu” thành công thì xóa plaintext khỏi state; tải lại
      không thể xem/copy mật khẩu hiện tại.
- [ ] Endpoint công khai của hồ sơ cơ sở không có credential status, password
      hoặc password hash.
- [ ] Form chặn mật khẩu dưới 8 ký tự, trên 128 ký tự, thiếu chữ, thiếu số hoặc
      xác nhận không trùng trước khi gọi API.
- [ ] Sai mật khẩu hiện tại hiển thị đúng dưới field, không làm mất toàn bộ form.
- [ ] Đổi mật khẩu thành công: nhận 204, xóa cả hai token, không gọi refresh,
      quay về đăng nhập.
- [ ] Sau đổi mật khẩu, request dùng access token cũ và refresh token cũ không
      được Mini App tiếp tục sử dụng.
- [ ] Quên mật khẩu với email tồn tại và email không tồn tại cho giao diện giống
      nhau, không tiết lộ trạng thái tài khoản.
- [ ] Reset thành công bằng token từ URL; token bị xóa khỏi URL/state sau khi
      dùng.
- [ ] Dùng lại token reset hoặc token hết hạn hiện cùng thông báo chung và có
      nút yêu cầu liên kết mới.
- [ ] 429 không tự retry và không tạo nhiều request song song.
- [ ] Plaintext ban đầu chỉ xuất hiện trong HTTPS response cấp một lần và state
      memory; logger, analytics, persisted cache, URL và request khác không chứa
      plaintext password, refresh token hay reset token.
- [ ] Không màn hình hoặc response model nào có `passwordHash` hay chức năng
      đọc mật khẩu hiện tại.
- [ ] Kiểm thử lại đăng nhập Zalo, đăng nhập email, refresh-token rotation và
      logout để bảo đảm không phát sinh vòng lặp 401.

Hoàn thành bằng code production-ready, dùng component/form/API client sẵn có
của dự án, giữ nguyên phong cách giao diện LocalGo và bổ sung unit/integration
test cho validation, phân quyền hiển thị, xử lý 204, forced logout và bảo vệ dữ
liệu nhạy cảm.

# Quản lý mật khẩu tài khoản Chủ vườn

Backend không có API đọc/lấy lại mật khẩu. `passwordHash`, `credentialVersion`
và hash của reset token là dữ liệu nội bộ, không xuất hiện trong response.

### Mật khẩu ban đầu khi duyệt hồ sơ BUSINESS

`POST /api/v1/admin/business-applications/:id/approve` không yêu cầu
`initialPassword`; field từ client cũ được chấp nhận nhưng bị bỏ qua. Khi tài
khoản được tạo mới hoặc tài khoản Zalo chưa có mật khẩu, backend tự sinh mật
khẩu 16 ký tự bằng CSPRNG, lưu Argon2 hash và trả plaintext đúng một lần trong
response duyệt:

```json
{
  "success": true,
  "data": {
    "id": "application-id",
    "status": "APPROVED",
    "createdUserId": "user-id",
    "initialPassword": "generated-once"
  }
}
```

Response có `Cache-Control: no-store, private`. Nếu tài khoản đã có mật khẩu,
backend giữ nguyên mật khẩu và trả `initialPassword: null`. Plaintext không
được lưu trong database, audit log hoặc notification và không thể lấy lại sau
response này; audit chỉ ghi action `INITIAL_PASSWORD_ISSUED`. Khi bị mất phải
dùng luồng quên mật khẩu hoặc admin đặt lại.

## API

### Đổi mật khẩu của Chủ vườn

`PATCH /api/v1/users/me/password` (Bearer token, giới hạn 5 lần/phút)

```json
{
  "currentPassword": "Current-password-123",
  "newPassword": "New-password-456",
  "newPasswordConfirmation": "New-password-456"
}
```

Chỉ tài khoản `BUSINESS` có `businessType=GARDEN` được gọi. Thành công trả
`204`; toàn bộ access/refresh token đã cấp trước đó bị vô hiệu và frontend phải
đưa người dùng về màn hình đăng nhập.

### Quên và đặt lại mật khẩu

`POST /api/v1/auth/forgot-password` (public, giới hạn 3 lần/15 phút)

```json
{ "email": "garden@example.com" }
```

API luôn trả `202` với cùng nội dung, dù email có tồn tại hay không. Liên kết
email chứa token ngẫu nhiên dùng một lần; database chỉ lưu SHA-256 của token và
token hết hạn mặc định sau 15 phút.

`POST /api/v1/auth/reset-password` (public, giới hạn 5 lần/15 phút)

```json
{
  "token": "token-nhan-qua-email",
  "newPassword": "Reset-password-789",
  "newPasswordConfirmation": "Reset-password-789"
}
```

Thành công trả `204` và thu hồi mọi phiên cũ. Token sai, hết hạn hoặc đã dùng
trả `INVALID_PASSWORD_RESET_TOKEN`.

### Admin đặt lại mật khẩu

`PATCH /api/v1/admin/users/:id/password` (chỉ `ADMIN`, 5 lần/phút)

```json
{ "password": "Admin-reset-password-123" }
```

Admin chỉ đặt mật khẩu mới, không thể đọc mật khẩu hiện tại. Thành công thu hồi
mọi phiên của tài khoản đích và response vẫn là `UserResponseDto` an toàn.

## Chính sách và cấu hình

Mật khẩu mới dài 8–128 ký tự, có ít nhất một chữ cái và một chữ số, và được
hash bằng Argon2. Các thao tác đổi/reset ghi audit action nhưng không ghi mật
khẩu hay hash.

Biến môi trường dùng cho email reset:

```dotenv
PASSWORD_RESET_TTL_MINUTES=15
PASSWORD_RESET_URL=https://example.com/reset-password
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM=LocalGo <no-reply@example.com>
```

Nếu chưa cấu hình `SMTP_HOST`, endpoint vẫn giữ response chống dò email nhưng
backend chỉ ghi cảnh báo và không thể giao liên kết reset. Production cần cấu
hình SMTP trước khi đưa luồng quên mật khẩu vào sử dụng.

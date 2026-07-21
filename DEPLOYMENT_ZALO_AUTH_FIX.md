# Hướng dẫn Deploy Zalo Mini App Auth Fix - Production

## Tóm tắt lỗi và giải pháp

### Lỗi hiện tại
- **Triệu chứng**: Mini App từ `https://h5.zadn.vn` gọi `POST /api/v1/auth/zalo` bị `Failed to fetch` (CORS error)
- **Nguyên nhân chính**:
  1. CORS allowlist không bao gồm `https://h5.zadn.vn` và `https://h5.zdn.vn`
  2. Production vẫn chạy `ZALO_AUTH_MODE=mock`, không xác thực token thật qua Zalo Graph API
  3. Thiếu `ZALO_APP_SECRET` trong biến môi trường

### Giải pháp
1. ✅ Cập nhật `CORS_ORIGINS` để chấp nhận Zalo Mini App origins
2. ✅ Bật `ZALO_AUTH_MODE=real` trên production
3. ✅ Cấu hình `ZALO_APP_SECRET` từ Zalo Developers
4. ✅ Rebuild và redeploy backend
5. ✅ Restart PM2/service

---

## Bước 1: Chuẩn bị biến môi trường Production

### 1.1 Lấy ZALO_APP_SECRET từ Zalo Developers

1. Đăng nhập vào [Zalo Developers](https://developers.zalo.me/)
2. Chọn Mini App của LocalGo
3. Vào **Settings** → **App Info** hoặc **Security**
4. Tìm **App Secret Key** (không phải App ID)
5. Copy giá trị này, **không share công khai** hoặc commit vào Git

### 1.2 Xác định nơi lưu biến môi trường production

Tùy theo cách deploy:

- **Nếu dùng Docker Compose**: Tạo file `.env` hoặc `.env.production` chứa biến môi trường
- **Nếu dùng PM2 trực tiếp**: Cập nhật file `.env` tại `/var/www/LocalGo-BE/`
- **Nếu dùng Kubernetes**: Cập nhật Secret
- **Nếu dùng Cloud (AWS/GCP/Azure)**: Cập nhật Environment Variables trong console

### 1.3 Cập nhật file .env Production

**Yêu cầu**: Cập nhật các dòng sau trên server production:

```bash
# 1. Thêm Zalo Mini App origins vào CORS allowlist (giữ lại các domain hiện tại)
CORS_ORIGINS=https://localgo.skilltripx.com.vn,https://admin.skilltripx.com.vn,http://localhost:5173,http://localhost:3000,http://localhost:2999,https://h5.zadn.vn,https://h5.zdn.vn

# 2. Bật Real Zalo Auth Mode
ZALO_AUTH_MODE=real

# 3. Thêm Zalo App Secret (lấy từ Zalo Developers)
ZALO_APP_SECRET=<ZALO_APP_SECRET_THẬT>
```

**Lưu ý quan trọng**:
- ✅ Giữ nguyên tất cả biến môi trường khác (JWT secrets, database URL, etc.)
- ✅ Không xóa các origin Admin/Web hiện tại
- ✅ Không log hoặc share giá trị `ZALO_APP_SECRET` công khai
- ✅ Xác nhận `ZALO_APP_SECRET` thuộc đúng App ID của Mini App đang deploy

---

## Bước 2: Build lại Backend

### 2.1 Nếu dùng Docker Compose

```bash
# Dừng container cũ
docker-compose down

# Build image mới từ source code hiện tại (có chứa RealZaloAuthProvider)
docker-compose build

# Khởi động lại
docker-compose up -d
```

### 2.2 Nếu dùng PM2 trực tiếp (Deployment hiện tại)

```bash
cd /var/www/LocalGo-BE

# Pull code mới (nếu cần)
git pull origin main

# Cài dependencies
npm ci --production

# Build project
npm run build

# Restart PM2 app
pm2 restart ecosystem.config.js

# Lưu trạng thái PM2 (startup script)
pm2 save
```

### 2.3 Hoặc dùng deploy.sh script

```bash
/var/www/LocalGo-BE/deploy.sh main
```

---

## Bước 3: Xác minh cấu hình sau Deploy

### 3.1 Kiểm tra biến môi trường đã được load

```bash
curl http://localhost:3001/api/v1/health 2>/dev/null | jq .
```

Kiểm tra log PM2:

```bash
pm2 logs localgo-be | grep -i "zalo\|cors\|auth"
```

Xác nhận không thấy message `(mock)` hoặc error về missing secret.

### 3.2 Test Preflight CORS từ Zalo Mini App origins

Chạy từ local machine hoặc server có outbound internet:

```bash
# Test với origin h5.zadn.vn
curl -i -X OPTIONS "https://api.localgo.skilltripx.com.vn/api/v1/auth/zalo" \
  -H "Origin: https://h5.zadn.vn" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,authorization"

# Kết quả phải chứa:
# HTTP/1.1 204 No Content
# Access-Control-Allow-Origin: https://h5.zadn.vn
# Access-Control-Allow-Methods: GET,HEAD,PUT,PATCH,POST,DELETE
# Access-Control-Allow-Headers: content-type,authorization
```

```bash
# Test với origin h5.zdn.vn (nếu cần)
curl -i -X OPTIONS "https://api.localgo.skilltripx.com.vn/api/v1/auth/zalo" \
  -H "Origin: https://h5.zdn.vn" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,authorization"

# Kết quả phải chứa:
# Access-Control-Allow-Origin: https://h5.zdn.vn
```

### 3.3 Test negative case (origin không được phép)

```bash
curl -i -X OPTIONS "https://api.localgo.skilltripx.com.vn/api/v1/auth/zalo" \
  -H "Origin: https://evil.example.com" \
  -H "Access-Control-Request-Method: POST"

# Kết quả: HTTP/1.1 403 Forbidden
# hoặc không có header Access-Control-Allow-Origin
```

---

## Bước 4: Smoke Test Xác thực Zalo thật

### 4.1 Lấy Zalo Access Token thật

1. Mở Mini App từ Zalo mobile
2. Thực hiện login
3. Kiểm tra Network tab → request tới `/auth/zalo` → copy giá trị `accessToken`

### 4.2 Test endpoint `/auth/zalo` với token thật

```bash
# Thay <ZALO_ACCESS_TOKEN> bằng token từ Mini App
curl -X POST "https://api.localgo.skilltripx.com.vn/api/v1/auth/zalo" \
  -H "Content-Type: application/json" \
  -d '{"accessToken":"<ZALO_ACCESS_TOKEN>"}'

# Response dự kiến (HTTP 201):
# {
#   "success": true,
#   "data": {
#     "accessToken": "eyJ...",
#     "refreshToken": "eyJ...",
#     "expiresAt": "2026-07-17T16:30:00.000Z"
#   }
# }
```

### 4.3 Test `/users/me` với LocalGo token

```bash
# Thay <LOCALGO_ACCESS_TOKEN> bằng token từ response trên
curl -X GET "https://api.localgo.skilltripx.com.vn/api/v1/users/me" \
  -H "Authorization: Bearer <LOCALGO_ACCESS_TOKEN>"

# Response dự kiến (HTTP 200):
# {
#   "success": true,
#   "data": {
#     "id": "...",
#     "zaloId": "...",
#     "displayName": "...",
#     "...": "..."
#   }
# }
```

### 4.4 Test negative case - token sai

```bash
curl -X POST "https://api.localgo.skilltripx.com.vn/api/v1/auth/zalo" \
  -H "Content-Type: application/json" \
  -d '{"accessToken":"invalid_token_12345"}'

# Response dự kiến (HTTP 401):
# {
#   "success": false,
#   "error": {
#     "code": "INVALID_CREDENTIALS",
#     "message": "Access token Zalo không hợp lệ hoặc đã hết hạn"
#   }
# }

# ⚠️ CẢNH BÁO: Response không được chứa chữ "(mock)" hoặc hướng dẫn format "mock::..."
# Nếu thấy đó, production vẫn đang chạy mode mock - kiểm tra lại .env và restart
```

---

## Bước 5: Kiểm tra Log và Monitoring

### 5.1 Xem log PM2

```bash
# Xem log mới nhất
pm2 logs localgo-be --lines 100

# Lọc theo từ khóa
pm2 logs localgo-be | grep -i "auth\|zalo\|cors\|error"
```

### 5.2 Kiểm tra các lỗi phổ biến

| Lỗi | Nguyên nhân | Cách khắc phục |
|-----|-----------|----------------|
| `CORS error: Access-Control-Allow-Origin missing` | CORS allowlist chưa thêm `h5.zadn.vn` hoặc `h5.zdn.vn` | Cập nhật `CORS_ORIGINS`, rebuild, restart |
| Response chứa `(mock)` hoặc `mock::` | `ZALO_AUTH_MODE` chưa thay từ `mock` thành `real` | Sửa `.env`, rebuild, restart |
| `ZALO_APP_SECRET` is required | Thiếu `ZALO_APP_SECRET` trong .env | Thêm giá trị từ Zalo Developers |
| `502 Bad Gateway` khi token đúng | Không kết nối được tới `graph.zalo.me` | Kiểm tra firewall/outbound network, DNS resolution |
| `401 INVALID_CREDENTIALS` với token thật | Secret sai hoặc token thuộc App khác | Xác nhận secret từ Zalo Developers |

### 5.3 Verify không có token leak trong log

```bash
# Kiểm tra xem log có chứa access token hay secret không
grep -E "accessToken|ZALO_APP_SECRET|mock::" /var/log/pm2/localgo-be.*.log

# Kết quả: không tìm thấy gì là tốt ✅
```

---

## Bước 6: Rollback (nếu cần)

Nếu deployment gây lỗi ngoài phạm vi auth:

```bash
# Quay lại commit trước
git revert HEAD
git push origin main

# Rebuild và restart
npm run build
pm2 restart ecosystem.config.js

# Hoặc nếu cấu hình .env là vấn đề:
# - Giữ nguyên code
# - Chỉ revert .env về giá trị cũ
# - Restart PM2
```

**Lưu ý quan trọng**:
- ❌ Không rollback `CORS_ORIGINS` để thêm `h5.zadn.vn` nếu đã xác nhận CORS hoạt động tốt
- ❌ Không chuyển production về `ZALO_AUTH_MODE=mock` như cách khắc phục tạm thời
- ✅ Nếu Real Zalo Auth chưa hoạt động, API sẽ fail đóng (trả 401/502) - đó là đúng

---

## Checklist Xác nhận Deploy Thành công

- [ ] Preflight từ `https://h5.zadn.vn` nhận `Access-Control-Allow-Origin` header
- [ ] Preflight từ `https://h5.zdn.vn` nhận `Access-Control-Allow-Origin` header
- [ ] Origin Admin/Web production hiện có vẫn hoạt động
- [ ] Origin giả không được cấp CORS
- [ ] `/auth/zalo` với token thật trả LocalGo tokens (không chứa `mock`)
- [ ] `/users/me` với LocalGo token trả hồ sơ người dùng
- [ ] `/auth/zalo` với token sai trả `401 INVALID_CREDENTIALS` (không chứa `(mock)`)
- [ ] Log PM2 không chứa Zalo token, LocalGo token hay app secret
- [ ] PM2 status = `online`, không có error
- [ ] Tất cả env variables đã update: `CORS_ORIGINS`, `ZALO_AUTH_MODE`, `ZALO_APP_SECRET`

---

## Liên hệ và Hỗ trợ

Nếu gặp vấn đề:

1. Kiểm tra log PM2: `pm2 logs localgo-be`
2. Xem stack trace đầy đủ: `pm2 show localgo-be`
3. Verify biến môi trường: `pm2 show localgo-be | grep -E "env|ZALO|CORS"`
4. Test CORS preflight manual: xem mục 3.2 trên
5. Liên hệ DevOps team với log + error message

---

## Files đã sửa trong commit này

1. `.env.example` - Thêm documentation chi tiết cho CORS_ORIGINS và ZALO_AUTH_MODE
2. `docker-compose.yml` - Thêm `ZALO_APP_SECRET` vào environment variables
3. Không sửa source code (RealZaloAuthProvider đã tồn tại)
4. Không migration database
5. Không thay đổi response contract

---

## Tài liệu liên quan

- [Zalo Developers - Graph API](https://developers.zalo.me/docs/api/zaloapi/social-api/user-info/get-user-info)
- [NestJS CORS Documentation](https://docs.nestjs.com/techniques/compression#cors)
- [Express CORS Module](https://github.com/expressjs/cors)
- Spec auth module: `src/modules/auth/`


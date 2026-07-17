# Hướng dẫn tích hợp Frontend (Phase 1)

Phạm vi tài liệu này: auth, trade posts, reviews, upload ảnh — các module đã xây dựng ở Phase 1. Các domain nội dung còn lại (nông nghiệp, điểm tham quan, ...) sẽ có tài liệu bổ sung khi Phase 2 hoàn thành.

## 1. Base URL

```
http://localhost:3001/api/v1
```

Production: thay bằng domain thật, vẫn giữ prefix `/api/v1`. Swagger UI tại `/api/docs` (bật/tắt qua `SWAGGER_ENABLED`).

## 2. Chuẩn response

Mọi response thành công có dạng:

```json
{ "success": true, "data": { ... }, "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 } }
```

`meta` chỉ xuất hiện ở API danh sách (phân trang). Response lỗi:

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] }, "requestId": "uuid" }
```

Frontend nên tạo một API client dùng chung, tự động unwrap `data`/`meta` và ném lỗi có `code` để xử lý theo từng trường hợp (ví dụ hiển thị thông báo khác nhau cho `ACCOUNT_BLOCKED` so với `VALIDATION_ERROR`).

## 3. Luồng xác thực (Zalo Mini App)

```
1. Frontend gọi zmp-sdk: const { accessToken } = await getAccessToken();
2. POST /api/v1/auth/zalo  { accessToken }
   -> { accessToken, refreshToken, expiresAt }  (đây là accessToken/refreshToken CỦA BACKEND, khác accessToken Zalo)
3. Lưu accessToken (bộ nhớ / state, KHÔNG localStorage lâu dài vì Mini App có thể bị đóng) và refreshToken (nơi lưu bền hơn, ví dụ zmp-sdk storage).
4. Mọi request cần xác thực: header Authorization: Bearer <accessToken>
5. Khi accessToken hết hạn (401 UNAUTHORIZED / INVALID_REFRESH_TOKEN không áp dụng ở bước này):
   POST /api/v1/auth/refresh { refreshToken } -> { accessToken, refreshToken (MỚI), expiresAt }
   -> Ghi đè cả accessToken lẫn refreshToken cũ bằng cặp mới (refresh token bị xoay vòng, dùng lại token cũ sẽ bị từ chối VÀ thu hồi toàn bộ phiên).
6. Đăng xuất: POST /api/v1/auth/logout { refreshToken }
7. Đăng xuất tất cả thiết bị: POST /api/v1/auth/logout-all (cần Bearer token)
```

Môi trường dev không có Zalo thật: dùng `ZALO_AUTH_MODE=mock` (mặc định), gửi `accessToken` dạng `mock:<zaloId-bất-kỳ>:<tên-hiển-thị>` — backend sẽ tạo user mới nếu `zaloId` chưa tồn tại.

Admin/moderator đăng nhập bằng email/mật khẩu (không qua Zalo): `POST /api/v1/auth/login { email, password }`.

## 4. Gọi API public vs private

- Public (không cần header `Authorization`): `GET /trade-posts`, `GET /trade-posts/:idOrSlug`, `GET /trade-posts/:tradePostId/reviews`, `GET /trade-posts/:tradePostId/reviews/summary`.
- Private (cần Bearer token): tạo/sửa/xóa trade post, tạo/sửa/xóa review, upload ảnh, `GET /users/me`.
- Admin/moderator (cần Bearer token + role phù hợp, gọi mà không đủ quyền sẽ nhận `403 FORBIDDEN`): mọi endpoint dưới `/admin/...`.

## 5. Phân trang

Query chung: `?page=1&limit=20&sortBy=newest&sortOrder=desc`. `limit` tối đa 100. `sortBy` cho trade posts: `newest | price_asc | price_desc | rating | popular` — gửi giá trị khác sẽ bị từ chối `400 VALIDATION_ERROR` (allowlist, không nhận giá trị tuỳ ý).

## 6. Upload ảnh

```
1. POST /api/v1/media/images  (multipart/form-data, field name: "file", cần Bearer token)
   -> { id, url, thumbnailUrl, width, height, size, mimeType }
2. Dùng `id` trả về làm phần tử trong mảng `imageIds` khi tạo/sửa trade post hoặc review:
   POST /api/v1/trade-posts { ..., imageIds: ["<id-1>", "<id-2>"] }
```

Giới hạn: tối đa 10 ảnh/tin đăng, 3 ảnh/đánh giá, mỗi ảnh tối đa `MAX_IMAGE_SIZE_MB` (mặc định 5MB), chỉ nhận JPG/PNG/WebP (kiểm tra magic bytes, không tin đuôi file). Ảnh được resize và chuyển sang WebP ở backend — `url`/`thumbnailUrl` trả về đã là link cuối cùng, không cần xử lý gì thêm ở frontend.

## 7. Mapping field: thay `src/pages/trade.tsx` mock

Xem bảng chi tiết trong `docs/frontend-backend-mapping.md`. Điểm cần lưu ý khi tích hợp:

- `id` chuyển từ `number` sang UUID `string` — bỏ mọi `Number(id)`.
- Thêm `slug` — nên dùng `slug` cho URL đẹp (`/trade/:slug`) thay vì id.
- `owner` (string) → cần đăng nhập thật, lấy tên qua `contactName` hoặc thông tin user hiện tại.
- `price` (string tự do) → tách thành `price` (số, chỉ có khi `priceType=FIXED`) + `priceLabel` (chuỗi hiển thị, luôn có).
- `rating`/`reviewCount` → `averageRating`/`reviewCount`, backend tự tính, không gửi lên khi tạo/sửa tin.
- `badge` → `featured` (boolean, chỉ admin/moderator đặt được qua `/admin/trade-posts/:id/feature`).

## 8. Quy trình thay thế từng bước (trade module)

1. Tạo API client dùng chung (base URL từ biến môi trường frontend mới, ví dụ `VITE_API_BASE_URL`).
2. Tạo auth interceptor: tự gắn `Authorization` header, tự gọi `/auth/refresh` khi gặp 401 rồi retry request gốc một lần.
3. Thay `src/pages/trade.tsx`: gọi `GET /trade-posts` thay vì import mảng mock; map field theo bảng ở mục 7.
4. Thay `src/pages/trade-detail.tsx`: gọi `GET /trade-posts/:slug`.
5. Nối nút "Đăng tin": form → `POST /media/images` (nếu có ảnh) → `POST /trade-posts` → `PATCH /trade-posts/:id/submit`.
6. Nối form review trong `trade-detail.tsx`: `POST /media/images` (nếu có ảnh, tối đa 3) → `POST /trade-posts/:tradePostId/reviews`.
7. Hiển thị `GET /trade-posts/:tradePostId/reviews` (đã duyệt) và `GET .../reviews/summary` (biểu đồ phân bố sao) thay cho 2 review hardcode.
8. Giữ nguyên mock data cho 14 domain nội dung khác — **chưa xóa** cho tới khi Phase 2 hoàn thành các module tương ứng.
9. Sau khi xác minh toàn bộ luồng trade + review hoạt động đúng trên môi trường thật, mới xóa `src/pages/trade.tsx` mock array và mock review trong `trade-detail.tsx`.

## 9. Lưu ý Zalo Mini App

- `getAccessToken()` của `zmp-sdk` có thể thất bại nếu user chưa cấp quyền — xử lý fallback (ví dụ hiển thị màn hình yêu cầu đăng nhập lại) thay vì crash.
- Access token Zalo (dùng để gọi `/auth/zalo`) khác hoàn toàn với access token của backend (dùng để gọi các API khác) — không dùng lẫn hai loại token.
- Mini App có thể bị đóng/mở lại bất kỳ lúc nào — refresh token nên được lưu ở nơi bền hơn state trong bộ nhớ (ví dụ `zmp-sdk`'s storage API), access token thì không bắt buộc.

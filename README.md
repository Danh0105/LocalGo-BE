# LocalGo Backend

Backend REST API cho **LocalGo** — Zalo Mini App quảng bá địa phương, du lịch, giao thương và kết nối cộng đồng xã Truông Mít.

> **Trạng thái: Phase 1** — nền tảng, xác thực (Zalo + email/mật khẩu), RBAC, upload ảnh, module giao thương (trade posts + reviews + rating) đã hoàn thành. 14 module nội dung địa phương (nông nghiệp, điểm tham quan, đền chùa, đặc sản, ...), Feedback, Favorites, Search, Admin dashboard sẽ được xây dựng ở các phase tiếp theo — xem `docs/frontend-backend-mapping.md` để biết chi tiết những gì đã/chưa xây.

## 1. Giới thiệu

Frontend hiện tại (`F:\LocalGo`) dùng dữ liệu mẫu tĩnh cho toàn bộ nội dung. Backend này thay thế dần dữ liệu mẫu bằng API thật, bắt đầu từ module quan trọng nhất: giao thương (trade posts) và đánh giá (reviews), cùng với nền tảng xác thực/phân quyền mà mọi module sau này sẽ dùng lại.

## 2. Kiến trúc hệ thống

- **NestJS 11** (TypeScript strict mode) + **PostgreSQL 18** qua **Prisma ORM 7**.
- Kiến trúc phân lớp: `Controller` (chỉ xử lý HTTP) → `Service` (business logic + transaction) → `Repository` (truy vấn Prisma). Controller không bao giờ gọi Prisma trực tiếp.
- Xác thực JWT access token (ngắn hạn) + refresh token xoay vòng (rotation) có phát hiện tái sử dụng (reuse detection) — xem chi tiết bên dưới.
- Upload ảnh qua storage abstraction (`MediaStorageService`), hiện dùng local filesystem, có thể thay bằng S3/MinIO/Cloudinary mà không đổi business logic.
- Response chuẩn hóa: `{ success, data, meta? }` khi thành công, `{ success: false, error: { code, message, details }, requestId }` khi lỗi.
- **Prisma ORM 7** dùng kiến trúc "no Rust engine": kết nối qua driver adapter (`@prisma/adapter-pg`) thay vì Rust query engine cũ — xem `docs/assumptions.md` để biết chi tiết (đây là thay đổi mới của Prisma 7, khác với các hướng dẫn Prisma 5/6 phổ biến trên mạng).

## 3. Yêu cầu môi trường

- Node.js LTS (đã test với Node 26)
- PostgreSQL 18 (chạy local hoặc container)
- npm

## 4. Cấu hình `.env`

Sao chép `.env.example` thành `.env` (và `.env.test` cho môi trường test) rồi điền giá trị thật. Các biến quan trọng:

| Biến                                              | Mô tả                                                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                                    | Connection string PostgreSQL                                                                     |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`         | Secret ký JWT, **bắt buộc tối thiểu 16 ký tự**, không dùng giá trị mẫu ở production              |
| `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | Thời hạn token (ví dụ `15m`, `30d`)                                                              |
| `PUBLIC_BASE_URL`                                 | Base URL công khai, dùng để build link ảnh upload                                                |
| `CORS_ORIGINS`                                    | Danh sách origin được phép, phân tách bằng dấu phẩy                                              |
| `MEDIA_STORAGE_PROVIDER`                          | `local` (mặc định) hoặc `s3` (chưa triển khai ở Phase 1)                                         |
| `ZALO_AUTH_MODE`                                  | `mock` (dev/test, chấp nhận token dạng `mock:<zaloId>:<tên>`) hoặc `real` (production, verify thật qua Zalo Graph API — bắt buộc `ZALO_APP_SECRET`) |
| `ZALO_APP_SECRET`                                 | App Secret Key từ Zalo Developers — bắt buộc khi `ZALO_AUTH_MODE=real`, không cần cho mode mock  |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`         | Tài khoản admin được tạo khi chạy seed                                                           |

Ứng dụng **fail-fast** nếu thiếu biến bắt buộc hoặc giá trị không hợp lệ (validate bằng Joi khi khởi động).

## 5. Cài đặt dependency

```bash
npm install
```

## 6. Chạy PostgreSQL và tạo role/database

Nếu chưa có, tạo role và 2 database (dev + test):

```sql
CREATE ROLE localgo WITH LOGIN PASSWORD '<mật khẩu của bạn>';
CREATE DATABASE localgo OWNER localgo;
CREATE DATABASE localgo_test OWNER localgo;
```

Cập nhật `DATABASE_URL` trong `.env`/`.env.test` cho khớp.

## 7. Chạy migration

```bash
npx prisma migrate dev
```

Sau khi migration đầu tiên chạy xong, áp dụng bổ sung migration SQL viết tay (partial unique index cho "một đánh giá đang hoạt động mỗi user/tin đăng" + CHECK constraint cho `rating`) — xem `docs/assumptions.md` mục "TradeReview one-active-review" để biết nội dung chính xác và lưu ý **không bao giờ regenerate lại migration này**.

## 8. Chạy seed

```bash
npx prisma db seed
```

Tạo: 1 admin, 1 moderator, 2 tài khoản business, 3 user thường, 6 tin giao thương, review mẫu, nội dung Giới thiệu và 6 điểm Đền - Chùa - Miếu. Script **idempotent** — chạy lại không tạo trùng dữ liệu (dùng `upsert` theo khóa duy nhất).

## 9. Chạy development

```bash
npm run start:dev
```

Mặc định: `http://localhost:3001/api/v1`, Swagger tại `http://localhost:3001/api/docs`.

## 10. Chạy test

```bash
npm run test        # unit tests
npm run test:e2e    # integration/e2e tests (cần PostgreSQL thật, dùng .env.test)
npm run test:cov    # coverage
```

## 11. Chạy lint

```bash
npm run lint
```

## 12. Build production

```bash
npm run build
node dist/main
```

## 13. Chạy Docker Compose

```bash
docker compose up -d --build
```

> **Lưu ý:** `Dockerfile`/`docker-compose.yml` được viết theo đúng spec (multi-stage build, health check, chạy migration khi start) nhưng **chưa được thực thi/kiểm chứng trong môi trường phát triển này** vì máy không cài Docker. Vui lòng tự kiểm tra `docker compose up` trước khi dùng cho production.

## 14. Swagger

`GET /api/docs` (bật/tắt qua `SWAGGER_ENABLED`). Có Bearer auth scheme, tag theo module, request/response schema đầy đủ cho mọi endpoint đã xây ở Phase 1.

## 15. Tài khoản seed (chỉ dùng cho development)

| Role      | Email/Username                                              | Password                                                              | Ghi chú                                                                                  |
| --------- | ----------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| ADMIN     | giá trị `SEED_ADMIN_EMAIL` (mặc định `admin@localgo.local`) | giá trị `SEED_ADMIN_PASSWORD` (mặc định `Admin@123456` nếu không đặt) | Đăng nhập qua `POST /auth/login`                                                         |
| MODERATOR | `moderator@localgo.local`                                   | `Moderator@123456`                                                    | Đăng nhập qua `POST /auth/login`                                                         |
| BUSINESS  | zaloId `seed-business-1`, `seed-business-2`                 | —                                                                     | Đăng nhập qua `POST /auth/zalo` với `accessToken: "mock:seed-business-1:..."` (dev mode) |
| USER      | zaloId `seed-user-1..3`                                     | —                                                                     | Tương tự, qua `POST /auth/zalo`                                                          |

**Không sử dụng các tài khoản/mật khẩu này ở production.** Luôn đặt `SEED_ADMIN_PASSWORD` riêng cho mỗi môi trường.

## 16. Role và permission

| Role                    | Quyền                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------- |
| GUEST (không đăng nhập) | Xem nội dung công khai (tin giao thương đã publish, review đã duyệt)                  |
| USER                    | Toàn bộ quyền GUEST + tạo/sửa/xóa đánh giá của mình, quản lý tin giao thương của mình |
| BUSINESS                | Giống USER ở Phase 1 (chưa có đặc quyền riêng)                                        |
| MODERATOR               | Duyệt/từ chối/lưu trữ tin giao thương, duyệt/ẩn đánh giá                              |
| ADMIN                   | Toàn quyền, bao gồm quản lý danh mục (`Category`)                                     |

RBAC được enforce ở backend qua `RolesGuard` (không chỉ kiểm tra ở frontend). Các thao tác sửa/xóa tài nguyên còn được kiểm tra quyền sở hữu (`ownerId`/`userId` khớp với người gọi API) độc lập với role.

## 17. Danh sách endpoint (Phase 1)

| Method                    | Endpoint                                    | Auth   | Role                     | Mô tả                                                       |
| ------------------------- | ------------------------------------------- | ------ | ------------------------ | ----------------------------------------------------------- |
| GET                       | `/health`                                   | Public | —                        | Health check, không đụng DB                                 |
| GET                       | `/health/database`                          | Public | —                        | Health check có kiểm tra kết nối DB                         |
| POST                      | `/auth/zalo`                                | Public | —                        | Đăng nhập bằng Zalo (mock ở dev)                            |
| POST                      | `/auth/login`                               | Public | —                        | Đăng nhập email/mật khẩu                                    |
| POST                      | `/auth/refresh`                             | Public | —                        | Làm mới access token                                        |
| POST                      | `/auth/logout`                              | Public | —                        | Đăng xuất phiên hiện tại                                    |
| POST                      | `/auth/logout-all`                          | Bearer | Any                      | Đăng xuất tất cả thiết bị                                   |
| GET                       | `/auth/me`                                  | Bearer | Any                      | Thông tin user hiện tại                                     |
| GET                       | `/users/me`                                 | Bearer | Any                      | Xem hồ sơ                                                   |
| PATCH                     | `/users/me`                                 | Bearer | Any                      | Cập nhật hồ sơ                                              |
| GET                       | `/sessions`                                 | Bearer | Any                      | Danh sách thiết bị đang đăng nhập                           |
| DELETE                    | `/sessions/:id`                             | Bearer | Any                      | Thu hồi một thiết bị                                        |
| POST                      | `/media/images`                             | Bearer | Any                      | Upload ảnh                                                  |
| GET                       | `/categories`, `/categories/:type`          | Public | —                        | Danh mục đang hoạt động theo domain                         |
| GET                       | `/admin/categories?domain=`                 | Bearer | MODERATOR, ADMIN         | Danh mục theo domain (kể cả đã vô hiệu hóa)                 |
| POST/PATCH/DELETE         | `/admin/categories...`                      | Bearer | MODERATOR, ADMIN         | Quản lý danh mục                                            |
| GET                       | `/trade-posts`                              | Public | —                        | Danh sách tin đã publish                                    |
| GET                       | `/trade-posts/:idOrSlug`                    | Public | —                        | Chi tiết tin đã publish                                     |
| GET                       | `/trade-posts/me`                           | Bearer | Any                      | Tin của tôi (mọi trạng thái)                                |
| POST                      | `/trade-posts`                              | Bearer | Any                      | Tạo tin (DRAFT)                                             |
| PATCH                     | `/trade-posts/:id`                          | Bearer | Chủ tin                  | Sửa tin                                                     |
| DELETE                    | `/trade-posts/:id`                          | Bearer | Chủ tin                  | Xóa (thu hồi) tin                                           |
| PATCH                     | `/trade-posts/:id/submit`                   | Bearer | Chủ tin                  | Gửi duyệt                                                   |
| GET/PATCH                 | `/admin/trade-posts...`                     | Bearer | MODERATOR, ADMIN         | Duyệt/từ chối/lưu trữ/nổi bật                               |
| GET                       | `/trade-posts/:tradePostId/reviews`         | Public | —                        | Đánh giá đã duyệt                                           |
| GET                       | `/trade-posts/:tradePostId/reviews/summary` | Public | —                        | Thống kê đánh giá                                           |
| POST                      | `/trade-posts/:tradePostId/reviews`         | Bearer | Any (không phải chủ tin) | Gửi đánh giá                                                |
| PATCH/DELETE              | `/reviews/:id`                              | Bearer | Chủ đánh giá             | Sửa/xóa đánh giá                                            |
| POST/DELETE               | `/reviews/:id/images...`                    | Bearer | Chủ đánh giá             | Quản lý ảnh đánh giá                                        |
| GET                       | `/admin/reviews`                            | Bearer | MODERATOR, ADMIN         | Danh sách đánh giá (mọi trạng thái, lọc status/tradePostId) |
| PATCH                     | `/admin/reviews/:id/status`                 | Bearer | MODERATOR, ADMIN         | Duyệt/ẩn đánh giá                                           |
| GET                       | `/temples`, `/temples/:id`                  | Public | —                        | Danh sách/chi tiết Đền - Chùa - Miếu đang hiển thị          |
| GET/POST/PUT/PATCH/DELETE | `/admin/temples...`                         | Bearer | MODERATOR, ADMIN         | CRUD, ẩn/hiện và sắp xếp điểm du lịch                       |

Toàn bộ endpoint có prefix `/api/v1`.

### API quản trị người dùng và đăng ký BUSINESS

| Method | Endpoint                                   | Auth   | Role             | Mô tả                                                     |
| ------ | ------------------------------------------ | ------ | ---------------- | --------------------------------------------------------- |
| GET    | `/admin/users`                             | Bearer | MODERATOR, ADMIN | Danh sách, tìm kiếm và lọc người dùng                     |
| PATCH  | `/admin/users/:id/status`                  | Bearer | MODERATOR, ADMIN | Khóa/mở khóa người dùng; khóa sẽ thu hồi refresh sessions |
| POST   | `/business-applications`                   | Bearer | Any              | Nộp hồ sơ đăng ký BUSINESS                                |
| GET    | `/business-applications/me`                | Bearer | Any              | Hồ sơ BUSINESS mới nhất của tôi                           |
| PATCH  | `/business-applications/:id`               | Bearer | Chủ hồ sơ        | Sửa và gửi lại hồ sơ đã bị từ chối                        |
| GET    | `/admin/business-applications`             | Bearer | MODERATOR, ADMIN | Danh sách hồ sơ BUSINESS                                  |
| POST   | `/admin/business-applications/:id/approve` | Bearer | MODERATOR, ADMIN | Duyệt và nâng tài khoản Zalo đã nộp hồ sơ thành BUSINESS  |
| POST   | `/admin/business-applications/:id/reject`  | Bearer | MODERATOR, ADMIN | Từ chối hồ sơ BUSINESS                                    |

Tài liệu hồ sơ được trả bằng URL ký HMAC có thời hạn 5 phút. Media đã gắn với hồ sơ BUSINESS bị chặn tại static public route.

### Ẩn và xóa tin giao thương đã duyệt

- `PATCH /admin/trade-posts/:id/hide`: chuyển `PUBLISHED` sang `HIDDEN` và gỡ trạng thái nổi bật.
- `PATCH /admin/trade-posts/:id/unhide`: hiển thị lại tin `HIDDEN` dưới trạng thái `PUBLISHED`.
- `DELETE /admin/trade-posts/:id`: xóa mềm tin `PUBLISHED` hoặc `HIDDEN`.

Tin `HIDDEN` và tin đã xóa không xuất hiện trong API công khai. Các thao tác đều yêu cầu `ADMIN` hoặc `MODERATOR` và được ghi audit log.

### Nội dung Giới thiệu

- `GET /about`: public snapshot đã xuất bản, có ETag và chỉ trả item active.
- `GET|PUT /admin/about`: đọc/lưu draft với optimistic locking.
- `GET /admin/about/preview`: preview draft.
- `POST /admin/about/publish`: publish atomic và tạo revision.
- `POST /admin/about/discard-draft`: hủy thay đổi nháp.

Chi tiết contract, media mapping, migration và error code: [docs/about-api.md](docs/about-api.md).

### Đền - Chùa - Miếu

Public API chỉ trả điểm active; admin API hỗ trợ phân trang, lọc/tìm kiếm, CRUD, optimistic locking, status và reorder transaction. Chi tiết: [docs/temples-api.md](docs/temples-api.md).

## 18. Cấu trúc response

Xem mục 2 (Kiến trúc). Chi tiết mã lỗi (`error.code`) trong `src/common/constants/error-codes.constant.ts`.

## 19. Upload file

Xem `docs/frontend-integration.md` mục 6. Tóm tắt: multipart `POST /media/images` → nhận `{ id, url, thumbnailUrl, ... }` → dùng `id` trong `imageIds` khi tạo/sửa trade post hoặc review.

## 20. Kết nối frontend

Xem `docs/frontend-integration.md` (hướng dẫn từng bước) và `docs/frontend-backend-mapping.md` (mapping field chi tiết cho module giao thương).

## 21. Assumption

Toàn bộ giả định thiết kế và quyết định kỹ thuật (kèm lý do + tác động) được ghi lại và cập nhật liên tục tại `docs/assumptions.md`.

## 22. Các hạn chế còn lại (Phase 1)

- 14 module nội dung địa phương, Feedback, Favorites, Search, Admin dashboard: **chưa xây dựng** (Phase 2+).
- `ZALO_AUTH_MODE=real` (xác thực Zalo thật) và `MEDIA_STORAGE_PROVIDER=s3`: chưa triển khai, chỉ có `mock`/`local`.
- Không có job tự động chuyển `TradePost.status` sang `EXPIRED` khi hết hạn — tin hết hạn vẫn ẩn khỏi danh sách công khai đúng qua điều kiện query, nhưng cột `status` trong DB không tự cập nhật.
- Docker Compose chưa được chạy thử trong môi trường phát triển này (máy không có Docker).
- Migration và toàn bộ e2e test suite đã được chạy trên PostgreSQL local. Ở môi trường mới, cần tạo role/database và cập nhật `DATABASE_URL` trước khi chạy `prisma migrate deploy`.

## 23. Chiến lược backup/upload production

- Local storage (`MEDIA_STORAGE_PROVIDER=local`) lưu file tại `UPLOAD_DIR/images/`. Ở production, thư mục này cần được backup định kỳ và/hoặc đặt trên volume có snapshot (không phù hợp với container ephemeral/nhiều instance).
- Media không tự động xóa file vật lý khi record bị soft-delete (tránh xóa nhầm file vẫn được tham chiếu) — cần một job dọn dẹp định kỳ (chưa xây ở Phase 1, xem `docs/assumptions.md` mục "Media resourceType/resourceId").
- Database: dùng cơ chế backup chuẩn của PostgreSQL (`pg_dump`/point-in-time recovery), không nằm trong phạm vi code của backend này.

## 24. Cách chuyển local media sang S3/MinIO/Cloudinary

`MediaStorageService` (`src/modules/media/providers/storage/media-storage-provider.interface.ts`) là một interface trừu tượng với 3 phương thức: `upload`, `delete`, `exists`. `LocalMediaStorageService` là implementation duy nhất hiện có. Để chuyển sang S3/MinIO/Cloudinary:

1. Tạo class mới implement `MediaStorageService` (ví dụ `S3MediaStorageService`), dùng SDK tương ứng để upload buffer và trả về `{ storageKey, originalUrl, thumbnailUrl }`.
2. Trong `src/modules/media/media.module.ts`, sửa factory của provider `MEDIA_STORAGE_SERVICE` để trả về implementation mới khi `MEDIA_STORAGE_PROVIDER=s3`.
3. Không cần sửa `MediaService` hay bất kỳ controller/service nào khác — toàn bộ business logic (validate, resize, checksum) độc lập với nơi lưu trữ.

---

## Phụ lục: tài liệu liên quan

- `docs/assumptions.md` — mọi giả định/quyết định thiết kế, kèm lý do và tác động.
- `docs/erd.md` — ERD (Mermaid) cho toàn bộ bảng đã tồn tại.
- `docs/frontend-backend-mapping.md` — mapping chi tiết frontend ↔ backend.
- `docs/frontend-integration.md` — hướng dẫn tích hợp frontend từng bước.

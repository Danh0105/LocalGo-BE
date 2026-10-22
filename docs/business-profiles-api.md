# CRUD hồ sơ doanh nghiệp theo loại tài khoản

`BusinessProfile` là hồ sơ vận hành/công khai của một tài khoản `BUSINESS`. Hồ sơ này tách biệt với `BusinessApplication`: đơn đăng ký giữ CCCD, giấy phép và tài liệu xác minh; API hồ sơ không trả các dữ liệu nhạy cảm đó.

Khi Admin duyệt `BusinessApplication`, backend tự tạo hoặc đồng bộ hồ sơ cho tài khoản được duyệt. Các tài khoản BUSINESS được tạo bằng cách khác có thể tự tạo hồ sơ qua `POST /api/v1/business-profiles`.

## Endpoint Mini App

| Method   | Endpoint                                | Auth       | Mô tả                                        |
| -------- | --------------------------------------- | ---------- | -------------------------------------------- |
| `GET`    | `/api/v1/business-profiles`             | Public     | Danh sách hồ sơ công khai                    |
| `GET`    | `/api/v1/business-profiles/:idOrUserId` | Public     | Chi tiết theo profile ID hoặc user ID        |
| `POST`   | `/api/v1/business-profiles`             | `BUSINESS` | Tạo hồ sơ; khôi phục nếu hồ sơ đã xóa mềm    |
| `GET`    | `/api/v1/business-profiles/me`          | `BUSINESS` | Hồ sơ hiện tại, kể cả khi `isPublic = false` |
| `PATCH`  | `/api/v1/business-profiles/me`          | `BUSINESS` | Cập nhật; bắt buộc gửi `version` hiện tại    |
| `DELETE` | `/api/v1/business-profiles/me`          | `BUSINESS` | Xóa mềm, hồ sơ biến mất khỏi API public      |

Danh sách nhận `businessType`, `search`, `page`, `limit`, `sortOrder`. API public chỉ trả hồ sơ `isPublic = true`, chưa xóa, thuộc tài khoản `BUSINESS` đang `ACTIVE`.

## Endpoint Admin

| Method   | Endpoint                              | Role             | Mô tả                                    |
| -------- | ------------------------------------- | ---------------- | ---------------------------------------- |
| `GET`    | `/api/v1/admin/business-profiles`     | ADMIN, MODERATOR | Danh sách; có thể `includeDeleted=true`  |
| `GET`    | `/api/v1/admin/business-profiles/:id` | ADMIN, MODERATOR | Chi tiết, kể cả hồ sơ ẩn/xóa mềm         |
| `POST`   | `/api/v1/admin/business-profiles`     | ADMIN            | Tạo cho tài khoản BUSINESS bằng `userId` |
| `PATCH`  | `/api/v1/admin/business-profiles/:id` | ADMIN            | Cập nhật với `version`                   |
| `DELETE` | `/api/v1/admin/business-profiles/:id` | ADMIN            | Xóa mềm                                  |

## Field chung

Field bắt buộc khi tạo:

- `businessName`
- `contactName`
- `contactPhone`: số điện thoại Việt Nam
- `contactEmail`
- `address`

Field tùy chọn:

- `businessCategory`
- `googleMapsUrl`, `lat`, `lng`; `lat` và `lng` phải cùng có hoặc cùng `null`
- `website`, `facebookUrl`, `zaloOaUrl`
- `logoUrl`, `coverImageUrl`
- `description`
- `isPublic`, mặc định `true`

`businessType` được lấy từ tài khoản đã duyệt, client không được tự chọn hay thay đổi tại API hồ sơ.

## Field theo loại hình

| `businessType`      | Field áp dụng                     | Bắt buộc       |
| ------------------- | --------------------------------- | -------------- |
| `TEMPLE_MANAGEMENT` | `templeName`                      | `templeName`   |
| `RESTAURANT`        | `openingHours`, `seatingCapacity` | Không          |
| `ACCOMMODATION`     | `openingHours`, `roomCount`       | Không          |
| `GARDEN`            | `gardenArea`, `mainProducts`      | `mainProducts` |
| `GENERAL`           | Không có field riêng              | Không          |

Backend đặt field không thuộc loại hình về `null`, ví dụ hồ sơ `RESTAURANT` không lưu `roomCount`.

## Ví dụ tạo hồ sơ Chủ vườn

```http
POST /api/v1/business-profiles
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "businessName": "Vườn Mãng Cầu Ba Đen",
  "businessCategory": "Vườn cây ăn trái",
  "gardenArea": "2 ha",
  "mainProducts": "Mãng cầu, bưởi da xanh",
  "contactName": "Nguyễn Văn A",
  "contactPhone": "0912345678",
  "contactEmail": "vuon@example.com",
  "address": "Truông Mít, Tây Ninh",
  "googleMapsUrl": "https://www.google.com/maps?q=11.1,106.1",
  "lat": 11.1,
  "lng": 106.1,
  "description": "Canh tác theo hướng hữu cơ",
  "isPublic": true
}
```

## Cập nhật và xung đột version

```json
{
  "version": 3,
  "gardenArea": "2.5 ha",
  "mainProducts": "Mãng cầu, bưởi da xanh, sầu riêng"
}
```

Response thành công tăng `version` lên 4. Nếu một thiết bị khác đã sửa trước, API trả `409 BUSINESS_PROFILE_VERSION_CONFLICT`; client phải tải lại `GET /business-profiles/me`, cho người dùng xem dữ liệu mới rồi mới gửi lại.

## Mã lỗi chính

- `403 BUSINESS_ACCOUNT_REQUIRED`: không phải tài khoản BUSINESS ACTIVE.
- `404 BUSINESS_PROFILE_NOT_FOUND`: không có hồ sơ hoặc hồ sơ không còn công khai.
- `409 BUSINESS_PROFILE_ALREADY_EXISTS`: gọi create khi hồ sơ hiện tại vẫn tồn tại.
- `409 BUSINESS_PROFILE_VERSION_CONFLICT`: `version` cũ.
- `400 VALIDATION_ERROR`: thiếu field chung, thiếu field bắt buộc theo loại hình, URL không hợp lệ hoặc thiếu một trong `lat`/`lng`.

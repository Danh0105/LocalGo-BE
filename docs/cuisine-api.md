# API Ẩm thực

Module `cuisine` quản lý danh sách món ăn địa phương. Mọi endpoint dùng prefix `/api/v1` và response envelope chung của dự án.

## Endpoints

| Method | Endpoint                                             | Quyền            | Mô tả                                                       |
| ------ | ------------------------------------------------------ | ---------------- | ------------------------------------------------------------ |
| GET    | `/cuisine?category=Món nước`                            | Public           | Chỉ bản ghi active, sắp xếp `sortOrder`, `createdAt`, `id`   |
| GET    | `/cuisine/:id`                                           | Public           | Chi tiết active, gồm `description`, `highlights`, `suggestedPlaces`, `tip` |
| GET    | `/admin/cuisine?page=1&limit=20&category=&search=`      | ADMIN, MODERATOR | Danh sách gồm cả bản ghi ẩn, tìm theo tên                    |
| GET    | `/admin/cuisine/:id`                                     | ADMIN, MODERATOR | Chi tiết và `version` hiện tại                                |
| POST   | `/admin/cuisine`                                         | ADMIN, MODERATOR | Tạo mới, tự sinh slug nếu không gửi `id`                      |
| PUT    | `/admin/cuisine/:id`                                     | ADMIN, MODERATOR | Cập nhật toàn bộ với optimistic locking                       |
| PATCH  | `/admin/cuisine/:id/status`                              | ADMIN, MODERATOR | Ẩn/hiện với optimistic locking                                |
| PATCH  | `/admin/cuisine/reorder`                                 | ADMIN, MODERATOR | Cập nhật thứ tự hàng loạt trong transaction                   |
| DELETE | `/admin/cuisine/:id`                                     | ADMIN, MODERATOR | Xóa món ăn                                                     |

Public list chỉ trả dữ liệu cần cho thẻ danh sách (gồm cả `suggestedPlaces` — deprecated, xem mục Rollout bên dưới — vì danh sách địa điểm ngắn, phù hợp hiển thị ngay). Public detail trả thêm `description`, `highlights`, `tip` và `suggestedPlaceDetails`. Public API không phân biệt bản ghi không tồn tại và bản ghi đang ẩn: cả hai đều trả `404 CUISINE_ITEM_NOT_FOUND`.

`GET /cuisine/:id` trả `ETag: "cuisine-{id}-{updatedAtMillis}"` và `Cache-Control: public, max-age=60, must-revalidate`. Mọi thao tác cập nhật làm đổi `updatedAt`, vì vậy ETag cũ tự mất hiệu lực.

## Request tạo/cập nhật

```json
{
  "version": 2,
  "name": "Bánh canh Trảng Bàng",
  "category": "Món nước",
  "priceRange": "35.000đ - 55.000đ/tô",
  "bestTime": "Buổi sáng hoặc chiều tối",
  "suggestedPlaceDetails": [
    {
      "id": "quan-an-khu-trung-tam-xa",
      "name": "Quán ăn khu trung tâm xã",
      "address": "Xã Truông Mít, tỉnh Tây Ninh",
      "googleMapsUrl": "https://maps.app.goo.gl/example"
    }
  ],
  "summary": "Tô bánh canh nóng với sợi mềm...",
  "description": ["Đoạn 1", "Đoạn 2"],
  "highlights": ["Phù hợp ăn sáng, ăn nhẹ hoặc dùng sau khi tham quan"],
  "tip": "Nên ăn lúc còn nóng.",
  "mediaId": "uuid-media",
  "imageAlt": "Bánh canh Trảng Bàng",
  "isActive": true
}
```

`category` chỉ nhận một trong năm giá trị `Món nước | Món nướng | Món cuốn | Ăn vặt | Món chay` (lưu dưới dạng enum Postgres, không phải free text). `priceRange`, `bestTime`, `tip` là chuỗi tự do. Slug của món ăn không đổi khi cập nhật tên.

### `suggestedPlaceDetails` — địa điểm gợi ý kèm link Google Maps

Mỗi phần tử tối đa 20 phần tử/món, giữ đúng thứ tự Admin nhập:

- `id`: bắt buộc, tối đa 100 ký tự, duy nhất trong cùng một món (trùng `id` bị từ chối `400 VALIDATION_ERROR`).
- `name`: bắt buộc, tối đa 200 ký tự.
- `address`: tùy chọn (mặc định rỗng khi chưa nhập), tối đa 255 ký tự.
- `googleMapsUrl`: tùy chọn (rỗng nghĩa là chưa dán link), tối đa 2.048 ký tự. Khi có giá trị, chỉ
  chấp nhận **HTTPS** và đúng domain Google Maps: `https://www.google.com/maps/...`,
  `https://google.com/maps/...`, `https://maps.google.com/...`, `https://maps.app.goo.gl/...`, hoặc
  `https://goo.gl/maps/...` (link rút gọn cũ). URL được so khớp `hostname` chính xác qua allowlist
  (không dùng `includes`), nên từ chối domain giả (`google.com.evil.example`), sai scheme (`http`,
  `javascript:`, `data:`), URL chứa `user:pass@`, URL không parse được hoặc vượt 2.048 ký tự.
  Backend **không** gọi Geocoding, không follow link rút gọn, không tự sinh link từ tên — chỉ lưu và
  trả lại đúng chuỗi Admin đã dán.
- Khi món được bật hiển thị (`isActive = true`, lúc tạo mới, `PUT` hoặc `PATCH .../status`), **mỗi**
  địa điểm trong `suggestedPlaceDetails` phải có `address` và `googleMapsUrl` hợp lệ (không rỗng);
  thiếu một trong hai bị từ chối `400 VALIDATION_ERROR`.
- Lỗi 400 do validate nested trả kèm path rõ trong nội dung message, ví dụ
  `suggestedPlaceDetails.1.googleMapsUrl must be...`.

`suggestedPlaces: string[]` (field cũ) **deprecated** — vẫn được nhận nếu request không gửi
`suggestedPlaceDetails`, tự động chuyển thành object với `address`/`googleMapsUrl` rỗng và `id` suy
ra từ tên. Nếu cả hai field cùng được gửi, `suggestedPlaceDetails` luôn được ưu tiên và
`suggestedPlaces` gửi kèm bị bỏ qua. Response luôn trả cả hai field; `suggestedPlaces` được **derive**
từ `suggestedPlaceDetails[].name`, không phải nguồn dữ liệu độc lập.

Khi `version` cũ, API trả `409 CUISINE_ITEM_VERSION_CONFLICT`; `error.details[0].latest` chứa bản ghi mới nhất để giao diện cảnh báo và cho phép tải lại mà không ghi đè âm thầm.

## Media

1. Upload JPEG/PNG/WebP bằng `POST /api/v1/media/images` với Bearer token.
2. Dùng `data.id` làm `mediaId` khi tạo/cập nhật món ăn.
3. Backend xác minh media chưa xóa, MIME bắt đầu bằng `image/`, thuộc người gọi và chưa được nội dung khác sử dụng. Media được claim thành resource `CUISINE` trong cùng transaction ghi nội dung.

Seed không hard-code domain CDN hay đường dẫn máy local. Có thể upload một ảnh placeholder vào media storage của môi trường, sau đó đặt `CUISINE_PLACEHOLDER_MEDIA_ID` trước khi chạy seed. Nếu không đặt, seed vẫn tạo đủ nội dung với `mediaId = null`; admin có thể gắn ảnh sau.

## Migration và seed

```powershell
npx.cmd prisma migrate deploy
npm.cmd run db:seed
```

Seed idempotent tạo đúng 5 slug hiện tại: `banh-canh-trang-bang`, `bo-to-nuong-rau-rung`, `goi-cuon-banh-trang-phoi-suong`, `banh-trang-tron`, `nem-buoi-chay`, giữ nguyên `description`, `highlights`, `suggestedPlaceDetails` (hiện chưa có `googleMapsUrl` thật, xem mục Rollout) và `tip` từ Mini App.

Slug `nem-buoi-chay` cố ý khác với `nem-buoi` bên module Đặc sản dù mô tả món tương tự — hai bảng `CuisineItem` và `Specialty` độc lập, không chia sẻ khóa chính hay khóa ngoại.

## Rollout `suggestedPlaceDetails`

`CuisineItem.suggestedPlaces` (cột `Json`) không đổi kiểu — chỉ đổi **nội dung** JSON lưu bên trong,
từ mảng tên chuỗi sang mảng object `{id, name, address, googleMapsUrl}`. Không có bước migration
schema/cột nào cho thay đổi này.

Thứ tự triển khai:

1. Deploy BE này — đọc được cả `suggestedPlaces: string[]` cũ lẫn `suggestedPlaceDetails` mới, ghi ưu
   tiên field mới.
2. Deploy bản Admin mới cho phép dán `googleMapsUrl` trực tiếp vào từng địa điểm.
3. Admin bổ sung `address` + `googleMapsUrl` thật cho toàn bộ địa điểm của các món đang active,
   **bao gồm 5 slug seed hiện tại** (hiện đều có `address: ''`, `googleMapsUrl: ''` vì chưa có link
   thật được xác nhận — không được seed link mẫu).
4. Deploy Mini App dùng `suggestedPlaceDetails[].googleMapsUrl` để mở trực tiếp Google Maps (không
   cần tự dựng URL từ tên/tọa độ).
5. Chỉ bỏ hẳn field `suggestedPlaces` (deprecated) ở một API version sau, khi xác nhận không còn
   client cũ nào phụ thuộc field này.

Trong lúc rollout, endpoint `PATCH .../status` sẽ từ chối kích hoạt (`isActive: true`) bất kỳ món nào
còn địa điểm thiếu `address`/`googleMapsUrl` — kể cả bản ghi active từ trước khi field này tồn tại,
nếu sau này bị tắt rồi bật lại. Rollout chỉ coi là hoàn tất khi không còn món active nào có địa điểm
thiếu link Maps hợp lệ.

## Error codes

- `CUISINE_ITEM_NOT_FOUND`: không tồn tại hoặc đang ẩn trên public API.
- `CUISINE_ITEM_SLUG_EXISTS`: slug tạo mới bị trùng.
- `CUISINE_ITEM_VERSION_CONFLICT`: version cập nhật/status đã cũ.
- `INVALID_CUISINE_ITEM_MEDIA`: media thiếu, sai MIME, đã xóa hoặc không có quyền dùng.
- `VALIDATION_ERROR`: enum, giới hạn chuỗi/mảng, slug, `googleMapsUrl` sai scheme/domain/quá dài, ID
  địa điểm trùng trong `suggestedPlaceDetails`, quá 20 địa điểm, cố kích hoạt món có địa điểm thiếu
  `address`/`googleMapsUrl`, hoặc cấu trúc request không hợp lệ.

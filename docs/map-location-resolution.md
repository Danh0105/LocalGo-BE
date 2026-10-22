# Phân giải vị trí từ Google Maps

## Contract

Public và admin list/detail của `map-places`, `cuisine`, `temples` và
`historical-sites` trả thêm field read-only sau. Response cuisine còn trả field
này độc lập trong từng `suggestedPlaceDetails[]`.

```json
{
  "googleMapsUrl": "https://www.google.com/maps/place/example/data=!3d11.2418!4d106.2024",
  "mapLocation": {
    "status": "resolved",
    "coordinates": { "lat": 11.2418, "lng": 106.2024 },
    "resolvedAt": "2026-10-20T08:00:00.000Z"
  }
}
```

Không có link hợp lệ thì `mapLocation` là `null`. Link mới/chưa xử lý trả
`pending`; link rõ tọa độ trả `resolved`; link hợp lệ nhưng không xác định chắc
đích trả `unresolved`; lỗi mạng/provider hết số lần retry trả `failed`.
`coordinates` cũ của `map-places` được giữ để tương thích và không được dùng để
tự tạo kết quả `resolved`.

`GET /api/v1/cuisine` trả cả `mapLocation` cấp món và
`suggestedPlaceDetails[].mapLocation` để Mini App tổng hợp ghim mà không phải gọi
detail tuần tự. Các admin list có phân trang hiện hữu; client lấy đủ dữ liệu
bằng cách tăng `page` cho tới khi đạt `meta.totalPages`.

## Lưu trữ và worker

Migration `20261020190000_map_location_resolution` tạo bảng
`MapLocationResolution`. Mỗi hàng vừa là cache bền vững vừa là job, khóa duy
nhất bằng `source + sourceId + subId`. `subId` là ID quán với cuisine và rỗng
cho bản ghi cấp cha. Worker không sửa JSON cuisine.

Khi Admin tạo/sửa link, hàng pending được ghi trong cùng transaction với nội
dung. Link không đổi giữ kết quả cũ. Link đổi/xóa lập tức xóa tọa độ cũ; worker
chỉ ghi nếu `urlHash` vẫn khớp nên job của link trước không thể ghi đè. Xóa nội
dung cũng xóa toàn bộ association. Bản ghi ẩn không xuất hiện ở public API theo
filter sẵn có.

Worker chỉ phân tích `!3d...!4d...`, segment tọa độ chính xác trong
`/maps/search/<lat>,<lng>`, `destination`, `query` hoặc `q` chứa đúng một cặp
tọa độ, và tọa độ đích cuối rõ trong URL `/maps/dir`. Đoạn camera `@lat,lng` bị
bỏ qua. Link ngắn được follow tối đa 5 redirect, kiểm tra lại HTTPS/host/path/DNS
từng hop và dừng ngay khi một `Location` hợp lệ đã chứa tọa độ đích. Request nào
còn cần thực hiện sẽ pin IP đã kiểm tra khi kết nối, timeout 5 giây mỗi request
và 10 giây toàn lượt. Worker chỉ đọc header rồi đóng response nên không tải HTML
bản đồ, cookie hay authorization.

Place ID/tên đơn thuần hiện trả `unresolved`. Repo không có cấu hình Google Maps
Platform. Places API hiện hạn chế cache nội dung và đặt điều kiện hiển thị trên
bản đồ; Mini App dùng Leaflet trong khi contract cần lưu tọa độ bền vững, nên
không tích hợp API tính phí nếu chưa có quyết định sản phẩm/pháp lý phù hợp.
Tham chiếu tài liệu hiện hành: [Place Details (New)](https://developers.google.com/maps/documentation/places/web-service/place-details)
và [Places API policies](https://developers.google.com/maps/documentation/places/web-service/policies).

Repo không có module/API `attractions`; dữ liệu `src/data/attractions.ts` được
nêu trong tài liệu mapping là dữ liệu FE. Backend này chưa bao phủ nguồn đó.

## Cấu hình và lệnh vận hành

```dotenv
MAP_LOCATION_WORKER_ENABLED=true
MAP_LOCATION_WORKER_CONCURRENCY=3
MAP_LOCATION_WORKER_POLL_MS=5000
MAP_LOCATION_MAX_ATTEMPTS=3
```

Chạy migration trước, sau đó bật worker trên ít nhất một instance API. Nhiều
instance dùng `FOR UPDATE SKIP LOCKED`, không claim trùng cùng một job.

```bash
npm run prisma:deploy
npm run map-location:backfill -- --dry-run --batch-size=100
npm run map-location:backfill -- --batch-size=100
npm run map-location:retry
# hoặc chỉ một trạng thái
npm run map-location:backfill -- --retry=failed
```

Backfill idempotent, không gọi provider trực tiếp, không đổi link/nội dung,
version hoặc timestamp nghiệp vụ. Nó chỉ đồng bộ queue theo batch và in các số
`eligible`, `pending`, `resolved`, `unresolved`, `failed` cùng `reasons` đã
được gom theo mã lỗi (không in URL). Worker giải quyết
queue với concurrency giới hạn và retry lũy tiến cho lỗi mạng/429/5xx.

## Rollback

Tắt `MAP_LOCATION_WORKER_ENABLED`, rollback code đọc/ghi `mapLocation`, rồi mới
drop bảng và enum nếu chắc chắn không cần giữ cache. Migration rollback thủ công:

```sql
DROP TABLE IF EXISTS "MapLocationResolution";
DROP TYPE IF EXISTS "MapLocationStatus";
DROP TYPE IF EXISTS "MapLocationSource";
```

Các cột nội dung và `googleMapsUrl` không bị migration này sửa nên rollback
không làm mất dữ liệu Admin.

## Kiểm tra thủ công

- URL dài có `!3d/!4d`; URL có `destination` là đúng một cặp; URL chỉ có camera
  `@lat,lng` phải không resolve.
- `maps.app.goo.gl`/`goo.gl/maps` redirect hợp lệ; redirect quá 5 hop, sang host
  lạ, DNS private/loopback, timeout, 429 và 5xx.
- URL chỉ có tên hoặc Place ID phải `unresolved`, không tự chọn kết quả.
- Sửa link khi job cũ đang chạy: response phải về `pending` và kết quả cũ không
  được ghi lại. Xóa link trả `mapLocation: null` ngay.
- Xóa/ẩn record và xóa một quán cuisine; public response không còn ghim tương
  ứng. Reorder quán không làm mất kết quả; đổi link của một quán không ảnh hưởng
  quán khác.
- Chạy dry-run, backfill hai lần và retry `failed/unresolved`; nội dung, thứ tự,
  version và timestamp nghiệp vụ phải giữ nguyên.

## Việc FE cần nối tiếp

Thêm `mapLocation` vào types/mappers của bốn nguồn và từng suggested place.
Chỉ tạo ghim khi `status === 'resolved'`; đổi `{ lat, lng }` thành `[lat, lng]`
cho Leaflet. Khi chưa có tọa độ, vẫn giữ địa điểm trong danh sách và dùng
`googleMapsUrl` gốc cho icon chỉ đường. FE hiện chưa đọc field này nên thay đổi
backend chưa tự làm ghim xuất hiện.

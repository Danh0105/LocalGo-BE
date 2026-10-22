# Google Maps links

Các API nội dung public/admin của 11 phân hệ menu trả thêm trường
`googleMapsUrl: string` ở cả danh sách và chi tiết:

- Đền - Chùa - Miếu, Di tích lịch sử, Nông nghiệp
- Liên hệ, OCOP, Làng nghề, Ẩm thực
- Tour trải nghiệm, Bản đồ, Tin tức, Lễ hội

Admin có thể gửi `googleMapsUrl` khi tạo/cập nhật. Trường này là tùy chọn để
tương thích dữ liệu cũ; chuỗi rỗng (`""`) nghĩa là chưa cấu hình. Khi có giá
trị, API chỉ chấp nhận HTTPS thuộc một trong các dạng Google Maps sau:

- `https://www.google.com/maps/...`
- `https://google.com/maps/...`
- `https://maps.google.com/...`
- `https://maps.app.goo.gl/...`
- `https://goo.gl/maps/...`

Mini App chỉ hiển thị hành động mở bản đồ khi `googleMapsUrl` khác rỗng và dùng
nguyên URL này làm đích điều hướng.

Bốn nguồn dùng để đặt ghim (`map-places`, `cuisine`, `temples`,
`historical-sites`) còn trả `mapLocation` read-only. Cách phân giải, vận hành
worker và backfill được mô tả tại [map-location-resolution.md](./map-location-resolution.md).
Link gốc luôn được giữ nguyên; Admin không gửi tọa độ hoặc trạng thái resolver.

Riêng Ẩm thực vẫn giữ `suggestedPlaceDetails[].googleMapsUrl` cho từng quán/địa
điểm gợi ý. `googleMapsUrl` cấp món là địa điểm chính, giúp client dùng chung
một hợp đồng với các phân hệ còn lại.

Riêng Đặc sản không có một địa điểm chính nên không dùng `googleMapsUrl` cấp
đặc sản. Mỗi điểm mua có link riêng tại
`buyPlaceDetails[].googleMapsUrl`, cùng `phone` và `email` liên hệ.

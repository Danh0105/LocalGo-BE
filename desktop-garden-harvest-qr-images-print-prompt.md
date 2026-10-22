Cập nhật giao diện Desktop LocalGo dành cho **Chủ vườn** — bổ sung hình ảnh
cho lô thu hoạch và đổi mẫu in mã QR thành hai tem QR thuần trên cùng một lượt
in.

Phạm vi là Business/Seller Center trên desktop, mục **“Lô hàng & tem QR”**.
Không thay đổi luồng mật khẩu và không đưa chức năng này vào trang Admin.

## 1. Hiện trạng và yêu cầu quan trọng

Backend hiện có CRUD lô thu hoạch:

- `GET /api/v1/harvest-batches`
- `POST /api/v1/harvest-batches`
- `GET /api/v1/harvest-batches/:id`
- `PATCH /api/v1/harvest-batches/:id`
- `DELETE /api/v1/harvest-batches/:id`
- `GET /api/v1/harvest-trace/:code` — công khai

Quyền quản lý chỉ dành cho tài khoản:

```ts
user.role === 'BUSINESS' && user.businessType === 'GARDEN';
```

Yêu cầu mới:

1. Form tạo/sửa lô thu hoạch cho phép tải hình ảnh thực tế của trái cây/lô
   hàng.
2. Hình ảnh xuất hiện trong chi tiết lô của Chủ vườn và trang truy xuất công
   khai khi khách quét QR.
3. Mẫu in **không in bất kỳ thông tin bổ sung nào**: không tên trái cây, tên
   Chủ vườn, ngày thu hoạch, giá, mã chữ, logo, hình ảnh hoặc khung mô tả.
4. Mỗi lần bấm in từ một lô phải in **hai bản giống nhau của cùng mã QR**, chia
   giấy thành hai cột vì máy in hỗ trợ hai tem cùng lúc.

## 2. Điều kiện backend bắt buộc cho hình ảnh

Backend hiện tại chưa nhận `imageIds` và response lô chưa có `images`. Không
được tự lưu URL/base64 ở frontend, nhét URL vào `fertilizers`, `pesticides` hay
bất kỳ trường văn bản nào.

Trước khi nối UI production, backend phải bổ sung contract sau:

### Upload ảnh

Dùng API media sẵn có:

```http
POST /api/v1/media/images/batch
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data

files=<image-1>
files=<image-2>
```

API nhận JPG/PNG/WebP, tối đa 10 file/lần, và trả mảng media:

```json
[
  {
    "id": "media-uuid",
    "url": "https://.../image.webp",
    "thumbnailUrl": "https://.../image-thumb.webp",
    "width": 1200,
    "height": 900
  }
]
```

### Payload lô thu hoạch

`POST /harvest-batches` và `PATCH /harvest-batches/:id` cần nhận thêm:

```json
{
  "imageIds": ["media-uuid-1", "media-uuid-2"]
}
```

Quy ước:

- Tối đa 10 ảnh/lô, không trùng id; thứ tự mảng là thứ tự hiển thị.
- Tạo mới: không gửi hoặc gửi `[]` nghĩa là lô không có ảnh.
- Cập nhật: chỉ gửi `imageIds` khi người dùng thay đổi ảnh; gửi `[]` để xóa
  toàn bộ ảnh khỏi lô.
- Backend phải kiểm tra ảnh thuộc chính tài khoản đang thao tác, chưa bị gắn
  vào resource khác và claim ảnh atomically cùng thao tác tạo/cập nhật lô.
- Bổ sung `HARVEST_BATCH` vào loại media và quan hệ ảnh có `sortOrder`; không
  lưu mảng URL trực tiếp trong bảng lô.
- Xóa/thay ảnh phải release hoặc soft-delete media theo cơ chế media hiện có,
  không để tài khoản khác chiếm lại ảnh.

Response quản lý và response công khai thêm:

```json
{
  "images": [
    {
      "id": "media-uuid-1",
      "url": "https://.../image.webp",
      "thumbnailUrl": "https://.../image-thumb.webp",
      "width": 1200,
      "height": 900,
      "sortOrder": 0
    }
  ]
}
```

Riêng `GET /harvest-trace/:code`, có thể bỏ `id` nội bộ nếu DTO public của dự
án yêu cầu; tối thiểu phải có `url`, `thumbnailUrl`, kích thước và thứ tự.

Nếu backend production chưa trả `images`, frontend phải tương thích ngược bằng
`images ?? []`, nhưng không được coi đó là hoàn thành chức năng upload.

## 3. Form tạo/sửa lô — bổ sung hình ảnh

Giữ nguyên các field hiện có: tên Chủ vườn, tên trái cây, ngày cắt, trọng lượng,
giá/kg, phân bón và thuốc bảo vệ thực vật.

Thêm section **“Hình ảnh lô hàng”** ở cuối phần thông tin, trước nhóm nút hành
động:

- Nhãn phụ: “Tối đa 10 ảnh JPG, PNG hoặc WebP.”
- Hỗ trợ chọn nhiều file và kéo-thả file trên desktop.
- Hiện preview thumbnail theo dạng grid.
- Cho phép:
  - thêm ảnh;
  - xóa từng ảnh;
  - đổi thứ tự ảnh bằng kéo-thả hoặc nút di chuyển trái/phải;
  - mở preview ảnh lớn;
  - thử tải lại riêng ảnh lỗi.
- Ảnh đầu tiên là ảnh đại diện trong danh sách lô và đầu trang truy xuất.
- Validate định dạng/kích thước trước khi upload theo giới hạn backend; vẫn xử
  lý lỗi backend `INVALID_IMAGE_FORMAT`, `IMAGE_SIZE_EXCEEDED` và
  `UPLOAD_LIMIT_EXCEEDED`.
- Không upload lại ảnh cũ khi sửa lô. Giữ `id` ảnh cũ, chỉ upload file mới rồi
  ghép thành `imageIds` theo đúng thứ tự cuối cùng.
- Disable nút Lưu/Tạo mã trong lúc còn ảnh đang upload hoặc lỗi chưa xử lý.
- Có progress/loading và chống submit lặp.

Luồng tạo:

1. Validate field lô và file ảnh.
2. Upload các file mới qua `/media/images/batch`.
3. Lấy `id` media theo thứ tự UI.
4. Gọi `POST /harvest-batches` một lần với dữ liệu lô và `imageIds`.
5. Chỉ mở modal kết quả/QR khi bước tạo lô thành công.
6. Nếu upload hoặc tạo lô lỗi, không gọi bước tiếp theo; hiển thị
   `error.message` và cho phép thử lại an toàn.

Luồng sửa:

1. Tải dữ liệu lô, map `images ?? []`.
2. Upload riêng ảnh mới.
3. Gọi `PATCH /harvest-batches/:id` với `imageIds` cuối cùng nếu ảnh đã thay
   đổi.
4. Mã `code` không thay đổi; QR đã in tiếp tục mở dữ liệu và ảnh mới.

Danh sách lô:

- Hiện thumbnail ảnh đầu tiên nếu có.
- Nếu không có ảnh, dùng placeholder trung tính; không hiển thị ảnh lỗi.
- Lazy-load thumbnail, có `alt` từ tên trái cây.

Trang truy xuất công khai:

- Hiện ảnh đầu tiên lớn, các ảnh còn lại trong gallery/carousel.
- Có trạng thái không ảnh và ảnh lỗi; không làm hỏng phần thông tin truy xuất.
- Ảnh chỉ xuất hiện trên màn hình xem thông tin, **không xuất hiện trên bản in
  QR**.

## 4. Mẫu in QR mới: hai tem, chỉ có QR

Khi người dùng bấm **“In mã QR”** từ chi tiết/kết quả tạo một lô:

- Mỗi lượt in đúng **một trang vật lý**.
- Trang được chia thành **hai vùng bằng nhau theo chiều ngang**.
- Vùng trái và vùng phải chứa **hai bản giống nhau của QR thuộc lô đang chọn**.
- Mỗi vùng chỉ có QR ở chính giữa.
- Không in:
  - tên trái cây;
  - tên Chủ vườn/nhà vườn;
  - ngày cắt, trọng lượng, giá;
  - mã `code` dạng chữ;
  - logo, tiêu đề, đường viền, mô tả;
  - hình ảnh lô;
  - nút hoặc thành phần điều hướng.

QR mã hóa URL công khai:

```text
https://<desktop-public-domain>/truy-xuat/<code>
```

Không mã hóa API URL, JSON hay chỉ riêng chuỗi code. Sau khi quét, trang
`/truy-xuat/:code` gọi `GET /harvest-trace/:code` như hiện tại.

### Layout in

Dùng một component/route print riêng, render bằng SVG hoặc canvas đủ nét:

```html
<main class="qr-print-sheet">
  <section class="qr-label"><!-- QR giống nhau --></section>
  <section class="qr-label"><!-- QR giống nhau --></section>
</main>
```

CSS bắt buộc:

```css
@media print {
  @page {
    margin: 0;
  }

  html,
  body {
    margin: 0;
    padding: 0;
  }

  .no-print {
    display: none !important;
  }

  .qr-print-sheet {
    display: grid;
    grid-template-columns: 1fr 1fr;
    width: 100%;
    height: 100%;
    break-after: avoid;
    page-break-after: avoid;
    overflow: hidden;
  }

  .qr-label {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
}
```

Yêu cầu kỹ thuật:

- QR có nền trắng, mã đen, tương phản cao và quiet zone tối thiểu 4 modules.
- QR vuông, dùng kích thước lớn nhất vừa mỗi nửa tem nhưng không bị crop.
- Không dùng `transform: scale()` gây mờ; ưu tiên QR SVG hoặc canvas theo mật
  độ điểm ảnh máy in.
- Không để grid tạo trang thứ hai do margin, border hoặc sai box sizing.
- Không render UI app vào DOM in; chỉ render print sheet và hai QR.
- Nút “In” trên màn hình chỉ dùng để gọi `window.print()` và phải bị ẩn trong
  `@media print`.
- Print preview phải đặt scale 100%, margin none. Nếu trình duyệt hỗ trợ header/
  footer mặc định, hướng dẫn tắt header/footer trong hộp thoại in.

### Khổ tem hai cột

Giữ các lựa chọn kích thước tem hiện có nhưng hiểu kích thước là **mỗi tem**.
Kích thước một trang hai cột tương ứng:

| Mỗi tem  | Trang in hai tem |
| -------- | ---------------- |
| 40×30 mm | 80×30 mm         |
| 50×30 mm | 100×30 mm        |
| 60×40 mm | 120×40 mm        |
| 70×50 mm | 140×50 mm        |

Tạo print stylesheet/class riêng cho từng khổ để đặt `@page size` chính xác.
Nếu máy in thực tế có khe giữa hai tem, đưa `columnGapMm` vào cấu hình máy in
và cộng đúng phần khe vào chiều rộng trang; mặc định là `0`, không tự thêm
padding.

Không thêm form “Thông tin in” hoặc bắt Chủ vườn nhập lại dữ liệu trước khi
in. Nút in dùng trực tiếp `code` của lô hiện tại.

## 5. Trạng thái và lỗi

- Lô vừa tạo nhưng chưa render xong QR: disable nút in và hiện “Đang tạo mã
  QR…”.
- Không có `code`: không mở print dialog, báo “Không tìm thấy mã lô hàng”.
- Upload ảnh lỗi: giữ dữ liệu form và các ảnh upload thành công, chỉ retry ảnh
  lỗi.
- API tạo lô lỗi sau upload: giữ form để retry, không tự tạo lô lần hai song
  song.
- 401: dùng refresh flow chung tối đa một lần.
- 403 `GARDEN_ACCOUNT_REQUIRED`: đóng chức năng và báo chỉ dành cho Chủ vườn.
- 404 `HARVEST_BATCH_NOT_FOUND`: báo lô không còn tồn tại và quay về danh sách.
- Không log file, URL tạm, media token hoặc nội dung nhạy cảm vào analytics.

## 6. Kiểm thử bắt buộc

- [ ] Tạo lô không ảnh vẫn hoạt động và response `images ?? []` không làm vỡ
      UI.
- [ ] Upload nhiều ảnh, đổi thứ tự, xóa ảnh rồi tạo lô; API nhận đúng thứ tự
      `imageIds`.
- [ ] Sửa lô giữ ảnh cũ, thêm ảnh mới và xóa một ảnh mà không upload lại ảnh
      cũ.
- [ ] File sai định dạng/quá dung lượng hiển thị đúng lỗi và không submit lô.
- [ ] Danh sách dùng thumbnail đầu; chi tiết và trang truy xuất hiển thị gallery
      đúng thứ tự.
- [ ] Chủ vườn chỉ sửa ảnh lô của mình; media của tài khoản khác bị backend từ
      chối.
- [ ] Mỗi lần in từ một lô tạo đúng một trang với hai QR giống nhau, hai cột
      bằng nhau.
- [ ] Bản in không có chữ, mã code, logo, ảnh, border, nút hoặc thông tin lô.
- [ ] Quét cả QR trái và QR phải đều mở đúng `/truy-xuat/<code>`.
- [ ] QR không bị crop/mờ và còn đủ quiet zone ở bốn khổ tem.
- [ ] Print preview không sinh trang trắng hoặc trang thứ hai.
- [ ] Kiểm tra trực tiếp trên máy in hai tem với scale 100%, margin none và
      header/footer tắt.
- [ ] Trang truy xuất cũ và QR đã in trước đây vẫn hoạt động sau khi bổ sung
      hình ảnh.

Hoàn thành bằng component/API client/style hiện có của dự án, responsive cho
desktop từ 1024 px trở lên, có unit/integration test cho upload/reorder ảnh và
test DOM/CSS print bảo đảm đúng hai QR thuần trên một trang.

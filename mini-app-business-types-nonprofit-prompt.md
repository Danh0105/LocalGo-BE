Cập nhật Zalo Mini App: form đăng ký giao thương theo loại hình (Ban quản lý đền/miếu, nhà hàng, khách sạn, chủ vườn, khác) và tin phi lợi nhuận (không cần giá).

## Hiện trạng backend (đã có sẵn)

### 1. Loại hình đăng ký

- `GET /api/v1/business-applications/business-types` (công khai) trả danh sách loại hình. Mỗi loại hình có, theo từng dạng đăng ký Cá nhân/Tổ chức, đúng các trường và giấy tờ cần thu, kèm nhãn tiếng Việt. **Hãy dựng form từ endpoint này, đừng hard-code**:
  ```json
  {
    "type": "TEMPLE_MANAGEMENT",
    "label": "Ban quản lý đền/miếu",
    "description": "...",
    "postPurposes": ["NON_PROFIT"],
    "applicantTypes": [
      {
        "applicantType": "ORGANIZATION",
        "requiredFields": [{ "field": "templeName", "label": "Tên đền/chùa/miếu" }, ...],
        "optionalFields": [],
        "requiredDocuments": [{ "type": "MANAGEMENT_DECISION", "label": "Văn bản xác nhận / quyết định công nhận Ban quản lý" }, ...],
        "optionalDocuments": [{ "type": "OTHER", "label": "Giấy tờ khác" }]
      }
    ]
  }
  ```
- Các loại hình:
  | `type`              | Nhãn                              | Đăng ký dưới dạng          | Ghi chú                                                                                                                           |
  | ------------------- | --------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
  | `TEMPLE_MANAGEMENT` | Ban quản lý đền/miếu              | chỉ Tổ chức                | CCCD người đại diện + văn bản xác nhận/quyết định công nhận Ban quản lý; **không cần** MST/GPKD. Chỉ đăng được tin phi lợi nhuận. |
  | `RESTAURANT`        | Nhà hàng – quán ăn                | Cá nhân hoặc Tổ chức       | GPKD bắt buộc; giấy ATTP tùy chọn; giờ mở cửa, số chỗ ngồi tùy chọn                                                               |
  | `ACCOMMODATION`     | Khách sạn – nhà nghỉ – homestay   | Cá nhân hoặc Tổ chức       | GPKD bắt buộc; giấy ANTT tùy chọn; giờ mở cửa, số phòng tùy chọn                                                                  |
  | `GARDEN`            | Chủ vườn – nhà vườn               | Cá nhân hoặc Tổ chức (HTX) | Cá nhân: CCCD; **sản phẩm/cây trồng chính bắt buộc**; diện tích, giấy chứng nhận QSDĐ tùy chọn                                    |
  | `GENERAL`           | Hộ kinh doanh / doanh nghiệp khác | Cá nhân hoặc Tổ chức       | Như form hiện tại                                                                                                                 |
- `POST /business-applications`, `PATCH /business-applications/:id`, `POST /business-applications/requests` nhận thêm:
  - `businessType`: tùy chọn, mặc định `GENERAL`. Bản mini app cũ không gửi trường này vẫn chạy như trước.
  - Các trường theo loại hình: `templeName`, `openingHours`, `seatingCapacity` (số nguyên), `roomCount` (số nguyên), `gardenArea`, `mainProducts`. Trường không thuộc loại hình đã chọn sẽ bị bỏ qua.
  - `businessCategory` ("Lĩnh vực") **không còn bắt buộc**. Bỏ trống thì backend lưu tên loại hình.
  - Loại giấy tờ mới trong `documents[].type`: `MANAGEMENT_DECISION`, `FOOD_SAFETY_CERTIFICATE`, `SECURITY_CERTIFICATE`, `LAND_USE_CERTIFICATE`.
- Thiếu trường/giấy tờ → 400 `INVALID_BUSINESS_APPLICATION`. `error.message` liệt kê đúng những gì còn thiếu, ví dụ "Hồ sơ nhà hàng – quán ăn còn thiếu: Giấy phép / giấy chứng nhận đăng ký kinh doanh". Hiện thẳng message này cho người dùng.
- Khi admin duyệt, tài khoản có `businessType`. `GET /auth/me` (user) trả thêm `businessType` (`null` = `GENERAL`).

### 2. Tin phi lợi nhuận

- Tin giao thương có `purpose`: `COMMERCIAL` (có lợi nhuận) hoặc `NON_PROFIT` (phi lợi nhuận).
- `POST /trade-posts` và `PATCH /trade-posts/:id`:
  - `purpose` tùy chọn. Mặc định là `COMMERCIAL`; riêng tài khoản `TEMPLE_MANAGEMENT` mặc định `NON_PROFIT`.
  - `COMMERCIAL`: `priceType` **bắt buộc** (như trước).
  - `NON_PROFIT`: **không cần giá**. `priceType`, `price`, `priceLabel` nếu có gửi cũng bị bỏ qua, và response trả `priceType: null`.
  - `NON_PROFIT` có thêm `eventStartAt`, `eventEndAt` (ISO 8601, tùy chọn) cho thời gian diễn ra sự kiện/ngày hội. `eventEndAt` phải ở tương lai, nếu không backend trả 400. **Nếu không đặt `expiresAt`, tin tự rời danh sách công khai sau `eventEndAt`.**
  - Tài khoản Ban quản lý đền/miếu gửi `purpose: COMMERCIAL` → 403 `TRADE_POST_PURPOSE_NOT_ALLOWED`.
  - Tin phi lợi nhuận không thể thuộc danh mục khuyến mãi (`PROMOTION`) → 400.
- Danh mục mới **`EVENT` "Sự kiện – Lễ hội"** đã có trong `GET /trade-post-categories`, dành cho tin quảng bá ngày hội.
- `GET /trade-posts?purpose=NON_PROFIT` để lọc tin phi lợi nhuận. Response tin có thêm `purpose`, `eventStartAt`, `eventEndAt`, và `owner.businessType` (khi có `owner`).

## Yêu cầu cập nhật Mini App

1. **Form đăng ký giao thương**
   - Bước 1: chọn loại hình (danh sách lấy từ `business-types`, hiện `label` + `description`).
   - Bước 2: chọn Cá nhân/Tổ chức, chỉ hiện các dạng có trong `applicantTypes`. Nếu loại hình chỉ có một dạng (đền/miếu), tự chọn và ẩn bước này.
   - Bước 3: hiện đúng `requiredFields` (bắt buộc) và `optionalFields` (tùy chọn) của dạng đã chọn, cộng các trường chung (tên cơ sở, người liên hệ, SĐT, email, địa chỉ, mô tả).
     - Với đền/miếu, đổi nhãn "Tên cơ sở" thành "Tên Ban quản lý" (vd. "Ban quản lý Đền Bà").
     - `seatingCapacity` và `roomCount` dùng ô nhập số.
   - Bước 4: tải giấy tờ theo `requiredDocuments`/`optionalDocuments`, dùng `label` từ API.
   - Gửi kèm `businessType`. Bỏ ô "Lĩnh vực" bắt buộc; có thể giữ dạng tùy chọn.

2. **Form đăng tin giao thương**
   - Thêm lựa chọn "Có lợi nhuận" / "Phi lợi nhuận" ở đầu form.
     - Tài khoản có `businessType === 'TEMPLE_MANAGEMENT'`: ẩn lựa chọn, luôn phi lợi nhuận.
     - Loại hình khác: mặc định "Có lợi nhuận".
   - Khi chọn **Phi lợi nhuận**: ẩn toàn bộ phần giá (loại giá, giá, nhãn giá), không gửi các trường giá. Hiện thêm 2 ô "Bắt đầu" và "Kết thúc" sự kiện, đều tùy chọn. Ngày kết thúc nên gửi lúc **23:59:59 giờ máy** của ngày được chọn (`toISOString()`), và chỉ cho chọn từ hôm nay trở đi. Gợi ý chọn danh mục "Sự kiện – Lễ hội".
   - Khi chọn **Có lợi nhuận**: giữ form giá như cũ, ẩn ô ngày sự kiện.
   - Bắt 403 `TRADE_POST_PURPOSE_NOT_ALLOWED` và 400 `VALIDATION_ERROR`, rồi hiện `error.message`.

3. **Hiển thị tin**
   - Tin `purpose === 'NON_PROFIT'`:
     - thay khối giá bằng nhãn **"Phi lợi nhuận"**;
     - nếu có `eventStartAt`/`eventEndAt` thì hiện "Diễn ra: 10/02 – 12/02/2027";
     - nếu `owner.businessType === 'TEMPLE_MANAGEMENT'` có thể thêm huy hiệu "Ban quản lý đền/miếu".
   - Có thể thêm bộ lọc/tab "Phi lợi nhuận" ở danh sách giao thương (`?purpose=NON_PROFIT`).
   - **Không** hiển thị "0đ" hay "Liên hệ" cho tin phi lợi nhuận: `price` và `priceType` của tin này là `null`.

4. **Đưa tin giao thương vào đúng mục nội dung**
   - Mục **Ẩm thực**: gọi `GET /trade-posts?section=cuisine` để lấy tin của Nhà hàng – quán ăn.
   - Mục **Điểm du lịch – Chùa – Miếu**: gọi `GET /trade-posts?section=temples`; backend chỉ trả tin phi lợi nhuận của Ban quản lý đền/miếu.
   - Mục **Đặc sản**: gọi `GET /trade-posts?section=specialties` để lấy tin của Chủ vườn.
   - Mục **Nông nghiệp**: gọi `GET /trade-posts?section=agriculture` để lấy tin của Chủ vườn.
   - Có thể kết hợp `section` với `page`, `limit`, `search`, `featured`, `sortBy`, `sortOrder`. Không tự lọc bằng tên người đăng hoặc category ở frontend.

## Test

- Đăng ký **Ban quản lý đền/miếu**: form chỉ có dạng Tổ chức, đòi tên đền, người đại diện, CCCD và quyết định công nhận; không đòi MST/GPKD. Admin duyệt xong thì `GET /auth/me` có `businessType: "TEMPLE_MANAGEMENT"`.
- Đăng ký **nhà hàng** dạng cá nhân mà thiếu GPKD → app hiện "…còn thiếu: Giấy phép / giấy chứng nhận đăng ký kinh doanh".
- Đăng ký **chủ vườn** cá nhân: không đòi GPKD, nhưng bắt buộc "Sản phẩm/cây trồng chính".
- Tài khoản đền/miếu đăng tin: không thấy phần giá, tin tạo ra có `purpose: "NON_PROFIT"`, hiện nhãn "Phi lợi nhuận".
- Tài khoản nhà hàng đăng tin có lợi nhuận mà không chọn loại giá → lỗi 400. Chọn "Phi lợi nhuận" thì đăng được mà không cần giá.
- Tin phi lợi nhuận có ngày kết thúc sự kiện: sau ngày đó tin không còn trong danh sách công khai.

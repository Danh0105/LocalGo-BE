Cập nhật Zalo Mini App LocalGo — phần Giao thương: (A) sửa lỗi ngày hết hạn làm tin không hiển thị, (B) form đăng ký theo loại hình, (C) tin phi lợi nhuận không cần giá, (D) hiển thị tin.

Backend đã deploy production cho cả 4 phần (19/10/2026). App bản cũ vẫn chạy, trừ lỗi ở phần A. Làm phần A trước tiên.

## Thông tin chung

- Base URL: `https://api.localgo.skilltripx.com.vn/api/v1`
- Thành công: `{ "success": true, "data": ..., "meta"?: { page, limit, total, totalPages } }`
- Lỗi: `{ "success": false, "error": { "code": "...", "message": "..." } }`. `error.message` là tiếng Việt, hiện thẳng được cho người dùng.
- Người dùng hiện tại: `GET /auth/me` (Bearer token) trả `role` và trường mới **`businessType`** (xem phần B; `null` nghĩa là `GENERAL`). Đăng nhập (`POST /auth/zalo`) chỉ trả token, nên luôn lấy role/businessType từ `/auth/me`. Gọi lại `/auth/me` mỗi khi mở form đăng tin, vì admin có thể vừa duyệt hồ sơ.

---

## A. Sửa lỗi ngày hết hạn — ƯU TIÊN CAO

**Lỗi:** tin đã duyệt nhưng không hiện trong danh sách giao thương. Ô "Ngày hết hạn" của form đăng tin đang gửi `expiresAt` bằng đúng thời điểm mở form (dữ liệu thật: tin tạo lúc 08:38:04, `expiresAt` = 08:37:00). Tin vì vậy hết hạn ngay khi được tạo. API công khai chỉ trả tin chưa hết hạn.

**Backend hiện tại:** `POST /trade-posts` và `PATCH /trade-posts/:id` trả **400 `VALIDATION_ERROR`** nếu `expiresAt` không ở tương lai. Nghĩa là app bản hiện tại đang báo lỗi khi người dùng để ô ngày mặc định. `PATCH` nhận `expiresAt: null` để xóa hạn.

**Cần làm:**

1. Ô "Ngày hết hạn" là tùy chọn và **mặc định để trống**: không khởi tạo bằng `new Date()` hay hôm nay. Không chọn thì **không gửi** `expiresAt`. Khi sửa tin mà người dùng xóa ngày thì gửi `expiresAt: null`.
2. Chọn ngày → gửi **23:59:59 giờ máy** của ngày đó: `new Date(y, m, d, 23, 59, 59).toISOString()`. Chỉ cho chọn từ **ngày mai** trở đi.
3. Kiểm tra trước khi gửi: `expiresAt <= now` thì báo lỗi dưới ô ngày, không gọi API.
4. Luồng "tạo tin rồi gửi duyệt" (`POST /trade-posts` → `PATCH /trade-posts/:id/submit`): nếu bước tạo lỗi thì dừng, không gọi submit.
5. `PATCH /trade-posts/:id/submit` có thể trả **409 `TRADE_POST_EXPIRED`** (tin đã quá hạn). Khi đó báo "Tin đã quá ngày hết hạn, vui lòng cập nhật" và mở màn sửa tin.

---

## B. Form đăng ký giao thương theo loại hình

Người được đăng tin giờ gồm: Ban quản lý đền/miếu, chủ nhà hàng, chủ khách sạn/nhà nghỉ/homestay, chủ vườn, và hộ kinh doanh/doanh nghiệp khác. Mỗi loại hình có form riêng.

**Dựng form từ API, không hard-code:** `GET /business-applications/business-types` (công khai) trả, cho từng loại hình và từng dạng Cá nhân/Tổ chức, đúng các trường và giấy tờ cần thu, kèm nhãn tiếng Việt:

```json
{
  "type": "TEMPLE_MANAGEMENT",
  "label": "Ban quản lý đền/miếu",
  "description": "Đăng tin phi lợi nhuận quảng bá lễ hội, ngày hội lớn của đền, chùa, miếu.",
  "postPurposes": ["NON_PROFIT"],
  "applicantTypes": [
    {
      "applicantType": "ORGANIZATION",
      "requiredFields": [
        { "field": "identityNumber", "label": "Số CCCD" },
        { "field": "identityIssuedAt", "label": "Ngày cấp CCCD" },
        { "field": "identityIssuedPlace", "label": "Nơi cấp CCCD" },
        { "field": "templeName", "label": "Tên đền/chùa/miếu" },
        { "field": "representativeName", "label": "Người đại diện" },
        { "field": "representativeTitle", "label": "Chức vụ người đại diện" }
      ],
      "optionalFields": [],
      "requiredDocuments": [
        { "type": "IDENTITY_FRONT", "label": "CCCD mặt trước" },
        { "type": "IDENTITY_BACK", "label": "CCCD mặt sau" },
        {
          "type": "MANAGEMENT_DECISION",
          "label": "Văn bản xác nhận / quyết định công nhận Ban quản lý"
        }
      ],
      "optionalDocuments": [{ "type": "OTHER", "label": "Giấy tờ khác" }]
    }
  ]
}
```

Tóm tắt dữ liệu hiện có (chỉ để tham khảo; app phải đọc từ API):

| `type`              | Nhãn                              | Dạng đăng ký            | Bắt buộc riêng                                                                                           | Tùy chọn riêng                            |
| ------------------- | --------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `TEMPLE_MANAGEMENT` | Ban quản lý đền/miếu              | chỉ Tổ chức             | tên đền, người đại diện + chức vụ, CCCD người đại diện, **quyết định công nhận BQL**. Không cần MST/GPKD | —                                         |
| `RESTAURANT`        | Nhà hàng – quán ăn                | Cá nhân / Tổ chức       | **GPKD** (cả cá nhân)                                                                                    | giờ mở cửa, số chỗ ngồi, giấy ATTP        |
| `ACCOMMODATION`     | Khách sạn – nhà nghỉ – homestay   | Cá nhân / Tổ chức       | **GPKD** (cả cá nhân)                                                                                    | giờ mở cửa, số phòng, giấy ANTT           |
| `GARDEN`            | Chủ vườn – nhà vườn               | Cá nhân / Tổ chức (HTX) | **sản phẩm/cây trồng chính**                                                                             | diện tích vườn, giấy CN quyền sử dụng đất |
| `GENERAL`           | Hộ kinh doanh / doanh nghiệp khác | Cá nhân / Tổ chức       | như form hiện tại                                                                                        | —                                         |

Ngoài phần riêng ở bảng trên, dạng Cá nhân luôn cần CCCD (số, ngày cấp, nơi cấp, ảnh 2 mặt). Dạng Tổ chức (trừ đền/miếu) luôn cần tên pháp nhân, MST, người đại diện + chức vụ, GPKD.

**Thay đổi ở API gửi hồ sơ** (`POST /business-applications`, `PATCH /business-applications/:id`, `POST /business-applications/requests`):

- Thêm `businessType` (mặc định `GENERAL` nếu không gửi).
- Trường mới theo loại hình:
  - `templeName` (chuỗi)
  - `openingHours` (chuỗi, vd. "6:00 – 22:00")
  - `seatingCapacity` (số nguyên)
  - `roomCount` (số nguyên)
  - `gardenArea` (chuỗi, vd. "2 ha")
  - `mainProducts` (chuỗi)

  Trường không thuộc loại hình đã chọn bị backend bỏ qua.

- `businessCategory` ("Lĩnh vực") **không còn bắt buộc**. Bỏ trống thì backend lưu tên loại hình.
- Loại giấy tờ mới cho `documents[].type`: `MANAGEMENT_DECISION`, `FOOD_SAFETY_CERTIFICATE`, `SECURITY_CERTIFICATE`, `LAND_USE_CERTIFICATE`. Cách tải file giữ nguyên như hiện tại, chỉ thêm các giá trị `type` này.
- Thiếu trường/giấy tờ → **400 `INVALID_BUSINESS_APPLICATION`**. Message liệt kê đúng mục còn thiếu, vd. "Hồ sơ nhà hàng – quán ăn còn thiếu: Giấy phép / giấy chứng nhận đăng ký kinh doanh". Hiện message này.
- Response hồ sơ (`GET /business-applications/me`, ...) có thêm `businessType` và các trường trên.

**Luồng form mới:**

1. **Chọn loại hình:** danh sách thẻ hiện `label` + `description`.
2. **Chọn Cá nhân / Tổ chức:** chỉ hiện các dạng có trong `applicantTypes`. Nếu chỉ có một dạng (đền/miếu), tự chọn và bỏ qua bước này.
3. **Thông tin:**
   - Các trường chung: tên cơ sở, người liên hệ, SĐT, email, địa chỉ, website, mô tả.
   - `requiredFields`: ô bắt buộc, có dấu `*`. `optionalFields`: ô tùy chọn.
   - Với đền/miếu, đổi nhãn "Tên cơ sở" thành **"Tên Ban quản lý"** (vd. "Ban quản lý Đền Bà").
   - `seatingCapacity` và `roomCount` dùng ô số; `identityIssuedAt` dùng ô chọn ngày.
4. **Giấy tờ:** một ô tải cho mỗi mục `requiredDocuments` (bắt buộc) và `optionalDocuments` (tùy chọn), nhãn lấy từ API.
5. **Gửi:** kèm `businessType`. Nếu app đang dẫn người dùng tới form đăng ký khi đăng tin bị 403 `BUSINESS_PROFILE_REQUIRED`, giữ nguyên luồng đó và trỏ tới form mới này.

- Hồ sơ bị từ chối được sửa và gửi lại bằng `PATCH`. Mở lại form với loại hình cũ, cho phép đổi loại hình.

---

## C. Đăng tin: có lợi nhuận / phi lợi nhuận

**Backend:**

- Tin có `purpose`: `COMMERCIAL` (có lợi nhuận) hoặc `NON_PROFIT` (phi lợi nhuận).
- `POST /trade-posts` nhận `purpose` (tùy chọn). Mặc định là `COMMERCIAL`; riêng tài khoản `businessType = TEMPLE_MANAGEMENT` mặc định `NON_PROFIT`.
- **COMMERCIAL:** `priceType` bắt buộc (như cũ), thiếu thì trả 400.
- **NON_PROFIT:**
  - **không có giá**: `priceType`, `price`, `priceLabel` nếu gửi cũng bị bỏ qua, response trả `null`;
  - có thể gửi `eventStartAt`, `eventEndAt` (ISO 8601, tùy chọn) là thời gian diễn ra sự kiện/ngày hội;
  - `eventEndAt` phải ở tương lai, nếu không trả 400;
  - **nếu không đặt `expiresAt`, tin tự rời danh sách công khai sau `eventEndAt`**.
- Loại tin mỗi loại hình được đăng nằm ở `postPurposes` (phần B):
  - Ban quản lý đền/miếu: chỉ `NON_PROFIT`. Gửi `COMMERCIAL` → **403 `TRADE_POST_PURPOSE_NOT_ALLOWED`**.
  - Loại hình khác: được cả hai.
- Tin phi lợi nhuận không được chọn danh mục **Khuyến mãi** (`PROMOTION`) → 400.
- Danh mục mới **`EVENT` — "Sự kiện – Lễ hội"** đã có trong `GET /trade-post-categories`, dành cho tin quảng bá ngày hội.
- `PATCH /trade-posts/:id`: đổi `purpose` sang `NON_PROFIT` sẽ xóa giá; đổi sang `COMMERCIAL` sẽ xóa ngày sự kiện và phải gửi kèm `priceType`. Sửa tin đã duyệt mà đổi `purpose` thì tin quay về chờ duyệt.

**Cần làm trong form đăng tin:** 0. **Đánh dấu field bắt buộc:** thêm dấu `*` ở `category`, `title`, `summary`,
`description`, `address`, `contactName`, `contactPhone`; `priceType` có dấu
`*` khi đang chọn `COMMERCIAL`. Chặn submit và cuộn tới field lỗi đầu tiên.
Các chuỗi chỉ có khoảng trắng được coi là thiếu.

1. **Chọn mục đích** ở đầu form: "Có lợi nhuận" / "Phi lợi nhuận".
   - Nếu `/auth/me` có `businessType === 'TEMPLE_MANAGEMENT'`: ẩn lựa chọn, luôn là phi lợi nhuận, gợi ý sẵn danh mục "Sự kiện – Lễ hội".
   - Loại hình khác: mặc định "Có lợi nhuận".
2. **Phi lợi nhuận:**
   - Ẩn toàn bộ phần giá (loại giá, giá, nhãn giá) và không gửi các trường giá.
   - Ẩn danh mục Khuyến mãi.
   - Hiện thêm "Thời gian diễn ra sự kiện" gồm Bắt đầu và Kết thúc, đều tùy chọn. Bắt đầu gửi 00:00 giờ máy, Kết thúc gửi 23:59:59 giờ máy, cùng `toISOString()`. Kết thúc chỉ được từ hôm nay trở đi và không được trước Bắt đầu.
3. **Có lợi nhuận:** giữ phần giá như hiện tại, ẩn ô sự kiện.
4. Gửi `purpose` trong body. Bắt 403 `TRADE_POST_PURPOSE_NOT_ALLOWED` / 400 `VALIDATION_ERROR` và hiện `error.message`.
5. Thêm ô **"Link Google Maps"** (tùy chọn), gửi `googleMapsUrl`. Khi sửa,
   gửi `null` để xóa. Chỉ chấp nhận link Google Maps HTTPS; hiển thị lỗi 400
   ngay dưới ô nếu backend trả `VALIDATION_ERROR`.

---

## D. Hiển thị tin

Response tin (`GET /trade-posts`, `GET /trade-posts/:idOrSlug`, `GET /trade-posts/me`) có thêm `purpose`, `eventStartAt`, `eventEndAt`, `googleMapsUrl`. **`priceType`, `price` và `googleMapsUrl` có thể là `null`**. Chỗ nào đang map `priceType` sang nhãn phải xử lý `null` để không vỡ giao diện. Khi `googleMapsUrl` có giá trị, hiện nút "Mở Google Maps" bằng chính URL backend trả về.

1. **Tin `purpose === 'NON_PROFIT'`:**
   - thay khối giá bằng nhãn **"Phi lợi nhuận"**. Không hiển thị "0đ", "Liên hệ" hay "Thương lượng";
   - có ngày sự kiện thì hiện "Diễn ra: 10/02 – 12/02/2027", hoặc "Từ 10/02/2027" nếu chỉ có ngày bắt đầu.
2. **Danh sách giao thương:** thêm bộ lọc hoặc tab "Phi lợi nhuận" bằng `GET /trade-posts?purpose=NON_PROFIT` (và `purpose=COMMERCIAL` cho tin có lợi nhuận). Sắp xếp theo giá luôn đẩy tin không có giá xuống cuối.
3. **"Tin của tôi" (`GET /trade-posts/me`):** hạn hiệu lực của tin = `expiresAt`, nếu không có thì `eventEndAt`. Nếu hạn này đã qua thì hiện nhãn **"Đã hết hạn — không còn hiển thị công khai"**, kèm nút "Gia hạn" mở màn sửa tin. Nút này chỉ hiện với tin `DRAFT`, `REJECTED`, `PUBLISHED`, vì tin `PENDING` không sửa được.

---

## Kiểm tra trước khi phát hành

- [ ] Đăng tin **không chọn** ngày hết hạn: payload không có `expiresAt`; admin duyệt xong thì tin hiện trong danh sách.
- [ ] Chọn ngày hết hạn là ngày mai: `expiresAt` = 23:59:59 ngày mai giờ VN. Không chọn được hôm nay hay ngày đã qua.
- [ ] Đăng ký **Ban quản lý đền/miếu**:
  - chỉ có dạng Tổ chức;
  - đòi tên đền, người đại diện, CCCD và quyết định công nhận;
  - không đòi MST/GPKD;
  - admin duyệt xong thì `/auth/me` có `businessType: "TEMPLE_MANAGEMENT"`.
- [ ] Đăng ký **nhà hàng** dạng cá nhân mà thiếu GPKD: app hiện "…còn thiếu: Giấy phép / giấy chứng nhận đăng ký kinh doanh".
- [ ] Đăng ký **chủ vườn** cá nhân: không đòi GPKD, bắt buộc "Sản phẩm/cây trồng chính".
- [ ] Tài khoản đền/miếu mở form đăng tin:
  - không có lựa chọn mục đích, không có phần giá;
  - tin tạo ra có `purpose: "NON_PROFIT"`, `priceType: null`;
  - hiển thị nhãn "Phi lợi nhuận" và thời gian sự kiện.
- [ ] Tài khoản nhà hàng chọn "Có lợi nhuận" mà không chọn loại giá: báo lỗi. Chọn "Phi lợi nhuận" thì đăng được mà không cần giá.
- [ ] Tin phi lợi nhuận có ngày kết thúc sự kiện: sau ngày đó tin không còn trong danh sách công khai; "Tin của tôi" hiện nhãn "Đã hết hạn".
- [ ] Danh sách và chi tiết tin cũ (có lợi nhuận) hiển thị như trước. Không màn nào vỡ khi gặp `priceType: null`.

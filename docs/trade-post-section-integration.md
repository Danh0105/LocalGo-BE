# Tích hợp tin giao thương vào các mục nội dung

Mini App dùng API danh sách tin giao thương công khai và truyền query `section`.
Backend tự ánh xạ theo loại hình Business của chủ tin; frontend không cần lọc
theo tên, danh mục tin hoặc nội dung.

## Ánh xạ

| Mục Mini App               | Request                                       | Tin được trả về                               |
| -------------------------- | --------------------------------------------- | --------------------------------------------- |
| Ẩm thực                    | `GET /api/v1/trade-posts?section=cuisine`     | Chủ tin có `businessType = RESTAURANT`        |
| Điểm du lịch – Chùa – Miếu | `GET /api/v1/trade-posts?section=temples`     | `TEMPLE_MANAGEMENT` và `purpose = NON_PROFIT` |
| Đặc sản                    | `GET /api/v1/trade-posts?section=specialties` | Chủ tin có `businessType = GARDEN`            |
| Nông nghiệp                | `GET /api/v1/trade-posts?section=agriculture` | Chủ tin có `businessType = GARDEN`            |

Chỉ tin `PUBLISHED`, danh mục đang hoạt động và chưa hết hạn mới được trả về.
Tin của Chủ vườn xuất hiện ở cả Đặc sản và Nông nghiệp. Nhà hàng không xuất
hiện ở hai mục này. Tài khoản Khách sạn hoặc loại hình Chung không tự xuất hiện
trong bốn mục trên.

## Query kết hợp

`section` dùng chung với các query hiện có:

```http
GET /api/v1/trade-posts?section=cuisine&page=1&limit=10&sortBy=newest
GET /api/v1/trade-posts?section=specialties&search=bưởi&sortBy=price_asc
GET /api/v1/trade-posts?section=temples&featured=true
```

Response giữ nguyên shape danh sách `/trade-posts`:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 0,
    "totalPages": 0
  }
}
```

Giá trị `section` khác `temples | specialties | agriculture | cuisine` trả
`400 VALIDATION_ERROR`.

## Quy tắc khi đăng tin

- `TEMPLE_MANAGEMENT` mặc định tạo tin `NON_PROFIT`; gửi `COMMERCIAL` trả
  `403 TRADE_POST_PURPOSE_NOT_ALLOWED`.
- Tin phi lợi nhuận không có giá. Nếu có `eventEndAt` và không có `expiresAt`,
  tin tự rời danh sách sau thời điểm kết thúc sự kiện.
- Việc một tin xuất hiện ở mục nào được xác định từ `User.businessType` đã được
  Admin duyệt, không phải từ `category` do người đăng lựa chọn.

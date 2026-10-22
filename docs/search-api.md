# API tìm kiếm toàn cục

Search service gom kết quả từ toàn bộ nội dung có thể điều hướng trong LocalGo về một response thống nhất. Truy vấn dùng PostgreSQL full-text search thay vì tải toàn bộ dữ liệu lên application để lọc. Tìm kiếm không phân biệt chữ hoa/thường, dấu tiếng Việt và thứ tự từ; đồng thời hỗ trợ tiền tố khi người dùng đang gõ, sai chính tả nhẹ trong tiêu đề, từ khóa liên quan (`ăn uống` ↔ `ẩm thực`, `tham quan` ↔ `du lịch`, `chùa chiền` ↔ `chùa`) và tên viết tắt (`ủy ban nhân dân` ↔ `UBND`).

Thứ tự kết quả ưu tiên tên khớp chính xác, tên bắt đầu bằng cụm tìm kiếm, tên chứa cụm tìm kiếm, độ liên quan full-text rồi mới tới thời gian cập nhật. Tiêu đề có trọng số cao hơn tóm tắt và nội dung chi tiết.

## Endpoint

| Method | Endpoint               | Quyền                | Phạm vi                                                                           |
| ------ | ---------------------- | -------------------- | --------------------------------------------------------------------------------- |
| `GET`  | `/api/v1/search`       | Public               | Chỉ nội dung đang công khai; tin tức chưa đến lịch và nội dung ẩn không xuất hiện |
| `GET`  | `/api/v1/admin/search` | `ADMIN`, `MODERATOR` | Có cả nội dung ẩn, bản nháp, tin lên lịch và tin giao thương chưa xuất bản        |

## Query parameters

| Tên     | Bắt buộc | Mặc định | Mô tả                                                              |
| ------- | -------- | -------- | ------------------------------------------------------------------ |
| `q`     | Có       | —        | Từ khóa 2–100 ký tự. Ví dụ `mang cau` vẫn tìm thấy `Mãng cầu`      |
| `types` | Không    | Tất cả   | Một hoặc nhiều loại cách nhau bởi dấu phẩy, ví dụ `SPECIALTY,OCOP` |
| `page`  | Không    | `1`      | Trang, bắt đầu từ 1                                                |
| `limit` | Không    | `20`     | Số kết quả/trang, tối đa 50                                        |

Mỗi từ trong `q` phải xuất hiện trong tài liệu (có thể ở các trường khác nhau). Ví dụ `truong mit mang` tìm được nội dung có địa chỉ `Truông Mít` và tiêu đề chứa `Mãng`; `mang ca` có thể tìm `Mãng cầu` nhờ tìm kiếm tiền tố. Fallback gần đúng chỉ áp dụng khi tất cả từ đều gần khớp với tiêu đề, tránh kết quả sai chỉ vì trùng một từ phổ biến.

Các giá trị `types`:

`ABOUT`, `TEMPLE`, `SPECIALTY`, `HISTORICAL_SITE`, `AGRICULTURE`, `OCOP`, `CRAFT_VILLAGE`, `CUISINE`, `FESTIVAL`, `EXPERIENCE_TOUR`, `FEEDBACK_CHANNEL`, `MAP_PLACE`, `CONTACT`, `NEWS`, `TRADE_POST`.

## Ví dụ

```http
GET /api/v1/search?q=mang%20cau&types=SPECIALTY,OCOP,NEWS&page=1&limit=20
```

```json
{
  "success": true,
  "data": [
    {
      "resourceType": "SPECIALTY",
      "resourceLabel": "Đặc sản",
      "id": "mang-cau-ba-den",
      "slug": "mang-cau-ba-den",
      "title": "Mãng cầu Bà Đen",
      "summary": "Đặc sản nổi tiếng của địa phương...",
      "category": "FRUIT",
      "imageUrl": "https://api.example.com/uploads/example.webp",
      "status": "ACTIVE",
      "updatedAt": "2026-10-21T10:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

`slug` bằng `id` với các module CMS; riêng `TRADE_POST`, `id` là UUID và `slug` là slug công khai của bài đăng.

## Trạng thái

- Các module CMS: `ACTIVE` hoặc `HIDDEN`.
- `ABOUT`: `PUBLISHED` hoặc `DRAFT`.
- `NEWS`: `PUBLISHED`, `SCHEDULED` hoặc `HIDDEN`.
- `TRADE_POST`: trạng thái nghiệp vụ hiện tại như `DRAFT`, `PENDING`, `PUBLISHED`, `HIDDEN`, `REJECTED`, `EXPIRED`, `ARCHIVED`.

API public không trả nội dung không còn khả dụng: bản ghi ẩn, bài tin chưa tới `publishedAt`, tin giao thương không ở trạng thái `PUBLISHED`, danh mục giao thương bị ẩn hoặc bài đã hết hạn.

## Lỗi thường gặp

- `400 VALIDATION_ERROR`: thiếu `q`, từ khóa ngắn hơn 2 ký tự, `limit > 50` hoặc `types` không hợp lệ.
- `401 UNAUTHORIZED`: gọi endpoint Admin không có access token hoặc token hết hạn.
- `403 FORBIDDEN`: tài khoản không có role `ADMIN`/`MODERATOR`.

Search công khai không bao gồm hồ sơ người dùng, hồ sơ đăng ký kinh doanh, nội dung hội thoại hay phiếu phản hồi của người dân. Các dữ liệu này tiếp tục dùng endpoint quản trị chuyên biệt để tránh trộn dữ liệu nhạy cảm vào tìm kiếm nội dung.

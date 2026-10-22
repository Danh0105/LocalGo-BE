# Harvest batches API (truy xuất nguồn gốc – tem QR)

Tài khoản hội viên **Chủ vườn** khai báo từng lô trái cây đã cắt trên PC (Business Center – `localgo-admin`, mục "Lô hàng & tem QR"), in tem QR bằng máy in tem. Ai quét tem cũng xem được thông tin lô. Mọi endpoint có prefix `/api/v1`, response envelope chuẩn (`{ success, data, meta? }`).

## Quyền truy cập

Endpoint quản lý (`/harvest-batches`) chỉ cho tài khoản **role `BUSINESS`, status `ACTIVE`, `businessType = GARDEN`** (`GardenOwnerGuard`). `businessType` được gán khi duyệt hồ sơ Business loại `GARDEN`.

- Role khác → 403 `BUSINESS_PROFILE_REQUIRED`
- Status `PENDING` → 403 `ACCOUNT_NOT_ACTIVE`
- Business loại khác → 403 `GARDEN_ACCOUNT_REQUIRED`

Chủ vườn chỉ thấy lô của mình. Lô của người khác trả 404 `HARVEST_BATCH_NOT_FOUND` để không dò được id.

| Method | Endpoint | Ghi chú |
|---|---|---|
| GET | `/harvest-batches?page=&limit=&search=&from=&to=` | Lô của tôi, ngày cắt mới nhất trước. `search` theo tên trái cây hoặc mã lô. `from`/`to` là ngày cắt `YYYY-MM-DD` |
| POST | `/harvest-batches` | Khai báo lô mới → 201, sinh `code` |
| GET | `/harvest-batches/:id` | Chi tiết lô của tôi |
| PATCH | `/harvest-batches/:id` | Sửa một phần. `code` giữ nguyên nên tem đã in hiển thị thông tin mới |
| DELETE | `/harvest-batches/:id` | Xóa mềm, 204. Quét tem của lô này sẽ trả 404 |
| GET | `/harvest-trace/:code` | **Công khai**, không cần token. Không phân biệt hoa thường. Throttle 60/phút |

## Body tạo / sửa

```json
{
  "ownerName": "Nguyễn Văn An",
  "fruitName": "Sầu riêng Ri6",
  "harvestDate": "2026-10-21",
  "weightKg": 12.5,
  "pricePerKg": 85000,
  "fertilizers": "Phân hữu cơ vi sinh 2 lần/vụ",
  "pesticides": "Không sử dụng",
  "imageIds": ["media-uuid-1", "media-uuid-2"]
}
```

| Trường | Quy tắc |
|---|---|
| `ownerName` | Tên chủ vườn in trên tem, 1–120 ký tự (trim). Không gửi thì lấy `displayName` của tài khoản. Lưu dạng snapshot nên đổi tên tài khoản không làm đổi tem cũ |
| `fruitName` | 1–120 ký tự (trim) |
| `harvestDate` | Ngày cắt `YYYY-MM-DD`, phải là ngày hợp lệ. Sau hôm nay (giờ VN) → 400 `INVALID_HARVEST_DATE` |
| `weightKg` | 0.01 – 1.000.000, tối đa 2 chữ số thập phân |
| `pricePerKg` | Giá bán VNĐ/kg, số nguyên 0 – 1.000.000.000 |
| `fertilizers`, `pesticides` | Phân bón / thuốc BVTV đã dùng, 1–2000 ký tự (trim), bắt buộc. Không dùng thì ghi "Không sử dụng" |
| `imageIds` | Không bắt buộc, tối đa 10 UUID media, không trùng nhau. Thứ tự mảng là thứ tự hiển thị. Ảnh phải được chính tài khoản hiện tại upload và chưa thuộc nội dung khác |

Ảnh được upload trước bằng `POST /media/images/batch` (`multipart/form-data`,
field `files`). Khi tạo lô, không gửi `imageIds` hoặc gửi `[]` đều có nghĩa là
không có ảnh. Khi sửa, không gửi trường này thì giữ nguyên ảnh; gửi `[]` thì gỡ
toàn bộ ảnh. Ảnh mới được claim atomically cùng thao tác tạo/sửa. Ảnh bị gỡ được
soft-delete và thu hồi khỏi storage theo cơ chế media chung.

## Response

Chủ vườn (`/harvest-batches`):
```json
{
  "id": "uuid", "code": "WDV6M5TL",
  "ownerName": "Nguyễn Văn An", "fruitName": "Sầu riêng Ri6",
  "harvestDate": "2026-10-21", "weightKg": 12.5, "pricePerKg": 85000,
  "totalPrice": 1062500,
  "fertilizers": "...", "pesticides": "...",
  "images": [
    {
      "id": "media-uuid-1", "url": "https://.../image.webp",
      "thumbnailUrl": "https://.../image-thumb.webp",
      "width": 1200, "height": 900, "sortOrder": 0
    }
  ],
  "createdAt": "ISO_DATE", "updatedAt": "ISO_DATE"
}
```

Công khai (`/harvest-trace/:code`), không có id nội bộ:
```json
{
  "code": "WDV6M5TL", "gardenName": "Nhà vườn Minh An",
  "ownerName": "Nguyễn Văn An", "fruitName": "Sầu riêng Ri6",
  "harvestDate": "2026-10-21", "weightKg": 12.5, "pricePerKg": 85000,
  "totalPrice": 1062500,
  "fertilizers": "...", "pesticides": "...",
  "images": [
    {
      "url": "https://.../image.webp",
      "thumbnailUrl": "https://.../image-thumb.webp",
      "width": 1200, "height": 900, "sortOrder": 0
    }
  ],
  "declaredAt": "ISO_DATE"
}
```

- `harvestDate` luôn là chuỗi `YYYY-MM-DD`. Hiển thị trực tiếp, không parse qua `Date`, để tránh lệch múi giờ.
- `totalPrice = round(weightKg × pricePerKg)`.
- `gardenName` là tên tài khoản nhà vườn đã duyệt. `declaredAt` là lần cập nhật khai báo gần nhất.
- `images` luôn là mảng (có thể rỗng), đã sắp xếp theo `sortOrder`. Response công khai không trả media id nội bộ.
- Mã không đúng định dạng, lô đã xóa, hoặc chủ vườn bị khóa/xóa → 404 `HARVEST_BATCH_NOT_FOUND`.

## Mã & tem QR

- `code` gồm 8 ký tự `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (không có 0/O/1/I), sinh ngẫu nhiên và unique. Mã được in dưới QR để tra cứu tay.
- QR mã hoá URL `https://<domain admin>/truy-xuat/<code>`, là trang công khai của `localgo-admin` gọi `GET /harvest-trace/:code`. Mini app muốn hiển thị trong Zalo thì đọc `code` ở cuối URL rồi gọi cùng endpoint.
- Tem được in từ trình duyệt với `@page` đúng khổ tem (50×30, 40×30, 60×40, 70×50 mm), mỗi tem một trang.

## Migration

- `prisma/migrations/20261021100000_harvest_batches`: bảng `HarvestBatch` (unique `code`, index `ownerId+harvestDate`, FK `ownerId → User` ON DELETE RESTRICT).
- `prisma/migrations/20261022090000_harvest_batch_images`: thêm `HARVEST_BATCH` vào `MediaResourceType` và bảng nối `HarvestBatchImage` có `sortOrder`.

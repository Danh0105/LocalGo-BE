# Cập nhật Mini App hỗ trợ nhiều ảnh cho 8 nhóm nội dung

Backend đã hỗ trợ ảnh đại diện và thư viện nhiều ảnh. Hãy cập nhật giao diện Mini App để quản lý và hiển thị nhiều ảnh cho các mục sau:

- Lễ hội (`festivals`)
- Tin tức (`news`)
- Tour trải nghiệm (`experience-tours`)
- Làng nghề (`craft-villages`)
- Liên hệ (`contacts`)
- Nông nghiệp (`agriculture`)
- Di tích (`historical-sites`)
- Đặc sản (`specialties`)

Trước khi sửa, hãy rà cấu trúc source hiện tại, xác định model/type, API service, form tạo/cập nhật, trang danh sách và trang chi tiết tương ứng. Tái sử dụng component và convention sẵn có; không tạo tám bản triển khai gallery độc lập nếu có thể dùng component/type/hook chung.

## Hợp đồng API mới

### Upload nhiều ảnh

```http
POST /api/v1/media/images/batch
Authorization: Bearer <access-token>
Content-Type: multipart/form-data
```

FormData phải dùng đúng field `files`, có thể gửi tối đa 10 file trong một request. Chỉ chấp nhận JPG, PNG, WebP; áp dụng giới hạn dung lượng ảnh hiện có của Mini App/backend.

Response được bọc trong envelope chung:

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-media-1",
      "url": "https://.../image-1.webp",
      "thumbnailUrl": "https://.../image-1-thumb.webp",
      "width": 1200,
      "height": 800,
      "size": 123456,
      "mimeType": "image/webp"
    }
  ]
}
```

Giữ API upload một ảnh hiện tại để tương thích:

```http
POST /api/v1/media/images
Content-Type: multipart/form-data
file: <binary>
```

### Payload tạo/cập nhật nội dung

Mọi endpoint `POST /api/v1/admin/<module>` và `PUT /api/v1/admin/<module>/:id` của tám module trên nhận thêm:

```json
{
  "mediaId": "uuid-anh-dai-dien",
  "galleryMediaIds": ["uuid-anh-phu-1", "uuid-anh-phu-2"]
}
```

Quy tắc:

- `mediaId` vẫn là ảnh đại diện, có thể `null`.
- `galleryMediaIds` là mảng ảnh thư viện theo đúng thứ tự hiển thị, tối đa 10 phần tử.
- Không được có ID trùng trong `galleryMediaIds`.
- `mediaId` không được xuất hiện trong `galleryMediaIds`.
- Khi cập nhật, luôn gửi toàn bộ `galleryMediaIds` còn lại trong state. Gửi `[]` để xóa hết thư viện; không được bỏ field khi người dùng vừa chỉnh gallery.
- Các request `PUT` vẫn phải gửi đầy đủ những field nội dung và `version` theo cơ chế optimistic locking hiện tại.

### Response chi tiết

Public detail và admin detail trả thêm:

```json
{
  "imageUrl": "https://.../cover.webp",
  "imageAlt": "Mô tả ảnh",
  "galleryImages": [
    {
      "mediaId": "uuid-anh-phu-1",
      "imageUrl": "https://.../image-1.webp",
      "thumbnailUrl": "https://.../image-1-thumb.webp",
      "sortOrder": 0
    }
  ]
}
```

Admin response trả thêm `galleryMediaIds: string[]`. Public list vẫn dùng `imageUrl` làm ảnh thẻ như trước, không cần tải/render cả gallery ở màn hình danh sách.

## Cập nhật type và API service

Tạo type dùng chung, tên có thể điều chỉnh theo convention của dự án:

```ts
export interface GalleryImage {
  mediaId: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  sortOrder: number;
}

export interface UploadedMedia {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  size: number;
  mimeType: string;
}
```

Mở rộng model chi tiết của cả tám module với `galleryImages`. Model/payload admin thêm `galleryMediaIds`.

Tạo một hàm upload batch dùng chung. Không tự đặt `Content-Type` kèm boundary khi gửi `FormData`; để HTTP client/runtime tự sinh header multipart. Hàm phải lấy đúng `response.data` trong envelope backend và giữ nguyên thứ tự file trả về.

## Giao diện form quản trị

Nếu Mini App/source hiện có màn hình quản trị tạo hoặc cập nhật các nội dung trên, bổ sung một component dùng chung, ví dụ `ContentImageManager`, gồm hai khu vực:

### 1. Ảnh đại diện

- Giữ UI ảnh đại diện hiện tại.
- Hiển thị preview, trạng thái đang upload và nút thay/xóa ảnh.
- Khi chọn một ảnh đang nằm trong gallery làm ảnh đại diện, tự loại ảnh đó khỏi gallery hoặc yêu cầu người dùng xác nhận; tuyệt đối không submit cùng ID ở cả hai nơi.

### 2. Thư viện ảnh

- Tiêu đề: `Thư viện ảnh (tối đa 10 ảnh)`.
- Nút `Thêm ảnh` hỗ trợ chọn nhiều file một lần.
- Validate trước khi upload: đúng JPG/PNG/WebP, không vượt dung lượng cho phép, tổng số ảnh sau khi thêm không quá 10.
- Upload bằng `/media/images/batch`, có trạng thái loading/progress; khóa nút Lưu khi vẫn còn ảnh đang upload hoặc upload lỗi.
- Sau upload, hiển thị dạng lưới thumbnail responsive.
- Mỗi ảnh có nút xóa rõ ràng; xóa khỏi state, chưa cần gọi API xóa media riêng.
- Cho phép đổi thứ tự bằng kéo-thả nếu thư viện hiện đã có thư viện drag/drop phù hợp. Nếu không, dùng nút `Lên`, `Xuống` hoặc điều khiển tương đương, tránh thêm dependency nặng chỉ để kéo-thả.
- Thứ tự state chính là thứ tự `galleryMediaIds` gửi lên backend.
- Khi mở form cập nhật, khởi tạo state từ `galleryImages`/`galleryMediaIds` của admin detail; không upload lại ảnh cũ.
- Nếu upload batch lỗi, giữ nguyên các ảnh đã có trước đó và hiển thị thông báo dễ hiểu để người dùng thử lại.

Trạng thái gợi ý:

```ts
type EditableGalleryImage = {
  mediaId: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  uploading?: boolean;
  error?: string;
};
```

Không lưu `File`, blob URL hoặc base64 vào payload tạo/cập nhật; payload chỉ chứa media ID đã upload thành công. Thu hồi object URL tạm khi component unmount hoặc khi ảnh bị xóa.

## Giao diện trang chi tiết public

Tạo một component gallery dùng chung cho trang chi tiết của cả tám mục:

- Ảnh lớn ban đầu là `imageUrl` (ảnh đại diện).
- Bên dưới là dải/lưới thumbnail gồm ảnh đại diện và `galleryImages` theo `sortOrder`.
- Chạm thumbnail đổi ảnh lớn đang xem.
- Chạm ảnh lớn mở chế độ xem toàn màn hình/lightbox/swiper nếu dự án đã có component phù hợp; hỗ trợ vuốt trái/phải trên thiết bị cảm ứng.
- Có chỉ báo vị trí dạng `1 / N` khi có từ hai ảnh trở lên.
- Giữ đúng tỷ lệ, không làm méo ảnh; dùng placeholder/skeleton trong lúc tải và fallback khi URL lỗi.
- Dùng `thumbnailUrl ?? imageUrl` cho thumbnail; dùng `imageUrl` cho ảnh lớn.
- Lazy-load ảnh phụ. Không preload toàn bộ ảnh kích thước lớn ở màn hình danh sách.
- Dùng `imageAlt` cho ảnh đại diện; ảnh phụ có alt dạng `${imageAlt} - ảnh ${index + 2}`.
- Nếu không có ảnh nào, giữ placeholder hiện tại.
- Nếu chỉ có ảnh đại diện và `galleryImages` rỗng, giao diện phải giống hành vi cũ, không hiện thanh thumbnail/điều khiển dư thừa.

Áp dụng component này vào trang chi tiết Lễ hội, Tin tức, Tour trải nghiệm, Làng nghề, Liên hệ, Nông nghiệp, Di tích và Đặc sản. Không thay đổi layout hoặc nghiệp vụ không liên quan.

## Xử lý lỗi

- `VALIDATION_ERROR`: hiển thị lỗi trùng ảnh/vượt số lượng gần khu vực quản lý ảnh.
- `INVALID_*_MEDIA`: báo `Một hoặc nhiều ảnh không hợp lệ hoặc đã được nội dung khác sử dụng`, giữ form để người dùng xử lý lại.
- Lỗi `409 *_VERSION_CONFLICT`: tiếp tục dùng luồng cảnh báo/tải lại dữ liệu mới nhất hiện tại; không âm thầm ghi đè.
- `401/403`: dùng luồng refresh token/đăng nhập hiện có.
- Không reset các field nội dung khác khi upload ảnh thất bại.

## Yêu cầu tương thích

- Dữ liệu cũ chỉ có `mediaId`/`imageUrl` vẫn phải hiển thị bình thường.
- Luôn xử lý an toàn khi backend cũ hoặc cache cũ chưa có `galleryImages`: mặc định thành `[]`.
- Không chuyển ảnh phụ đầu tiên thành ảnh đại diện một cách ngầm định.
- Không thay đổi ảnh đại diện của các thẻ danh sách; danh sách vẫn đọc `imageUrl`.
- Giữ responsive và vùng bấm phù hợp trên Zalo Mini App, đặc biệt với màn hình nhỏ.

## Tiêu chí nghiệm thu

1. Ở mỗi form của tám module, chọn một lần từ 2–10 ảnh, thấy preview và lưu thành công.
2. Tạo nội dung với một ảnh đại diện và ít nhất hai ảnh phụ; mở chi tiết thấy đúng ảnh, đúng thứ tự.
3. Cập nhật thứ tự gallery, lưu và tải lại trang vẫn giữ đúng thứ tự.
4. Xóa một ảnh phụ, lưu và tải lại không còn ảnh đó.
5. Gửi `galleryMediaIds: []` xóa được toàn bộ ảnh phụ nhưng giữ nguyên ảnh đại diện.
6. Không cho thêm ảnh thứ 11, không cho ID trùng và không cho ảnh đại diện trùng gallery.
7. Upload lỗi không làm mất dữ liệu form hoặc gallery cũ.
8. Nội dung cũ không có gallery vẫn hiển thị như trước.
9. Trang danh sách không phát sinh request tải ảnh gallery và không bị giảm hiệu năng đáng kể.
10. Chạy type-check, lint, test hiện có; bổ sung test cho component quản lý ảnh, mapping payload và gallery public.

Sau khi hoàn tất, báo cáo ngắn các file đã sửa, component dùng chung đã tạo, cách state/payload được ánh xạ và kết quả kiểm thử. Không chỉ mô tả hướng làm; hãy chỉnh code và kiểm tra thực tế.

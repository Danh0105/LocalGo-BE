# Tích hợp tìm kiếm toàn cục cho Admin

Admin dùng `GET /api/v1/admin/search`, gửi Bearer access token qua API client hiện có. Endpoint này dành cho `ADMIN` và `MODERATOR`, đồng thời trả cả bản ghi ẩn, bản nháp, tin lên lịch và bài giao thương chưa xuất bản.

## API client

Có thể tái sử dụng `SearchResult` trong tài liệu Mini App và thêm hàm:

```ts
export async function searchAdminContent(params: {
  q: string;
  types?: SearchResourceType[];
  page?: number;
  limit?: number;
  signal?: AbortSignal;
}): Promise<Paginated<SearchResult>> {
  const response = await apiClient.get("/admin/search", {
    params: {
      q: params.q.trim(),
      types: params.types?.join(","),
      page: params.page ?? 1,
      limit: params.limit ?? 20,
    },
    signal: params.signal,
  });
  return unwrapPaginated(response);
}
```

Giữ nguyên interceptor refresh token hiện tại. Khi refresh thất bại, chuyển về màn đăng nhập như các API Admin khác.

## UI đề xuất

- Đặt ô tìm kiếm toàn cục trên header `AdminLayout`.
- Chỉ gọi khi có ít nhất 2 ký tự, debounce khoảng 300 ms và hủy request trước bằng `AbortController`.
- Hiển thị `resourceLabel`, ảnh, `title`, `summary`, badge `status` và thời gian `updatedAt`.
- Cho phép lọc nhiều `types` bằng dropdown/checklist.
- Badge cảnh báo cho `HIDDEN`, `DRAFT`, `SCHEDULED`, `PENDING`, `REJECTED`, `EXPIRED`, `ARCHIVED`.
- Phân trang bằng `meta`; không tự lọc lại ở client vì `total` là tổng sau khi backend lọc.

## Điều hướng kết quả

```ts
const ADMIN_ROUTES: Record<SearchResourceType, (item: SearchResult) => string> = {
  ABOUT: () => "/content/about",
  TEMPLE: (item) => `/content/temples/${item.id}`,
  SPECIALTY: (item) => `/content/specialties/${item.id}`,
  HISTORICAL_SITE: (item) => `/content/historical-sites/${item.id}`,
  AGRICULTURE: (item) => `/content/agriculture/${item.id}`,
  OCOP: (item) => `/content/ocop/${item.id}`,
  CRAFT_VILLAGE: (item) => `/content/craft-villages/${item.id}`,
  CUISINE: (item) => `/content/cuisine/${item.id}`,
  FESTIVAL: (item) => `/content/festivals/${item.id}`,
  EXPERIENCE_TOUR: (item) => `/content/experience-tours/${item.id}`,
  FEEDBACK_CHANNEL: (item) => `/content/feedback-channels/${item.id}`,
  MAP_PLACE: (item) => `/content/map-places/${item.id}`,
  CONTACT: (item) => `/content/contacts/${item.id}`,
  NEWS: (item) => `/content/news/${item.id}`,
  TRADE_POST: (item) => `/trade-posts?postId=${item.id}`,
};
```

Trang quản lý giao thương hiện là trang danh sách/tab thay vì form theo route `:id`; đọc `postId` từ query string để tự chọn/mở bài tương ứng. Nếu chưa hỗ trợ deep-link này, điều hướng tạm về `/trade-posts`.

Tìm kiếm toàn cục chỉ phục vụ nội dung. Người dùng, hồ sơ doanh nghiệp, phiếu phản hồi và đánh giá vẫn dùng bộ lọc tại màn quản trị riêng để giữ đúng quyền truy cập và tránh lộ dữ liệu nhạy cảm trong dropdown tìm kiếm chung.

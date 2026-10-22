# Tích hợp tìm kiếm cho Zalo Mini App

Thay phần `search-popup.tsx` đang tải từng danh sách và lọc trên máy bằng một request tới `GET /api/v1/search`. Endpoint public không yêu cầu đăng nhập.

## Service TypeScript

```ts
export type SearchResourceType =
  | 'ABOUT'
  | 'TEMPLE'
  | 'SPECIALTY'
  | 'HISTORICAL_SITE'
  | 'AGRICULTURE'
  | 'OCOP'
  | 'CRAFT_VILLAGE'
  | 'CUISINE'
  | 'FESTIVAL'
  | 'EXPERIENCE_TOUR'
  | 'FEEDBACK_CHANNEL'
  | 'MAP_PLACE'
  | 'CONTACT'
  | 'NEWS'
  | 'TRADE_POST';

export interface SearchResult {
  resourceType: SearchResourceType;
  resourceLabel: string;
  id: string;
  slug: string | null;
  title: string;
  summary: string;
  category: string | null;
  imageUrl: string | null;
  status: string;
  updatedAt: string;
}

interface SearchResponse {
  success: true;
  data: SearchResult[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export async function searchAll(
  q: string,
  options: {
    types?: SearchResourceType[];
    page?: number;
    limit?: number;
    signal?: AbortSignal;
  } = {},
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    q: q.trim(),
    page: String(options.page ?? 1),
    limit: String(options.limit ?? 30),
  });
  if (options.types?.length) params.set('types', options.types.join(','));

  const response = await fetch(
    `${import.meta.env.VITE_API_BASE_URL}/search?${params}`,
    { signal: options.signal },
  );
  const body = await response.json();
  if (!response.ok || !body.success) {
    throw new Error(body?.error?.message ?? 'Không thể tìm kiếm nội dung.');
  }
  return body;
}
```

## Cách gọi trong popup

- Chỉ gọi khi `q.trim().length >= 2`.
- Debounce 250–350 ms để không gọi API theo từng phím ngay lập tức.
- Dùng `AbortController` hủy request cũ khi người dùng tiếp tục nhập.
- Hiển thị loading, empty state và nút “Xem thêm” khi `meta.page < meta.totalPages`.
- Có thể nhóm kết quả bằng `resourceLabel`; không cần gọi lại API cho từng module.
- Gửi nguyên văn từ khóa người dùng nhập; backend đã xử lý tiếng Việt không dấu, thứ tự từ, tiền tố và lỗi gõ nhẹ nên frontend không tự chuẩn hóa hoặc lọc lại kết quả.

```ts
useEffect(() => {
  const keyword = query.trim();
  if (keyword.length < 2) {
    setResults([]);
    return;
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => {
    searchAll(keyword, { limit: 30, signal: controller.signal })
      .then((response) => setResults(response.data))
      .catch((error) => {
        if (error.name !== 'AbortError') setSearchError(error.message);
      });
  }, 300);

  return () => {
    window.clearTimeout(timer);
    controller.abort();
  };
}, [query]);
```

## Điều hướng kết quả

```ts
const MINI_APP_ROUTES: Record<
  SearchResourceType,
  (item: SearchResult) => string
> = {
  ABOUT: () => '/about',
  TEMPLE: (item) => `/temples/${item.slug}`,
  SPECIALTY: (item) => `/specialties/${item.slug}`,
  HISTORICAL_SITE: (item) => `/historical-sites/${item.slug}`,
  AGRICULTURE: (item) => `/agriculture/${item.slug}`,
  OCOP: (item) => `/ocop/${item.slug}`,
  CRAFT_VILLAGE: (item) => `/craft-villages/${item.slug}`,
  CUISINE: (item) => `/cuisine/${item.slug}`,
  FESTIVAL: (item) => `/festivals/${item.slug}`,
  EXPERIENCE_TOUR: (item) => `/experience-tours/${item.slug}`,
  FEEDBACK_CHANNEL: (item) => `/feedback/${item.slug}`,
  MAP_PLACE: (item) => `/map/${item.slug}`,
  CONTACT: (item) => `/contacts/${item.slug}`,
  NEWS: (item) => `/news/${item.slug}`,
  TRADE_POST: (item) => `/trade/${item.slug}`,
};
```

Nếu màn chi tiết OCOP chưa được bật trong router Mini App, bật route `/ocop/:id` trước khi cho phép điều hướng kết quả `OCOP`.

Ảnh có thể là `null`; dùng ảnh placeholder theo từng `resourceType`. Không cần tự bỏ dấu tiếng Việt ở frontend vì backend đã chuẩn hóa từ khóa.

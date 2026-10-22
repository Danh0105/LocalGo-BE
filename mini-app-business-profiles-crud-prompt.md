# Prompt cập nhật Mini App: CRUD hồ sơ theo role

```text
Hãy trực tiếp cập nhật source Zalo Mini App LocalGo để tích hợp đầy đủ CRUD hồ sơ doanh nghiệp theo loại tài khoản đã được backend duyệt.

API base:
https://api.localgo.skilltripx.com.vn/api/v1

Mục tiêu:
- Tài khoản BUSINESS quản lý hồ sơ vận hành/công khai của mình.
- Form tự thay đổi theo businessType.
- Người dùng thường có thể xem danh sách và chi tiết hồ sơ công khai.
- Giữ nguyên kiến trúc, router, API client, auth store và design system hiện tại.

1. Đọc source trước khi sửa
- Tìm API client/interceptor refresh token, auth store, User model, router và các màn đăng ký BUSINESS hiện có.
- Tái sử dụng component input, upload, loading, empty state, error state, toast và confirm dialog hiện có.
- Không hardcode access token hoặc API response.

2. Khai báo kiểu dữ liệu

type BusinessType =
  | "TEMPLE_MANAGEMENT"
  | "RESTAURANT"
  | "ACCOMMODATION"
  | "GARDEN"
  | "GENERAL";

interface BusinessProfile {
  id: string;
  userId: string;
  businessType: BusinessType;
  businessName: string;
  businessCategory: string;
  templeName: string | null;
  openingHours: string | null;
  seatingCapacity: number | null;
  roomCount: number | null;
  gardenArea: string | null;
  mainProducts: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  googleMapsUrl: string | null;
  lat: number | null;
  lng: number | null;
  website: string | null;
  facebookUrl: string | null;
  zaloOaUrl: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  description: string | null;
  isPublic: boolean;
  version: number;
  owner: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    status: "ACTIVE" | "BLOCKED" | "PENDING";
  };
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

3. Tạo businessProfileService
- GET /business-profiles?businessType=&search=&page=&limit=&sortOrder=
- GET /business-profiles/:idOrUserId
- POST /business-profiles
- GET /business-profiles/me
- PATCH /business-profiles/me
- DELETE /business-profiles/me

GET danh sách/chi tiết public không cần đăng nhập. Các API /me và POST/PATCH/DELETE dùng API client có Bearer token + refresh token hiện có.

4. Điều hướng theo trạng thái tài khoản
- Nếu user.role !== "BUSINESS": không hiển thị menu “Hồ sơ cơ sở”; hiển thị CTA đăng ký BUSINESS ở vị trí hiện có.
- Nếu user.role === "BUSINESS": hiển thị menu “Hồ sơ cơ sở”.
- Khi mở màn quản lý, gọi GET /business-profiles/me.
- Nếu trả 404 BUSINESS_PROFILE_NOT_FOUND: hiển thị form tạo mới.
- Nếu có dữ liệu: hiển thị trang xem trước và nút chỉnh sửa/xóa.
- Không cho frontend tự thay đổi businessType; lấy businessType từ /users/me hoặc response hồ sơ.

5. Form chung bắt buộc
- businessName
- contactName
- contactPhone
- contactEmail
- address

Field chung tùy chọn:
- businessCategory
- googleMapsUrl, lat, lng
- website, facebookUrl, zaloOaUrl
- logoUrl, coverImageUrl
- description
- isPublic

Nếu có lat thì phải có lng và ngược lại. Kiểm tra số điện thoại Việt Nam, email và URL trước khi submit nhưng vẫn hiển thị message validation do backend trả về.

6. Form động theo businessType
- TEMPLE_MANAGEMENT:
  + Hiển thị templeName và bắt buộc nhập.
  + Nhãn: “Tên đền/chùa/miếu”.
- RESTAURANT:
  + Hiển thị openingHours và seatingCapacity.
- ACCOMMODATION:
  + Hiển thị openingHours và roomCount.
- GARDEN:
  + Hiển thị gardenArea và mainProducts.
  + mainProducts bắt buộc.
- GENERAL:
  + Không hiển thị field riêng.

Không gửi field của loại hình khác. Khi đổi dữ liệu form hoặc hydrate cache, tránh giữ field cũ không thuộc businessType.

7. Create/update/delete
- Tạo mới: POST /business-profiles với toàn bộ form, không gửi businessType.
- Cập nhật: PATCH /business-profiles/me, luôn gửi version mới nhất nhận từ server.
- Sau update thành công, thay cache bằng response mới vì version đã tăng.
- Xóa: mở confirm dialog nêu rõ hồ sơ sẽ biến mất khỏi trang công khai; gọi DELETE /business-profiles/me; thành công trả HTTP 204.
- Sau xóa, chuyển về trạng thái tạo hồ sơ. POST sau khi xóa sẽ khôi phục hồ sơ cũ bằng dữ liệu mới.

8. Xử lý lỗi
- 403 BUSINESS_ACCOUNT_REQUIRED: refresh /users/me; nếu vẫn không phải BUSINESS thì chuyển về trang đăng ký.
- 404 BUSINESS_PROFILE_NOT_FOUND: chuyển sang form tạo mới hoặc trạng thái “không còn công khai” ở trang public.
- 409 BUSINESS_PROFILE_ALREADY_EXISTS: gọi lại GET /business-profiles/me rồi mở chế độ sửa.
- 409 BUSINESS_PROFILE_VERSION_CONFLICT: không tự ghi đè; tải lại hồ sơ, thông báo “Hồ sơ đã được cập nhật ở thiết bị khác”, cho người dùng xem dữ liệu mới.
- 401: để interceptor refresh token xử lý; chỉ logout khi refresh thất bại.
- 400 VALIDATION_ERROR: map message/details vào form và toast.

9. Màn public
- Thêm danh sách cơ sở từ GET /business-profiles, có tìm kiếm, lọc businessType, phân trang hoặc infinite scroll.
- Card hiển thị logo/cover fallback, businessName, businessType label, businessCategory, address và thông tin phù hợp role.
- Chi tiết gọi GET /business-profiles/:idOrUserId.
- Có nút gọi điện, mở Google Maps, website, Facebook và Zalo OA khi field tương ứng tồn tại.
- Không hiển thị field null và không tự hiển thị giấy tờ đăng ký/CCCD vì API hồ sơ không cung cấp dữ liệu này.

10. Cache và UX
- Dùng query key riêng cho profile của tôi, danh sách và chi tiết.
- Invalidate danh sách/chi tiết sau create, update hoặc delete.
- Có skeleton, empty state, retry và pull-to-refresh phù hợp Mini App.
- Chống double submit và hủy request cũ khi tìm kiếm.
- Giữ dữ liệu form chưa lưu khi request lỗi.

11. Test bắt buộc
- USER không thấy menu quản lý hồ sơ.
- BUSINESS chưa có hồ sơ thấy form create.
- Render đúng field của cả 5 businessType.
- TEMPLE_MANAGEMENT thiếu templeName và GARDEN thiếu mainProducts không submit.
- Create thành công và hydrate response.
- Update gửi version, cập nhật cache với version mới.
- Xử lý 409 version conflict.
- Confirm/delete 204 và chuyển về trạng thái create.
- Danh sách/chi tiết public hoạt động không cần đăng nhập.
- 401 refresh thành công không đẩy người dùng về login.

12. Hoàn tất
- Chạy lint, type-check, unit test và build.
- Sửa lỗi trong phạm vi thay đổi.
- Báo cáo file đã sửa, route đã thêm và kết quả từng lệnh kiểm tra.
- Không chỉ viết hướng dẫn; hãy trực tiếp chỉnh sửa và kiểm thử source Mini App.
```

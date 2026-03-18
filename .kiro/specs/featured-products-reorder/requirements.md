# Requirements Document - Sắp xếp Sản phẩm Nổi bật (Phiên bản Đơn giản)

## Introduction

Chức năng di chuyển vị trí hiển thị sản phẩm nổi bật cho phép admin sắp xếp lại thứ tự hiển thị của các sản phẩm nổi bật trên trang chủ một cách đơn giản và nhanh gọn. Hiện tại, hệ thống đã có sản phẩm nổi bật nhưng thiếu khả năng kiểm soát thứ tự hiển thị. Chức năng này sẽ cung cấp các nút Up/Down đơn giản để admin có thể di chuyển sản phẩm lên/xuống một cách nhanh chóng.

## Glossary

- **Admin**: Người quản trị hệ thống có quyền truy cập admin panel
- **Featured_Product**: Sản phẩm nổi bật được hiển thị trên trang chủ
- **Display_Order**: Thứ tự hiển thị của sản phẩm nổi bật (số nguyên)
- **Reorder_System**: Hệ thống quản lý thứ tự hiển thị sản phẩm nổi bật
- **Up_Down_Buttons**: Nút lên/xuống để di chuyển sản phẩm
- **Homepage_Display**: Khu vực hiển thị sản phẩm nổi bật trên trang chủ

## Requirements

### Requirement 1: Quản lý thứ tự hiển thị sản phẩm nổi bật

**User Story:** Là một admin, tôi muốn sắp xếp thứ tự hiển thị của các sản phẩm nổi bật bằng nút Up/Down đơn giản, để tôi có thể tối ưu layout trang chủ một cách nhanh chóng.

#### Acceptance Criteria

1. WHEN admin truy cập trang quản lý sản phẩm nổi bật, THE Reorder_System SHALL hiển thị danh sách sản phẩm theo thứ tự hiện tại với nút Up/Down
2. WHEN admin click nút "Up", THE Reorder_System SHALL di chuyển sản phẩm lên 1 vị trí và cập nhật Display_Order
3. WHEN admin click nút "Down", THE Reorder_System SHALL di chuyển sản phẩm xuống 1 vị trí và cập nhật Display_Order
4. WHEN có lỗi xảy ra trong quá trình cập nhật, THE Reorder_System SHALL hiển thị thông báo lỗi và không thay đổi thứ tự
5. THE Reorder_System SHALL đảm bảo mỗi sản phẩm nổi bật có một Display_Order duy nhất

### Requirement 2: Giao diện Up/Down buttons đơn giản

**User Story:** Là một admin, tôi muốn có nút Up/Down dễ sử dụng, để tôi có thể sắp xếp sản phẩm một cách nhanh chóng mà không cần kéo thả phức tạp.

#### Acceptance Criteria

1. WHEN admin xem danh sách sản phẩm nổi bật, THE Up_Down_Buttons SHALL hiển thị rõ ràng bên cạnh mỗi sản phẩm
2. WHEN sản phẩm ở vị trí đầu tiên, THE Up_Down_Buttons SHALL ẩn nút "Up"
3. WHEN sản phẩm ở vị trí cuối cùng, THE Up_Down_Buttons SHALL ẩn nút "Down"
4. WHEN admin click nút, THE Up_Down_Buttons SHALL hiển thị loading state trong khi xử lý
5. THE Up_Down_Buttons SHALL hoạt động tốt trên cả desktop và mobile

### Requirement 3: Hiển thị theo thứ tự trên trang chủ

**User Story:** Là một khách hàng, tôi muốn thấy sản phẩm nổi bật được hiển thị theo thứ tự mà admin đã sắp xếp, để tôi có thể thấy những sản phẩm quan trọng nhất trước.

#### Acceptance Criteria

1. WHEN trang chủ được tải, THE Homepage_Display SHALL hiển thị sản phẩm nổi bật theo Display_Order tăng dần
2. WHEN admin thay đổi thứ tự sản phẩm, THE Homepage_Display SHALL phản ánh thay đổi ngay lập tức khi refresh trang
3. WHEN không có Display_Order được thiết lập, THE Homepage_Display SHALL hiển thị sản phẩm theo thứ tự created_at
4. THE Homepage_Display SHALL duy trì layout grid 4 cột hiện tại
5. WHEN có sản phẩm mới được thêm vào featured products, THE Reorder_System SHALL gán Display_Order cao nhất + 1

### Requirement 4: Tương thích với hệ thống hiện tại

**User Story:** Là một developer, tôi muốn chức năng mới tương thích hoàn toàn với hệ thống hiện tại, để không ảnh hưởng đến các tính năng đã có và triển khai nhanh chóng.

#### Acceptance Criteria

1. THE Reorder_System SHALL sử dụng lại API `reorderFeaturedProducts` đã có trong featured-service.js
2. THE Reorder_System SHALL tương thích với featured-carousel.js component hiện tại
3. WHEN không có Display_Order, THE Homepage_Display SHALL fallback về logic hiển thị cũ
4. THE Reorder_System SHALL không thay đổi cấu trúc database hiện tại (sử dụng cột `featured_order` đã có)
5. THE Reorder_System SHALL tích hợp vào admin panel layout hiện tại mà không cần thay đổi lớn

### Requirement 5: Implementation đơn giản và nhanh

**User Story:** Là một developer, tôi muốn implementation đơn giản nhất có thể, để có thể triển khai nhanh chóng và ít bug.

#### Acceptance Criteria

1. THE Reorder_System SHALL chỉ cần thêm 2 nút Up/Down vào UI hiện tại
2. THE Reorder_System SHALL sử dụng lại hàm `handleReorder` đã có, chỉ cần modify tham số
3. THE Reorder_System SHALL không cần thêm thư viện JavaScript mới
4. THE Reorder_System SHALL có tối đa 50 dòng code JavaScript mới
5. THE Reorder_System SHALL có thể hoàn thành trong 1 giờ coding
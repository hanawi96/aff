# Requirements Document - Hệ thống Quản lý Lãi Lỗ

## Introduction

Hệ thống quản lý lãi lỗ cho phép chủ shop vòng dâu tằm thủ công theo dõi chi phí, doanh thu và lợi nhuận một cách chi tiết. Hệ thống tập trung vào việc quản lý giá vốn sản phẩm, chi phí đóng gói (túi zip, giấy in, túi rút, hộp), phí vận chuyển và hoa hồng CTV để tính toán lãi ròng chính xác.

## Glossary

- **System**: Hệ thống quản lý lãi lỗ
- **Product**: Sản phẩm vòng dâu tằm
- **Cost Price**: Giá vốn sản phẩm (chi phí làm vòng: dây, bi bạc, charm, hổ phách...)
- **Packaging Cost**: Chi phí đóng gói (túi zip, giấy in, túi rút đỏ, hộp đóng hàng)
- **Shipping Cost**: Phí vận chuyển thực tế
- **Commission**: Hoa hồng CTV
- **Profit**: Lãi ròng = Doanh thu - (Giá vốn + Chi phí đóng gói + Phí ship + Hoa hồng)
- **Admin**: Người quản lý hệ thống

## Requirements

### Requirement 1: Quản lý Cấu hình Chi phí Đóng gói

**User Story:** Là Admin, tôi muốn cấu hình giá các vật liệu đóng gói một lần, để hệ thống tự động áp dụng cho các đơn hàng mà không phải nhập lại mỗi lần.

#### Acceptance Criteria

1. WHEN Admin truy cập trang cài đặt, THE System SHALL hiển thị form cấu hình chi phí đóng gói với các trường: túi zip, giấy in, túi rút đỏ, hộp đóng hàng
2. WHEN Admin nhập giá cho từng loại vật liệu đóng gói, THE System SHALL validate giá trị phải là số dương
3. WHEN Admin lưu cấu hình, THE System SHALL lưu vào database và hiển thị thông báo thành công
4. WHEN Admin tạo đơn hàng mới, THE System SHALL tự động áp dụng giá đóng gói đã cấu hình
5. WHEN Admin cập nhật giá đóng gói, THE System SHALL áp dụng giá mới cho các đơn hàng tạo sau đó

### Requirement 2: Quản lý Giá vốn Sản phẩm

**User Story:** Là Admin, tôi muốn nhập giá vốn cho mỗi sản phẩm, để biết được lợi nhuận dự kiến khi bán sản phẩm đó.

#### Acceptance Criteria

1. WHEN Admin thêm hoặc sửa sản phẩm, THE System SHALL hiển thị trường "Giá vốn" để nhập
2. WHEN Admin nhập giá vốn, THE System SHALL tự động tính và hiển thị lãi dự kiến (Giá bán - Giá vốn)
3. WHEN Admin nhập giá vốn, THE System SHALL tự động tính và hiển thị tỷ suất lợi nhuận phần trăm
4. WHEN Admin lưu sản phẩm, THE System SHALL lưu giá vốn vào database
5. WHEN giá vốn lớn hơn giá bán, THE System SHALL hiển thị cảnh báo màu đỏ về lỗ tiềm năng

### Requirement 3: Tính toán Lãi Lỗ Đơn hàng

**User Story:** Là Admin, tôi muốn xem lãi lỗ của từng đơn hàng, để biết đơn nào sinh lời cao và đơn nào cần xem xét.

#### Acceptance Criteria

1. WHEN Admin tạo đơn hàng mới, THE System SHALL tự động lấy giá vốn từ sản phẩm đã chọn
2. WHEN Admin chọn loại đóng gói (túi rút, hộp), THE System SHALL tự động tính tổng chi phí đóng gói
3. WHEN Admin nhập phí ship, THE System SHALL tự động tính tổng chi phí vận chuyển
4. WHEN đơn hàng có mã CTV, THE System SHALL tự động tính hoa hồng CTV
5. WHEN Admin tạo đơn hàng, THE System SHALL tự động tính và hiển thị lãi ròng dự kiến
6. WHEN Admin xem danh sách đơn hàng, THE System SHALL hiển thị cột lãi ròng với màu xanh nếu lãi, màu đỏ nếu lỗ
7. WHEN Admin click vào đơn hàng, THE System SHALL hiển thị chi tiết phân tích lãi lỗ

### Requirement 4: Báo cáo Lãi Lỗ Tổng hợp

**User Story:** Là Admin, tôi muốn xem báo cáo lãi lỗ theo thời gian (ngày, tuần, tháng, năm), để đánh giá hiệu quả kinh doanh và lập kế hoạch.

#### Acceptance Criteria

1. WHEN Admin truy cập trang báo cáo lãi lỗ, THE System SHALL hiển thị dashboard với các chỉ số: doanh thu, chi phí, lãi ròng, tỷ suất lợi nhuận
2. WHEN Admin chọn khoảng thời gian (hôm nay, tuần này, tháng này, năm nay, tất cả), THE System SHALL tính toán và hiển thị số liệu tương ứng
3. WHEN Admin xem báo cáo, THE System SHALL hiển thị chi tiết chi phí theo từng loại: giá vốn, đóng gói, phí ship, hoa hồng
4. WHEN Admin xem chi phí đóng gói, THE System SHALL hiển thị chi tiết: túi zip hết bao nhiêu, giấy in hết bao nhiêu, túi rút hết bao nhiêu, hộp hết bao nhiêu
5. WHEN Admin xem báo cáo, THE System SHALL hiển thị danh sách các đơn hàng trong kỳ với thông tin lãi lỗ
6. WHEN Admin click vào đơn hàng trong báo cáo, THE System SHALL hiển thị chi tiết phân tích lãi lỗ của đơn đó

### Requirement 5: Giao diện Người dùng

**User Story:** Là Admin, tôi muốn giao diện đẹp, gọn gàng, dễ sử dụng, để làm việc hiệu quả và chuyên nghiệp.

#### Acceptance Criteria

1. WHEN Admin sử dụng hệ thống, THE System SHALL hiển thị giao diện với thiết kế hiện đại, màu sắc hài hòa
2. WHEN Admin xem số liệu tài chính, THE System SHALL sử dụng màu xanh cho lãi, màu đỏ cho lỗ, màu xám cho trung tính
3. WHEN Admin xem dashboard, THE System SHALL hiển thị các card thống kê với icon trực quan
4. WHEN Admin xem bảng dữ liệu, THE System SHALL hiển thị với spacing hợp lý, dễ đọc
5. WHEN Admin sử dụng trên mobile, THE System SHALL hiển thị responsive, dễ thao tác
6. WHEN Admin thực hiện thao tác, THE System SHALL hiển thị loading state và feedback rõ ràng

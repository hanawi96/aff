# Requirements Document - Welcome Email for Collaborators

## Introduction

Khi một cộng tác viên (CTV) đăng ký thành công, hệ thống cần gửi email chúc mừng tự động để:
- Chào mừng CTV mới
- Cung cấp thông tin mã referral và link giới thiệu
- Hướng dẫn cách kiểm tra đơn hàng
- Tạo trải nghiệm chuyên nghiệp và thân thiện

## Glossary

- **CTV (Cộng Tác Viên)**: Người đăng ký để trở thành đối tác giới thiệu sản phẩm
- **Referral Code**: Mã giới thiệu duy nhất được gán cho mỗi CTV
- **Referral URL**: Link giới thiệu có chứa mã referral của CTV
- **Order Check URL**: Link để CTV kiểm tra danh sách đơn hàng của mình
- **Email System**: Hệ thống gửi email tự động (Google Apps Script hoặc email service)

## Requirements

### Requirement 1: Gửi Email Chúc Mừng Tự Động

**User Story:** Là một CTV mới, tôi muốn nhận email chúc mừng ngay sau khi đăng ký thành công, để tôi có thể lưu lại thông tin quan trọng và bắt đầu công việc.

#### Acceptance Criteria

1. WHEN CTV hoàn tất form đăng ký và nhận được mã referral, THE System SHALL gửi email chúc mừng đến địa chỉ email của CTV trong vòng 1 phút
2. IF CTV không cung cấp email trong form đăng ký, THEN THE System SHALL bỏ qua việc gửi email mà không báo lỗi
3. THE System SHALL ghi log thành công hoặc thất bại của việc gửi email để theo dõi
4. THE Email SHALL có subject line rõ ràng: "Chúc mừng bạn trở thành Cộng Tác Viên - Mẹ & Bé"
5. THE Email SHALL được gửi từ địa chỉ email chính thức của hệ thống

### Requirement 2: Nội Dung Email Chuyên Nghiệp

**User Story:** Là một CTV mới, tôi muốn email có thiết kế đẹp, dễ đọc và chứa đầy đủ thông tin cần thiết, để tôi có thể nhanh chóng hiểu và sử dụng.

#### Acceptance Criteria

1. THE Email SHALL hiển thị tên CTV một cách cá nhân hóa trong lời chào
2. THE Email SHALL hiển thị mã referral với font size lớn, dễ nhìn và có thể copy dễ dàng
3. THE Email SHALL bao gồm referral URL đầy đủ và có thể click được
4. THE Email SHALL có thiết kế responsive, hiển thị tốt trên cả desktop và mobile
5. THE Email SHALL sử dụng màu sắc nhất quán với brand (mom-pink, mom-blue, mom-purple)
6. THE Email SHALL có cấu trúc rõ ràng với các section: Header, Welcome Message, Referral Info, Instructions, Footer

### Requirement 3: Link Kiểm Tra Đơn Hàng

**User Story:** Là một CTV, tôi muốn có button/link trực tiếp để kiểm tra danh sách đơn hàng của mình, để tôi có thể theo dõi hoa hồng dễ dàng.

#### Acceptance Criteria

1. THE Email SHALL chứa một button "Kiểm Tra Đơn Hàng" nổi bật
2. THE Button SHALL link đến URL: https://ctv.shopvd.store/?ref={REFERRAL_CODE}
3. WHERE {REFERRAL_CODE} là mã referral của CTV, THE System SHALL thay thế placeholder bằng mã thực tế
4. THE Button SHALL có styling rõ ràng với màu nổi bật (gradient hoặc solid color)
5. THE Link SHALL mở trong tab mới khi click

### Requirement 4: Hướng Dẫn Sử Dụng

**User Story:** Là một CTV mới, tôi muốn email có hướng dẫn cơ bản về cách bắt đầu, để tôi không bị bối rối và có thể làm việc ngay.

#### Acceptance Criteria

1. THE Email SHALL bao gồm section "Bước Tiếp Theo" với 3-5 bước hướng dẫn đơn giản
2. THE Email SHALL giải thích cách sử dụng referral link
3. THE Email SHALL nêu rõ tỷ lệ hoa hồng (10%)
4. THE Email SHALL bao gồm thông tin liên hệ hỗ trợ (Zalo, phone)
5. THE Email SHALL có link đến nhóm Zalo CTV

### Requirement 5: Tích Hợp với Backend

**User Story:** Là một developer, tôi muốn email được gửi tự động từ backend sau khi tạo CTV thành công, để đảm bảo tính nhất quán và bảo mật.

#### Acceptance Criteria

1. THE Backend (Google Apps Script) SHALL gọi email service sau khi lưu thông tin CTV thành công
2. THE System SHALL truyền các thông tin cần thiết: fullName, email, referralCode, referralUrl
3. IF việc gửi email thất bại, THE System SHALL ghi log lỗi nhưng vẫn trả về success cho frontend
4. THE System SHALL có retry mechanism: thử gửi lại 1 lần nếu lần đầu thất bại
5. THE Email service SHALL có timeout 10 giây để tránh block request

### Requirement 6: Email Template HTML

**User Story:** Là một CTV, tôi muốn email có thiết kế đẹp mắt với hình ảnh và màu sắc phù hợp, để tạo ấn tượng chuyên nghiệp về công ty.

#### Acceptance Criteria

1. THE Email SHALL sử dụng HTML template với inline CSS để đảm bảo tương thích với email clients
2. THE Email SHALL có logo hoặc header image của brand
3. THE Email SHALL có background color nhẹ nhàng (warm-beige hoặc gradient)
4. THE Email SHALL có footer với thông tin công ty và social links
5. THE Email SHALL có max-width 600px để hiển thị tốt trên mọi thiết bị
6. THE Email SHALL tránh sử dụng JavaScript hoặc external CSS files

### Requirement 7: Xử Lý Lỗi và Fallback

**User Story:** Là một system admin, tôi muốn hệ thống xử lý lỗi email một cách graceful, để không ảnh hưởng đến trải nghiệm đăng ký của CTV.

#### Acceptance Criteria

1. IF email address không hợp lệ, THE System SHALL ghi log nhưng không hiển thị lỗi cho user
2. IF email service không khả dụng, THE System SHALL vẫn hoàn tất đăng ký CTV
3. THE System SHALL ghi log tất cả các lỗi email với timestamp và error details
4. THE System SHALL có dashboard hoặc report để theo dõi email delivery rate
5. WHERE email gửi thất bại, THE System SHALL lưu thông tin để có thể gửi lại manual sau này

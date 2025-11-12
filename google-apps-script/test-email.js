// ============================================
// TEST EMAIL - Chạy các hàm này để test email
// ============================================

/**
 * Test 1: Gửi email chào mừng cho CTV
 * Thay đổi email test thành email của bạn để nhận email test
 */
function testWelcomeEmail() {
  Logger.log('🧪 Testing Welcome Email...\n');

  const testData = {
    fullName: 'Nguyễn Thị Lan Anh',
    phone: '0901234567',
    email: 'test@example.com', // ⭐ THAY ĐỔI EMAIL NÀY THÀNH EMAIL CỦA BẠN
    city: 'Hà Nội',
    age: '26-30',
    experience: 'Mới bắt đầu',
    motivation: 'Muốn có thêm thu nhập để chăm sóc gia đình và chia sẻ những sản phẩm tốt cho mẹ và bé.',
    timestamp: new Date().toLocaleString('vi-VN')
  };

  const refCode = 'CTV123456';
  const refUrl = 'https://shopvd.store/?ref=CTV123456';
  const orderCheckUrl = 'https://shopvd.store/ctv/?code=CTV123456';

  try {
    sendWelcomeEmailToCTV(testData, refCode, refUrl, orderCheckUrl);
    Logger.log('✅ Email test đã được gửi đến: ' + testData.email);
    Logger.log('📧 Kiểm tra hộp thư của bạn (có thể trong spam)');
  } catch (error) {
    Logger.log('❌ Lỗi: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
  }
}

/**
 * Test 2: Gửi email thông báo cho admin
 */
function testAdminNotificationEmail() {
  Logger.log('🧪 Testing Admin Notification Email...\n');

  const testData = {
    fullName: 'Nguyễn Thị Lan Anh',
    phone: '0901234567',
    email: 'ctv@example.com',
    city: 'Hà Nội',
    age: '26-30',
    experience: 'Mới bắt đầu',
    facebook: 'https://facebook.com/test',
    motivation: 'Muốn có thêm thu nhập để chăm sóc gia đình.',
    timestamp: new Date().toLocaleString('vi-VN')
  };

  try {
    sendNotificationEmail(testData);
    Logger.log('✅ Email thông báo admin đã được gửi');
    Logger.log('⚠️ Lưu ý: Kiểm tra email admin trong hàm sendNotificationEmail()');
  } catch (error) {
    Logger.log('❌ Lỗi: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
  }
}

/**
 * Test 3: Test toàn bộ flow đăng ký (bao gồm cả email)
 */
function testFullRegistrationFlow() {
  Logger.log('🧪 Testing Full Registration Flow...\n');

  const testData = {
    fullName: 'Nguyễn Thị Test Flow',
    phone: '0987654321',
    email: 'test-flow@example.com', // ⭐ THAY ĐỔI EMAIL NÀY
    city: 'TP. Hồ Chí Minh',
    age: '31-35',
    experience: '1-2 năm',
    motivation: 'Muốn xây dựng cộng đồng mẹ bỉm và chia sẻ kinh nghiệm.',
    timestamp: new Date().toLocaleString('vi-VN')
  };

  const mockEvent = {
    postData: {
      contents: JSON.stringify(testData)
    }
  };

  try {
    Logger.log('📝 Đang xử lý đăng ký...');
    const result = doPost(mockEvent);
    const response = JSON.parse(result.getContent());

    Logger.log('\n📊 Kết quả:');
    Logger.log('  Success: ' + response.success);
    Logger.log('  Referral Code: ' + response.referralCode);
    Logger.log('  Referral URL: ' + response.referralUrl);
    Logger.log('  Order Check URL: ' + response.orderCheckUrl);

    if (response.success) {
      Logger.log('\n✅ Đăng ký thành công!');
      Logger.log('📧 Email chào mừng đã được gửi đến: ' + testData.email);
      Logger.log('📧 Email thông báo admin cũng đã được gửi');
    } else {
      Logger.log('\n❌ Đăng ký thất bại: ' + response.error);
    }

  } catch (error) {
    Logger.log('❌ Lỗi: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
  }
}

/**
 * Test 4: Test với CTV không có email (không gửi email)
 */
function testRegistrationWithoutEmail() {
  Logger.log('🧪 Testing Registration WITHOUT Email...\n');

  const testData = {
    fullName: 'Nguyễn Văn No Email',
    phone: '0912345678',
    email: '', // Không có email
    city: 'Đà Nẵng',
    age: '26-30',
    experience: 'Mới bắt đầu',
    motivation: 'Muốn kiếm thêm thu nhập.',
    timestamp: new Date().toLocaleString('vi-VN')
  };

  const mockEvent = {
    postData: {
      contents: JSON.stringify(testData)
    }
  };

  try {
    Logger.log('📝 Đang xử lý đăng ký không có email...');
    const result = doPost(mockEvent);
    const response = JSON.parse(result.getContent());

    Logger.log('\n📊 Kết quả:');
    Logger.log('  Success: ' + response.success);
    Logger.log('  Referral Code: ' + response.referralCode);

    if (response.success) {
      Logger.log('\n✅ Đăng ký thành công!');
      Logger.log('ℹ️ Không gửi email vì CTV không cung cấp email');
    }

  } catch (error) {
    Logger.log('❌ Lỗi: ' + error.toString());
  }
}

/**
 * Test 5: Kiểm tra giới hạn gửi email
 */
function checkEmailQuota() {
  Logger.log('📊 Checking Email Quota...\n');

  try {
    const quota = MailApp.getRemainingDailyQuota();
    Logger.log('📧 Số email còn lại có thể gửi hôm nay: ' + quota);

    if (quota > 50) {
      Logger.log('✅ Quota tốt, có thể gửi email bình thường');
    } else if (quota > 10) {
      Logger.log('⚠️ Quota thấp, cân nhắc giảm số email gửi');
    } else {
      Logger.log('❌ Quota rất thấp hoặc đã hết, không thể gửi email');
    }

  } catch (error) {
    Logger.log('❌ Lỗi kiểm tra quota: ' + error.toString());
  }
}

/**
 * Test 6: Gửi nhiều email test (để test spam filter)
 */
function testMultipleEmails() {
  Logger.log('🧪 Testing Multiple Emails...\n');

  const testEmails = [
    'test1@example.com',
    'test2@example.com',
    'test3@example.com'
  ];

  Logger.log('⚠️ Sẽ gửi ' + testEmails.length + ' email test');
  Logger.log('⚠️ Thay đổi email trong mảng testEmails thành email thật của bạn\n');

  testEmails.forEach((email, index) => {
    try {
      const testData = {
        fullName: 'Test User ' + (index + 1),
        phone: '090123456' + index,
        email: email,
        city: 'Hà Nội',
        age: '26-30',
        experience: 'Mới bắt đầu',
        motivation: 'Test email ' + (index + 1),
        timestamp: new Date().toLocaleString('vi-VN')
      };

      const refCode = 'CTV' + String(index + 1).padStart(6, '0');
      const refUrl = 'https://shopvd.store/?ref=' + refCode;
      const orderCheckUrl = 'https://shopvd.store/ctv/?code=' + refCode;

      sendWelcomeEmailToCTV(testData, refCode, refUrl, orderCheckUrl);
      Logger.log('✅ Email ' + (index + 1) + ' đã gửi đến: ' + email);

      // Delay 1 giây giữa các email
      Utilities.sleep(1000);

    } catch (error) {
      Logger.log('❌ Lỗi gửi email ' + (index + 1) + ': ' + error.toString());
    }
  });

  Logger.log('\n✅ Hoàn tất gửi ' + testEmails.length + ' email test');
}

/**
 * Chạy tất cả tests
 */
function runAllEmailTests() {
  Logger.log('╔════════════════════════════════════════╗');
  Logger.log('║   CHẠY TẤT CẢ EMAIL TESTS             ║');
  Logger.log('╚════════════════════════════════════════╝\n');

  // Test 1
  Logger.log('═══ Test 1: Email Quota ═══');
  checkEmailQuota();
  Logger.log('');

  // Test 2
  Logger.log('═══ Test 2: Welcome Email ═══');
  testWelcomeEmail();
  Logger.log('');

  // Test 3
  Logger.log('═══ Test 3: Admin Notification ═══');
  testAdminNotificationEmail();
  Logger.log('');

  // Test 4
  Logger.log('═══ Test 4: Registration Without Email ═══');
  testRegistrationWithoutEmail();
  Logger.log('');

  Logger.log('╔════════════════════════════════════════╗');
  Logger.log('║   HOÀN TẤT TẤT CẢ TESTS               ║');
  Logger.log('╚════════════════════════════════════════╝');
}

// ============================================
// HƯỚNG DẪN SỬ DỤNG
// ============================================
/*

1. MỞ GOOGLE APPS SCRIPT EDITOR
   - Vào Google Sheets của bạn
   - Extensions > Apps Script

2. COPY CODE NÀY VÀO FILE MỚI
   - Tạo file mới tên "test-email.gs"
   - Copy toàn bộ code này vào

3. CHẠY TEST
   - Chọn hàm muốn test từ dropdown
   - Click nút Run (▶️)
   - Xem kết quả trong Logs

4. CÁC HÀM TEST QUAN TRỌNG:
   
   ✅ testWelcomeEmail()
      → Test gửi email chào mừng CTV
      → NHỚ THAY ĐỔI EMAIL TEST!
   
   ✅ checkEmailQuota()
      → Kiểm tra số email còn lại có thể gửi
   
   ✅ testFullRegistrationFlow()
      → Test toàn bộ flow đăng ký + gửi email
   
   ✅ runAllEmailTests()
      → Chạy tất cả tests một lần

5. LƯU Ý:
   - Thay đổi email test thành email thật của bạn
   - Kiểm tra spam folder nếu không thấy email
   - Chạy checkEmailQuota() trước để đảm bảo còn quota

*/

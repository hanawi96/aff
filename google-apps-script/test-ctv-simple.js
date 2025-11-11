// Test đơn giản để kiểm tra thông tin CTV
// Copy code này vào Google Apps Script và chạy

// Test với mã CTV từ ảnh: CTV119439
function testCTVInfo_CTV119439() {
  Logger.log('========================================');
  Logger.log('TEST: Lấy thông tin CTV119439');
  Logger.log('========================================\n');

  const testRefCode = 'CTV119439';
  Logger.log('🔍 Testing with referral code: ' + testRefCode);

  const ctvInfo = getCTVInfoByReferralCode(testRefCode);

  Logger.log('\n📋 Result:');
  Logger.log('  Name: ' + ctvInfo.name);
  Logger.log('  Phone: ' + ctvInfo.phone);
  Logger.log('  Address: ' + ctvInfo.address);

  Logger.log('\n========================================');
}

// Test với mã CTV khác từ ảnh: PARTNER001
function testCTVInfo_PARTNER001() {
  Logger.log('========================================');
  Logger.log('TEST: Lấy thông tin PARTNER001');
  Logger.log('========================================\n');

  const testRefCode = 'PARTNER001';
  Logger.log('🔍 Testing with referral code: ' + testRefCode);

  const ctvInfo = getCTVInfoByReferralCode(testRefCode);

  Logger.log('\n📋 Result:');
  Logger.log('  Name: ' + ctvInfo.name);
  Logger.log('  Phone: ' + ctvInfo.phone);
  Logger.log('  Address: ' + ctvInfo.address);

  Logger.log('\n========================================');
}

// Test với SĐT từ ảnh: 386190596
function testCTVInfo_Phone386190596() {
  Logger.log('========================================');
  Logger.log('TEST: Lấy thông tin theo SĐT 386190596');
  Logger.log('========================================\n');

  const testPhone = '386190596';
  Logger.log('🔍 Testing with phone: ' + testPhone);

  const ctvInfo = getCTVInfoByPhone(testPhone);

  Logger.log('\n📋 Result:');
  Logger.log('  Name: ' + ctvInfo.name);
  Logger.log('  Phone: ' + ctvInfo.phone);
  Logger.log('  Address: ' + ctvInfo.address);

  Logger.log('\n========================================');
}

// Test API endpoint với CTV119439
function testAPI_CTV119439() {
  Logger.log('========================================');
  Logger.log('TEST: API getOrders với CTV119439');
  Logger.log('========================================\n');

  const mockEvent = {
    parameter: {
      action: 'getOrders',
      referralCode: 'CTV119439'
    }
  };

  const response = doGet(mockEvent);
  const result = JSON.parse(response.getContent());

  Logger.log('📋 API Response:');
  Logger.log('  Success: ' + result.success);
  Logger.log('  Orders count: ' + (result.orders ? result.orders.length : 0));
  
  if (result.ctvInfo) {
    Logger.log('\n✅ ctvInfo found:');
    Logger.log('  Name: ' + result.ctvInfo.name);
    Logger.log('  Phone: ' + result.ctvInfo.phone);
    Logger.log('  Address: ' + result.ctvInfo.address);
  } else {
    Logger.log('\n❌ ctvInfo NOT found in response!');
  }

  Logger.log('\n========================================');
}

// Test API endpoint với PARTNER001
function testAPI_PARTNER001() {
  Logger.log('========================================');
  Logger.log('TEST: API getOrders với PARTNER001');
  Logger.log('========================================\n');

  const mockEvent = {
    parameter: {
      action: 'getOrders',
      referralCode: 'PARTNER001'
    }
  };

  const response = doGet(mockEvent);
  const result = JSON.parse(response.getContent());

  Logger.log('📋 API Response:');
  Logger.log('  Success: ' + result.success);
  Logger.log('  Orders count: ' + (result.orders ? result.orders.length : 0));
  
  if (result.ctvInfo) {
    Logger.log('\n✅ ctvInfo found:');
    Logger.log('  Name: ' + result.ctvInfo.name);
    Logger.log('  Phone: ' + result.ctvInfo.phone);
    Logger.log('  Address: ' + result.ctvInfo.address);
  } else {
    Logger.log('\n❌ ctvInfo NOT found in response!');
  }

  Logger.log('\n========================================');
}

// Chạy tất cả tests
function runSimpleCTVTests() {
  Logger.log('\n\n');
  Logger.log('╔════════════════════════════════════════╗');
  Logger.log('║   TEST THÔNG TIN CTV - ĐƠN GIẢN       ║');
  Logger.log('╚════════════════════════════════════════╝');
  Logger.log('\n');

  testCTVInfo_CTV119439();
  Logger.log('\n');

  testCTVInfo_PARTNER001();
  Logger.log('\n');

  testCTVInfo_Phone386190596();
  Logger.log('\n');

  testAPI_CTV119439();
  Logger.log('\n');

  testAPI_PARTNER001();
  Logger.log('\n');

  Logger.log('╔════════════════════════════════════════╗');
  Logger.log('║           HOÀN TẤT TESTS              ║');
  Logger.log('╚════════════════════════════════════════╝');
}

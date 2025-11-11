// Test functions để kiểm tra lấy thông tin CTV
// Copy các hàm này vào Google Apps Script và chạy để debug

// Test 1: Kiểm tra cấu trúc sheet CTV
function testCTVSheetStructure() {
  Logger.log('========================================');
  Logger.log('TEST: Kiểm tra cấu trúc sheet CTV');
  Logger.log('========================================\n');

  try {
    const CONFIG = {
      CTV_SHEET_ID: '1QOXBlIcX1Th1ZnNKulnbxEJDD-HfAiKfOFKHn2pBo4o',
      CTV_SHEET_NAME: 'DS REF'
    };

    const ctvSpreadsheet = SpreadsheetApp.openById(CONFIG.CTV_SHEET_ID);
    const ctvSheet = ctvSpreadsheet.getSheetByName(CONFIG.CTV_SHEET_NAME);

    if (!ctvSheet) {
      Logger.log('❌ Không tìm thấy sheet: ' + CONFIG.CTV_SHEET_NAME);
      return;
    }

    const data = ctvSheet.getDataRange().getValues();
    Logger.log('✅ Sheet found: ' + ctvSheet.getName());
    Logger.log('📊 Total rows: ' + data.length);

    // Hiển thị headers
    const headers = data[0];
    Logger.log('\n📋 Headers:');
    headers.forEach((h, i) => {
      Logger.log(`  [${i}] ${h}`);
    });

    // Hiển thị 3 dòng dữ liệu đầu tiên
    Logger.log('\n📝 First 3 data rows:');
    for (let i = 1; i <= Math.min(3, data.length - 1); i++) {
      Logger.log(`\nRow ${i}:`);
      const row = data[i];
      headers.forEach((h, j) => {
        Logger.log(`  ${h}: ${row[j]}`);
      });
    }

    // Tìm các cột quan trọng
    Logger.log('\n🔍 Finding important columns:');
    
    const refCodeIndex = headers.findIndex(h =>
      h && h.toString().toLowerCase().includes('ref')
    );
    Logger.log('  Mã Ref column index: ' + refCodeIndex + 
               (refCodeIndex !== -1 ? ` (${headers[refCodeIndex]})` : ' (NOT FOUND)'));

    const nameIndex = headers.findIndex(h =>
      h && (h.toString().toLowerCase().includes('họ tên') || 
            h.toString().toLowerCase().includes('tên'))
    );
    Logger.log('  Họ Tên column index: ' + nameIndex + 
               (nameIndex !== -1 ? ` (${headers[nameIndex]})` : ' (NOT FOUND)'));

    const phoneIndex = headers.findIndex(h =>
      h && (h.toString().toLowerCase().includes('điện thoại') ||
            h.toString().toLowerCase().includes('sđt'))
    );
    Logger.log('  SĐT column index: ' + phoneIndex + 
               (phoneIndex !== -1 ? ` (${headers[phoneIndex]})` : ' (NOT FOUND)'));

    const addressIndex = headers.findIndex(h =>
      h && (h.toString().toLowerCase().includes('tỉnh') || 
            h.toString().toLowerCase().includes('thành'))
    );
    Logger.log('  Địa chỉ column index: ' + addressIndex + 
               (addressIndex !== -1 ? ` (${headers[addressIndex]})` : ' (NOT FOUND)'));

    Logger.log('\n========================================');
    Logger.log('✅ TEST HOÀN TẤT');
    Logger.log('========================================');

  } catch (error) {
    Logger.log('❌ Error: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
  }
}

// Test 2: Test lấy thông tin CTV theo mã
function testGetCTVInfoByCode() {
  Logger.log('========================================');
  Logger.log('TEST: Lấy thông tin CTV theo mã');
  Logger.log('========================================\n');

  // Thay đổi mã CTV này thành mã thực tế trong sheet của bạn
  const testRefCode = 'CTV119439'; // Từ ảnh bạn gửi

  Logger.log('🔍 Testing with referral code: ' + testRefCode);

  const ctvInfo = getCTVInfoByReferralCode(testRefCode);

  Logger.log('\n📋 Result:');
  Logger.log(JSON.stringify(ctvInfo, null, 2));

  Logger.log('\n========================================');
}

// Test 3: Test lấy thông tin CTV theo SĐT
function testGetCTVInfoByPhone() {
  Logger.log('========================================');
  Logger.log('TEST: Lấy thông tin CTV theo SĐT');
  Logger.log('========================================\n');

  // Thay đổi SĐT này thành SĐT thực tế trong sheet của bạn
  const testPhone = '386190596'; // Từ ảnh bạn gửi (đã bỏ số 0)

  Logger.log('🔍 Testing with phone: ' + testPhone);

  const ctvInfo = getCTVInfoByPhone(testPhone);

  Logger.log('\n📋 Result:');
  Logger.log(JSON.stringify(ctvInfo, null, 2));

  Logger.log('\n========================================');
}

// Test 4: Test API endpoint
function testAPIGetOrders() {
  Logger.log('========================================');
  Logger.log('TEST: API getOrders');
  Logger.log('========================================\n');

  const testRefCode = 'CTV119439'; // Thay bằng mã thực tế

  // Giả lập request
  const mockEvent = {
    parameter: {
      action: 'getOrders',
      referralCode: testRefCode
    }
  };

  const response = doGet(mockEvent);
  const result = JSON.parse(response.getContent());

  Logger.log('📋 API Response:');
  Logger.log(JSON.stringify(result, null, 2));

  if (result.ctvInfo) {
    Logger.log('\n✅ ctvInfo found in response:');
    Logger.log('  Name: ' + result.ctvInfo.name);
    Logger.log('  Phone: ' + result.ctvInfo.phone);
    Logger.log('  Address: ' + result.ctvInfo.address);
  } else {
    Logger.log('\n❌ ctvInfo NOT found in response!');
  }

  Logger.log('\n========================================');
}

// Chạy tất cả tests
function runAllCTVTests() {
  Logger.log('\n\n');
  Logger.log('╔════════════════════════════════════════╗');
  Logger.log('║   BẮT ĐẦU KIỂM TRA THÔNG TIN CTV      ║');
  Logger.log('╚════════════════════════════════════════╝');
  Logger.log('\n');

  testCTVSheetStructure();
  Logger.log('\n\n');

  testGetCTVInfoByCode();
  Logger.log('\n\n');

  testGetCTVInfoByPhone();
  Logger.log('\n\n');

  testAPIGetOrders();
  Logger.log('\n\n');

  Logger.log('╔════════════════════════════════════════╗');
  Logger.log('║        HOÀN TẤT TẤT CẢ TESTS          ║');
  Logger.log('╚════════════════════════════════════════╝');
}

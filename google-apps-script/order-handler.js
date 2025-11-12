// Google Apps Script code to handle form submissions and order lookup
// Deploy this as a Web App in Google Apps Script

// ============================================
// CONFIGURATION - ĐÃ CẤU HÌNH
// ============================================
const CONFIG = {
  // Sheet ID của danh sách CTV
  CTV_SHEET_ID: '1axooVOgwVsgwAqCE59afdz6RQOWNV1j4WUGQrBvUHiI',
  CTV_SHEET_NAME: 'DS CTV',

  // Sheet ID của đơn hàng
  ORDER_SHEET_ID: '1XNdGOYAVYa4BdZFEVZicMLbX8nJ3J--2HPJjltD9r-k',
  ORDER_SHEET_NAME: 'DS ĐƠN HÀNG', // Tên sheet chứa đơn hàng

  // Mapping cột trong sheet đơn hàng (theo ảnh)
  ORDER_COLUMNS: {
    orderId: 0,        // Cột A - Mã Đơn Hàng
    orderDate: 1,      // Cột B - Ngày Đặt
    customerName: 2,   // Cột C - Tên Khách Hàng
    customerPhone: 3,  // Cột D - Số Điện Thoại (Khách hàng)
    address: 4,        // Cột E - Địa Chỉ
    products: 5,       // Cột F - Chi Tiết Sản Phẩm
    totalAmount: 6,    // Cột G - TỔNG KHÁCH PHẢI TRẢ
    paymentMethod: 7,  // Cột H - Phương Thức Thanh Toán
    status: 8,         // Cột I - Ghi Chú
    referralCode: 9,   // Cột J - Mã Referral
    commission: 10,    // Cột K - Hoa Hồng
    ctvPhone: 11       // Cột L - SĐT CTV (⭐ ĐÚNG INDEX)
  },

  // Tỷ lệ hoa hồng (10%)
  COMMISSION_RATE: 0.1
};

function doPost(e) {
  try {
    // Parse the incoming data
    let data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (parseError) {
      // If parsing fails, try to get the data directly
      data = e.parameter;
    }

    // Log for debugging
    Logger.log('Received data: ' + JSON.stringify(data));

    // Get or create the spreadsheet
    const spreadsheet = SpreadsheetApp.openById(CONFIG.CTV_SHEET_ID);

    // Get or create the sheet
    let sheet = spreadsheet.getSheetByName(CONFIG.CTV_SHEET_NAME);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(CONFIG.CTV_SHEET_NAME);
    }

    // Kiểm tra xem sheet có header chưa (kiểm tra cell A1)
    const firstCell = sheet.getRange(1, 1).getValue();
    const needsHeader = !firstCell || firstCell === '';

    // Danh sách header đầy đủ
    const headers = [
      'Thời Gian',
      'Họ Tên',
      'Số Điện Thoại',
      'Email',           // ⭐ Thêm cột Email
      'Tỉnh/Thành',
      'Tuổi',
      'Kinh Nghiệm',
      'Lý Do',
      'Mã Ref',
      'Trạng Thái',
      'Đơn Hàng Của Bạn' // ⭐ Cột mới
    ];

    if (needsHeader) {
      // Tạo header mới
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

      // Format headers - Nổi bật và đẹp hơn
      const headerRange = sheet.getRange(1, 1, 1, headers.length);

      // Background gradient effect với màu hồng đậm hơn
      headerRange.setBackground('#e91e63'); // Material Pink 500
      headerRange.setFontWeight('bold');
      headerRange.setFontColor('#ffffff');
      headerRange.setFontSize(11);
      headerRange.setFontFamily('Arial');
      headerRange.setHorizontalAlignment('center');
      headerRange.setVerticalAlignment('middle');

      // Thêm border cho header
      headerRange.setBorder(
        true, true, true, true, true, true,
        '#c2185b', // Material Pink 700 - darker border
        SpreadsheetApp.BorderStyle.SOLID_MEDIUM
      );

      // Tăng chiều cao của header row
      sheet.setRowHeight(1, 35);

      // Set column widths cho dễ đọc
      sheet.setColumnWidth(1, 150);  // Thời Gian
      sheet.setColumnWidth(2, 180);  // Họ Tên
      sheet.setColumnWidth(3, 120);  // Số Điện Thoại
      sheet.setColumnWidth(4, 200);  // Email ⭐
      sheet.setColumnWidth(5, 120);  // Tỉnh/Thành
      sheet.setColumnWidth(6, 100);  // Tuổi
      sheet.setColumnWidth(7, 130);  // Kinh Nghiệm
      sheet.setColumnWidth(8, 300);  // Lý Do
      sheet.setColumnWidth(9, 120);  // Mã Ref
      sheet.setColumnWidth(10, 100); // Trạng Thái
      sheet.setColumnWidth(11, 150); // Đơn Hàng Của Bạn ⭐

      // Freeze header row
      sheet.setFrozenRows(1);

      // Thêm filter cho header
      sheet.getRange(1, 1, 1, headers.length).createFilter();

      Logger.log('✅ Header đã được tạo thành công!');
    } else {
      // ⭐ Kiểm tra và cập nhật header nếu thiếu cột
      Logger.log('ℹ️ Header đã tồn tại, kiểm tra số cột...');

      const lastColumn = sheet.getLastColumn();
      Logger.log('Số cột hiện tại: ' + lastColumn + ', Số cột cần có: ' + headers.length);

      if (lastColumn < headers.length) {
        // Thiếu cột, cập nhật header
        Logger.log('⚠️ Thiếu cột! Đang cập nhật header...');
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

        // Format cột mới
        const newColumnRange = sheet.getRange(1, lastColumn + 1, 1, headers.length - lastColumn);
        newColumnRange.setBackground('#e91e63');
        newColumnRange.setFontWeight('bold');
        newColumnRange.setFontColor('#ffffff');
        newColumnRange.setFontSize(11);
        newColumnRange.setHorizontalAlignment('center');
        newColumnRange.setVerticalAlignment('middle');

        // Set width cho cột mới
        if (lastColumn < 4) {
          sheet.setColumnWidth(4, 200); // Email
        }
        if (lastColumn < 11) {
          sheet.setColumnWidth(11, 150); // Đơn Hàng Của Bạn
        }

        Logger.log('✅ Đã thêm cột mới vào header!');
      }
    }

    // Generate unique referral code
    const refCode = generateReferralCode(data.fullName || 'USER');
    const refUrl = 'https://shopvd.store/?ref=' + refCode;

    // ⭐ Tạo link tra cứu đơn hàng cho CTV
    const orderCheckUrl = 'https://shopvd.store/ctv/?code=' + refCode;

    Logger.log('Generated RefCode: ' + refCode);
    Logger.log('Generated RefUrl: ' + refUrl);
    Logger.log('Generated OrderCheckUrl: ' + orderCheckUrl);

    // Prepare the row data
    const rowData = [
      data.timestamp || new Date().toLocaleString('vi-VN'),
      data.fullName || '',
      data.phone || '',
      data.email || '',  // ⭐ Thêm email
      data.city || '',
      data.age || '',
      data.experience || '',
      data.motivation || '',
      refCode, // Referral Code
      'Mới', // Status
      'Xem ngay' // ⭐ Text cho link đơn hàng
    ];

    // Add the data to the sheet
    sheet.appendRow(rowData);

    // Get the last row that was just added
    const lastRow = sheet.getLastRow();

    // Format the newly added row
    const dataRange = sheet.getRange(lastRow, 1, 1, rowData.length);

    // Căn giữa các cột trừ cột "Lý Do" (cột 8)
    for (let col = 1; col <= rowData.length; col++) {
      const cell = sheet.getRange(lastRow, col);
      if (col === 8) { // Cột "Lý Do" - căn trái
        cell.setHorizontalAlignment('left');
      } else {
        cell.setHorizontalAlignment('center');
      }
      cell.setVerticalAlignment('middle');
    }

    // Thêm màu nền xen kẽ cho dễ đọc (zebra striping)
    if (lastRow % 2 === 0) {
      dataRange.setBackground('#f9f9f9'); // Light gray cho hàng chẵn
    } else {
      dataRange.setBackground('#ffffff'); // White cho hàng lẻ
    }

    // Format cột "Trạng Thái" (cột 10) với màu nổi bật
    const statusCell = sheet.getRange(lastRow, 10);
    statusCell.setBackground('#fff3cd'); // Light yellow
    statusCell.setFontColor('#856404'); // Dark yellow text
    statusCell.setFontWeight('bold');

    // Format cột "Mã Ref" (cột 9) với màu nổi bật
    const refCodeCell = sheet.getRange(lastRow, 9);
    refCodeCell.setBackground('#e3f2fd'); // Light blue
    refCodeCell.setFontColor('#1565c0'); // Dark blue text
    refCodeCell.setFontWeight('bold');
    refCodeCell.setFontFamily('Courier New'); // Monospace font cho code

    // ⭐ Format cột "Đơn Hàng Của Bạn" (cột 11) với hyperlink
    const orderLinkCell = sheet.getRange(lastRow, 11);

    // Cách 1: Dùng RichText (an toàn nhất)
    try {
      const richText = SpreadsheetApp.newRichTextValue()
        .setText('Xem ngay')
        .setLinkUrl(orderCheckUrl)
        .build();
      orderLinkCell.setRichTextValue(richText);
    } catch (e) {
      // Fallback: Nếu RichText lỗi, dùng công thức HYPERLINK
      Logger.log('RichText error, using HYPERLINK formula: ' + e.toString());
      const linkFormula = '=HYPERLINK("' + orderCheckUrl + '","Xem ngay")';
      orderLinkCell.setFormula(linkFormula);
    }

    // Format đẹp cho link
    orderLinkCell.setBackground('#d1f2eb'); // Light green
    orderLinkCell.setFontColor('#0d6832'); // Dark green text
    orderLinkCell.setFontWeight('bold');
    orderLinkCell.setHorizontalAlignment('center');
    orderLinkCell.setVerticalAlignment('middle');

    // Thêm border cho row
    dataRange.setBorder(
      true, true, true, true, false, false,
      '#e0e0e0',
      SpreadsheetApp.BorderStyle.SOLID
    );

    // Set row height
    sheet.setRowHeight(lastRow, 30);

    // Send notification email (optional)
    try {
      sendNotificationEmail(data);
    } catch (emailError) {
      Logger.log('Email error: ' + emailError.toString());
    }

    // Return success response with referral code
    const responseData = {
      success: true,
      message: 'Data saved successfully',
      referralCode: refCode,
      orderCheckUrl: orderCheckUrl, // ⭐ Thêm link tra cứu đơn hàng
      referralUrl: refUrl,
      timestamp: new Date().toISOString()
    };

    Logger.log('Response data: ' + JSON.stringify(responseData));

    return ContentService
      .createTextOutput(JSON.stringify(responseData))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log('Error: ' + error.toString());
    Logger.log('Stack: ' + error.stack);

    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString(),
        stack: error.stack
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Generate unique referral code
function generateReferralCode(_fullName) {
  // Tạo mã CTV với format: CTV + 6 chữ số ngẫu nhiên
  let randomCode = '';
  for (let i = 0; i < 6; i++) {
    randomCode += Math.floor(Math.random() * 10);
  }

  return 'CTV' + randomCode;
}

// Remove Vietnamese accents
function removeVietnameseAccents(str) {
  const accents = {
    'à': 'a', 'á': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
    'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
    'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
    'đ': 'd',
    'è': 'e', 'é': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
    'ê': 'e', 'ề': 'e', 'ế': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
    'ì': 'i', 'í': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
    'ò': 'o', 'ó': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
    'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o',
    'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
    'ù': 'u', 'ú': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
    'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
    'ỳ': 'y', 'ý': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y'
  };

  return str.split('').map(char => accents[char] || char).join('');
}

// Handle GET requests (for CTV order lookup)
function doGet(e) {
  try {
    const action = e.parameter.action;

    // API: Lấy 10 đơn hàng mới nhất
    if (action === 'getRecentOrders') {
      const limit = parseInt(e.parameter.limit) || 10;
      const orders = getRecentOrders(limit);

      return ContentService
        .createTextOutput(JSON.stringify({
          success: true,
          orders: orders,
          total: orders.length
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // API: Lấy đơn hàng theo mã CTV
    if (action === 'getOrders') {
      const referralCode = e.parameter.referralCode;

      if (!referralCode) {
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            error: 'Mã Referral không được để trống'
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      // Get orders from Google Sheets
      Logger.log('📦 Getting orders for referral code: ' + referralCode);
      const orders = getOrdersByReferralCode(referralCode);
      Logger.log('📊 Found ' + orders.length + ' orders');

      // Get CTV info
      Logger.log('👤 Getting CTV info for referral code: ' + referralCode);
      const ctvInfo = getCTVInfoByReferralCode(referralCode);
      Logger.log('📋 CTV Info result: ' + JSON.stringify(ctvInfo));

      const response = {
        success: true,
        orders: orders,
        referralCode: referralCode,
        ctvInfo: ctvInfo
      };

      Logger.log('📤 Sending response with ctvInfo: ' + (ctvInfo ? 'YES' : 'NO'));
      Logger.log('📤 Response: ' + JSON.stringify(response));

      return ContentService
        .createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ⭐ API MỚI: Lấy đơn hàng theo số điện thoại CTV
    if (action === 'getOrdersByPhone') {
      const phone = e.parameter.phone;

      if (!phone) {
        return ContentService
          .createTextOutput(JSON.stringify({
            success: false,
            error: 'Số điện thoại không được để trống'
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      // Chuẩn hóa số điện thoại (bỏ số 0 đầu)
      const normalizedPhone = normalizePhone(phone);
      Logger.log('🔍 Searching orders for normalized phone: ' + normalizedPhone);

      // ⭐ PHƯƠNG ÁN TỐI ƯU: Tìm đơn hàng trực tiếp theo SĐT CTV trong sheet đơn hàng
      const orders = getOrdersByPhoneDirectly(normalizedPhone);

      if (!orders || orders.length === 0) {
        // Nếu không tìm thấy, thử phương án 2: Tìm mã CTV từ sheet DS REF
        Logger.log('⚠️ No orders found directly, trying to find via CTV sheet...');
        const referralCode = getReferralCodeByPhone(normalizedPhone);

        if (!referralCode) {
          return ContentService
            .createTextOutput(JSON.stringify({
              success: false,
              error: 'Không tìm thấy đơn hàng với số điện thoại: ' + phone
            }))
            .setMimeType(ContentService.MimeType.JSON);
        }

        // Lấy đơn hàng theo mã CTV
        const ordersByRefCode = getOrdersByReferralCode(referralCode);

        // Get CTV info
        const ctvInfo = getCTVInfoByPhone(normalizedPhone);

        return ContentService
          .createTextOutput(JSON.stringify({
            success: true,
            orders: ordersByRefCode,
            referralCode: referralCode,
            phone: phone,
            ctvInfo: ctvInfo,
            method: 'via_ctv_sheet'
          }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      // Lấy mã CTV từ đơn hàng đầu tiên (nếu có)
      const referralCode = orders.length > 0 ? orders[0].referralCode : '';

      // Get CTV info
      const ctvInfo = getCTVInfoByPhone(normalizedPhone);

      return ContentService
        .createTextOutput(JSON.stringify({
          success: true,
          orders: orders,
          referralCode: referralCode,
          phone: phone,
          ctvInfo: ctvInfo,
          method: 'direct_phone_lookup'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // API: Lấy thống kê dashboard
    if (action === 'getDashboardStats') {
      const stats = getDashboardStats();

      return ContentService
        .createTextOutput(JSON.stringify({
          success: true,
          stats: stats
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Default response
    return ContentService
      .createTextOutput('Google Apps Script is working!')
      .setMimeType(ContentService.MimeType.TEXT);

  } catch (error) {
    Logger.log('Error in doGet: ' + error.toString());
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Get recent orders (10 đơn hàng CÓ MÃ REFERRAL mới nhất)
function getRecentOrders(limit) {
  try {
    // Mở spreadsheet đơn hàng
    const orderSpreadsheet = SpreadsheetApp.openById(CONFIG.ORDER_SHEET_ID);

    // Lấy sheet đơn hàng
    let orderSheet = orderSpreadsheet.getSheetByName(CONFIG.ORDER_SHEET_NAME);
    if (!orderSheet) {
      orderSheet = orderSpreadsheet.getSheets()[0];
      Logger.log('Không tìm thấy sheet "' + CONFIG.ORDER_SHEET_NAME + '", sử dụng sheet: ' + orderSheet.getName());
    }

    // Lấy tất cả dữ liệu
    const data = orderSheet.getDataRange().getValues();

    if (data.length <= 1) {
      Logger.log('Sheet đơn hàng không có dữ liệu');
      return [];
    }

    // Lấy N đơn hàng CÓ MÃ REFERRAL mới nhất (từ cuối lên)
    const cols = CONFIG.ORDER_COLUMNS;
    const orders = [];

    // Duyệt từ dòng cuối lên đầu
    for (let i = data.length - 1; i >= 1; i--) {
      const row = data[i];

      // Bỏ qua nếu không có Order ID
      if (!row[cols.orderId]) continue;

      // ⭐ QUAN TRỌNG: Chỉ lấy đơn hàng CÓ MÃ REFERRAL
      const refCode = row[cols.referralCode];
      if (!refCode || refCode.toString().trim() === '') {
        Logger.log('Bỏ qua đơn ' + row[cols.orderId] + ' - Không có mã Referral');
        continue; // Bỏ qua đơn không có mã referral
      }

      const rawAmount = row[cols.totalAmount];
      const parsedAmount = parseAmount(rawAmount);

      orders.push({
        orderId: row[cols.orderId] || '',
        orderDate: formatDate(row[cols.orderDate]),
        customerName: row[cols.customerName] || '',
        customerPhone: row[cols.customerPhone] || '',
        products: row[cols.products] || '',
        totalAmount: parsedAmount,
        status: row[cols.status] || '',
        referralCode: refCode.toString().trim()
      });

      // Dừng khi đã đủ số lượng
      if (orders.length >= limit) break;
    }

    Logger.log('Found ' + orders.length + ' recent orders WITH referral code');
    return orders;

  } catch (error) {
    Logger.log('Error in getRecentOrders: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    throw error;
  }
}

// Get orders by referral code from Google Sheets
function getOrdersByReferralCode(referralCode) {
  try {
    // Mở spreadsheet đơn hàng (RIÊNG BIỆT với sheet CTV)
    const orderSpreadsheet = SpreadsheetApp.openById(CONFIG.ORDER_SHEET_ID);

    // Lấy sheet đơn hàng
    let orderSheet = orderSpreadsheet.getSheetByName(CONFIG.ORDER_SHEET_NAME);
    if (!orderSheet) {
      // Nếu không tìm thấy sheet theo tên, lấy sheet đầu tiên
      orderSheet = orderSpreadsheet.getSheets()[0];
      Logger.log('Không tìm thấy sheet "' + CONFIG.ORDER_SHEET_NAME + '", sử dụng sheet: ' + orderSheet.getName());
    }

    // Lấy tất cả dữ liệu
    const data = orderSheet.getDataRange().getValues();

    if (data.length <= 1) {
      Logger.log('Sheet đơn hàng không có dữ liệu');
      return [];
    }

    // Header row
    const headers = data[0];
    Logger.log('Headers: ' + JSON.stringify(headers));

    // Tìm index của cột "Mã Referral" (tự động tìm cột chứa "ref")
    let refColumnIndex = headers.findIndex(h =>
      h && h.toString().toLowerCase().includes('ref')
    );

    // Nếu không tìm thấy, sử dụng config
    if (refColumnIndex === -1) {
      refColumnIndex = CONFIG.ORDER_COLUMNS.referralCode;
      Logger.log('Sử dụng config column index: ' + refColumnIndex);
    }

    Logger.log('Referral column index: ' + refColumnIndex);

    // Lọc các đơn hàng có mã referral khớp
    const orders = [];
    const cols = CONFIG.ORDER_COLUMNS;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowRefCode = row[refColumnIndex] ? row[refColumnIndex].toString().trim() : '';

      if (rowRefCode.toUpperCase() === referralCode.toUpperCase()) {
        const rawAmount = row[cols.totalAmount];
        const parsedAmount = parseAmount(rawAmount);

        Logger.log('Raw amount from sheet: "' + rawAmount + '" (type: ' + typeof rawAmount + ')');
        Logger.log('Parsed amount: ' + parsedAmount);

        // Map dữ liệu theo config
        orders.push({
          orderId: row[cols.orderId] || '',
          orderDate: formatDate(row[cols.orderDate]),
          customerName: row[cols.customerName] || '',
          customerPhone: row[cols.customerPhone] || '',
          products: row[cols.products] || '',
          totalAmount: parsedAmount,
          status: row[cols.status] || '',
          referralCode: rowRefCode
        });
      }
    }

    Logger.log('Found ' + orders.length + ' orders for referral code: ' + referralCode);
    return orders;

  } catch (error) {
    Logger.log('Error in getOrdersByReferralCode: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    throw error;
  }
}

// Helper function to format date
function formatDate(dateValue) {
  if (!dateValue) return '';

  try {
    if (dateValue instanceof Date) {
      return Utilities.formatDate(dateValue, Session.getScriptTimeZone(), 'dd/MM/yyyy');
    }
    return dateValue.toString();
  } catch (e) {
    return dateValue.toString();
  }
}

// Helper function to parse amount
function parseAmount(amountValue) {
  if (!amountValue) return 0;

  try {
    // Nếu là số, nhân với 1000 vì Google Sheets format đã chia 1000
    if (typeof amountValue === 'number') {
      // Nếu số nhỏ hơn 10000, có thể đã bị format
      if (amountValue < 10000) {
        return amountValue * 1000;
      }
      return amountValue;
    }

    // Nếu là string, xử lý định dạng Việt Nam: "139.000 đ"
    const cleanAmount = amountValue.toString()
      .replace(/[^\d.,]/g, '')  // Giữ số, dấu chấm, dấu phẩy
      .replace(/\./g, '')        // Xóa dấu chấm (hàng nghìn)
      .replace(/,/g, '.');       // Thay phẩy thành chấm (thập phân)

    return parseFloat(cleanAmount) || 0;
  } catch (e) {
    Logger.log('Error parsing amount: ' + amountValue + ' - ' + e.toString());
    return 0;
  }
}

// ⭐ Helper function: Chuẩn hóa số điện thoại (bỏ số 0 đầu)
function normalizePhone(phone) {
  if (!phone) return '';

  // Chuyển thành string và loại bỏ khoảng trắng, dấu gạch ngang
  let normalized = phone.toString().trim().replace(/[\s\-]/g, '');

  // Bỏ số 0 ở đầu nếu có
  if (normalized.startsWith('0')) {
    normalized = normalized.substring(1);
  }

  return normalized;
}

// ⭐ Hàm mới: Lấy thông tin CTV theo số điện thoại
function getCTVInfoByPhone(normalizedPhone) {
  try {
    Logger.log('🔍 Getting CTV info for phone: ' + normalizedPhone);

    const ctvSpreadsheet = SpreadsheetApp.openById(CONFIG.CTV_SHEET_ID);
    const ctvSheet = ctvSpreadsheet.getSheetByName(CONFIG.CTV_SHEET_NAME);

    if (!ctvSheet) {
      Logger.log('❌ CTV sheet not found');
      return {
        name: 'Chưa cập nhật',
        phone: 'Chưa cập nhật',
        address: 'Chưa cập nhật'
      };
    }

    const data = ctvSheet.getDataRange().getValues();
    Logger.log('📊 Total rows in CTV sheet: ' + data.length);

    if (data.length <= 1) {
      Logger.log('⚠️ No CTV data found');
      return {
        name: 'Chưa cập nhật',
        phone: 'Chưa cập nhật',
        address: 'Chưa cập nhật'
      };
    }

    // Tìm index các cột cần thiết
    const headers = data[0];
    Logger.log('📋 Headers: ' + JSON.stringify(headers));

    const phoneColumnIndex = headers.findIndex(h =>
      h && (h.toString().toLowerCase().includes('điện thoại') ||
        h.toString().toLowerCase().includes('sđt') ||
        h.toString().toLowerCase().includes('phone'))
    );
    const nameColumnIndex = headers.findIndex(h =>
      h && (h.toString().toLowerCase().includes('họ tên') ||
        h.toString().toLowerCase().includes('họ và tên') ||
        h.toString().toLowerCase().includes('tên'))
    );
    const addressColumnIndex = headers.findIndex(h =>
      h && (h.toString().toLowerCase().includes('tỉnh') ||
        h.toString().toLowerCase().includes('thành') ||
        h.toString().toLowerCase().includes('địa chỉ'))
    );

    Logger.log('📍 Column indexes - Phone: ' + phoneColumnIndex +
      ', Name: ' + nameColumnIndex +
      ', Address: ' + addressColumnIndex);

    if (phoneColumnIndex === -1) {
      Logger.log('❌ Phone column not found');
      return {
        name: 'Chưa cập nhật',
        phone: 'Chưa cập nhật',
        address: 'Chưa cập nhật'
      };
    }

    // Tìm CTV với số điện thoại khớp
    Logger.log('🔎 Searching for phone: ' + normalizedPhone);

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowPhone = row[phoneColumnIndex];

      if (!rowPhone) continue;

      const normalizedRowPhone = normalizePhone(rowPhone);
      Logger.log(`  Row ${i}: Comparing "${normalizedRowPhone}" === "${normalizedPhone}"`);

      if (normalizedRowPhone === normalizedPhone) {
        const ctvInfo = {
          name: nameColumnIndex !== -1 && row[nameColumnIndex] ? row[nameColumnIndex].toString() : 'Chưa cập nhật',
          phone: rowPhone.toString(),
          address: addressColumnIndex !== -1 && row[addressColumnIndex] ? row[addressColumnIndex].toString() : 'Chưa cập nhật'
        };

        Logger.log('✅ Found CTV info: ' + JSON.stringify(ctvInfo));
        return ctvInfo;
      }
    }

    Logger.log('❌ No matching CTV found for phone: ' + normalizedPhone);
    return {
      name: 'Không tìm thấy',
      phone: normalizedPhone,
      address: 'Không tìm thấy'
    };

  } catch (error) {
    Logger.log('❌ Error in getCTVInfoByPhone: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    return {
      name: 'Lỗi: ' + error.toString(),
      phone: 'Lỗi',
      address: 'Lỗi'
    };
  }
}

// ⭐ Hàm mới: Lấy thông tin CTV theo mã referral
function getCTVInfoByReferralCode(referralCode) {
  try {
    Logger.log('🔍 Getting CTV info for referral code: ' + referralCode);

    const ctvSpreadsheet = SpreadsheetApp.openById(CONFIG.CTV_SHEET_ID);
    const ctvSheet = ctvSpreadsheet.getSheetByName(CONFIG.CTV_SHEET_NAME);

    if (!ctvSheet) {
      Logger.log('❌ CTV sheet not found');
      return {
        name: 'Chưa cập nhật',
        phone: 'Chưa cập nhật',
        address: 'Chưa cập nhật'
      };
    }

    const data = ctvSheet.getDataRange().getValues();
    Logger.log('📊 Total rows in CTV sheet: ' + data.length);

    if (data.length <= 1) {
      Logger.log('⚠️ No CTV data found');
      return {
        name: 'Chưa cập nhật',
        phone: 'Chưa cập nhật',
        address: 'Chưa cập nhật'
      };
    }

    // Tìm index các cột cần thiết
    const headers = data[0];
    Logger.log('📋 Headers: ' + JSON.stringify(headers));

    const refCodeColumnIndex = headers.findIndex(h =>
      h && h.toString().toLowerCase().includes('ref')
    );
    const nameColumnIndex = headers.findIndex(h =>
      h && (h.toString().toLowerCase().includes('họ tên') ||
        h.toString().toLowerCase().includes('họ và tên') ||
        h.toString().toLowerCase().includes('tên'))
    );
    const phoneColumnIndex = headers.findIndex(h =>
      h && (h.toString().toLowerCase().includes('điện thoại') ||
        h.toString().toLowerCase().includes('sđt') ||
        h.toString().toLowerCase().includes('phone'))
    );
    const addressColumnIndex = headers.findIndex(h =>
      h && (h.toString().toLowerCase().includes('tỉnh') ||
        h.toString().toLowerCase().includes('thành') ||
        h.toString().toLowerCase().includes('địa chỉ'))
    );

    Logger.log('📍 Column indexes - RefCode: ' + refCodeColumnIndex +
      ', Name: ' + nameColumnIndex +
      ', Phone: ' + phoneColumnIndex +
      ', Address: ' + addressColumnIndex);

    if (refCodeColumnIndex === -1) {
      Logger.log('❌ Referral code column not found in headers');
      return {
        name: 'Chưa cập nhật',
        phone: 'Chưa cập nhật',
        address: 'Chưa cập nhật'
      };
    }

    // Tìm CTV với mã referral khớp
    Logger.log('🔎 Searching for referral code: ' + referralCode.toUpperCase());

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowRefCode = row[refCodeColumnIndex];

      if (!rowRefCode) continue;

      const normalizedRowRefCode = rowRefCode.toString().trim().toUpperCase();
      const normalizedSearchCode = referralCode.toString().trim().toUpperCase();

      Logger.log(`  Row ${i}: Comparing "${normalizedRowRefCode}" === "${normalizedSearchCode}"`);

      if (normalizedRowRefCode === normalizedSearchCode) {
        const ctvInfo = {
          name: nameColumnIndex !== -1 && row[nameColumnIndex] ? row[nameColumnIndex].toString() : 'Chưa cập nhật',
          phone: phoneColumnIndex !== -1 && row[phoneColumnIndex] ? row[phoneColumnIndex].toString() : 'Chưa cập nhật',
          address: addressColumnIndex !== -1 && row[addressColumnIndex] ? row[addressColumnIndex].toString() : 'Chưa cập nhật'
        };

        Logger.log('✅ Found CTV info: ' + JSON.stringify(ctvInfo));
        return ctvInfo;
      }
    }

    Logger.log('❌ No matching CTV found for referral code: ' + referralCode);
    return {
      name: 'Không tìm thấy',
      phone: 'Không tìm thấy',
      address: 'Không tìm thấy'
    };

  } catch (error) {
    Logger.log('❌ Error in getCTVInfoByReferralCode: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    return {
      name: 'Lỗi: ' + error.toString(),
      phone: 'Lỗi',
      address: 'Lỗi'
    };
  }
}

// ⭐ Hàm mới: Lấy đơn hàng trực tiếp theo số điện thoại CTV (PHƯƠNG ÁN TỐI ƯU)
function getOrdersByPhoneDirectly(normalizedPhone) {
  try {
    Logger.log('🔍 Searching orders directly by CTV phone: ' + normalizedPhone);

    // Mở spreadsheet đơn hàng
    const orderSpreadsheet = SpreadsheetApp.openById(CONFIG.ORDER_SHEET_ID);
    let orderSheet = orderSpreadsheet.getSheetByName(CONFIG.ORDER_SHEET_NAME);

    if (!orderSheet) {
      orderSheet = orderSpreadsheet.getSheets()[0];
      Logger.log('Không tìm thấy sheet "' + CONFIG.ORDER_SHEET_NAME + '", sử dụng sheet: ' + orderSheet.getName());
    }

    // Lấy tất cả dữ liệu
    const data = orderSheet.getDataRange().getValues();

    if (data.length <= 1) {
      Logger.log('Sheet đơn hàng không có dữ liệu');
      return [];
    }

    // Tìm index của cột "SĐT CTV" hoặc "Số Điện Thoại CTV"
    const headers = data[0];
    Logger.log('📋 Headers: ' + JSON.stringify(headers));

    let ctvPhoneColumnIndex = headers.findIndex(h =>
      h && (h.toString().toLowerCase().includes('sđt ctv') ||
        h.toString().toLowerCase().includes('số điện thoại ctv') ||
        h.toString().toLowerCase().includes('phone ctv') ||
        h.toString().toLowerCase().includes('sdt ctv'))
    );

    // Nếu không tìm thấy, thử dùng config
    if (ctvPhoneColumnIndex === -1 && CONFIG.ORDER_COLUMNS.ctvPhone !== undefined) {
      ctvPhoneColumnIndex = CONFIG.ORDER_COLUMNS.ctvPhone;
      Logger.log('⚠️ Không tìm thấy cột SĐT CTV trong header, sử dụng config index: ' + ctvPhoneColumnIndex);
    }

    Logger.log('📍 CTV Phone column index: ' + ctvPhoneColumnIndex);

    if (ctvPhoneColumnIndex === -1) {
      Logger.log('❌ Không tìm thấy cột SĐT CTV trong sheet đơn hàng');
      return [];
    }

    // Lọc các đơn hàng có SĐT CTV khớp
    const orders = [];
    const cols = CONFIG.ORDER_COLUMNS;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowCtvPhone = row[ctvPhoneColumnIndex];

      if (!rowCtvPhone) continue;

      // Chuẩn hóa số điện thoại trong sheet
      const normalizedRowPhone = normalizePhone(rowCtvPhone);

      Logger.log(`  Row ${i}: Comparing ${normalizedRowPhone} === ${normalizedPhone}`);

      if (normalizedRowPhone === normalizedPhone) {
        const rawAmount = row[cols.totalAmount];
        const parsedAmount = parseAmount(rawAmount);

        Logger.log(`  ✅ Match found! Order: ${row[cols.orderId]}, Amount: ${parsedAmount}`);

        orders.push({
          orderId: row[cols.orderId] || '',
          orderDate: formatDate(row[cols.orderDate]),
          customerName: row[cols.customerName] || '',
          customerPhone: row[cols.customerPhone] || '',
          products: row[cols.products] || '',
          totalAmount: parsedAmount,
          status: row[cols.status] || '',
          referralCode: row[cols.referralCode] ? row[cols.referralCode].toString().trim() : ''
        });
      }
    }

    Logger.log(`✅ Found ${orders.length} orders for phone: ${normalizedPhone}`);
    return orders;

  } catch (error) {
    Logger.log('❌ Error in getOrdersByPhoneDirectly: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    return [];
  }
}

// ⭐ Hàm mới: Tìm mã CTV từ số điện thoại (PHƯƠNG ÁN DỰ PHÒNG)
function getReferralCodeByPhone(normalizedPhone) {
  try {
    Logger.log('🔍 Searching for CTV with phone: ' + normalizedPhone);

    // Mở spreadsheet CTV
    const ctvSpreadsheet = SpreadsheetApp.openById(CONFIG.CTV_SHEET_ID);
    const ctvSheet = ctvSpreadsheet.getSheetByName(CONFIG.CTV_SHEET_NAME);

    if (!ctvSheet) {
      Logger.log('❌ CTV sheet not found');
      return null;
    }

    // Lấy tất cả dữ liệu
    const data = ctvSheet.getDataRange().getValues();

    if (data.length <= 1) {
      Logger.log('⚠️ No CTV data found');
      return null;
    }

    // Tìm index của cột "Số Điện Thoại" và "Mã Ref"
    const headers = data[0];
    const phoneColumnIndex = headers.findIndex(h =>
      h && h.toString().toLowerCase().includes('điện thoại')
    );
    const refCodeColumnIndex = headers.findIndex(h =>
      h && h.toString().toLowerCase().includes('ref')
    );

    Logger.log('📍 Phone column index: ' + phoneColumnIndex);
    Logger.log('📍 RefCode column index: ' + refCodeColumnIndex);

    if (phoneColumnIndex === -1 || refCodeColumnIndex === -1) {
      Logger.log('❌ Required columns not found');
      return null;
    }

    // Duyệt qua các dòng để tìm số điện thoại khớp
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowPhone = row[phoneColumnIndex];

      if (!rowPhone) continue;

      // Chuẩn hóa số điện thoại trong sheet
      const normalizedRowPhone = normalizePhone(rowPhone);

      Logger.log(`  Comparing: ${normalizedRowPhone} === ${normalizedPhone}`);

      if (normalizedRowPhone === normalizedPhone) {
        const refCode = row[refCodeColumnIndex];
        Logger.log('✅ Found matching CTV! RefCode: ' + refCode);
        return refCode ? refCode.toString().trim() : null;
      }
    }

    Logger.log('❌ No matching CTV found');
    return null;

  } catch (error) {
    Logger.log('❌ Error in getReferralCodeByPhone: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    return null;
  }
}

function sendNotificationEmail(data) {
  try {
    const emailAddress = 'your-email@gmail.com'; // Thay bằng email của bạn để nhận thông báo
    const subject = '🎉 Đăng Ký Cộng Tác Viên Mới';

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f8b4cb, #d4a5d4); padding: 20px; border-radius: 10px 10px 0 0;">
          <h2 style="color: white; margin: 0;">Đăng Ký Cộng Tác Viên Mới</h2>
        </div>
        
        <div style="background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px;">
          <h3 style="color: #333; margin-top: 0;">Thông Tin Người Đăng Ký:</h3>
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Họ Tên:</td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.fullName}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Số Điện Thoại:</td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.phone}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Email:</td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.email}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Tỉnh/Thành:</td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.city}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Tuổi:</td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.age || 'Không cung cấp'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Kinh Nghiệm:</td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.experience || 'Không cung cấp'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Facebook:</td>
              <td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.facebook || 'Không cung cấp'}</td>
            </tr>
          </table>
          
          ${data.motivation ? `
            <h4 style="color: #333; margin-top: 20px;">Lý Do Tham Gia:</h4>
            <p style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #f8b4cb;">
              ${data.motivation}
            </p>
          ` : ''}
          
          <p style="margin-top: 20px; color: #666; font-size: 14px;">
            Thời gian đăng ký: ${data.timestamp || new Date().toLocaleString('vi-VN')}
          </p>
        </div>
      </div>
    `;

    MailApp.sendEmail({
      to: emailAddress,
      subject: subject,
      htmlBody: htmlBody
    });

  } catch (error) {
    console.error('Email notification error:', error);
  }
}

// ============================================
// TEST FUNCTIONS - Chạy để kiểm tra cấu hình
// ============================================

// Test 1: Kiểm tra kết nối sheet CTV
function testCTVSheet() {
  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.CTV_SHEET_ID);
    const sheet = spreadsheet.getSheetByName(CONFIG.CTV_SHEET_NAME);

    Logger.log('✅ Kết nối CTV Sheet thành công!');
    Logger.log('Sheet name: ' + sheet.getName());
    Logger.log('Số dòng: ' + sheet.getLastRow());

    return true;
  } catch (error) {
    Logger.log('❌ Lỗi kết nối CTV Sheet: ' + error.toString());
    return false;
  }
}

// Test 2: Kiểm tra kết nối sheet đơn hàng
function testOrderSheet() {
  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.ORDER_SHEET_ID);
    const sheet = spreadsheet.getSheetByName(CONFIG.ORDER_SHEET_NAME);

    Logger.log('✅ Kết nối Order Sheet thành công!');
    Logger.log('Sheet name: ' + sheet.getName());
    Logger.log('Số dòng: ' + sheet.getLastRow());

    // Hiển thị headers
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    Logger.log('Headers: ' + JSON.stringify(headers));

    return true;
  } catch (error) {
    Logger.log('❌ Lỗi kết nối Order Sheet: ' + error.toString());
    Logger.log('Kiểm tra lại ORDER_SHEET_ID và ORDER_SHEET_NAME trong CONFIG');
    return false;
  }
}

// Test 3: Kiểm tra lấy đơn hàng CÓ MÃ REFERRAL mới nhất
function testGetRecentOrders() {
  try {
    Logger.log('Test lấy 10 đơn hàng CÓ MÃ REFERRAL mới nhất...');

    const orders = getRecentOrders(10);

    Logger.log('✅ Tìm thấy ' + orders.length + ' đơn hàng có mã Referral');

    if (orders.length > 0) {
      Logger.log('Chi tiết đơn hàng đầu tiên:');
      Logger.log(JSON.stringify(orders[0], null, 2));

      // Kiểm tra tất cả đơn đều có mã referral
      const allHaveRefCode = orders.every(order => order.referralCode && order.referralCode.trim() !== '');
      if (allHaveRefCode) {
        Logger.log('✅ Tất cả đơn hàng đều có mã Referral');
      } else {
        Logger.log('⚠️ Có đơn hàng không có mã Referral!');
      }
    } else {
      Logger.log('⚠️ Không tìm thấy đơn hàng nào có mã Referral');
    }

    return true;
  } catch (error) {
    Logger.log('❌ Lỗi test lấy đơn mới nhất: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    return false;
  }
}

// Test 4: Kiểm tra tra cứu đơn hàng theo mã CTV
function testGetOrders() {
  try {
    // Lấy mã referral đầu tiên từ sheet đơn hàng để test
    const orderSpreadsheet = SpreadsheetApp.openById(CONFIG.ORDER_SHEET_ID);
    const sheet = orderSpreadsheet.getSheetByName(CONFIG.ORDER_SHEET_NAME);
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      Logger.log('⚠️ Sheet đơn hàng chưa có dữ liệu');
      return false;
    }

    // Lấy mã referral từ dòng đầu tiên
    const refCode = data[1][CONFIG.ORDER_COLUMNS.referralCode];

    if (!refCode) {
      Logger.log('⚠️ Không tìm thấy mã Referral ở cột ' + CONFIG.ORDER_COLUMNS.referralCode);
      Logger.log('Kiểm tra lại ORDER_COLUMNS.referralCode trong CONFIG');
      return false;
    }

    Logger.log('Test với mã Referral: ' + refCode);

    const orders = getOrdersByReferralCode(refCode);

    Logger.log('✅ Tìm thấy ' + orders.length + ' đơn hàng');
    Logger.log('Chi tiết đơn hàng đầu tiên:');
    Logger.log(JSON.stringify(orders[0], null, 2));

    return true;
  } catch (error) {
    Logger.log('❌ Lỗi test tra cứu: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    return false;
  }
}

// Test 5: Chạy tất cả tests
function runAllTests() {
  Logger.log('========================================');
  Logger.log('BẮT ĐẦU KIỂM TRA HỆ THỐNG');
  Logger.log('========================================\n');

  Logger.log('Test 1: Kết nối CTV Sheet');
  const test1 = testCTVSheet();
  Logger.log('');

  Logger.log('Test 2: Kết nối Order Sheet');
  const test2 = testOrderSheet();
  Logger.log('');

  let test3 = false;
  let test4 = false;

  if (test2) {
    Logger.log('Test 3: Lấy đơn hàng mới nhất');
    test3 = testGetRecentOrders();
    Logger.log('');

    Logger.log('Test 4: Tra cứu đơn hàng theo mã CTV');
    test4 = testGetOrders();
    Logger.log('');
  }

  Logger.log('========================================');
  Logger.log('KẾT QUẢ KIỂM TRA');
  Logger.log('========================================');
  Logger.log('CTV Sheet: ' + (test1 ? '✅ OK' : '❌ FAILED'));
  Logger.log('Order Sheet: ' + (test2 ? '✅ OK' : '❌ FAILED'));
  Logger.log('Recent Orders: ' + (test3 ? '✅ OK' : '❌ FAILED'));
  Logger.log('Search Orders: ' + (test4 ? '✅ OK' : '❌ FAILED'));
  Logger.log('========================================');
}

// Test function to verify CTV registration
function testCTVRegistration() {
  const testData = {
    fullName: 'Nguyễn Thị Test',
    phone: '0901234567',
    email: 'test@example.com',
    city: 'Hà Nội',
    age: '26-30',
    experience: 'Mới bắt đầu',
    facebook: 'https://facebook.com/test',
    motivation: 'Muốn có thêm thu nhập',
    timestamp: new Date().toLocaleString('vi-VN')
  };

  const mockEvent = {
    postData: {
      contents: JSON.stringify(testData)
    }
  };

  const result = doPost(mockEvent);
  Logger.log('Test result:', result.getContent());
}

// Get dashboard statistics
function getDashboardStats() {
  try {
    Logger.log('🚀 getDashboardStats() called');

    // Mở spreadsheet CTV
    Logger.log('📂 Opening CTV spreadsheet: ' + CONFIG.CTV_SHEET_ID);
    const ctvSpreadsheet = SpreadsheetApp.openById(CONFIG.CTV_SHEET_ID);
    const ctvSheet = ctvSpreadsheet.getSheetByName(CONFIG.CTV_SHEET_NAME);
    Logger.log('✅ CTV sheet opened: ' + ctvSheet.getName());

    // Mở spreadsheet đơn hàng
    Logger.log('📂 Opening Order spreadsheet: ' + CONFIG.ORDER_SHEET_ID);
    const orderSpreadsheet = SpreadsheetApp.openById(CONFIG.ORDER_SHEET_ID);
    const orderSheet = orderSpreadsheet.getSheetByName(CONFIG.ORDER_SHEET_NAME);
    Logger.log('✅ Order sheet opened: ' + orderSheet.getName());

    // Đếm tổng số CTV (trừ header)
    const ctvData = ctvSheet.getDataRange().getValues();
    const totalCTV = ctvData.length - 1; // Trừ dòng header
    Logger.log('👥 Total CTV: ' + totalCTV);

    // Lấy tất cả đơn hàng
    const orderData = orderSheet.getDataRange().getValues();
    const rows = orderData.slice(1);
    Logger.log('📦 Total order rows: ' + rows.length);

    // Tìm index của cột referralCode
    const cols = CONFIG.ORDER_COLUMNS;
    Logger.log('📍 Referral code column index: ' + cols.referralCode);

    // Lọc các đơn hàng có mã referral
    const ordersWithRef = rows.filter(row => {
      const refCode = row[cols.referralCode];
      return refCode && refCode.toString().trim() !== '';
    });
    Logger.log('✅ Orders with referral code: ' + ordersWithRef.length);

    const totalOrders = ordersWithRef.length;
    let totalRevenue = 0;

    // Tính tổng doanh số
    ordersWithRef.forEach(row => {
      const amount = parseAmount(row[cols.totalAmount]);
      totalRevenue += amount;
    });
    Logger.log('💰 Total revenue: ' + totalRevenue);

    const totalCommission = totalRevenue * CONFIG.COMMISSION_RATE;
    Logger.log('💵 Total commission: ' + totalCommission);

    // Tính top performers
    const performerMap = {};

    ordersWithRef.forEach(row => {
      const refCode = row[cols.referralCode].toString().trim();
      const amount = parseAmount(row[cols.totalAmount]);

      if (!performerMap[refCode]) {
        performerMap[refCode] = {
          referralCode: refCode,
          orderCount: 0,
          totalRevenue: 0,
          commission: 0
        };
      }

      performerMap[refCode].orderCount++;
      performerMap[refCode].totalRevenue += amount;
      performerMap[refCode].commission += amount * CONFIG.COMMISSION_RATE;
    });

    // Chuyển thành array và sắp xếp theo doanh số
    const topPerformers = Object.values(performerMap)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 5); // Lấy top 5

    Logger.log('🏆 Top performers count: ' + topPerformers.length);
    topPerformers.forEach((p, i) => {
      Logger.log(`  ${i + 1}. ${p.referralCode}: ${p.orderCount} orders, ${p.totalRevenue} revenue`);
    });

    const result = {
      totalCTV: totalCTV,
      totalOrders: totalOrders,
      totalRevenue: totalRevenue,
      totalCommission: totalCommission,
      topPerformers: topPerformers
    };

    Logger.log('✅ Dashboard stats result: ' + JSON.stringify(result));
    return result;

  } catch (error) {
    Logger.log('❌ Error in getDashboardStats: ' + error.toString());
    Logger.log('❌ Error stack: ' + error.stack);
    return {
      totalCTV: 0,
      totalOrders: 0,
      totalRevenue: 0,
      totalCommission: 0,
      topPerformers: []
    };
  }
}

// Test dashboard stats
function testGetDashboardStats() {
  const stats = getDashboardStats();
  Logger.log('Dashboard Stats:');
  Logger.log(JSON.stringify(stats, null, 2));
}


// Test function - Run this in Apps Script to debug
function debugDashboardStats() {
  Logger.log('=== DEBUG DASHBOARD STATS ===');

  // Test CONFIG
  Logger.log('CONFIG.CTV_SHEET_ID: ' + CONFIG.CTV_SHEET_ID);
  Logger.log('CONFIG.CTV_SHEET_NAME: ' + CONFIG.CTV_SHEET_NAME);
  Logger.log('CONFIG.ORDER_SHEET_ID: ' + CONFIG.ORDER_SHEET_ID);
  Logger.log('CONFIG.ORDER_SHEET_NAME: ' + CONFIG.ORDER_SHEET_NAME);
  Logger.log('CONFIG.ORDER_COLUMNS.referralCode: ' + CONFIG.ORDER_COLUMNS.referralCode);
  Logger.log('CONFIG.ORDER_COLUMNS.totalAmount: ' + CONFIG.ORDER_COLUMNS.totalAmount);
  Logger.log('CONFIG.COMMISSION_RATE: ' + CONFIG.COMMISSION_RATE);

  try {
    // Test CTV Sheet
    Logger.log('\n--- Testing CTV Sheet ---');
    const ctvSpreadsheet = SpreadsheetApp.openById(CONFIG.CTV_SHEET_ID);
    Logger.log('✅ CTV Spreadsheet opened: ' + ctvSpreadsheet.getName());

    const ctvSheet = ctvSpreadsheet.getSheetByName(CONFIG.CTV_SHEET_NAME);
    Logger.log('✅ CTV Sheet opened: ' + ctvSheet.getName());

    const ctvData = ctvSheet.getDataRange().getValues();
    Logger.log('CTV Data rows: ' + ctvData.length);
    Logger.log('CTV Headers: ' + JSON.stringify(ctvData[0]));
    if (ctvData.length > 1) {
      Logger.log('First CTV row: ' + JSON.stringify(ctvData[1]));
    }

    // Test Order Sheet
    Logger.log('\n--- Testing Order Sheet ---');
    const orderSpreadsheet = SpreadsheetApp.openById(CONFIG.ORDER_SHEET_ID);
    Logger.log('✅ Order Spreadsheet opened: ' + orderSpreadsheet.getName());

    const orderSheet = orderSpreadsheet.getSheetByName(CONFIG.ORDER_SHEET_NAME);
    Logger.log('✅ Order Sheet opened: ' + orderSheet.getName());

    const orderData = orderSheet.getDataRange().getValues();
    Logger.log('Order Data rows: ' + orderData.length);
    Logger.log('Order Headers: ' + JSON.stringify(orderData[0]));

    if (orderData.length > 1) {
      Logger.log('First order row: ' + JSON.stringify(orderData[1]));

      // Check referral code column
      const refCodeIndex = CONFIG.ORDER_COLUMNS.referralCode;
      Logger.log('Referral code column index: ' + refCodeIndex);
      Logger.log('First order referral code: ' + orderData[1][refCodeIndex]);

      // Check total amount column
      const amountIndex = CONFIG.ORDER_COLUMNS.totalAmount;
      Logger.log('Total amount column index: ' + amountIndex);
      Logger.log('First order total amount: ' + orderData[1][amountIndex]);
    }

    // Test getDashboardStats
    Logger.log('\n--- Testing getDashboardStats() ---');
    const stats = getDashboardStats();
    Logger.log('Result: ' + JSON.stringify(stats, null, 2));

  } catch (error) {
    Logger.log('❌ ERROR: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
  }
}

// ⭐ Test 6: Kiểm tra tra cứu theo số điện thoại
function testGetOrdersByPhone() {
  try {
    Logger.log('========================================');
    Logger.log('TEST: Tra cứu đơn hàng theo số điện thoại');
    Logger.log('========================================\n');

    // Lấy số điện thoại từ CTV đầu tiên để test
    const ctvSpreadsheet = SpreadsheetApp.openById(CONFIG.CTV_SHEET_ID);
    const ctvSheet = ctvSpreadsheet.getSheetByName(CONFIG.CTV_SHEET_NAME);
    const ctvData = ctvSheet.getDataRange().getValues();

    if (ctvData.length <= 1) {
      Logger.log('⚠️ Không có dữ liệu CTV để test');
      return false;
    }

    // Tìm cột số điện thoại và mã ref
    const headers = ctvData[0];
    const phoneColumnIndex = headers.findIndex(h =>
      h && h.toString().toLowerCase().includes('điện thoại')
    );
    const refCodeColumnIndex = headers.findIndex(h =>
      h && h.toString().toLowerCase().includes('ref')
    );

    if (phoneColumnIndex === -1 || refCodeColumnIndex === -1) {
      Logger.log('❌ Không tìm thấy cột cần thiết');
      return false;
    }

    // Lấy số điện thoại và mã ref từ dòng đầu tiên
    const testPhone = ctvData[1][phoneColumnIndex];
    const expectedRefCode = ctvData[1][refCodeColumnIndex];

    Logger.log('📱 Test với số điện thoại: ' + testPhone);
    Logger.log('🎯 Mã CTV mong đợi: ' + expectedRefCode);

    // Test 1: Chuẩn hóa số điện thoại
    Logger.log('\n--- Test 1: Chuẩn hóa số điện thoại ---');
    const normalized1 = normalizePhone('0386190596');
    Logger.log('normalizePhone("0386190596") = "' + normalized1 + '" (expected: "386190596")');

    const normalized2 = normalizePhone('386190596');
    Logger.log('normalizePhone("386190596") = "' + normalized2 + '" (expected: "386190596")');

    const normalized3 = normalizePhone('0901 234 567');
    Logger.log('normalizePhone("0901 234 567") = "' + normalized3 + '" (expected: "901234567")');

    // Test 2: Tìm mã CTV từ số điện thoại
    Logger.log('\n--- Test 2: Tìm mã CTV từ số điện thoại ---');
    const foundRefCode = getReferralCodeByPhone(normalizePhone(testPhone));

    if (foundRefCode) {
      Logger.log('✅ Tìm thấy mã CTV: ' + foundRefCode);
      if (foundRefCode === expectedRefCode) {
        Logger.log('✅ Mã CTV khớp với mong đợi!');
      } else {
        Logger.log('⚠️ Mã CTV không khớp. Mong đợi: ' + expectedRefCode);
      }
    } else {
      Logger.log('❌ Không tìm thấy mã CTV');
      return false;
    }

    // Test 3: Lấy đơn hàng theo số điện thoại
    Logger.log('\n--- Test 3: Lấy đơn hàng theo số điện thoại ---');
    const orders = getOrdersByReferralCode(foundRefCode);
    Logger.log('✅ Tìm thấy ' + orders.length + ' đơn hàng');

    if (orders.length > 0) {
      Logger.log('Chi tiết đơn hàng đầu tiên:');
      Logger.log(JSON.stringify(orders[0], null, 2));
    }

    Logger.log('\n========================================');
    Logger.log('✅ TEST HOÀN TẤT!');
    Logger.log('========================================');

    return true;

  } catch (error) {
    Logger.log('❌ Lỗi test: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    return false;
  }
}

// Test tất cả chức năng mới
function testPhoneFeature() {
  Logger.log('🚀 BẮT ĐẦU TEST CHỨC NĂNG TRA CỨU THEO SỐ ĐIỆN THOẠI\n');

  const result = testGetOrdersByPhone();

  if (result) {
    Logger.log('\n🎉 TẤT CẢ TEST ĐỀU PASS!');
  } else {
    Logger.log('\n❌ CÓ TEST BỊ LỖI, VUI LÒNG KIỂM TRA LẠI!');
  }
}

// ⭐ TEST NHANH: Kiểm tra thông tin CTV với PARTNER001
function testCTVInfoQuick() {
  Logger.log('╔════════════════════════════════════════╗');
  Logger.log('║   TEST NHANH - THÔNG TIN CTV          ║');
  Logger.log('╚════════════════════════════════════════╝\n');

  // Test 1: Lấy thông tin CTV theo mã
  Logger.log('📋 Test 1: getCTVInfoByReferralCode("PARTNER001")');
  const ctvInfo1 = getCTVInfoByReferralCode('PARTNER001');
  Logger.log('Result: ' + JSON.stringify(ctvInfo1, null, 2));
  Logger.log('');

  // Test 2: Lấy thông tin CTV theo SĐT
  Logger.log('📋 Test 2: getCTVInfoByPhone("386190596")');
  const ctvInfo2 = getCTVInfoByPhone('386190596');
  Logger.log('Result: ' + JSON.stringify(ctvInfo2, null, 2));
  Logger.log('');

  // Test 3: API getOrders
  Logger.log('📋 Test 3: API getOrders với PARTNER001');
  const mockEvent = {
    parameter: {
      action: 'getOrders',
      referralCode: 'PARTNER001'
    }
  };

  const response = doGet(mockEvent);
  const result = JSON.parse(response.getContent());

  Logger.log('API Response:');
  Logger.log('  success: ' + result.success);
  Logger.log('  orders count: ' + (result.orders ? result.orders.length : 0));
  Logger.log('  ctvInfo: ' + JSON.stringify(result.ctvInfo, null, 2));
  Logger.log('');

  // Kết luận
  Logger.log('╔════════════════════════════════════════╗');
  if (result.ctvInfo && result.ctvInfo.name !== 'Chưa cập nhật') {
    Logger.log('║   ✅ THÀNH CÔNG - CTV INFO FOUND      ║');
  } else {
    Logger.log('║   ❌ THẤT BẠI - CTV INFO NOT FOUND    ║');
  }
  Logger.log('╚════════════════════════════════════════╝');
}


// ⭐ Test DEBUG: Kiểm tra sheet đơn hàng có cột SĐT CTV không
function debugOrderSheetStructure() {
  try {
    Logger.log('========================================');
    Logger.log('DEBUG: Kiểm tra cấu trúc sheet đơn hàng');
    Logger.log('========================================\n');

    const orderSpreadsheet = SpreadsheetApp.openById(CONFIG.ORDER_SHEET_ID);
    const orderSheet = orderSpreadsheet.getSheetByName(CONFIG.ORDER_SHEET_NAME);
    const orderData = orderSheet.getDataRange().getValues();

    Logger.log('📋 Headers: ' + JSON.stringify(orderData[0]));
    Logger.log('📊 Total rows: ' + orderData.length);

    // Tìm cột SĐT CTV
    const headers = orderData[0];
    const ctvPhoneIndex = headers.findIndex(h =>
      h && (h.toString().toLowerCase().includes('sđt ctv') ||
        h.toString().toLowerCase().includes('số điện thoại ctv') ||
        h.toString().toLowerCase().includes('phone ctv') ||
        h.toString().toLowerCase().includes('sdt ctv'))
    );

    Logger.log('\n📍 Tìm kiếm cột SĐT CTV...');
    Logger.log('   Index tìm thấy: ' + ctvPhoneIndex);

    if (ctvPhoneIndex !== -1) {
      Logger.log('✅ Tìm thấy cột: "' + headers[ctvPhoneIndex] + '" tại index ' + ctvPhoneIndex);

      // Hiển thị 10 số điện thoại đầu tiên
      Logger.log('\n📱 10 số điện thoại CTV đầu tiên:');
      for (let i = 1; i <= Math.min(10, orderData.length - 1); i++) {
        const phone = orderData[i][ctvPhoneIndex];
        const normalized = normalizePhone(phone);
        const orderId = orderData[i][0];
        Logger.log(`  Row ${i} (Order ${orderId}): "${phone}" → normalized: "${normalized}"`);
      }

      // Tìm số điện thoại 386190596
      Logger.log('\n🔍 Tìm kiếm số điện thoại 386190596...');
      let found = false;
      for (let i = 1; i < orderData.length; i++) {
        const phone = orderData[i][ctvPhoneIndex];
        const normalized = normalizePhone(phone);
        if (normalized === '386190596') {
          Logger.log(`✅ Tìm thấy tại row ${i}!`);
          Logger.log(`   Order ID: ${orderData[i][0]}`);
          Logger.log(`   SĐT gốc: "${phone}"`);
          Logger.log(`   SĐT chuẩn hóa: "${normalized}"`);
          found = true;
        }
      }
      if (!found) {
        Logger.log('❌ KHÔNG tìm thấy số điện thoại 386190596 trong sheet!');
      }

    } else {
      Logger.log('❌ KHÔNG tìm thấy cột SĐT CTV!');
      Logger.log('\n💡 Các cột hiện có:');
      headers.forEach((h, i) => {
        Logger.log(`   [${i}] ${h}`);
      });
    }

    Logger.log('\n========================================');

  } catch (error) {
    Logger.log('❌ Lỗi: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
  }
}

// Test với số điện thoại cụ thể
function testPhoneNumber386190596() {
  Logger.log('🧪 Testing phone: 386190596\n');

  const orders = getOrdersByPhoneDirectly('386190596');

  Logger.log('📊 Kết quả: ' + orders.length + ' đơn hàng');

  if (orders.length > 0) {
    Logger.log('✅ Thành công! Chi tiết:');
    orders.forEach((order, i) => {
      Logger.log(`\nĐơn ${i + 1}:`);
      Logger.log(JSON.stringify(order, null, 2));
    });
  } else {
    Logger.log('❌ Không tìm thấy đơn hàng!');
    Logger.log('💡 Chạy hàm debugOrderSheetStructure() để kiểm tra cấu trúc sheet');
  }
}


// ⭐⭐⭐ TEST SIÊU NHANH - Chạy hàm này để debug
function testCTVInfoDebug() {
  Logger.log('═══════════════════════════════════════');
  Logger.log('🔍 DEBUG: Kiểm tra getCTVInfoByReferralCode');
  Logger.log('═══════════════════════════════════════\n');

  const testCode = 'PARTNER001';
  Logger.log('🎯 Testing with code: ' + testCode);
  Logger.log('');

  const result = getCTVInfoByReferralCode(testCode);

  Logger.log('📊 RESULT:');
  Logger.log('  Type: ' + typeof result);
  Logger.log('  Is null: ' + (result === null));
  Logger.log('  Is undefined: ' + (result === undefined));
  Logger.log('  JSON: ' + JSON.stringify(result, null, 2));

  if (result) {
    Logger.log('');
    Logger.log('📋 DETAILS:');
    Logger.log('  name: "' + result.name + '"');
    Logger.log('  phone: "' + result.phone + '"');
    Logger.log('  address: "' + result.address + '"');

    Logger.log('');
    Logger.log('✅ VALIDATION:');
    Logger.log('  Has name: ' + (!!result.name && result.name !== 'Chưa cập nhật' && result.name !== 'Không tìm thấy'));
    Logger.log('  Has phone: ' + (!!result.phone && result.phone !== 'Chưa cập nhật'));
    Logger.log('  Has address: ' + (!!result.address && result.address !== 'Chưa cập nhật'));
  }

  Logger.log('');
  Logger.log('═══════════════════════════════════════');
}

// Google Apps Script code to handle form submissions and order lookup
// Deploy this as a Web App in Google Apps Script

// ============================================
// CONFIGURATION - ĐÃ CẤU HÌNH
// ============================================
const CONFIG = {
  // Sheet ID của danh sách CTV
  CTV_SHEET_ID: '1QOXBlIcX1Th1ZnNKulnbxEJDD-HfAiKfOFKHn2pBo4o',
  CTV_SHEET_NAME: 'DS REF',

  // Sheet ID của đơn hàng
  ORDER_SHEET_ID: '1CmfyZg1MCPCv0_RnlBOOf0HIev4RPg4DK43veMGyPJM',
  ORDER_SHEET_NAME: 'Form responses 1', // Tên sheet mặc định của Google Form

  // Mapping cột trong sheet đơn hàng (theo ảnh)
  ORDER_COLUMNS: {
    orderId: 0,        // Cột A - Mã Đơn Hàng
    orderDate: 1,      // Cột B - Ngày Đặt
    customerName: 2,   // Cột C - Tên Khách Hàng
    customerPhone: 3,  // Cột D - Số Điện Thoại
    address: 4,        // Cột E - Địa Chỉ
    products: 5,       // Cột F - Chi Tiết Sản Phẩm
    totalAmount: 6,    // Cột G - TỔNG KHÁCH PHẢI TRẢ
    paymentMethod: 7,  // Cột H - Hướng Thanh Toán
    status: 8,         // Cột I - Ghi Chú
    referralCode: 9    // Cột J - Mã Referral
  }
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
      sheet.setColumnWidth(4, 120);  // Tỉnh/Thành
      sheet.setColumnWidth(5, 100);  // Tuổi
      sheet.setColumnWidth(6, 130);  // Kinh Nghiệm
      sheet.setColumnWidth(7, 300);  // Lý Do
      sheet.setColumnWidth(8, 120);  // Mã Ref
      sheet.setColumnWidth(9, 100);  // Trạng Thái
      sheet.setColumnWidth(10, 150); // Đơn Hàng Của Bạn ⭐

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
        if (lastColumn < 10) {
          sheet.setColumnWidth(10, 150); // Đơn Hàng Của Bạn
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

    // Căn giữa các cột trừ cột "Lý Do" (cột 7)
    for (let col = 1; col <= rowData.length; col++) {
      const cell = sheet.getRange(lastRow, col);
      if (col === 7) { // Cột "Lý Do" - căn trái
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

    // Format cột "Trạng Thái" (cột 9) với màu nổi bật
    const statusCell = sheet.getRange(lastRow, 9);
    statusCell.setBackground('#fff3cd'); // Light yellow
    statusCell.setFontColor('#856404'); // Dark yellow text
    statusCell.setFontWeight('bold');

    // Format cột "Mã Ref" (cột 8) với màu nổi bật
    const refCodeCell = sheet.getRange(lastRow, 8);
    refCodeCell.setBackground('#e3f2fd'); // Light blue
    refCodeCell.setFontColor('#1565c0'); // Dark blue text
    refCodeCell.setFontWeight('bold');
    refCodeCell.setFontFamily('Courier New'); // Monospace font cho code

    // ⭐ Format cột "Đơn Hàng Của Bạn" (cột 10) với hyperlink
    const orderLinkCell = sheet.getRange(lastRow, 10);

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
function generateReferralCode(fullName) {
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
      const orders = getOrdersByReferralCode(referralCode);

      return ContentService
        .createTextOutput(JSON.stringify({
          success: true,
          orders: orders,
          referralCode: referralCode
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
    const spreadsheet = SpreadsheetApp.openById(CONFIG.ORDER_SHEET_ID);
    const sheet = spreadsheet.getSheetByName(CONFIG.ORDER_SHEET_NAME);
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
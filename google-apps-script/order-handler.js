/**
 * Google Apps Script cho xử lý đơn hàng Vòng Dâu Tằm By Ánh
 * File: order-handler.js
 * Tác giả: Yendev96
 * Ngày tạo: 2025-09-01
 */

// ==================== CẤU HÌNH ====================
// CẤU HÌNH FILE GOOGLE SHEETS
const MAIN_SHEET_ID = "1fezE-k8xQ7aqJuBwtyj9P5hAWUdi9nqJAfF1d9MAi8c"; // ID file Google Sheets chính
const SHEET_NAME = "ĐƠN VDT TỪ WEB"; // Tên sheet đơn hàng

// CẤU HÌNH FILE DANH SÁCH CTV
const CTV_SHEET_ID = "1axooVOgwVsgwAqCE59afdz6RQOWNV1j4WUGQrBvUHiI";
const CTV_SHEET_NAME = "DS CTV";

// Định nghĩa cột headers - Tối ưu hóa cho dễ đọc
const HEADERS = [
  "Mã Đơn Hàng",
  "Ngày Đặt",
  "Tên Khách Hàng",
  "Số Điện Thoại",
  "Địa Chỉ",
  "Chi Tiết Sản Phẩm",
  "💰 TỔNG KHÁCH PHẢI TRẢ",
  "Phương Thức Thanh Toán",
  "Ghi Chú",
  "Mã Referral",
  "Hoa Hồng"
];

// ==================== HÀM CHÍNH ====================

/**
 * Hàm chính xử lý POST request từ website và Telegram webhook
 */
function doPost(e) {
  try {
    const requestData = JSON.parse(e.postData.contents);
    Logger.log('🧾 doPost received payload: ' + JSON.stringify({
      hasOrder: !!requestData?.orderId,
      orderId: requestData?.orderId || null
    }));

    // Chỉ xử lý đơn hàng từ website
    if (requestData && requestData.orderId) {
      return handleOrderFromWebsite(requestData);
    }

    return createJsonResponse({
      result: 'error',
      message: 'Invalid request (missing orderId)'
    });

  } catch (error) {
    Logger.log(`❌ LỖI XỬ LÝ REQUEST: ${error.message}`);
    return createJsonResponse({
      result: 'error',
      message: `Lỗi xử lý request: ${error.message}`
    });
  }
}

/**
 * Xử lý đơn hàng từ website
 */
function handleOrderFromWebsite(orderData) {
  try {
    const sheet = initializeSheet();
    validateOrderData(orderData);
    addOrderToSheet(sheet, orderData);

    sendEmailNotification(orderData);

    return createJsonResponse({
      result: 'success',
      message: 'Đơn hàng đã được ghi nhận thành công!',
      data: {
        orderId: orderData.orderId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    Logger.log(`❌ Lỗi xử lý đơn hàng: ${error.message}; orderId=${orderData?.orderId || 'UNKNOWN'}`);
    return createJsonResponse({
      result: 'error',
      message: `Lỗi xử lý đơn hàng: ${error.message}`
    });
  }
}

// ==================== HÀM HỖ TRỢ ====================

/**
 * Khởi tạo và kiểm tra sheet
 */
function initializeSheet() {
  const spreadsheet = SpreadsheetApp.openById(MAIN_SHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    setupSheetHeaders(sheet);
  }

  return sheet;
}

/**
 * Thiết lập headers và format cho sheet
 */
function setupSheetHeaders(sheet) {
  // Thêm dòng headers
  sheet.appendRow(HEADERS);

  // Format headers
  const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  headerRange
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setBackground("#4F46E5") // Màu xanh đậm
    .setFontColor("#FFFFFF")  // Chữ trắng
    .setFontSize(11);

  // Highlight cột tổng tiền
  const totalColumn = HEADERS.indexOf("💰 TỔNG KHÁCH PHẢI TRẢ") + 1;
  sheet.getRange(1, totalColumn)
    .setBackground("#F59E0B") // Màu vàng
    .setFontColor("#000000"); // Chữ đen

  // Thiết lập độ rộng cột
  sheet.setColumnWidth(1, 120);  // Mã đơn hàng
  sheet.setColumnWidth(2, 100);  // Ngày đặt
  sheet.setColumnWidth(3, 150);  // Tên khách hàng
  sheet.setColumnWidth(4, 120);  // Số điện thoại
  sheet.setColumnWidth(5, 250);  // Địa chỉ
  sheet.setColumnWidth(6, 300);  // Chi tiết sản phẩm
  sheet.setColumnWidth(7, 150);  // Tổng tiền
  sheet.setColumnWidth(8, 150);  // Phương thức thanh toán
  sheet.setColumnWidth(9, 200);  // Ghi chú
  sheet.setColumnWidth(10, 120); // Mã Referral
  sheet.setColumnWidth(11, 120); // Hoa Hồng
}

/**
 * Validate dữ liệu đơn hàng
 */
function validateOrderData(orderData) {
  if (!orderData.orderId) throw new Error("Thiếu mã đơn hàng");
  if (!orderData.customer?.name) throw new Error("Thiếu tên khách hàng");
  if (!orderData.customer?.phone) throw new Error("Thiếu số điện thoại");
  if (!orderData.cart || orderData.cart.length === 0) throw new Error("Giỏ hàng trống");
  if (!orderData.total) throw new Error("Thiếu tổng tiền");
}

/**
 * Format chi tiết sản phẩm thành chuỗi đẹp
 */
function formatProductDetails(cartItems) {
  if (!cartItems || cartItems.length === 0) return "Không có sản phẩm";

  let result = "";

  cartItems.forEach((item, index) => {
    result += `▪ ${item.name}\n`;
    result += `   • SL: ${item.quantity}`;

    // Thêm thông tin cân nặng nếu có
    if (item.weight && item.weight !== 'Không có') {
      result += ` | Cân nặng: ${item.weight}`;
    }

    // Thêm ghi chú sản phẩm nếu có
    if (item.notes && item.notes.trim()) {
      result += `\n   📝 Ghi chú SP: ${item.notes.trim()}`;
    }

    // Thêm dòng trống giữa các sản phẩm (trừ sản phẩm cuối)
    if (index < cartItems.length - 1) {
      result += "\n\n";
    }
  });

  return result;
}

/**
 * Thêm đơn hàng vào sheet
 */
function addOrderToSheet(sheet, orderData) {
  // Format chi tiết sản phẩm
  const productDetails = formatProductDetails(orderData.cart);

  // Debug logging
  Logger.log('📝 Order Data Received:');
  Logger.log('- Order ID: ' + orderData.orderId);
  Logger.log('- Referral Code: ' + (orderData.referralCode || 'EMPTY'));
  Logger.log('- Referral Commission: ' + (orderData.referralCommission || 0));

  // Tạo dòng dữ liệu mới
  const newRow = [
    orderData.orderId,
    new Date(orderData.orderDate),
    orderData.customer.name,
    orderData.customer.phone,
    orderData.customer.address,
    productDetails,
    orderData.total, // TỔNG KHÁCH PHẢI TRẢ
    getPaymentMethodText(orderData.paymentMethod),
    orderData.customer.notes || "",
    orderData.referralCode || "", // Mã Referral
    orderData.referralCommission ? `${orderData.referralCommission.toLocaleString('vi-VN')}đ` : "" // Hoa Hồng
  ];

  // Thêm vào sheet
  const newRowIndex = sheet.getLastRow() + 1;
  sheet.appendRow(newRow);

  formatNewOrderRow(sheet, newRowIndex);
}

/**
 * Format dòng đơn hàng mới
 */
function formatNewOrderRow(sheet, rowIndex) {
  const range = sheet.getRange(rowIndex, 1, 1, HEADERS.length);

  // Format chung
  range
    .setVerticalAlignment("top")
    .setWrap(true)
    .setBorder(true, true, true, true, true, true);

  // Highlight cột tổng tiền
  const totalColumn = HEADERS.indexOf("💰 TỔNG KHÁCH PHẢI TRẢ") + 1;
  sheet.getRange(rowIndex, totalColumn)
    .setBackground("#FEF3C7") // Nền vàng nhạt
    .setFontWeight("bold")
    .setFontColor("#92400E"); // Chữ vàng đậm


}

/**
 * Lấy số điện thoại CTV từ mã referral
 */
function getCTVPhoneByReferralCode(referralCode) {
  try {
    // Nếu không có mã referral, trả về N/A
    if (!referralCode || referralCode.trim() === "") {
      return "N/A";
    }

    // Mở file Google Sheets danh sách CTV
    const ctvSpreadsheet = SpreadsheetApp.openById(CTV_SHEET_ID);
    const ctvSheet = ctvSpreadsheet.getSheetByName(CTV_SHEET_NAME);

    if (!ctvSheet) {
      return "N/A";
    }

    const ctvData = ctvSheet.getDataRange().getValues();
    const ctvRows = ctvData.slice(1);

    for (let i = 0; i < ctvRows.length; i++) {
      const row = ctvRows[i];
      const maRef = row[8] ? row[8].toString().trim() : "";
      const soDienThoai = row[2] ? row[2].toString().trim() : "";

      if (maRef.toLowerCase() === referralCode.toLowerCase()) {
        return soDienThoai || "N/A";
      }
    }

    return "N/A";

  } catch (error) {
    return "N/A";
  }
}

/**
 * Lấy thông tin đầy đủ của CTV từ mã referral (bao gồm email)
 */
function getCTVInfoByReferralCode(referralCode) {
  try {
    // Nếu không có mã referral, trả về null
    if (!referralCode || referralCode.trim() === "") {
      return null;
    }

    // Mở file Google Sheets danh sách CTV
    const ctvSpreadsheet = SpreadsheetApp.openById(CTV_SHEET_ID);
    const ctvSheet = ctvSpreadsheet.getSheetByName(CTV_SHEET_NAME);

    if (!ctvSheet) {
      return null;
    }

    const ctvData = ctvSheet.getDataRange().getValues();
    const ctvRows = ctvData.slice(1);

    for (let i = 0; i < ctvRows.length; i++) {
      const row = ctvRows[i];
      const maRef = row[8] ? row[8].toString().trim() : "";

      if (maRef.toLowerCase() === referralCode.toLowerCase()) {
        return {
          name: row[1] ? row[1].toString().trim() : "N/A",
          phone: row[2] ? row[2].toString().trim() : "N/A",
          email: row[3] ? row[3].toString().trim() : "",
          referralCode: maRef
        };
      }
    }

    return null;

  } catch (error) {
    return null;
  }
}

/**
 * Chuyển đổi payment method thành text dễ đọc
 */
function getPaymentMethodText(paymentMethod) {
  switch (paymentMethod) {
    case 'cod':
      return "💰 COD (Thanh toán khi nhận)";
    case 'bank_transfer':
      return "🏦 Chuyển khoản ngân hàng";
    default:
      return paymentMethod || "Không xác định";
  }
}

/**
 * Tạo JSON response chuẩn
 */
function createJsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==================== HÀM TIỆN ÍCH ====================

/**
 * Gửi thông báo Telegram đơn hàng mới
 */
// NOTE: Phần gửi Telegram cho đơn hàng đã được tắt để tránh trùng lặp.

/**
 * Gửi email thông báo đơn hàng mới
 */
function sendEmailNotification(orderData) {
  try {
    const adminEmail = "yendev96@gmail.com";
    const subject = `🔔 Đơn hàng mới #${orderData.orderId} - ${orderData.customer.name}`;
    const htmlBody = createEmailHtmlBody(orderData);
    const emailQuotaRemaining = MailApp.getRemainingDailyQuota();

    if (emailQuotaRemaining <= 0) {
      throw new Error("Đã hết quota gửi email hôm nay");
    }

    MailApp.sendEmail({
      to: adminEmail,
      subject: subject,
      htmlBody: htmlBody
    });

    if (orderData.referralCode && orderData.referralCode.trim() !== "") {
      sendEmailToCTV(orderData);
    }

  } catch (error) {
    // Không throw error để không ảnh hưởng đến việc lưu đơn hàng
  }
}

/**
 * Gửi email thông báo cho cộng tác viên khi có đơn hàng từ link referral
 */
function sendEmailToCTV(orderData) {
  try {
    const ctvInfo = getCTVInfoByReferralCode(orderData.referralCode);

    if (!ctvInfo || !ctvInfo.email || ctvInfo.email.trim() === "") {
      return;
    }

    const subject = `🎉 Bạn có đơn hàng mới từ link referral #${orderData.orderId}`;
    const htmlBody = createCTVEmailHtmlBody(orderData, ctvInfo);

    MailApp.sendEmail({
      to: ctvInfo.email,
      subject: subject,
      htmlBody: htmlBody
    });

  } catch (error) {
    // Không throw error để không ảnh hưởng đến việc lưu đơn hàng
  }
}

/**
 * Tạo nội dung email HTML
 */
function createEmailHtmlBody(orderData) {
  // Format sản phẩm
  let productsHtml = '';
  orderData.cart.forEach((item, index) => {
    productsHtml += `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px 8px;">
          <strong>${index + 1}. ${item.name}</strong><br>
          <span style="color: #6b7280; font-size: 14px;">Số lượng: ${item.quantity}</span>
          ${item.weight && item.weight !== 'Không có' ? `<br><span style="color: #6b7280; font-size: 14px;">Cân nặng: ${item.weight}</span>` : ''}
          ${item.notes && item.notes.trim() ? `<br><span style="color: #059669; font-size: 14px;">📝 ${item.notes.trim()}</span>` : ''}
        </td>
      </tr>
    `;
  });

  // Thông tin referral (nếu có)
  let referralHtml = '';
  if (orderData.referralCode && orderData.referralCode.trim() !== "") {
    // Lấy tên CTV thực tế từ sheet
    const ctvInfo = getCTVInfoByReferralCode(orderData.referralCode);
    const partnerName = ctvInfo ? ctvInfo.name : orderData.referralPartner || 'N/A';

    referralHtml = `
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin-top: 20px; border-radius: 4px;">
        <h3 style="margin: 0 0 8px 0; color: #92400e; font-size: 16px;">🤝 Thông tin Referral</h3>
        <p style="margin: 4px 0; color: #78350f;"><strong>Mã:</strong> ${orderData.referralCode}</p>
        <p style="margin: 4px 0; color: #78350f;"><strong>Partner:</strong> ${partnerName}</p>
        ${orderData.referralCommission && orderData.referralCommission > 0 ? `<p style="margin: 4px 0; color: #78350f;"><strong>Hoa hồng:</strong> ${orderData.referralCommission.toLocaleString('vi-VN')}đ</p>` : ''}
      </div>
    `;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); padding: 30px 20px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 24px;">🔔 Đơn Hàng Mới</h1>
          <p style="margin: 8px 0 0 0; color: #fce7f3; font-size: 14px;">Vòng Dâu Tằm By Ánh</p>
        </div>

        <!-- Content -->
        <div style="padding: 30px 20px;">
          
          <!-- Order Info -->
          <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <h2 style="margin: 0 0 16px 0; color: #1f2937; font-size: 18px;">📋 Thông tin đơn hàng</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; width: 40%;">Mã đơn hàng:</td>
                <td style="padding: 8px 0; color: #1f2937; font-weight: bold;">${orderData.orderId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Thời gian:</td>
                <td style="padding: 8px 0; color: #1f2937;">${new Date(orderData.orderDate).toLocaleString('vi-VN')}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Tổng tiền:</td>
                <td style="padding: 8px 0; color: #dc2626; font-weight: bold; font-size: 18px;">${orderData.total}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Thanh toán:</td>
                <td style="padding: 8px 0; color: #1f2937;">${getPaymentMethodText(orderData.paymentMethod).replace(/🏦|💰/g, '')}</td>
              </tr>
            </table>
          </div>

          <!-- Customer Info -->
          <div style="background-color: #eff6ff; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <h2 style="margin: 0 0 16px 0; color: #1f2937; font-size: 18px;">👤 Thông tin khách hàng</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; width: 40%;">Tên khách hàng:</td>
                <td style="padding: 8px 0; color: #1f2937; font-weight: bold;">${orderData.customer.name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Số điện thoại:</td>
                <td style="padding: 8px 0; color: #1f2937;">${orderData.customer.phone}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; vertical-align: top;">Địa chỉ:</td>
                <td style="padding: 8px 0; color: #1f2937;">${orderData.customer.address}</td>
              </tr>
              ${orderData.customer.notes && orderData.customer.notes.trim() ? `
              <tr>
                <td style="padding: 8px 0; color: #6b7280; vertical-align: top;">Ghi chú:</td>
                <td style="padding: 8px 0; color: #059669; font-style: italic;">${orderData.customer.notes.trim()}</td>
              </tr>
              ` : ''}
            </table>
          </div>

          <!-- Products -->
          <div style="background-color: #fef3c7; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <h2 style="margin: 0 0 16px 0; color: #1f2937; font-size: 18px;">🛍️ Chi tiết sản phẩm</h2>
            <table style="width: 100%; border-collapse: collapse;">
              ${productsHtml}
            </table>
          </div>

          ${referralHtml}

        </div>

        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #6b7280; font-size: 14px;">
            Email tự động từ hệ thống Vòng Dâu Tằm By Ánh
          </p>
          <p style="margin: 8px 0 0 0; color: #9ca3af; font-size: 12px;">
            © 2024 Vòng Dâu Tằm By Ánh. All rights reserved.
          </p>
        </div>

      </div>
    </body>
    </html>
  `;

  return html;
}

/**
 * Tạo nội dung email HTML cho cộng tác viên
 */
function createCTVEmailHtmlBody(orderData, ctvInfo) {
  // Format sản phẩm
  let productsHtml = '';
  orderData.cart.forEach((item, index) => {
    productsHtml += `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px 8px;">
          <strong>${index + 1}. ${item.name}</strong><br>
          <span style="color: #6b7280; font-size: 14px;">Số lượng: ${item.quantity}</span>
          ${item.weight && item.weight !== 'Không có' ? `<br><span style="color: #6b7280; font-size: 14px;">Cân nặng: ${item.weight}</span>` : ''}
        </td>
      </tr>
    `;
  });

  // Tính hoa hồng (nếu có)
  let commissionHtml = '';
  if (orderData.referralCommission && orderData.referralCommission > 0) {
    commissionHtml = `
      <div style="background-color: #d1fae5; border-left: 4px solid #10b981; padding: 20px; margin-top: 20px; border-radius: 8px; text-align: center;">
        <h3 style="margin: 0 0 8px 0; color: #065f46; font-size: 18px;">💰 Hoa Hồng Của Bạn</h3>
        <p style="margin: 8px 0; color: #047857; font-size: 28px; font-weight: bold;">${orderData.referralCommission.toLocaleString('vi-VN')}đ</p>
        <p style="margin: 4px 0; color: #059669; font-size: 14px;">Chúc mừng bạn đã có thêm một đơn hàng thành công!</p>
      </div>
    `;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px 20px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 24px;">🎉 Chúc Mừng!</h1>
          <p style="margin: 8px 0 0 0; color: #d1fae5; font-size: 16px;">Bạn có đơn hàng mới từ link referral</p>
        </div>

        <!-- Content -->
        <div style="padding: 30px 20px;">
          
          <!-- Greeting -->
          <div style="margin-bottom: 20px;">
            <p style="margin: 0; color: #1f2937; font-size: 16px;">Xin chào <strong>${ctvInfo.name}</strong>,</p>
            <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 14px;">
              Có một khách hàng vừa đặt hàng thông qua link referral của bạn. Dưới đây là thông tin chi tiết:
            </p>
          </div>

          <!-- Order Info -->
          <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <h2 style="margin: 0 0 16px 0; color: #1f2937; font-size: 18px;">📋 Thông tin đơn hàng</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; width: 40%;">Mã đơn hàng:</td>
                <td style="padding: 8px 0; color: #1f2937; font-weight: bold;">${orderData.orderId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Thời gian:</td>
                <td style="padding: 8px 0; color: #1f2937;">${new Date(orderData.orderDate).toLocaleString('vi-VN')}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Tổng tiền:</td>
                <td style="padding: 8px 0; color: #dc2626; font-weight: bold; font-size: 18px;">${orderData.total}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Mã Referral:</td>
                <td style="padding: 8px 0; color: #10b981; font-weight: bold;">${orderData.referralCode}</td>
              </tr>
            </table>
          </div>

          <!-- Customer Info -->
          <div style="background-color: #eff6ff; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <h2 style="margin: 0 0 16px 0; color: #1f2937; font-size: 18px;">👤 Thông tin khách hàng</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; width: 40%;">Tên khách hàng:</td>
                <td style="padding: 8px 0; color: #1f2937; font-weight: bold;">${orderData.customer.name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Số điện thoại:</td>
                <td style="padding: 8px 0; color: #1f2937;">${orderData.customer.phone}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; vertical-align: top;">Địa chỉ:</td>
                <td style="padding: 8px 0; color: #1f2937;">${orderData.customer.address}</td>
              </tr>
            </table>
          </div>

          <!-- Products -->
          <div style="background-color: #fef3c7; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <h2 style="margin: 0 0 16px 0; color: #1f2937; font-size: 18px;">🛍️ Chi tiết sản phẩm</h2>
            <table style="width: 100%; border-collapse: collapse;">
              ${productsHtml}
            </table>
          </div>

          ${commissionHtml}

          <!-- Thank You Message -->
          <div style="background-color: #fef3c7; border-radius: 8px; padding: 20px; margin-top: 20px; text-align: center;">
            <p style="margin: 0; color: #92400e; font-size: 16px;">
              🙏 <strong>Cảm ơn bạn đã đồng hành cùng Vòng Dâu Tằm By Ánh!</strong>
            </p>
            <p style="margin: 8px 0 0 0; color: #78350f; font-size: 14px;">
              Chúng tôi sẽ liên hệ với bạn để thanh toán hoa hồng trong thời gian sớm nhất.
            </p>
          </div>

        </div>

        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #6b7280; font-size: 14px;">
            Email tự động từ hệ thống Vòng Dâu Tằm By Ánh
          </p>
          <p style="margin: 8px 0 0 0; color: #9ca3af; font-size: 12px;">
            © 2024 Vòng Dâu Tằm By Ánh. All rights reserved.
          </p>
          <p style="margin: 8px 0 0 0; color: #9ca3af; font-size: 12px;">
            Nếu có thắc mắc, vui lòng liên hệ: yendev96@gmail.com
          </p>
        </div>

      </div>
    </body>
    </html>
  `;

  return html;
}

function doGet(e) {
  return ContentService.createTextOutput("Order handler is running");
}

// ==================== Telegram bot admin commands removed ====================
/**
 * Xử lý GET request (webhook từ Telegram)
 */
function doGet(e) {
  try {
    // Trả về response đơn giản cho GET request
    return ContentService.createTextOutput("Order handler is running");
  } catch (error) {
    return ContentService.createTextOutput("Error: " + error.message);
  }
}

/**
 * Xử lý tin nhắn từ Telegram
 */
function handleTelegramWebhook(update) {
  // Telegram webhook/commands are disabled. We only process orders now.
  return ContentService.createTextOutput("OK");
}

/**
 * Xử lý các lệnh admin
 */
function handleAdminCommand(chatId, command) {
  try {
    const sheet = SpreadsheetApp.openById(MAIN_SHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) {
      sendTelegramMessage(chatId, "❌ Không tìm thấy sheet đơn hàng");
      return;
    }

    const trimmedCommand = command.trim();
    const parts = trimmedCommand.split(' ');
    const cmd = parts[0].toLowerCase();

    switch (cmd) {
      case '/start':
      case '/help':
        sendHelpMessage(chatId);
        break;

      case '/today':
        sendTodayOrders(chatId, sheet);
        break;

      case '/stats':
        sendStatistics(chatId, sheet);
        break;

      case '/find':
        if (parts[1]) {
          findOrder(chatId, sheet, parts[1]);
        } else {
          sendTelegramMessage(chatId, "❌ Vui lòng nhập mã đơn hàng\nVí dụ: /find VDT001");
        }
        break;

      case '/customer':
        if (parts[1]) {
          findCustomerHistory(chatId, sheet, parts[1]);
        } else {
          sendTelegramMessage(chatId, "❌ Vui lòng nhập số điện thoại\nVí dụ: /customer 0123456789");
        }
        break;

      case '/pending':
        sendPendingOrders(chatId, sheet);
        break;

      case '/week':
        sendWeeklyStats(chatId, sheet);
        break;

      case '/month':
        sendMonthlyStats(chatId, sheet);
        break;

      case '/recent':
        sendRecentOrders(chatId, sheet);
        break;

      default:
        sendTelegramMessage(chatId, `❌ Lệnh không hợp lệ: "${cmd}"\nGõ /help để xem danh sách lệnh.`);
    }

  } catch (error) {
    sendTelegramMessage(chatId, `❌ Lỗi: ${error.message}`);
  }
}

// ==================== CÁC HÀM XỬ LÝ ADMIN COMMANDS ====================

/**
 * Gửi tin nhắn Telegram đơn giản
 */
function sendTelegramMessage(chatId, message) {
  // Disabled: Telegram messaging removed from this Apps Script.
  return;
}

/**
 * Gửi tin nhắn hướng dẫn
 */
function sendHelpMessage(chatId) {
  const helpText = `
🤖 <b>LỆNH ADMIN - Vòng Dâu Tằm By Ánh</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 <b>XEM ĐƠN HÀNG:</b>
/today - Đơn hàng hôm nay
/week - Thống kê tuần này
/month - Thống kê tháng này
/recent - 10 đơn hàng gần nhất
/stats - Thống kê tổng quan

🔍 <b>TÌM KIẾM:</b>
/find VDT001 - Chi tiết đơn hàng
/customer 0123456789 - Lịch sử khách hàng

💡 <b>MẸO:</b> Gõ lệnh bất kỳ để quản lý shop nhanh chóng!
  `;

  sendTelegramMessage(chatId, helpText);
}

/**
 * Xem đơn hàng hôm nay
 */
function sendTodayOrders(chatId, sheet) {
  const today = new Date();
  const todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'dd/MM/yyyy');

  const data = sheet.getDataRange().getValues();
  const orders = data.slice(1);

  // Lọc đơn hàng hôm nay
  const todayOrders = orders.filter(row => {
    const orderDate = new Date(row[1]); // Cột "Ngày Đặt"
    const orderDateStr = Utilities.formatDate(orderDate, Session.getScriptTimeZone(), 'dd/MM/yyyy');
    return orderDateStr === todayStr;
  });

  if (todayOrders.length === 0) {
    sendTelegramMessage(chatId, `📅 <b>HÔM NAY (${todayStr})</b>\n\n📦 Chưa có đơn hàng nào`);
    return;
  }

  // Tính tổng doanh thu
  let totalRevenue = 0;
  todayOrders.forEach(order => {
    const total = order[6]; // Cột "💰 TỔNG KHÁCH PHẢI TRẢ"
    const amount = parseInt(total.toString().replace(/[^\d]/g, ''));
    totalRevenue += amount;
  });

  let message = `📊 <b>ĐƠN HÀNG HÔM NAY (${todayStr})</b>\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  message += `📦 Tổng: <b>${todayOrders.length} đơn hàng</b>\n`;
  message += `💰 Doanh thu: <b>${totalRevenue.toLocaleString('vi-VN')}đ</b>\n\n`;
  message += `📋 <b>DANH SÁCH:</b>\n`;

  todayOrders.slice(0, 10).forEach((order, index) => {
    const orderId = order[0];
    const customerName = order[2];
    const total = order[6];
    const payment = order[7];

    message += `${index + 1}. <code>${orderId}</code> - ${customerName}\n`;
    message += `   💰 ${total} - ${payment.replace(/🏦|💰/g, '')}\n\n`;
  });

  if (todayOrders.length > 10) {
    message += `... và ${todayOrders.length - 10} đơn hàng khác\n\n`;
  }

  message += `💡 Gõ <code>/find [mã đơn]</code> để xem chi tiết`;

  sendTelegramMessage(chatId, message);
}

/**
 * Gửi thống kê tổng quan
 */
function sendStatistics(chatId, sheet) {
  const data = sheet.getDataRange().getValues();
  const orders = data.slice(1);

  if (orders.length === 0) {
    sendTelegramMessage(chatId, "📊 Chưa có đơn hàng nào để thống kê");
    return;
  }

  // Thống kê theo ngày
  const today = new Date();
  const todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'dd/MM/yyyy');

  let todayCount = 0;
  let todayRevenue = 0;
  let totalRevenue = 0;

  orders.forEach(order => {
    const orderDate = new Date(order[1]);
    const orderDateStr = Utilities.formatDate(orderDate, Session.getScriptTimeZone(), 'dd/MM/yyyy');
    const total = order[6];
    const amount = parseInt(total.toString().replace(/[^\d]/g, ''));

    totalRevenue += amount;

    if (orderDateStr === todayStr) {
      todayCount++;
      todayRevenue += amount;
    }
  });

  let message = `📊 <b>THỐNG KÊ TỔNG QUAN</b>\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  message += `📅 <b>HÔM NAY (${todayStr}):</b>\n`;
  message += `📦 Đơn hàng: <b>${todayCount}</b>\n`;
  message += `💰 Doanh thu: <b>${todayRevenue.toLocaleString('vi-VN')}đ</b>\n\n`;
  message += `📈 <b>TỔNG CỘNG:</b>\n`;
  message += `📦 Tổng đơn hàng: <b>${orders.length}</b>\n`;
  message += `💰 Tổng doanh thu: <b>${totalRevenue.toLocaleString('vi-VN')}đ</b>\n\n`;
  message += `📊 Trung bình: <b>${Math.round(totalRevenue / orders.length).toLocaleString('vi-VN')}đ</b>/đơn`;

  sendTelegramMessage(chatId, message);
}

/**
 * Tìm đơn hàng cụ thể
 */
function findOrder(chatId, sheet, orderId) {
  const data = sheet.getDataRange().getValues();
  const orders = data.slice(1);

  const order = orders.find(row => row[0].toString().toLowerCase() === orderId.toLowerCase());

  if (!order) {
    sendTelegramMessage(chatId, `❌ Không tìm thấy đơn hàng <code>${orderId}</code>`);
    return;
  }

  const orderDate = new Date(order[1]);
  const dateStr = Utilities.formatDate(orderDate, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');

  let message = `🔍 <b>CHI TIẾT ĐƠN HÀNG ${order[0]}</b>\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  message += `👤 <b>${order[2]}</b> - <code>${order[3]}</code>\n`;
  message += `📍 ${order[4]}\n`;
  message += `💰 <b>Tổng: ${order[6]}</b>\n`;
  message += `💳 ${order[7]}\n`;
  message += `📅 ${dateStr}\n\n`;
  message += `🛍️ <b>SẢN PHẨM:</b>\n`;
  message += `${order[5]}\n\n`; // Chi tiết sản phẩm

  if (order[8] && order[8].trim()) {
    message += `💬 <b>Ghi chú:</b> <i>${order[8]}</i>\n\n`;
  }

  message += `🔧 <b>HÀNH ĐỘNG:</b>\n`;
  message += `/customer ${order[3]} - Xem lịch sử khách này`;

  sendTelegramMessage(chatId, message);
}

/**
 * Xem lịch sử khách hàng
 */
function findCustomerHistory(chatId, sheet, phone) {
  const data = sheet.getDataRange().getValues();
  const orders = data.slice(1);

  const customerOrders = orders.filter(row => row[3].toString().includes(phone));

  if (customerOrders.length === 0) {
    sendTelegramMessage(chatId, `❌ Không tìm thấy đơn hàng nào của SĐT <code>${phone}</code>`);
    return;
  }

  // Tính tổng
  let totalSpent = 0;
  customerOrders.forEach(order => {
    const amount = parseInt(order[6].toString().replace(/[^\d]/g, ''));
    totalSpent += amount;
  });

  let message = `👤 <b>LỊCH SỬ KHÁCH HÀNG</b>\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  message += `📞 SĐT: <code>${phone}</code>\n`;
  message += `👤 Tên: <b>${customerOrders[0][2]}</b>\n`;
  message += `📦 Tổng đơn hàng: <b>${customerOrders.length}</b>\n`;
  message += `💰 Tổng chi tiêu: <b>${totalSpent.toLocaleString('vi-VN')}đ</b>\n\n`;
  message += `📋 <b>DANH SÁCH ĐƠN HÀNG:</b>\n`;

  customerOrders.slice(0, 5).forEach((order, index) => {
    const orderDate = new Date(order[1]);
    const dateStr = Utilities.formatDate(orderDate, Session.getScriptTimeZone(), 'dd/MM');

    message += `${index + 1}. <code>${order[0]}</code> - ${order[6]} (${dateStr})\n`;
  });

  if (customerOrders.length > 5) {
    message += `... và ${customerOrders.length - 5} đơn hàng khác\n`;
  }

  // Đánh giá khách hàng
  if (customerOrders.length >= 3) {
    message += `\n🌟 <b>KHÁCH HÀNG VIP</b> - Đã mua ${customerOrders.length} lần!`;
  }

  sendTelegramMessage(chatId, message);
}

/**
 * Xem đơn hàng chờ xử lý - Cải tiến để hiển thị đơn hàng gần đây
 */
function sendPendingOrders(chatId, sheet) {
  const data = sheet.getDataRange().getValues();
  const orders = data.slice(1);

  if (orders.length === 0) {
    sendTelegramMessage(chatId, "📦 Chưa có đơn hàng nào");
    return;
  }

  // Lấy 10 đơn hàng gần nhất (sắp xếp theo ngày giảm dần)
  const recentOrders = orders
    .sort((a, b) => new Date(b[1]) - new Date(a[1]))
    .slice(0, 10);

  let message = `� <b>10 ĐƠN HÀNG GẦN NHẤT</b>\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  recentOrders.forEach((order, index) => {
    const orderDate = new Date(order[1]);
    const dateStr = Utilities.formatDate(orderDate, Session.getScriptTimeZone(), 'dd/MM HH:mm');

    message += `${index + 1}. <code>${order[0]}</code>\n`;
    message += `   � ${order[2]} - � ${order[3]}\n`;
    message += `   � ${order[6]} - 📅 ${dateStr}\n\n`;
  });

  message += `� Gõ <code>/find [mã đơn]</code> để xem chi tiết`;
  sendTelegramMessage(chatId, message);
}

/**
 * Thống kê tuần này
 */
function sendWeeklyStats(chatId, sheet) {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay()); // Chủ nhật đầu tuần

  const data = sheet.getDataRange().getValues();
  const orders = data.slice(1);

  // Lọc đơn hàng tuần này
  const weekOrders = orders.filter(row => {
    const orderDate = new Date(row[1]);
    return orderDate >= startOfWeek && orderDate <= today;
  });

  if (weekOrders.length === 0) {
    sendTelegramMessage(chatId, `📅 <b>TUẦN NÀY</b>\n\n📦 Chưa có đơn hàng nào`);
    return;
  }

  // Tính tổng doanh thu
  let totalRevenue = 0;
  weekOrders.forEach(order => {
    const amount = parseInt(order[6].toString().replace(/[^\d]/g, ''));
    totalRevenue += amount;
  });

  const startStr = Utilities.formatDate(startOfWeek, Session.getScriptTimeZone(), 'dd/MM');
  const endStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'dd/MM/yyyy');

  let message = `📊 <b>THỐNG KÊ TUẦN NÀY (${startStr} - ${endStr})</b>\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  message += `📦 Tổng đơn hàng: <b>${weekOrders.length}</b>\n`;
  message += `💰 Doanh thu: <b>${totalRevenue.toLocaleString('vi-VN')}đ</b>\n`;
  message += `📊 Trung bình: <b>${Math.round(totalRevenue / weekOrders.length).toLocaleString('vi-VN')}đ</b>/đơn\n\n`;
  message += `💡 Gõ <code>/today</code> để xem chi tiết hôm nay`;

  sendTelegramMessage(chatId, message);
}

/**
 * Thống kê tháng này
 */
function sendMonthlyStats(chatId, sheet) {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const data = sheet.getDataRange().getValues();
  const orders = data.slice(1);

  // Lọc đơn hàng tháng này
  const monthOrders = orders.filter(row => {
    const orderDate = new Date(row[1]);
    return orderDate >= startOfMonth && orderDate <= today;
  });

  if (monthOrders.length === 0) {
    const monthStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'MM/yyyy');
    sendTelegramMessage(chatId, `📅 <b>THÁNG ${monthStr}</b>\n\n📦 Chưa có đơn hàng nào`);
    return;
  }

  // Tính tổng doanh thu
  let totalRevenue = 0;
  monthOrders.forEach(order => {
    const amount = parseInt(order[6].toString().replace(/[^\d]/g, ''));
    totalRevenue += amount;
  });

  const monthStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'MM/yyyy');

  let message = `📊 <b>THỐNG KÊ THÁNG ${monthStr}</b>\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  message += `📦 Tổng đơn hàng: <b>${monthOrders.length}</b>\n`;
  message += `💰 Doanh thu: <b>${totalRevenue.toLocaleString('vi-VN')}đ</b>\n`;
  message += `📊 Trung bình: <b>${Math.round(totalRevenue / monthOrders.length).toLocaleString('vi-VN')}đ</b>/đơn\n\n`;
  message += `💡 Gõ <code>/week</code> để xem thống kê tuần`;

  sendTelegramMessage(chatId, message);
}

/**
 * Xem đơn hàng gần đây (alias cho /pending)
 */
function sendRecentOrders(chatId, sheet) {
  const data = sheet.getDataRange().getValues();
  const orders = data.slice(1);

  if (orders.length === 0) {
    sendTelegramMessage(chatId, "📦 Chưa có đơn hàng nào");
    return;
  }

  // Lấy 5 đơn hàng gần nhất
  const recentOrders = orders
    .sort((a, b) => new Date(b[1]) - new Date(a[1]))
    .slice(0, 5);

  let message = `📋 <b>5 ĐƠN HÀNG GẦN NHẤT</b>\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  recentOrders.forEach((order, index) => {
    const orderDate = new Date(order[1]);
    const dateStr = Utilities.formatDate(orderDate, Session.getScriptTimeZone(), 'dd/MM HH:mm');

    message += `${index + 1}. <code>${order[0]}</code>\n`;
    message += `   👤 ${order[2]}\n`;
    message += `   💰 ${order[6]} - 📅 ${dateStr}\n\n`;
  });

  message += `💡 Gõ <code>/find [mã đơn]</code> để xem chi tiết`;
  sendTelegramMessage(chatId, message);
}


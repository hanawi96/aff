// Google Apps Script code to handle form submissions
// Deploy this as a Web App in Google Apps Script

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
    const spreadsheetId = '1QOXBlIcX1Th1ZnNKulnbxEJDD-HfAiKfOFKHn2pBo4o';
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);

    // Get or create the sheet (sử dụng tên sheet "DS REF" như bạn đã tạo)
    let sheet = spreadsheet.getSheetByName('DS REF');
    if (!sheet) {
      sheet = spreadsheet.insertSheet('DS REF');
    }

    // Kiểm tra xem sheet có header chưa (kiểm tra cell A1)
    const firstCell = sheet.getRange(1, 1).getValue();
    const needsHeader = !firstCell || firstCell === '';

    if (needsHeader) {
      // Add headers
      const headers = [
        'Thời Gian',
        'Họ Tên',
        'Số Điện Thoại',
        'Tỉnh/Thành',
        'Tuổi',
        'Kinh Nghiệm',
        'Lý Do',
        'Mã Ref',
        'Trạng Thái'
      ];
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

      // Freeze header row
      sheet.setFrozenRows(1);

      // Thêm filter cho header
      sheet.getRange(1, 1, 1, headers.length).createFilter();

      Logger.log('✅ Header đã được tạo thành công!');
    } else {
      Logger.log('ℹ️ Header đã tồn tại, bỏ qua việc tạo mới');
    }

    // Generate unique referral code
    const refCode = generateReferralCode(data.fullName || 'USER');
    const refUrl = 'https://shopvd.store/?ref=' + refCode;

    Logger.log('Generated RefCode: ' + refCode);
    Logger.log('Generated RefUrl: ' + refUrl);

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
      'Mới' // Status
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
  // Remove Vietnamese accents and convert to uppercase
  const name = removeVietnameseAccents(fullName).toUpperCase();

  // Get first letters of name (max 3 characters)
  const nameParts = name.split(' ').filter(part => part.length > 0);
  let nameCode = '';
  for (let i = 0; i < Math.min(3, nameParts.length); i++) {
    nameCode += nameParts[i].charAt(0);
  }

  // Add random alphanumeric characters
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let randomCode = '';
  for (let i = 0; i < 5; i++) {
    randomCode += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return nameCode + randomCode;
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

// Handle GET requests (for testing)
function doGet(e) {
  return ContentService
    .createTextOutput('Google Apps Script is working!')
    .setMimeType(ContentService.MimeType.TEXT);
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

// Test function to verify the setup
function testFunction() {
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

  // Simulate a POST request
  const mockEvent = {
    postData: {
      contents: JSON.stringify(testData)
    }
  };

  const result = doPost(mockEvent);
  console.log('Test result:', result.getContent());
}
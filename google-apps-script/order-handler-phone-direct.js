// ⭐ THÊM HÀM NÀY VÀO FILE order-handler.js (sau hàm getReferralCodeByPhone)

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

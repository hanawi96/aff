// Orders Statistics Functions
// Extracted from orders.js for better code organization
// NOTE: All functions remain at global scope for backward compatibility
// DEPENDENCIES: filteredOrdersData, allOrdersData, calculateOrderProfit() (orders-constants.js)

// ============================================
// UPDATE STATISTICS
// ============================================

/**
 * Cập nhật thẻ thống kê — CHỈ còn 1 chỉ số: số đơn CHƯA GỬI HÀNG.
 * allOrdersData (LUỒNG 1) luôn chứa toàn bộ đơn chưa gửi hàng → dùng trực tiếp độ dài,
 * không phụ thuộc bộ lọc/trang hiện tại. Đã bỏ 3 thẻ doanh thu / lợi nhuận / TB đơn
 * để làm nhẹ hệ thống (không quét/tính tổng tài chính ở client nữa).
 */
function updateStats() {
    // Hiển thị số đơn CHƯA GỬI HÀNG ngay trên tiêu đề bảng:
    // "Danh Sách Đơn Hàng (24 đơn hàng chưa gửi)". allOrdersData luôn = bucket đơn chưa gửi.
    const unshippedCount = Array.isArray(allOrdersData) ? allOrdersData.length : 0;
    const label = document.getElementById('unshippedCountLabel');
    if (label) {
        label.textContent = ` (${unshippedCount} đơn hàng chưa gửi)`;
    }
}

// (Đã bỏ updateStatElement + updateStatLabels — trước phục vụ 4 thẻ thống kê.
//  Nay số đơn chưa gửi hiển thị thẳng trên tiêu đề bảng qua #unshippedCountLabel.)

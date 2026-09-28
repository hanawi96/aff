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
    // allOrdersData luôn = bucket đơn CHƯA GỬI HÀNG.
    const list = Array.isArray(allOrdersData) ? allOrdersData : [];
    const unshippedCount = list.length;

    // Số đơn chưa gửi trên tiêu đề bảng.
    const label = document.getElementById('unshippedCountLabel');
    if (label) {
        label.textContent = ` (${unshippedCount} đơn hàng chưa gửi)`;
    }

    // Tổng doanh thu đơn chưa gửi (badge header) — cộng total_amount.
    const revenueEl = document.getElementById('unshippedRevenue');
    if (revenueEl) {
        const totalRevenue = list.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
        revenueEl.textContent = (typeof formatCurrency === 'function')
            ? formatCurrency(totalRevenue)
            : totalRevenue.toLocaleString('vi-VN') + 'đ';
    }
}

// (Đã bỏ updateStatElement + updateStatLabels — trước phục vụ 4 thẻ thống kê.
//  Nay số đơn chưa gửi hiển thị thẳng trên tiêu đề bảng qua #unshippedCountLabel.)

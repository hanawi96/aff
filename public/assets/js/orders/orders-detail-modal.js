// Orders Detail Modal Module
// Handles order detail modal display
// NOTE: All functions are global scope for compatibility with existing code

// View order detail
function viewOrderDetail(orderId) {
    const order = allOrdersData.find(o => o.id === orderId);
    if (!order) {
        showToast('Không tìm thấy đơn hàng', 'error');
        return;
    }

    showOrderDetailModal(order);
}

// Show order detail modal
function showOrderDetailModal(order) {
    const modal = document.createElement('div');
    modal.id = 'orderDetailModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <!-- Header -->
            <div class="bg-gradient-to-r from-admin-primary to-admin-secondary px-6 py-4 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                        <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                    </div>
                    <div>
                        <h2 class="text-xl font-bold text-white">Chi tiết đơn hàng</h2>
                        <p class="text-sm text-white/80">${escapeHtml(order.order_id || 'N/A')}</p>
                    </div>
                </div>
                <button onclick="closeOrderDetailModal()" class="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                    <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            
            <!-- Content -->
            <div class="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                <div class="space-y-6">
                    <!-- Order Info -->
                    <div>
                        <h3 class="text-lg font-semibold text-gray-900 mb-3">Thông tin đơn hàng</h3>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <p class="text-sm text-gray-500">Mã đơn hàng</p>
                                <p class="text-sm font-semibold text-gray-900">${escapeHtml(order.order_id || 'N/A')}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-500">Ngày đặt</p>
                                <p class="text-sm font-semibold text-gray-900">${formatDateTime(order.created_at || order.order_date)}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-500">Giá trị đơn hàng</p>
                                <p class="text-sm font-bold text-green-600">${formatCurrency(order.total_amount || 0)}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-500">Hoa hồng</p>
                                <p class="text-sm font-bold text-orange-600">${formatCurrency(order.commission || 0)}</p>
                            </div>
                        </div>
                    </div>

                    <!-- Customer Info -->
                    <div>
                        <h3 class="text-lg font-semibold text-gray-900 mb-3">Thông tin khách hàng</h3>
                        <div class="grid grid-cols-1 gap-3">
                            <div>
                                <p class="text-sm text-gray-500">Tên khách hàng</p>
                                <p class="text-sm font-semibold text-gray-900">${escapeHtml(order.customer_name || 'N/A')}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-500">Số điện thoại</p>
                                <p class="text-sm font-semibold text-gray-900">${escapeHtml(order.customer_phone || 'N/A')}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-500">Địa chỉ</p>
                                <p class="text-sm font-semibold text-gray-900">${escapeHtml(order.address || 'N/A')}</p>
                            </div>
                        </div>
                    </div>

                    <!-- CTV Info -->
                    ${order.referral_code ? `
                    <div>
                        <h3 class="text-lg font-semibold text-gray-900 mb-3">Thông tin CTV</h3>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <p class="text-sm text-gray-500">Mã CTV</p>
                                <p class="text-sm font-semibold text-blue-600">${escapeHtml(order.referral_code)}</p>
                            </div>
                            ${order.ctv_phone ? `
                            <div>
                                <p class="text-sm text-gray-500">SĐT CTV</p>
                                <p class="text-sm font-semibold text-gray-900">${escapeHtml(order.ctv_phone)}</p>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    ` : ''}

                    <!-- Products -->
                    ${order.products ? `
                    <div>
                        <h3 class="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <svg class="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                            </svg>
                            Sản phẩm
                        </h3>
                        ${formatProductsForModal(order.products)}
                    </div>
                    ` : ''}

                    <!-- Payment & Status -->
                    <div>
                        <h3 class="text-lg font-semibold text-gray-900 mb-3">Thanh toán & Trạng thái</h3>
                        <div class="grid grid-cols-2 gap-4">
                            ${order.payment_method ? `
                            <div>
                                <p class="text-sm text-gray-500">Phương thức thanh toán</p>
                                <p class="text-sm font-semibold text-gray-900">${escapeHtml(order.payment_method)}</p>
                            </div>
                            ` : ''}
                            ${order.status ? `
                            <div>
                                <p class="text-sm text-gray-500">Trạng thái</p>
                                <p class="text-sm font-semibold text-gray-900">${escapeHtml(order.status)}</p>
                            </div>
                            ` : ''}
                        </div>
                    </div>

                    <!-- Order Notes -->
                    ${order.notes ? `
                    <div>
                        <h3 class="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <svg class="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                            </svg>
                            Ghi chú đơn hàng
                        </h3>
                        <div class="bg-amber-50 rounded-xl p-4 border border-amber-200">
                            <p class="text-sm text-gray-700 whitespace-pre-wrap">${escapeHtml(order.notes)}</p>
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
            
            <!-- Footer -->
            <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end">
                <button type="button" onclick="closeOrderDetailModal()" 
                    class="px-6 py-2.5 bg-gradient-to-r from-admin-primary to-admin-secondary text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Đóng
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

// Close order detail modal
function closeOrderDetailModal() {
    const modal = document.getElementById('orderDetailModal');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 200);
    }
}

// Format products for modal (helper function for viewOrderDetail)
function formatProductsForModal(productsText, orderId, orderCode, orderNotes = null) {
    if (!productsText || productsText.trim() === '') {
        return '<span class="text-sm text-gray-400 italic">Không có thông tin</span>';
    }

    // Parse products - có thể là text hoặc JSON
    let products = [];

    try {
        // Thử parse JSON nếu có
        products = JSON.parse(productsText);
    } catch (e) {
        // Nếu không phải JSON, parse text thông thường
        // Format: "Sản phẩm A x2, Sản phẩm B x1" hoặc "Sản phẩm A\nSản phẩm B"
        const lines = productsText.split(/[,\n]/).map(line => line.trim()).filter(line => line);
        products = lines.map(line => {
            // Tách tên và số lượng nếu có format "Tên x Số lượng"
            const match = line.match(/^(.+?)\s*[xX×]\s*(\d+)$/);
            if (match) {
                return { name: match[1].trim(), quantity: parseInt(match[2]) };
            }
            return { name: line, quantity: 1 };
        });
    }

    // Nếu không parse được gì, hiển thị text gốc
    if (!Array.isArray(products) || products.length === 0) {
        // Giới hạn độ dài text và thêm tooltip
        const shortText = productsText.length > 50 ? productsText.substring(0, 50) + '...' : productsText;
        return `
            <div class="max-w-xs">
                <p class="text-sm text-gray-700 line-clamp-2" title="${escapeHtml(productsText)}">
                    ${escapeHtml(shortText)}
                </p>
            </div>
        `;
    }

    // Hiển thị tất cả sản phẩm trong modal (không giới hạn)
    let html = '<div class="flex flex-col gap-2 w-full">';

    products.forEach((product, index) => {
        const productName = typeof product === 'string' ? product : (product.name || 'Sản phẩm');
        const quantity = typeof product === 'object' && product.quantity ? product.quantity : 1;
        const price = typeof product === 'object' && product.price ? product.price : null;
        const weight = typeof product === 'object' && product.weight ? product.weight : null;
        const size = typeof product === 'object' && product.size ? product.size : null;
        const notes = typeof product === 'object' && product.notes ? product.notes : null;

        // Parse quantity nếu là string
        const parsedQuantity = typeof quantity === 'string' ? parseInt(quantity) || 1 : quantity;

        // Tạo text chi tiết
        const details = [];
        if (weight) details.push(`⚖️ ${formatWeightSize(weight)}`);
        if (size) {
            const isSizeMeasurement = size.toLowerCase().includes('cm') ||
                size.toLowerCase().includes('size') ||
                size.toLowerCase().includes('tay');
            const icon = isSizeMeasurement ? '📏' : '⚖️';
            details.push(`${icon} ${formatWeightSize(size)}`);
        }
        if (price) {
            const priceNum = typeof price === 'number' ? price : parseFloat(String(price).replace(/[^\d]/g, ''));
            if (!isNaN(priceNum) && priceNum > 0) {
                details.push(`💰 ${formatCurrency(priceNum * parsedQuantity)}`);
            }
        }
        const detailsText = details.length > 0 ? details.join(' • ') : '';

        html += `
            <div class="relative bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 rounded-xl px-3 py-2.5 border border-purple-200 shadow-sm">
                <div class="flex items-start gap-2 mb-1.5">
                    <div class="flex-shrink-0 w-2 h-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full shadow-sm mt-1.5">
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-start gap-2">
                            <span class="text-sm font-semibold text-gray-900 break-words leading-tight" title="${escapeHtml(productName)}">
                                ${escapeHtml(productName)}
                            </span>
                            ${parsedQuantity > 1 ? `
                                <span class="inline-flex items-center px-2 py-0.5 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-full shadow-sm flex-shrink-0">
                                    ×${parsedQuantity}
                                </span>
                            ` : ''}
                        </div>
                    </div>
                </div>
                
                <!-- Details: Giá, cân nặng -->
                ${detailsText ? `
                    <div class="flex items-center gap-2 text-xs text-gray-600 pl-8 mb-1">
                        ${detailsText}
                    </div>
                ` : ''}
                
                <!-- Notes -->
                ${notes ? `
                    <div class="flex items-start gap-1.5 text-xs text-gray-700 pl-8 mt-1.5 pt-1.5 border-t border-purple-200">
                        <svg class="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                        </svg>
                        <span class="italic">${escapeHtml(notes)}</span>
                    </div>
                ` : ''}
            </div>
        `;
    });

    html += '</div>';
    return html;
}

console.log('✅ orders-detail-modal.js loaded');

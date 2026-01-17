// Orders Products Display Module
// Handles product display formatting in orders table
// NOTE: All functions are global scope for compatibility with existing code

// Format products display with beautiful badges
function formatProductsDisplay(productsText, orderId, orderCode, orderNotes = null) {
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

    // Hiển thị tối đa 3 sản phẩm, còn lại hiển thị "+X sản phẩm"
    const maxDisplay = 3;
    const displayProducts = products.slice(0, maxDisplay);
    const remainingProducts = products.slice(maxDisplay);
    const remainingCount = remainingProducts.length;

    // Tạo ID duy nhất cho container này
    const uniqueId = 'products_' + Math.random().toString(36).substr(2, 9);

    let html = '<div class="flex flex-col gap-2 w-full">';

    // Hiển thị 3 sản phẩm đầu tiên
    displayProducts.forEach((product, index) => {
        html += createProductItemHtml(product, orderId, orderCode, index);
    });

    // Container cho các sản phẩm còn lại (ẩn mặc định)
    if (remainingCount > 0) {
        html += `<div id="${uniqueId}_hidden" class="hidden flex flex-col gap-2">`;

        remainingProducts.forEach((product, index) => {
            const actualIndex = maxDisplay + index;
            html += createProductItemHtml(product, orderId, orderCode, actualIndex);
        });

        html += '</div>';

        // Nút toggle
        html += `
            <div id="${uniqueId}_toggle" class="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5 border border-gray-200 cursor-pointer hover:bg-gray-200 transition-colors" 
                 onclick="toggleProducts('${uniqueId}')">
                <svg id="${uniqueId}_icon" class="w-4 h-4 text-gray-500 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span id="${uniqueId}_text" class="text-xs font-medium text-gray-600">
                    ${remainingCount} sản phẩm khác
                </span>
            </div>
        `;
    }


    // Order Notes (if exists)
    if (orderNotes) {
        html += `
            <div class="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg px-3 py-2 border border-amber-200">
                <div class="flex items-start gap-2">
                    <svg class="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    <div class="flex-1 min-w-0">
                        <p class="text-xs font-semibold text-amber-800 mb-0.5">Lưu ý đơn hàng</p>
                        <p class="text-xs text-gray-700 line-clamp-2" title="${escapeHtml(orderNotes)}">${escapeHtml(orderNotes)}</p>
                    </div>
                </div>
            </div>
        `;
    }

    // Add product and notes buttons (2 columns)
    html += `
        <div class="grid grid-cols-2 gap-2">
            <!-- Add Product Button -->
            <div class="flex items-center gap-1.5 bg-white rounded-lg px-2 py-1.5 border-2 border-dashed border-purple-200 cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-all group" 
                 onclick="showProductSelectionModalForOrder(${orderId}, '${escapeHtml(orderCode)}')">
                <div class="w-5 h-5 rounded-full bg-purple-100 group-hover:bg-purple-500 flex items-center justify-center transition-colors flex-shrink-0">
                    <svg class="w-3 h-3 text-purple-500 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                </div>
                <span class="text-xs font-medium text-purple-600 group-hover:text-purple-700">Thêm SP</span>
            </div>
            
            <!-- Add Notes Button -->
            <div class="flex items-center gap-1.5 bg-white rounded-lg px-2 py-1.5 border-2 border-dashed border-amber-200 cursor-pointer hover:border-amber-400 hover:bg-amber-50 transition-all group" 
                 onclick="showAddOrderNotesModal(${orderId}, '${escapeHtml(orderCode)}')">
                <div class="w-5 h-5 rounded-full bg-amber-100 group-hover:bg-amber-500 flex items-center justify-center transition-colors flex-shrink-0">
                    <svg class="w-3 h-3 text-amber-500 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </div>
                <span class="text-xs font-medium text-amber-600 group-hover:text-amber-700">Ghi chú</span>
            </div>
        </div>
    `;

    html += '</div>';
    return html;
}

// Helper function to create product item HTML
function createProductItemHtml(product, orderId, orderCode, index) {
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

    const productId = `product_${orderId}_${index}`;
    
    return `
        <div class="relative bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 rounded-xl px-3 py-2.5 border border-purple-200 shadow-sm hover:shadow-md transition-all group">
            <!-- Header: Tên sản phẩm và số lượng -->
            <div class="flex items-start gap-2 mb-1.5">
                <div class="flex-shrink-0 w-2 h-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full shadow-sm mt-1.5">
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-start gap-2">
                        <span id="${productId}" class="text-sm font-semibold text-gray-900 break-words leading-tight" title="${escapeHtml(productName)}">
                            ${escapeHtml(productName)}
                        </span>
                        ${parsedQuantity > 1 ? `
                            <span class="inline-flex items-center px-2 py-0.5 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-full shadow-sm flex-shrink-0">
                                ×${parsedQuantity}
                            </span>
                        ` : ''}
                    </div>
                </div>
                <!-- Action buttons -->
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="editProductName('${productId}', ${orderId}, '${escapeHtml(orderCode)}')" class="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors" title="Chỉnh sửa">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button onclick="confirmDeleteProduct(${orderId}, ${index}, '${escapeHtml(orderCode)}', '${escapeHtml(productName)}')" class="p-1 text-red-600 hover:bg-red-100 rounded transition-colors" title="Xóa">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
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
}

// Toggle products visibility
function toggleProducts(uniqueId) {
    const hiddenContainer = document.getElementById(uniqueId + '_hidden');
    const icon = document.getElementById(uniqueId + '_icon');
    const text = document.getElementById(uniqueId + '_text');

    if (!hiddenContainer || !icon || !text) return;

    const isHidden = hiddenContainer.classList.contains('hidden');

    if (isHidden) {
        // Hiển thị các sản phẩm còn lại
        hiddenContainer.classList.remove('hidden');
        hiddenContainer.classList.add('flex');

        // Đổi icon thành minus
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 12H6" />';

        // Đổi text
        text.textContent = 'Thu gọn';
    } else {
        // Ẩn các sản phẩm còn lại
        hiddenContainer.classList.add('hidden');
        hiddenContainer.classList.remove('flex');

        // Đổi icon thành plus
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />';

        // Đổi text về ban đầu
        const count = hiddenContainer.children.length;
        text.textContent = count + ' sản phẩm khác';
    }
}


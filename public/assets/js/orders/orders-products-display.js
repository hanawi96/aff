// Orders Products Display Module
// Handles product display formatting in orders table
// NOTE: All functions are global scope for compatibility with existing code

const ORDER_PRODUCT_META_DOT = `<svg class="shrink-0" style="width:6px;height:6px;display:inline-block;vertical-align:middle" viewBox="-10 -286 580 580" fill="currentColor" aria-hidden="true"><path d="M0 4c0-155 125-280 280-280S560-151 560 4 435 284 280 284 0 159 0 4z"/></svg>`;

/** Icon meta chip size/cân — dấu chấm tròn */
const ORDER_PRODUCT_ICON_SIZE = ORDER_PRODUCT_META_DOT;

/** @deprecated alias */
const ORDER_PRODUCT_ICON_RULER = ORDER_PRODUCT_META_DOT;

/** Icon meta chip giá — dấu chấm tròn */
const ORDER_PRODUCT_ICON_CURRENCY = ORDER_PRODUCT_META_DOT;

const ORDER_PRODUCT_NOTE_ICON = `<svg class="w-3.5 h-3.5 text-purple-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" /></svg>`;

function buildOrderProductNotesBlockHtml(label, notesText, extraClass = '') {
    return `
        <div class="rounded-md border border-purple-100 bg-purple-50/60 px-2.5 py-2 ${extraClass}">
            <div class="flex items-start gap-2 min-w-0">
                ${ORDER_PRODUCT_NOTE_ICON}
                <p class="flex-1 min-w-0 text-gray-700 line-clamp-2 leading-snug" style="font-size:12px" title="${escapeHtml(label)} : ${escapeHtml(notesText)}">
                    <span class="font-semibold text-purple-800">${escapeHtml(label)}</span><span class="text-gray-500"> : </span>${escapeHtml(notesText)}
                </p>
            </div>
        </div>
    `;
}

function buildOrderProductMetaChip(iconHtml, textHtml, tone = 'default') {
    const toneClasses = {
        warn: 'text-amber-700 bg-amber-50 border-amber-100',
        weight: 'text-blue-700 bg-blue-50 border-blue-100',
        price: 'text-indigo-700 bg-indigo-50 border-indigo-100',
        default: 'text-gray-600 bg-gray-50 border-gray-100',
    };
    const toneClass = toneClasses[tone] || toneClasses.default;
    return `<span class="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 ${toneClass}" style="font-size:12px">${iconHtml}<span class="leading-none">${textHtml}</span></span>`;
}

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

    let html = '<div class="flex flex-col gap-1.5 w-full min-w-[220px] max-w-[280px] mx-auto">';

    // Hiển thị 3 sản phẩm đầu tiên
    displayProducts.forEach((product, index) => {
        html += createProductItemHtml(product, orderId, orderCode, index);
    });

    // Container cho các sản phẩm còn lại (ẩn mặc định)
    if (remainingCount > 0) {
        html += `<div id="${uniqueId}_hidden" class="hidden flex flex-col gap-1.5">`;

        remainingProducts.forEach((product, index) => {
            const actualIndex = maxDisplay + index;
            html += createProductItemHtml(product, orderId, orderCode, actualIndex);
        });

        html += '</div>';

        // Nút toggle
        html += `
            <button type="button" id="${uniqueId}_toggle" class="inline-flex items-center justify-center gap-1.5 rounded-md border border-purple-100 bg-purple-50/50 px-2.5 py-1 text-purple-700 hover:bg-purple-50 hover:border-purple-200 transition-colors w-full"
                 onclick="toggleProducts('${uniqueId}')">
                <svg id="${uniqueId}_icon" class="w-3.5 h-3.5 text-purple-400 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span id="${uniqueId}_text" class="font-medium" style="font-size:12px">
                    +${remainingCount} sản phẩm khác
                </span>
            </button>
        `;
    }


    // Order Notes (if exists)
    if (orderNotes) {
        html += buildOrderProductNotesBlockHtml('Lưu ý đơn', orderNotes);
    }

    // Add product and notes buttons
    html += `
        <div class="grid grid-cols-2 gap-1.5 pt-0.5">
            <button type="button"
                 class="inline-flex items-center justify-center gap-1 rounded-md border border-purple-100 bg-purple-50/60 px-2 py-1.5 text-purple-700 hover:bg-purple-50 hover:border-purple-200 transition-colors group"
                 onclick="showProductSelectionModalForOrder(${orderId}, '${escapeHtml(orderCode)}')">
                <svg class="w-3.5 h-3.5 text-purple-500 group-hover:text-purple-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span class="font-medium" style="font-size:12px">Thêm SP</span>
            </button>

            <button type="button"
                 class="inline-flex items-center justify-center gap-1 rounded-md border border-purple-100 bg-purple-50/60 px-2 py-1.5 text-purple-700 hover:bg-purple-50 hover:border-purple-200 transition-colors group"
                 onclick="showAddOrderNotesModal(${orderId}, '${escapeHtml(orderCode)}')">
                <svg class="w-3.5 h-3.5 text-purple-500 group-hover:text-purple-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                </svg>
                <span class="font-medium" style="font-size:12px">Ghi chú</span>
            </button>
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
    const rawWeight = typeof product === 'object' && product.weight ? product.weight : null;
    const rawSize = typeof product === 'object' && product.size ? product.size : null;
    const weight = normalizeOrderItemSizeClient(rawWeight);
    const size = normalizeOrderItemSizeClient(rawSize);
    const notes = typeof product === 'object' && product.notes ? product.notes : null;

    // Parse quantity nếu là string
    const parsedQuantity = typeof quantity === 'string' ? parseInt(quantity) || 1 : quantity;

    // Parse price using helper function
    const priceNum = parsePrice(price);

    const metaChips = [];
    const sizeNorm = (value) => String(value || '').trim().toLowerCase();

    if (weight) {
        metaChips.push(buildOrderProductMetaChip(ORDER_PRODUCT_ICON_SIZE, escapeHtml(formatWeightSize(weight)), 'weight'));
    }
    if (size && sizeNorm(size) !== sizeNorm(weight)) {
        metaChips.push(buildOrderProductMetaChip(ORDER_PRODUCT_ICON_SIZE, escapeHtml(formatWeightSize(size)), 'weight'));
    }
    if (!weight && !size) {
        metaChips.push(buildOrderProductMetaChip(ORDER_PRODUCT_ICON_SIZE, '<span class="font-medium">Chưa có</span>', 'warn'));
    }
    if (priceNum > 0) {
        metaChips.push(buildOrderProductMetaChip(ORDER_PRODUCT_ICON_CURRENCY, escapeHtml(formatCurrency(priceNum * parsedQuantity)), 'price'));
    }

    const productId = `product_${orderId}_${index}`;
    const isMissingWeight = !weight && !size;
    const itemBorder = isMissingWeight ? 'border-amber-200 bg-amber-50/50' : 'border-purple-100 bg-purple-50/40';

    return `
        <div class="relative ${itemBorder} rounded-lg border px-2.5 py-2 hover:border-purple-200 hover:bg-purple-50/60 hover:shadow-sm transition-all group">
            <div class="flex items-start gap-2">
                <div class="flex-1 min-w-0">
                    <div class="flex items-start gap-1.5 min-w-0">
                        <span id="${productId}" class="font-semibold text-gray-900 break-words leading-snug flex-1 min-w-0" style="font-size:14px" title="${escapeHtml(productName)}">
                            ${escapeHtml(productName)}
                        </span>
                        <span class="inline-flex items-center justify-center rounded bg-purple-100 text-purple-700 font-semibold tabular-nums shrink-0 px-1.5 py-0.5 leading-none" style="font-size:11px">×${parsedQuantity}</span>
                    </div>

                    ${metaChips.length ? `
                        <div class="flex flex-wrap items-center gap-1 mt-1.5">
                            ${metaChips.join('')}
                        </div>
                    ` : ''}

                    ${notes ? buildOrderProductNotesBlockHtml('Lưu ý SP', notes, 'mt-1.5') : ''}
                </div>

                <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 -mr-0.5 -mt-0.5">
                    <button type="button" onclick="editProductName('${productId}', ${orderId}, '${escapeHtml(orderCode)}')" class="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Chỉnh sửa">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                        </svg>
                    </button>
                    <button type="button" onclick="confirmDeleteProduct(${orderId}, ${index}, '${escapeHtml(orderCode)}')" class="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Xóa">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                    </button>
                </div>
            </div>
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
        text.textContent = `+${count} sản phẩm khác`;
    }
}

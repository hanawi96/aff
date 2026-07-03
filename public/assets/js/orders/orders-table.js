// Orders Table Rendering Functions
// Extracted from orders.js for better code organization
// NOTE: All functions remain at global scope for backward compatibility
// DEPENDENCIES: Uses global variables from orders.js (filteredOrdersData, currentPage, itemsPerPage)

// ============================================
// RENDER ORDERS TABLE
// ============================================

/**
 * Cache customer statistics for performance
 * Calculated once before rendering table
 */
let customerStatsCache = {};

/**
 * Build customer statistics cache
 */
function buildCustomerStatsCache() {
    customerStatsCache = {};
    
    allOrdersData.forEach(order => {
        const phone = order.customer_phone;
        if (!phone) return;
        
        if (!customerStatsCache[phone]) {
            customerStatsCache[phone] = {
                count: 0,
                totalSpent: 0
            };
        }
        
        customerStatsCache[phone].count++;
        customerStatsCache[phone].totalSpent += (order.total_amount || 0);
    });
}

/**
 * Get customer badge info from cache
 */
function getCustomerBadge(customerPhone) {
    if (!customerPhone || !customerStatsCache[customerPhone]) {
        return '';
    }
    
    const stats = customerStatsCache[customerPhone];
    const orderCount = stats.count;
    const totalSpent = stats.totalSpent;
    
    let badgeClass = '';
    let badgeBorder = '';
    let badgeText = '';
    
    if (orderCount === 1) {
        badgeClass = 'bg-blue-100 text-blue-700';
        badgeBorder = 'border-blue-200/80';
        badgeText = 'Mới';
    } else if (orderCount === 2) {
        badgeClass = 'bg-purple-100 text-purple-700';
        badgeBorder = 'border-purple-200/80';
        badgeText = 'Quen';
    } else if (orderCount >= 3 && orderCount <= 9) {
        badgeClass = 'bg-yellow-100 text-yellow-700';
        badgeBorder = 'border-yellow-200/80';
        badgeText = 'VIP';
    } else if (orderCount >= 10) {
        badgeClass = 'bg-orange-100 text-orange-700';
        badgeBorder = 'border-orange-200/80';
        badgeText = 'Thân thiết';
    }
    
    return `<span class="inline-flex items-center px-1.5 py-0.5 rounded-full font-semibold leading-none border ${badgeClass} ${badgeBorder}" style="font-size:10px" title="${orderCount} đơn hàng • ${formatCurrency(totalSpent)}">${badgeText}</span>`;
}

/**
 * Render orders table with current filtered data
 * @param {{ skipRowAnimation?: boolean }} [options]
 */
function renderOrdersTable(options = {}) {
    const tbody = document.getElementById('ordersTableBody');

    if (!tbody) {
        console.error('Table body not found');
        return;
    }

    if (filteredOrdersData.length === 0) {
        showEmptyState();
        return;
    }

    // Build customer stats cache once before rendering
    buildCustomerStatsCache();

    tbody.innerHTML = '';

    // Calculate pagination
    const totalPages = Math.ceil(filteredOrdersData.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredOrdersData.slice(startIndex, endIndex);

    // Render rows for current page
    pageData.forEach((order, index) => {
        const globalIndex = startIndex + index + 1;
        const row = createOrderRow(order, globalIndex, index, pageData.length, options);
        tbody.appendChild(row);
    });

    // Render pagination
    renderPagination(totalPages);

    syncOrderTableSelection();
    showTable();
}

/**
 * Chỉ cập nhật trạng thái checkbox — không rebuild bảng (dùng khi chỉ đổi selection).
 */
function syncOrderTableSelection() {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;

    const checkboxes = tbody.querySelectorAll('.order-checkbox');
    checkboxes.forEach((cb) => {
        const orderId = Number(cb.dataset.orderId);
        cb.checked = selectedOrderIds.has(orderId);
    });

    const selectAllCb = document.getElementById('selectAllCheckbox');
    if (selectAllCb) {
        selectAllCb.checked = checkboxes.length > 0 && Array.from(checkboxes).every((cb) => cb.checked);
    }
}

// ============================================
// CREATE ORDER ROW
// ============================================

/**
 * Create a single order row element
 */
function createOrderRow(order, index, pageIndex, totalPageItems, options = {}) {
    const tr = document.createElement('tr');
    tr.className = options.skipRowAnimation ? 'transition-colors' : 'transition-colors fade-in';
    tr.setAttribute('data-order-id', order.id);
    
    // Apply priority styling
    const isPriority = order.is_priority === 1;

    if (isPriority) {
        tr.classList.add('bg-yellow-50', 'hover:bg-yellow-100');
        tr.style.borderLeft = '4px solid #facc15'; // yellow-400
    } else {
        tr.classList.add('hover:bg-gray-50');
    }

    // STT with Checkbox (removed priority star icon)
    const tdIndex = document.createElement('td');
    tdIndex.className = 'px-4 py-4 whitespace-nowrap text-center';
    tdIndex.innerHTML = `
        <div class="flex items-center justify-center gap-2">
            <input type="checkbox" 
                   class="order-checkbox w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 cursor-pointer" 
                   data-order-id="${order.id}"
                   ${selectedOrderIds.has(Number(order.id)) ? 'checked' : ''}
                   onchange="handleOrderCheckbox(${order.id}, this.checked)">
            <span class="text-sm text-gray-500">${index}</span>
        </div>
    `;

    // Mã đơn với icon CTV và Status Badge
    const tdOrderId = document.createElement('td');
    tdOrderId.className = 'px-4 py-4 whitespace-nowrap text-center';

    // Use commission directly from database
    const displayCommission = order.commission || 0;

    // Show commission rate if available
    let commissionRateDisplay = '';
    if (order.referral_code && order.ctv_commission_rate !== undefined && order.ctv_commission_rate !== null) {
        commissionRateDisplay = `
        <div class="text-xs text-gray-500 mt-1">
            Tỷ lệ: ${(order.ctv_commission_rate * 100).toFixed(1)}%
        </div>`;
    }

    // Determine tooltip position: show above for last 3 items, below for others
    const isNearBottom = pageIndex > totalPageItems - 3;
    const tooltipPositionClass = isNearBottom ? 'bottom-full mb-2' : 'top-full mt-2';

    const ctvIcon = order.referral_code ? `
        <div class="relative group inline-block">
            <div onclick="showCollaboratorModal('${escapeHtml(order.referral_code)}')" class="w-5 h-5 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform">
                <svg class="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path fill-rule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clip-rule="evenodd" />
                </svg>
            </div>
            <!-- Tooltip -->
            <div class="absolute left-0 ${tooltipPositionClass} hidden group-hover:block z-[9999] w-52 pointer-events-none">
                <div class="bg-white rounded-lg shadow-xl border border-gray-200 p-3 text-xs">
                    <div class="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
                        <svg class="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                            <path fill-rule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clip-rule="evenodd" />
                        </svg>
                        <span class="font-semibold text-gray-900">Đơn từ CTV</span>
                    </div>
                    <div class="space-y-1.5">
                        <div class="flex items-center justify-between">
                            <span class="text-gray-600">Mã CTV:</span>
                            <span class="font-semibold text-blue-600">${escapeHtml(order.referral_code)}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-gray-600">Hoa hồng:</span>
                            <span class="font-bold text-orange-600">${formatCurrency(displayCommission)}</span>
                        </div>
                        ${commissionRateDisplay}
                    </div>
                </div>
            </div>
        </div>
    ` : '';

    let shippedTimeBlock = '';
    const onShippedListFilter = (document.getElementById('statusFilter')?.value || '') === 'shipped';
    if (orderShouldShowShipTime(order) && !onShippedListFilter) {
        const shipParts = formatOrderTimeDisplayParts(order.shipped_at_unix);
        const shipMain = escapeHtml(shipParts.main);
        const shipTitle = escapeHtml(shipParts.title);
        const shipBody = shipParts.isRelative
            ? `<span class="text-sm font-semibold text-blue-700 leading-tight" title="${shipTitle}">${shipMain}</span>`
            : (() => {
                const hm = shipParts.main.slice(0, 5);
                const line = `${hm} - ${shipParts.sub}`;
                return `<span class="text-xs text-sky-700 font-medium leading-tight whitespace-nowrap text-center">${escapeHtml(line)}</span>`;
            })();
        shippedTimeBlock = `
            <div class="mt-2 pt-2 border-t border-gray-100 w-full max-w-[9rem] mx-auto flex flex-col items-center gap-0.5">
                <span class="text-[0.65rem] text-blue-600 uppercase tracking-wide font-medium">Gửi</span>
                ${shipBody}
            </div>`;
    }

    tdOrderId.innerHTML = `
        <div class="flex flex-col gap-2 items-center">
            <div class="flex items-center gap-2">
                ${ctvIcon}
                <span class="text-sm font-mono font-semibold text-gray-900">${escapeHtml(order.order_id || 'N/A')}</span>
                <button onclick="copyToClipboard('${escapeHtml(order.order_id || '')}')" class="text-gray-400 hover:text-gray-600">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                </button>
            </div>
            ${getStatusBadge(order.status, order.id, order.order_id, order)}
            ${shippedTimeBlock}
        </div>
    `;

    // Khách & giao hàng (gộp thông tin khách + địa chỉ)
    const tdDelivery = document.createElement('td');
    tdDelivery.className = 'px-4 py-3 text-left align-top';
    tdDelivery.style.minWidth = '280px';
    tdDelivery.style.maxWidth = '380px';

    const customerId = `customer_${order.id}`;
    const customerBadge = getCustomerBadge(order.customer_phone);
    const sourceBadge = typeof renderCustomerSourceBadgeHtml === 'function'
        ? renderCustomerSourceBadgeHtml(order.customer_source ?? order.customerSource)
        : '';

    const phoneCopyBtn = order.customer_phone
        ? `<button type="button" onclick="event.stopPropagation(); copyToClipboard(decodeURIComponent(this.getAttribute('data-phone') || ''))" data-phone="${encodeURIComponent(order.customer_phone)}" title="Copy số điện thoại" class="inline-flex text-gray-400 hover:text-gray-600 flex-shrink-0" aria-label="Copy số điện thoại">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
            </button>`
        : '';

    let address = '';
    if (window.addressSelector?.loaded) {
        address = window.addressSelector.formatOrderDisplayAddress(order);
    } else {
        const parts = [order.street_address, order.ward_name, order.district_name, order.province_name].filter(Boolean);
        address = parts.join(', ') || order.address || '';
    }
    if (!address) address = order.address || '';
    const hasAddress = !!String(address).trim();
    const addressTitle = escapeHtml(hasAddress ? address : 'Chưa có địa chỉ');
    const addressBody = hasAddress
        ? escapeHtml(address)
        : '<span class="italic text-amber-600">Chưa có địa chỉ</span>';

    tdDelivery.innerHTML = `
        <div class="min-w-0">
            <div id="${customerId}" class="group cursor-pointer rounded-t-lg hover:bg-blue-50 transition-colors" onclick="editCustomerInfo(${order.id}, '${escapeHtml(order.order_id)}')">
                <div class="flex items-start gap-1.5 px-2 py-1.5 -mx-2">
                    <div class="flex-1 min-w-0">
                        <div class="flex flex-wrap items-center gap-1.5">
                            <span class="text-sm font-semibold text-gray-900">${escapeHtml(titleCaseCustomerName(order.customer_name) || 'N/A')}</span>
                            ${sourceBadge}
                            ${customerBadge}
                        </div>
                    </div>
                    <span class="opacity-0 group-hover:opacity-100 transition-opacity text-blue-600 flex-shrink-0 p-0.5" title="Chỉnh sửa thông tin khách hàng">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </span>
                </div>
                <div class="flex items-center gap-1 border-t border-gray-100 px-2 py-1.5 -mx-2">
                    <svg class="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                    </svg>
                    <span class="text-gray-500 tabular-nums" style="font-size:13px">${escapeHtml(order.customer_phone || 'Chưa có SĐT')}</span>
                    ${phoneCopyBtn}
                </div>
            </div>
            <div class="group flex items-start gap-1.5 cursor-pointer border-t border-gray-100 px-2 py-1.5 -mx-2 rounded-b-lg hover:bg-amber-50 transition-colors" onclick="editAddress(${order.id}, '${escapeHtml(order.order_id)}')">
                <svg class="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p class="text-gray-600 line-clamp-2 text-left flex-1 min-w-0 leading-snug" style="font-size:13px" title="${addressTitle}">
                    ${addressBody}
                </p>
                <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pt-0.5">
                    ${hasAddress ? `<button type="button" data-addr="${escapeHtml(address)}" onclick="event.stopPropagation();copyAddressText(this)" class="p-0.5 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="Sao chép địa chỉ">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                    </button>` : ''}
                    <span class="p-0.5 rounded text-amber-600" title="Chỉnh sửa địa chỉ">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </span>
                </div>
            </div>
        </div>
    `;

    // Sản phẩm
    const tdProducts = document.createElement('td');
    tdProducts.className = 'px-3 py-3 text-left align-top';
    tdProducts.style.minWidth = '400px';
    tdProducts.style.width = '38%';
    tdProducts.innerHTML = formatProductsDisplay(order.products, order.id, order.order_id, order.notes);

    // Giá trị (Total Amount - Doanh thu)
    const tdAmount = document.createElement('td');
    tdAmount.className = 'px-4 py-4 whitespace-nowrap text-center group';
    const paymentApiKey = orderPaymentApiKey(order.payment_method);
    
    // Calculate total amount (doanh thu)
    const shippingFee = order.shipping_fee || 0;
    const discountAmount = order.discount_amount || 0;
    let totalAmount = order.total_amount || 0;
    
    // Fallback: If total_amount is 0 or suspiciously low, recalculate
    if (totalAmount === 0 && order.product_total) {
        totalAmount = (order.product_total || 0) + shippingFee - discountAmount;
    }
    
    // Determine color based on payment method (bank và bank_transfer đều là CK)
    const isBankTransfer = paymentApiKey === 'bank';
    const depositAmount = getOrderDepositAmount(order);
    const codCollect = getOrderCodCollectAmount(order);

    const amountColor = isBankTransfer ? 'text-green-600' : 'text-gray-900';
    const payPillClass = isBankTransfer
        ? 'text-[10px] font-medium text-green-700 bg-green-50 px-1.5 py-px rounded'
        : 'text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-px rounded';
    const payPillLabel = isBankTransfer ? 'CK' : 'COD';

    let amountSubLine = '';
    if (!isBankTransfer && depositAmount > 0) {
        amountSubLine = `<p class="text-[11px] text-orange-600 font-medium leading-tight mt-0.5 tabular-nums">cọc ${formatCurrency(depositAmount)} → thu ${formatCurrency(codCollect)}</p>`;
    }

    tdAmount.innerHTML = `
        <div class="flex flex-col items-center gap-0.5">
            <div class="inline-flex items-center gap-1">
                <div class="flex flex-col items-center">
                    <div class="inline-flex items-center gap-1.5">
                        <span class="text-sm font-semibold tabular-nums ${amountColor}">${formatCurrency(totalAmount)}</span>
                        <span class="${payPillClass}">${payPillLabel}</span>
                    </div>
                    ${amountSubLine}
                </div>
                <button type="button"
                    onclick="editOrderPaymentSummary(${order.id}, '${escapeHtml(order.order_id)}')"
                    class="order-amount-edit-btn p-1 rounded-md text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity shrink-0"
                    title="Sửa thanh toán &amp; giá trị">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </button>
            </div>
        </div>
    `;

    // Lãi ròng
    const tdProfit = document.createElement('td');
    tdProfit.className = 'px-4 py-4 whitespace-nowrap text-center';
    const profit = calculateOrderProfit(order);
    const profitColor = profit > 0 ? 'text-emerald-600' : profit < 0 ? 'text-red-600' : 'text-gray-600';
    const profitBg = profit > 0 ? 'bg-emerald-50' : profit < 0 ? 'bg-red-50' : 'bg-gray-50';
    tdProfit.innerHTML = `
        <div class="flex flex-col items-center gap-1">
            <span class="text-sm font-bold ${profitColor} px-2 py-1 ${profitBg} rounded">${formatCurrency(profit)}</span>
            <button onclick="showProfitBreakdown(${order.id})" class="text-xs text-gray-500 hover:text-gray-700 underline" title="Xem chi tiết">
                Chi tiết
            </button>
        </div>
    `;

    // Ngày đặt (thời gian gửi nằm cột Mã đơn)
    const tdDate = document.createElement('td');
    tdDate.className = 'px-4 py-4 text-sm text-gray-500 text-center';
    const tsPlace = order.created_at_unix || order.created_at || order.order_date;
    const placeParts = formatOrderTimeDisplayParts(tsPlace);
    const placeMain = escapeHtml(placeParts.main);
    const placeSub = escapeHtml(placeParts.sub);
    const placeTitle = escapeHtml(placeParts.title);
    tdDate.innerHTML = placeParts.isRelative
        ? `<div style="display: flex; flex-direction: column; align-items: center; gap: 2px;" title="${placeTitle}">
            <span style="font-weight: 600; color: #374151; font-size: 0.875rem;">${placeMain}</span>
        </div>`
        : `<div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
            <span style="font-weight: 600; color: #374151; font-size: 0.875rem;">${placeMain}</span>
            <span style="font-size: 0.75rem; color: #9CA3AF;">${placeSub}</span>
        </div>`;

    // Thao tác
    const tdActions = document.createElement('td');
    tdActions.className = 'px-4 py-4 whitespace-nowrap text-center text-sm font-medium';
    
    // Determine star icon based on priority status
    const starIcon = isPriority ? `
        <button onclick="toggleOrderPriority(${order.id}, ${order.is_priority || 0})" 
            class="text-yellow-500 hover:text-yellow-600 transition-all hover:scale-110" 
            title="Bỏ đánh dấu ưu tiên">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
        </button>
    ` : `
        <button onclick="toggleOrderPriority(${order.id}, ${order.is_priority || 0})" 
            class="text-gray-400 hover:text-yellow-500 transition-all hover:scale-110" 
            title="Đánh dấu ưu tiên">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 20 20" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
        </button>
    `;
    
    tdActions.innerHTML = `
        <div class="flex items-center justify-center gap-2">
            ${starIcon}
            <button onclick="copySPXFormat(${order.id})" 
                class="text-purple-600 hover:text-purple-700 transition-colors" title="Copy format SPX">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            </button>
            <button onclick="editFullOrder(${order.id})" 
                class="text-blue-600 hover:text-blue-700 transition-colors" title="Sửa toàn bộ đơn (cùng form tạo đơn)">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
            </button>
            <button onclick="duplicateOrder(${order.id})" 
                class="text-green-600 hover:text-green-700 transition-colors" title="Nhân bản đơn hàng">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
            </button>
            <button onclick="confirmDeleteOrder(${order.id}, '${escapeHtml(order.order_id)}')" 
                class="text-red-500 hover:text-red-700 transition-colors" title="Xóa đơn hàng">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </button>
        </div>
    `;

    tr.appendChild(tdIndex);
    tr.appendChild(tdOrderId);
    tr.appendChild(tdDelivery);
    tr.appendChild(tdProducts);
    tr.appendChild(tdAmount);
    tr.appendChild(tdProfit);
    tr.appendChild(tdDate);
    tr.appendChild(tdActions);

    return tr;
}

function copyAddressText(btn) {
    const addr = btn.getAttribute('data-addr');
    if (!addr) return;
    navigator.clipboard.writeText(addr).then(() => {
        const orig = btn.innerHTML;
        btn.innerHTML = `<svg class="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`;
        setTimeout(() => { btn.innerHTML = orig; }, 1500);
        showToast('Đã sao chép địa chỉ', 'success', 2000);
    }).catch(() => {
        showToast('Không thể sao chép', 'error', 2000);
    });
}

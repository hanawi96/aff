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
    let badgeText = '';
    
    if (orderCount === 1) {
        badgeClass = 'bg-blue-100 text-blue-700';
        badgeText = 'Mới';
    } else if (orderCount === 2) {
        badgeClass = 'bg-purple-100 text-purple-700';
        badgeText = 'Quen';
    } else if (orderCount >= 3 && orderCount <= 9) {
        badgeClass = 'bg-yellow-100 text-yellow-700';
        badgeText = 'VIP';
    } else if (orderCount >= 10) {
        badgeClass = 'bg-orange-100 text-orange-700';
        badgeText = 'Thân thiết';
    }
    
    return `<span class="text-xs px-2 py-0.5 rounded-full ${badgeClass} font-medium" title="${orderCount} đơn hàng • ${formatCurrency(totalSpent)}">${badgeText}</span>`;
}

/**
 * Render orders table with current filtered data
 */
function renderOrdersTable() {
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
        const row = createOrderRow(order, globalIndex, index, pageData.length);
        tbody.appendChild(row);
    });

    // Render pagination
    renderPagination(totalPages);

    showTable();
}

// ============================================
// CREATE ORDER ROW
// ============================================

/**
 * Create a single order row element
 */
function createOrderRow(order, index, pageIndex, totalPageItems) {
    const tr = document.createElement('tr');
    tr.className = 'transition-colors fade-in';
    tr.setAttribute('data-order-id', order.id);
    
    // Apply priority styling
    const isPriority = order.is_priority === 1;
    if (isPriority) {
        tr.classList.add('bg-yellow-50', 'hover:bg-yellow-100');
        // Use inline style to ensure border is applied
        tr.style.borderLeft = '4px solid #facc15'; // yellow-400
    } else {
        tr.classList.add('hover:bg-gray-50');
    }

    // STT with Checkbox and Priority Star (only show star for priority orders)
    const tdIndex = document.createElement('td');
    tdIndex.className = 'px-4 py-4 whitespace-nowrap text-center';
    tdIndex.innerHTML = `
        <div class="flex items-center justify-center gap-2">
            ${isPriority ? `
                <button onclick="toggleOrderPriority(${order.id}, ${order.is_priority || 0})" 
                        class="priority-icon hover:scale-110 transition-transform cursor-pointer"
                        data-priority-order-id="${order.id}"
                        title="Đơn ưu tiên - Click để bỏ đánh dấu">
                    <svg class="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                </button>
            ` : ''}
            <input type="checkbox" 
                   class="order-checkbox w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 cursor-pointer" 
                   data-order-id="${order.id}"
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
            ${getStatusBadge(order.status, order.id, order.order_id)}
        </div>
    `;

    // Khách hàng
    const tdCustomer = document.createElement('td');
    tdCustomer.className = 'px-4 py-4 whitespace-nowrap text-center';
    const customerId = `customer_${order.id}`;
    
    // Get customer badge from cache (already calculated)
    const customerBadge = getCustomerBadge(order.customer_phone);
    
    tdCustomer.innerHTML = `
        <div id="${customerId}" class="group cursor-pointer hover:bg-blue-50 rounded-lg px-3 py-2 -mx-3 -my-2 transition-colors" onclick="editCustomerInfo(${order.id}, '${escapeHtml(order.order_id)}')">
            <div class="flex items-center gap-2">
                <div class="flex-1">
                    <div class="flex items-center gap-2 justify-center">
                        <div class="text-sm font-medium text-gray-900">${escapeHtml(order.customer_name || 'N/A')}</div>
                        ${customerBadge}
                    </div>
                    <div class="text-sm text-gray-500">${escapeHtml(order.customer_phone || 'N/A')}</div>
                </div>
                <button class="opacity-0 group-hover:opacity-100 transition-opacity text-blue-600 hover:text-blue-700 flex-shrink-0" title="Chỉnh sửa thông tin khách hàng">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </button>
            </div>
        </div>
    `;

    // Sản phẩm
    const tdProducts = document.createElement('td');
    tdProducts.className = 'px-4 py-4 text-center';
    tdProducts.innerHTML = formatProductsDisplay(order.products, order.id, order.order_id, order.notes);

    // Địa chỉ
    const tdAddress = document.createElement('td');
    tdAddress.className = 'px-4 py-4 text-center';
    tdAddress.style.minWidth = '350px';
    tdAddress.style.maxWidth = '500px';
    const address = order.address || 'Chưa có địa chỉ';
    tdAddress.innerHTML = `
        <div class="group cursor-pointer hover:bg-amber-50 rounded-lg px-3 py-2 -mx-3 -my-2 transition-colors relative" onclick="editAddress(${order.id}, '${escapeHtml(order.order_id)}')">
            <p class="text-sm text-gray-700 line-clamp-3 pr-6 text-left" title="${escapeHtml(address)}">
                ${escapeHtml(address)}
            </p>
            <button class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-amber-600 hover:text-amber-700" title="Chỉnh sửa địa chỉ">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
            </button>
        </div>
    `;

    // Giá trị (Total Amount - Doanh thu)
    const tdAmount = document.createElement('td');
    tdAmount.className = 'px-4 py-4 whitespace-nowrap text-center';
    const paymentMethod = order.payment_method || 'cod';
    
    // Calculate total amount (doanh thu)
    const shippingFee = order.shipping_fee || 0;
    const discountAmount = order.discount_amount || 0;
    let totalAmount = order.total_amount || 0;
    
    // Fallback: If total_amount is 0 or suspiciously low, recalculate
    if (totalAmount === 0 && order.product_total) {
        totalAmount = (order.product_total || 0) + shippingFee - discountAmount;
    }
    
    // Determine color based on payment method
    const isBankTransfer = paymentMethod === 'bank';
    
    tdAmount.innerHTML = `
        <div class="flex flex-col gap-1.5 items-center">
            <div class="group cursor-pointer hover:bg-green-50 rounded-lg px-3 py-2 transition-colors inline-flex items-center gap-2" onclick="editAmount(${order.id}, '${escapeHtml(order.order_id)}')">
                <span class="text-sm font-bold ${isBankTransfer ? 'text-green-600' : 'text-orange-600'}">${formatCurrency(totalAmount)}</span>
                <button class="opacity-0 group-hover:opacity-100 transition-opacity ${isBankTransfer ? 'text-green-600 hover:text-green-700' : 'text-orange-600 hover:text-orange-700'}" title="Chỉnh sửa giá trị">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </button>
            </div>
            <div class="text-xs ${isBankTransfer ? 'text-green-600 font-medium' : 'text-gray-500'}">
                ${isBankTransfer ? 'bank' : 'cod'}
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

    // Ngày đặt
    const tdDate = document.createElement('td');
    tdDate.className = 'px-4 py-4 text-sm text-gray-500 text-center';
    const dateTimeObj = formatDateTimeSplit(order.created_at || order.order_date);
    tdDate.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
            <span style="font-weight: 600; color: #374151; font-size: 0.875rem;">${dateTimeObj.time}</span>
            <span style="font-size: 0.75rem; color: #9CA3AF;">${dateTimeObj.date}</span>
        </div>
    `;

    // Thao tác
    const tdActions = document.createElement('td');
    tdActions.className = 'px-4 py-4 whitespace-nowrap text-center text-sm font-medium';
    tdActions.innerHTML = `
        <div class="flex items-center justify-center gap-2">
            <button onclick="copySPXFormat(${order.id})" 
                class="text-purple-600 hover:text-purple-700 transition-colors" title="Copy format SPX">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            </button>
            <button onclick="viewOrderDetail(${order.id})" 
                class="text-admin-primary hover:text-admin-secondary transition-colors" title="Xem chi tiết">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
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
    tr.appendChild(tdCustomer);
    tr.appendChild(tdProducts);
    tr.appendChild(tdAddress);
    tr.appendChild(tdAmount);
    tr.appendChild(tdProfit);
    tr.appendChild(tdDate);
    tr.appendChild(tdActions);

    return tr;
}

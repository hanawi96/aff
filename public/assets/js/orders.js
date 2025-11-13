// Orders Dashboard JavaScript
let allOrdersData = [];
let filteredOrdersData = [];
let currentPage = 1;
const itemsPerPage = 15;
let dateSortOrder = 'desc'; // 'desc' = mới nhất trước, 'asc' = cũ nhất trước, 'none' = không sắp xếp
let amountSortOrder = 'none'; // 'desc' = cao nhất trước, 'asc' = thấp nhất trước, 'none' = không sắp xếp

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 Orders Dashboard initialized');
    loadOrdersData();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(filterOrdersData, 300));
    }

    // Date filter
    const dateFilter = document.getElementById('dateFilter');
    if (dateFilter) {
        dateFilter.addEventListener('change', filterOrdersData);
    }
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Load orders data from API
async function loadOrdersData() {
    try {
        showLoading();

        const response = await fetch(`${CONFIG.API_URL}?action=getRecentOrders&limit=1000&timestamp=${Date.now()}`);

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        console.log('📊 Received orders data:', data);

        if (data.success) {
            allOrdersData = data.orders || [];
            filteredOrdersData = [...allOrdersData];

            // Apply default sorting (newest first)
            applySorting();
            updateDateSortIcon();
            updateAmountSortIcon();

            updateStats();
            renderOrdersTable();
            hideLoading();
        } else {
            throw new Error(data.error || 'Failed to load data');
        }

    } catch (error) {
        console.error('❌ Error loading orders data:', error);
        hideLoading();
        showError('Không thể tải dữ liệu. Vui lòng thử lại sau.');
    }
}

// Update statistics
function updateStats() {
    const totalOrders = allOrdersData.length;
    const totalRevenue = allOrdersData.reduce((sum, order) => sum + (order.total_amount || 0), 0);
    const totalCommission = allOrdersData.reduce((sum, order) => sum + (order.commission || 0), 0);

    // Get today's orders
    const today = new Date().toISOString().split('T')[0];
    const todayOrders = allOrdersData.filter(order => {
        if (!order.created_at) return false;
        const orderDate = new Date(order.created_at).toISOString().split('T')[0];
        return orderDate === today;
    }).length;

    // Update stats - Remove skeleton and add text
    updateStatElement('totalOrders', totalOrders, 'text-3xl font-bold text-blue-600');
    updateStatElement('totalRevenue', formatCurrency(totalRevenue), 'text-3xl font-bold text-green-600');
    updateStatElement('totalCommission', formatCurrency(totalCommission), 'text-3xl font-bold text-orange-600');
    updateStatElement('todayOrders', todayOrders, 'text-3xl font-bold text-purple-600');
}

// Helper function to update stat element
function updateStatElement(elementId, value, className) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.remove('skeleton', 'h-10', 'w-16', 'w-24', 'rounded');
        element.className = className;
        element.textContent = value;
    }
}

// Render orders table
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

    tbody.innerHTML = '';

    // Calculate pagination
    const totalPages = Math.ceil(filteredOrdersData.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredOrdersData.slice(startIndex, endIndex);

    // Render rows for current page
    pageData.forEach((order, index) => {
        const globalIndex = startIndex + index + 1;
        const row = createOrderRow(order, globalIndex);
        tbody.appendChild(row);
    });

    // Render pagination
    renderPagination(totalPages);

    showTable();
}

// Create order row
function createOrderRow(order, index) {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50 transition-colors fade-in';

    // STT
    const tdIndex = document.createElement('td');
    tdIndex.className = 'px-4 py-4 whitespace-nowrap text-sm text-gray-500';
    tdIndex.textContent = index;

    // Mã đơn với icon CTV
    const tdOrderId = document.createElement('td');
    tdOrderId.className = 'px-4 py-4 whitespace-nowrap';

    // Tạo icon CTV nếu có referral_code
    const ctvIcon = order.referral_code ? `
        <div class="relative group inline-block">
            <div onclick="showCollaboratorModal('${escapeHtml(order.referral_code)}')" class="w-5 h-5 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform">
                <svg class="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path fill-rule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clip-rule="evenodd" />
                </svg>
            </div>
            <!-- Tooltip -->
            <div class="absolute left-0 top-full mt-2 hidden group-hover:block z-50 w-48 pointer-events-none">
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
                            <span class="font-bold text-orange-600">${formatCurrency(order.commission || 0)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    ` : '';

    tdOrderId.innerHTML = `
        <div class="flex items-center gap-2">
            ${ctvIcon}
            <span class="text-sm font-mono font-semibold text-gray-900">${escapeHtml(order.order_id || 'N/A')}</span>
            <button onclick="copyToClipboard('${escapeHtml(order.order_id || '')}')" class="text-gray-400 hover:text-gray-600">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
            </button>
        </div>
    `;

    // Khách hàng
    const tdCustomer = document.createElement('td');
    tdCustomer.className = 'px-4 py-4 whitespace-nowrap';
    const customerId = `customer_${order.id}`;
    tdCustomer.innerHTML = `
        <div id="${customerId}" class="group cursor-pointer hover:bg-blue-50 rounded-lg px-3 py-2 -mx-3 -my-2 transition-colors" onclick="editCustomerInfo(${order.id}, '${escapeHtml(order.order_id)}')">
            <div class="flex items-center gap-2">
                <div class="flex-1">
                    <div class="text-sm font-medium text-gray-900">${escapeHtml(order.customer_name || 'N/A')}</div>
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

    // Sản phẩm - Thiết kế đẹp với badges
    const tdProducts = document.createElement('td');
    tdProducts.className = 'px-4 py-4';
    tdProducts.innerHTML = formatProductsDisplay(order.products, order.id, order.order_id);

    // Địa chỉ
    const tdAddress = document.createElement('td');
    tdAddress.className = 'px-4 py-4';
    const address = order.address || 'Chưa có địa chỉ';
    tdAddress.innerHTML = `
        <div class="group cursor-pointer hover:bg-amber-50 rounded-lg px-3 py-2 -mx-3 -my-2 transition-colors relative" onclick="editAddress(${order.id}, '${escapeHtml(order.order_id)}')">
            <p class="text-sm text-gray-700 line-clamp-3 pr-6" title="${escapeHtml(address)}">
                ${escapeHtml(address)}
            </p>
            <button class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-amber-600 hover:text-amber-700" title="Chỉnh sửa địa chỉ">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
            </button>
        </div>
    `;

    // Giá trị
    const tdAmount = document.createElement('td');
    tdAmount.className = 'px-4 py-4 whitespace-nowrap';
    tdAmount.innerHTML = `
        <div class="group cursor-pointer hover:bg-green-50 rounded-lg px-3 py-2 -mx-3 -my-2 transition-colors inline-flex items-center gap-2" onclick="editAmount(${order.id}, '${escapeHtml(order.order_id)}')">
            <span class="text-sm font-bold text-green-600">${formatCurrency(order.total_amount || 0)}</span>
            <button class="opacity-0 group-hover:opacity-100 transition-opacity text-green-600 hover:text-green-700" title="Chỉnh sửa giá trị">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
            </button>
        </div>
    `;

    // Ngày đặt
    const tdDate = document.createElement('td');
    tdDate.className = 'px-4 py-4 whitespace-nowrap text-sm text-gray-500';
    tdDate.textContent = formatDateTime(order.created_at || order.order_date);

    // Thao tác
    const tdActions = document.createElement('td');
    tdActions.className = 'px-4 py-4 whitespace-nowrap text-center text-sm font-medium';
    tdActions.innerHTML = `
        <div class="flex items-center justify-center gap-2">
            <button onclick="viewOrderDetail(${order.id})" 
                class="text-admin-primary hover:text-admin-secondary transition-colors" title="Xem chi tiết">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
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
    tr.appendChild(tdDate);
    tr.appendChild(tdActions);

    return tr;
}

// Format products display with beautiful badges
function formatProductsDisplay(productsText, orderId, orderCode) {
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

    let html = '<div class="flex flex-col gap-1.5 max-w-xs">';

    // Hiển thị 3 sản phẩm đầu tiên
    displayProducts.forEach(product => {
        const productName = typeof product === 'string' ? product : (product.name || 'Sản phẩm');
        const quantity = typeof product === 'object' && product.quantity ? product.quantity : 1;
        const weight = typeof product === 'object' && product.weight ? product.weight : null;
        const size = typeof product === 'object' && product.size ? product.size : null;

        // Tạo text chi tiết (cân nặng và size)
        const details = [];
        if (weight) details.push(weight);
        if (size) details.push(size);
        const detailsText = details.length > 0 ? details.join(' • ') : '';

        const productId = `product_${orderId}_${Math.random().toString(36).substr(2, 9)}`;
        html += `
            <div class="flex flex-col gap-1 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg px-3 py-2 border border-purple-100 group">
                <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-purple-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                    </svg>
                    <span id="${productId}" class="text-xs font-medium text-gray-700 flex-1 truncate cursor-text" title="${escapeHtml(productName)}" onclick="editProductName('${productId}', ${orderId}, '${escapeHtml(orderCode)}')">
                        ${escapeHtml(productName)}
                    </span>
                    <button onclick="editProductName('${productId}', ${orderId}, '${escapeHtml(orderCode)}')" class="opacity-0 group-hover:opacity-100 transition-opacity text-blue-600 hover:text-blue-700 flex-shrink-0" title="Chỉnh sửa tên sản phẩm">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    ${quantity > 1 ? `
                        <span class="inline-flex items-center justify-center px-2 h-6 text-xs font-bold text-white bg-purple-500 rounded-full flex-shrink-0">
                            x${quantity}
                        </span>
                    ` : ''}
                </div>
                ${detailsText ? `
                    <div class="flex items-center gap-1.5 text-xs text-gray-600 pl-6">
                        <svg class="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>${detailsText}</span>
                    </div>
                ` : ''}
            </div>
        `;
    });

    // Container cho các sản phẩm còn lại (ẩn mặc định)
    if (remainingCount > 0) {
        html += `<div id="${uniqueId}_hidden" class="hidden flex flex-col gap-1.5">`;

        remainingProducts.forEach(product => {
            const productName = typeof product === 'string' ? product : (product.name || 'Sản phẩm');
            const quantity = typeof product === 'object' && product.quantity ? product.quantity : 1;
            const weight = typeof product === 'object' && product.weight ? product.weight : null;
            const size = typeof product === 'object' && product.size ? product.size : null;

            // Tạo text chi tiết (cân nặng và size)
            const details = [];
            if (weight) details.push(weight);
            if (size) details.push(size);
            const detailsText = details.length > 0 ? details.join(' • ') : '';

            const productId = `product_${orderId}_${Math.random().toString(36).substr(2, 9)}`;
            html += `
                <div class="flex flex-col gap-1 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg px-3 py-2 border border-purple-100 group">
                    <div class="flex items-center gap-2">
                        <svg class="w-4 h-4 text-purple-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                        </svg>
                        <span id="${productId}" class="text-xs font-medium text-gray-700 flex-1 truncate cursor-text" title="${escapeHtml(productName)}" onclick="editProductName('${productId}', ${orderId}, '${escapeHtml(orderCode)}')">
                            ${escapeHtml(productName)}
                        </span>
                        <button onclick="editProductName('${productId}', ${orderId}, '${escapeHtml(orderCode)}')" class="opacity-0 group-hover:opacity-100 transition-opacity text-blue-600 hover:text-blue-700 flex-shrink-0" title="Chỉnh sửa tên sản phẩm">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        ${quantity > 1 ? `
                            <span class="inline-flex items-center justify-center px-2 h-6 text-xs font-bold text-white bg-purple-500 rounded-full flex-shrink-0">
                                x${quantity}
                            </span>
                        ` : ''}
                    </div>
                    ${detailsText ? `
                        <div class="flex items-center gap-1.5 text-xs text-gray-600 pl-6">
                            <svg class="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>${detailsText}</span>
                        </div>
                    ` : ''}
                </div>
            `;
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

    html += '</div>';
    return html;
}

// Filter orders data
function filterOrdersData() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const dateFilter = document.getElementById('dateFilter').value;

    filteredOrdersData = allOrdersData.filter(order => {
        // Search filter
        const matchesSearch = !searchTerm ||
            (order.order_id && order.order_id.toLowerCase().includes(searchTerm)) ||
            (order.customer_name && order.customer_name.toLowerCase().includes(searchTerm)) ||
            (order.customer_phone && order.customer_phone.includes(searchTerm)) ||
            (order.referral_code && order.referral_code.toLowerCase().includes(searchTerm));

        // Date filter
        let matchesDate = true;
        if (dateFilter !== 'all') {
            const orderDate = new Date(order.created_at || order.order_date);
            const now = new Date();

            if (dateFilter === 'today') {
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                matchesDate = orderDate >= today;
            } else if (dateFilter === 'yesterday') {
                const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                matchesDate = orderDate >= yesterday && orderDate < today;
            } else if (dateFilter === 'week') {
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                matchesDate = orderDate >= weekAgo;
            } else if (dateFilter === 'month') {
                const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                matchesDate = orderDate >= monthAgo;
            }
        }

        return matchesSearch && matchesDate;
    });

    // Apply sorting
    applySorting();

    currentPage = 1; // Reset to first page when filtering
    updateStats(); // Update stats based on filtered data
    renderOrdersTable();
}

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
            <div class="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
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
                        <h3 class="text-lg font-semibold text-gray-900 mb-3">Sản phẩm</h3>
                        <div class="bg-gray-50 rounded-lg p-4">
                            <p class="text-sm text-gray-700 whitespace-pre-wrap">${escapeHtml(order.products)}</p>
                        </div>
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

// Copy to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Đã copy: ' + text);
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}

// Render pagination
function renderPagination(totalPages) {
    const paginationContainer = document.getElementById('paginationContainer');
    if (!paginationContainer) return;

    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    let html = '<div class="flex items-center justify-between px-6 py-4 border-t border-gray-200">';

    // Info text
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, filteredOrdersData.length);
    html += `<div class="text-sm text-gray-700">
        Hiển thị <span class="font-medium">${startItem}</span> đến <span class="font-medium">${endItem}</span> trong tổng số <span class="font-medium">${filteredOrdersData.length}</span> đơn hàng
    </div>`;

    // Pagination buttons
    html += '<div class="flex items-center gap-2">';

    // Previous button
    html += `<button onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} 
        class="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium ${currentPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-50'} transition-colors">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
    </button>`;

    // Page numbers
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    if (startPage > 1) {
        html += `<button onclick="goToPage(1)" class="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">1</button>`;
        if (startPage > 2) {
            html += '<span class="px-2 text-gray-500">...</span>';
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            html += `<button class="px-3 py-2 rounded-lg bg-admin-primary text-white text-sm font-medium">${i}</button>`;
        } else {
            html += `<button onclick="goToPage(${i})" class="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">${i}</button>`;
        }
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += '<span class="px-2 text-gray-500">...</span>';
        }
        html += `<button onclick="goToPage(${totalPages})" class="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">${totalPages}</button>`;
    }

    // Next button
    html += `<button onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} 
        class="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium ${currentPage === totalPages ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-50'} transition-colors">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
    </button>`;

    html += '</div></div>';

    paginationContainer.innerHTML = html;
}

// Go to page
function goToPage(page) {
    const totalPages = Math.ceil(filteredOrdersData.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;

    currentPage = page;
    renderOrdersTable();

    // Scroll to top of table
    document.getElementById('tableContent').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Toggle date sort
function toggleDateSort() {
    // Reset amount sort
    amountSortOrder = 'none';
    updateAmountSortIcon();

    // Cycle through: desc -> asc -> none -> desc
    if (dateSortOrder === 'desc') {
        dateSortOrder = 'asc';
    } else if (dateSortOrder === 'asc') {
        dateSortOrder = 'none';
    } else {
        dateSortOrder = 'desc';
    }

    // Update icon
    updateDateSortIcon();

    // Apply sort
    applySorting();

    // Reset to first page
    currentPage = 1;
    renderOrdersTable();
}

// Toggle amount sort
function toggleAmountSort() {
    // Reset date sort
    dateSortOrder = 'none';
    updateDateSortIcon();

    // Cycle through: desc -> asc -> none -> desc
    if (amountSortOrder === 'desc') {
        amountSortOrder = 'asc';
    } else if (amountSortOrder === 'asc') {
        amountSortOrder = 'none';
    } else {
        amountSortOrder = 'desc';
    }

    // Update icon
    updateAmountSortIcon();

    // Apply sort
    applySorting();

    // Reset to first page
    currentPage = 1;
    renderOrdersTable();
}

// Update date sort icon
function updateDateSortIcon() {
    const icon = document.getElementById('dateSortIcon');
    if (!icon) return;

    if (dateSortOrder === 'desc') {
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />';
        icon.classList.remove('text-gray-400');
        icon.classList.add('text-admin-primary');
    } else if (dateSortOrder === 'asc') {
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />';
        icon.classList.remove('text-gray-400');
        icon.classList.add('text-admin-primary');
    } else {
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />';
        icon.classList.remove('text-admin-primary');
        icon.classList.add('text-gray-400');
    }
}

// Update amount sort icon
function updateAmountSortIcon() {
    const icon = document.getElementById('amountSortIcon');
    if (!icon) return;

    if (amountSortOrder === 'desc') {
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />';
        icon.classList.remove('text-gray-400');
        icon.classList.add('text-green-500');
    } else if (amountSortOrder === 'asc') {
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />';
        icon.classList.remove('text-gray-400');
        icon.classList.add('text-green-500');
    } else {
        icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />';
        icon.classList.remove('text-green-500');
        icon.classList.add('text-gray-400');
    }
}

// Apply sorting
function applySorting() {
    // Ưu tiên sắp xếp theo amount nếu đang active
    if (amountSortOrder !== 'none') {
        filteredOrdersData.sort((a, b) => {
            const amountA = a.total_amount || 0;
            const amountB = b.total_amount || 0;

            if (amountSortOrder === 'desc') {
                return amountB - amountA;
            } else {
                return amountA - amountB;
            }
        });
    } else if (dateSortOrder !== 'none') {
        filteredOrdersData.sort((a, b) => {
            const dateA = new Date(a.created_at || a.order_date || 0);
            const dateB = new Date(b.created_at || b.order_date || 0);

            if (dateSortOrder === 'desc') {
                return dateB - dateA;
            } else {
                return dateA - dateB;
            }
        });
    }
}

// Refresh data
function refreshData() {
    showToast('Đang tải lại dữ liệu...', 'info');
    loadOrdersData();
}

// Utility functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatCurrency(amount) {
    if (!amount) return '0đ';
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount);
}

function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return dateString;
        }
        return date.toLocaleString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return dateString;
    }
}

// UI State functions
function showLoading() {
    document.getElementById('loadingState').classList.remove('hidden');
    document.getElementById('tableContent').classList.add('hidden');
    document.getElementById('emptyState').classList.add('hidden');
}

function hideLoading() {
    document.getElementById('loadingState').classList.add('hidden');
}

function showTable() {
    document.getElementById('tableContent').classList.remove('hidden');
    document.getElementById('emptyState').classList.add('hidden');
}

function showEmptyState() {
    document.getElementById('tableContent').classList.add('hidden');
    document.getElementById('emptyState').classList.remove('hidden');
}

function showError(message) {
    showToast(message, 'error');
    showEmptyState();
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white z-50 fade-in ${type === 'success' ? 'bg-green-500' :
        type === 'error' ? 'bg-red-500' :
            type === 'warning' ? 'bg-yellow-500' :
                'bg-blue-500'
        }`;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}

// Show collaborator modal
async function showCollaboratorModal(referralCode) {
    try {
        // Get collaborator info from existing orders data
        const ctvOrders = allOrdersData.filter(order => order.referral_code === referralCode);

        if (ctvOrders.length === 0) {
            showToast('Không tìm thấy thông tin CTV', 'error');
            return;
        }

        // Calculate stats from orders
        const stats = {
            totalOrders: ctvOrders.length,
            totalRevenue: ctvOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0),
            totalCommission: ctvOrders.reduce((sum, order) => sum + (order.commission || 0), 0)
        };

        // Get CTV info - fetch from API to get full details
        let ctv = {
            referral_code: referralCode,
            name: 'Đang tải...',
            phone: ctvOrders[0].ctv_phone || 'Chưa cập nhật',
            email: null,
            commission_rate: ctvOrders[0].commission && ctvOrders[0].total_amount
                ? (ctvOrders[0].commission / ctvOrders[0].total_amount * 100).toFixed(1)
                : 10,
            bank_info: null
        };

        // Fetch CTV details from getAllCTV API
        try {
            const response = await fetch(`${CONFIG.API_URL}?action=getAllCTV&timestamp=${Date.now()}`);
            const data = await response.json();

            if (data.success && data.ctvList) {
                const ctvInfo = data.ctvList.find(c => c.referralCode === referralCode);
                if (ctvInfo) {
                    ctv.name = ctvInfo.fullName || 'Chưa cập nhật';
                    ctv.phone = ctvInfo.phone || ctv.phone;
                    ctv.email = ctvInfo.email;
                    ctv.commission_rate = (ctvInfo.commissionRate * 100).toFixed(1);
                }
            }
        } catch (error) {
            console.warn('Could not fetch CTV details:', error);
            ctv.name = 'Cộng tác viên';
        }

        const modal = document.createElement('div');
        modal.id = 'collaboratorModal';
        modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';
        modal.style.animation = 'fadeIn 0.3s ease-out';

        modal.innerHTML = `
            <div class="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden" style="animation: fadeIn 0.3s ease-out;">
                <!-- Header with gradient -->
                <div class="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 px-8 py-6 relative overflow-hidden">
                    <div class="absolute inset-0 bg-black/10"></div>
                    <div class="relative flex items-center justify-between">
                        <div class="flex items-center gap-4">
                            <div class="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center ring-4 ring-white/30">
                                <svg class="w-9 h-9 text-white" viewBox="0 0 24 24" fill="currentColor">
                                    <path fill-rule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clip-rule="evenodd" />
                                </svg>
                            </div>
                            <div>
                                <h2 class="text-2xl font-bold text-white mb-1">Thông tin Cộng tác viên</h2>
                                <p class="text-white/90 text-sm font-medium">Mã CTV: ${escapeHtml(ctv.referral_code)}</p>
                            </div>
                        </div>
                        <button onclick="closeCollaboratorModal()" class="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all hover:rotate-90 duration-300">
                            <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
                
                <!-- Content -->
                <div class="p-8 overflow-y-auto max-h-[calc(90vh-200px)]">
                    <!-- Stats Cards -->
                    <div class="grid grid-cols-3 gap-4 mb-8">
                        <div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                            <div class="flex items-center gap-3">
                                <div class="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                                    <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                                    </svg>
                                </div>
                                <div>
                                    <p class="text-xs text-blue-600 font-medium">Tổng đơn hàng</p>
                                    <p class="text-2xl font-bold text-blue-700">${stats.totalOrders || 0}</p>
                                </div>
                            </div>
                        </div>
                        
                        <div class="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
                            <div class="flex items-center gap-3">
                                <div class="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                                    <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
                                    </svg>
                                </div>
                                <div>
                                    <p class="text-xs text-green-600 font-medium">Tổng doanh thu</p>
                                    <p class="text-xl font-bold text-green-700">${formatCurrency(stats.totalRevenue || 0)}</p>
                                </div>
                            </div>
                        </div>
                        
                        <div class="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200">
                            <div class="flex items-center gap-3">
                                <div class="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center">
                                    <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clip-rule="evenodd" />
                                    </svg>
                                </div>
                                <div>
                                    <p class="text-xs text-orange-600 font-medium">Tổng hoa hồng</p>
                                    <p class="text-xl font-bold text-orange-700">${formatCurrency(stats.totalCommission || 0)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Collaborator Info -->
                    <div class="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200 mb-6">
                        <h3 class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <svg class="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Thông tin chi tiết
                        </h3>
                        <div class="grid grid-cols-2 gap-4">
                            <div class="bg-white rounded-lg p-4 border border-gray-200">
                                <p class="text-sm text-gray-500 mb-1">Họ và tên</p>
                                <p class="text-base font-semibold text-gray-900">${escapeHtml(ctv.name || 'N/A')}</p>
                            </div>
                            <div class="bg-white rounded-lg p-4 border border-gray-200">
                                <p class="text-sm text-gray-500 mb-1">Số điện thoại</p>
                                <p class="text-base font-semibold text-gray-900">${escapeHtml(ctv.phone || 'N/A')}</p>
                            </div>
                            <div class="bg-white rounded-lg p-4 border border-gray-200">
                                <p class="text-sm text-gray-500 mb-1">Mã CTV</p>
                                <p class="text-base font-semibold text-blue-600">${escapeHtml(ctv.referral_code)}</p>
                            </div>
                            <div class="bg-white rounded-lg p-4 border border-gray-200">
                                <p class="text-sm text-gray-500 mb-1">Tỷ lệ hoa hồng</p>
                                <p class="text-base font-semibold text-orange-600">${ctv.commission_rate || 0}%</p>
                            </div>
                            ${ctv.bank_info ? `
                            <div class="bg-white rounded-lg p-4 border border-gray-200 col-span-2">
                                <p class="text-sm text-gray-500 mb-1">Thông tin ngân hàng</p>
                                <p class="text-base font-semibold text-gray-900">${escapeHtml(ctv.bank_info)}</p>
                            </div>
                            ` : ''}
                        </div>
                    </div>

                    <!-- Action Button -->
                    <div class="flex justify-center">
                        <button onclick="showCollaboratorOrders('${escapeHtml(referralCode)}')" 
                            class="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center gap-3">
                            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            <span>Xem đơn hàng của CTV</span>
                            <svg class="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeCollaboratorModal();
            }
        });

    } catch (error) {
        console.error('Error loading collaborator info:', error);
        showToast('Không thể tải thông tin CTV', 'error');
    }
}

// Close collaborator modal
function closeCollaboratorModal() {
    const modal = document.getElementById('collaboratorModal');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 200);
    }
}

// Show collaborator orders
async function showCollaboratorOrders(referralCode) {
    try {
        // Close the info modal first
        closeCollaboratorModal();

        // Show loading
        const loadingModal = document.createElement('div');
        loadingModal.id = 'ordersLoadingModal';
        loadingModal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50';
        loadingModal.innerHTML = `
            <div class="bg-white rounded-2xl p-8 flex flex-col items-center gap-4">
                <div class="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p class="text-gray-700 font-medium">Đang tải đơn hàng...</p>
            </div>
        `;
        document.body.appendChild(loadingModal);

        // Fetch orders
        const orders = allOrdersData.filter(order => order.referral_code === referralCode);

        // Remove loading
        loadingModal.remove();

        if (orders.length === 0) {
            showToast('CTV này chưa có đơn hàng nào', 'info');
            return;
        }

        // Sort by date (newest first)
        orders.sort((a, b) => {
            const dateA = new Date(a.created_at || a.order_date || 0);
            const dateB = new Date(b.created_at || b.order_date || 0);
            return dateB - dateA;
        });

        // Calculate stats
        const totalRevenue = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
        const totalCommission = orders.reduce((sum, order) => sum + (order.commission || 0), 0);

        const modal = document.createElement('div');
        modal.id = 'collaboratorOrdersModal';
        modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';
        modal.style.animation = 'fadeIn 0.3s ease-out';

        modal.innerHTML = `
            <div class="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden" style="animation: fadeIn 0.3s ease-out;">
                <!-- Header -->
                <div class="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 px-8 py-6 relative overflow-hidden">
                    <div class="absolute inset-0 bg-black/10"></div>
                    <div class="relative flex items-center justify-between">
                        <div class="flex items-center gap-4">
                            <button onclick="closeCollaboratorOrdersModal(); showCollaboratorModal('${escapeHtml(referralCode)}')" 
                                class="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all">
                                <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <div>
                                <h2 class="text-2xl font-bold text-white mb-1">Đơn hàng của CTV</h2>
                                <p class="text-white/90 text-sm font-medium">Mã CTV: ${escapeHtml(referralCode)} • ${orders.length} đơn hàng</p>
                            </div>
                        </div>
                        <button onclick="closeCollaboratorOrdersModal()" class="w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all hover:rotate-90 duration-300">
                            <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- Stats Summary -->
                <div class="px-8 py-6 bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
                    <div class="grid grid-cols-3 gap-4">
                        <div class="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                            <p class="text-sm text-gray-600 mb-1">Tổng đơn hàng</p>
                            <p class="text-2xl font-bold text-blue-600">${orders.length}</p>
                        </div>
                        <div class="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                            <p class="text-sm text-gray-600 mb-1">Tổng doanh thu</p>
                            <p class="text-xl font-bold text-green-600">${formatCurrency(totalRevenue)}</p>
                        </div>
                        <div class="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                            <p class="text-sm text-gray-600 mb-1">Tổng hoa hồng</p>
                            <p class="text-xl font-bold text-orange-600">${formatCurrency(totalCommission)}</p>
                        </div>
                    </div>
                </div>
                
                <!-- Orders List -->
                <div class="p-8 overflow-y-auto max-h-[calc(90vh-300px)]">
                    <div class="space-y-4">
                        ${orders.map((order, index) => `
                            <div class="bg-white rounded-xl border-2 border-gray-200 hover:border-blue-400 transition-all hover:shadow-lg overflow-hidden">
                                <div class="p-6">
                                    <div class="flex items-start justify-between mb-4">
                                        <div class="flex items-center gap-3">
                                            <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
                                                ${index + 1}
                                            </div>
                                            <div>
                                                <div class="flex items-center gap-2 mb-1">
                                                    <span class="text-lg font-bold text-gray-900">${escapeHtml(order.order_id || 'N/A')}</span>
                                                    <button onclick="copyToClipboard('${escapeHtml(order.order_id || '')}')" class="text-gray-400 hover:text-blue-600 transition-colors">
                                                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                        </svg>
                                                    </button>
                                                </div>
                                                <p class="text-sm text-gray-500">${formatDateTime(order.created_at || order.order_date)}</p>
                                            </div>
                                        </div>
                                        <div class="text-right">
                                            <p class="text-sm text-gray-500 mb-1">Giá trị đơn hàng</p>
                                            <p class="text-xl font-bold text-green-600">${formatCurrency(order.total_amount || 0)}</p>
                                            <p class="text-sm text-orange-600 font-semibold mt-1">HH: ${formatCurrency(order.commission || 0)}</p>
                                        </div>
                                    </div>

                                    <div class="grid grid-cols-2 gap-4 mb-4">
                                        <div class="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                            <p class="text-xs text-gray-500 mb-1">Khách hàng</p>
                                            <p class="text-sm font-semibold text-gray-900">${escapeHtml(order.customer_name || 'N/A')}</p>
                                            <p class="text-sm text-gray-600">${escapeHtml(order.customer_phone || 'N/A')}</p>
                                        </div>
                                        <div class="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                            <p class="text-xs text-gray-500 mb-1">Địa chỉ</p>
                                            <p class="text-sm text-gray-700 line-clamp-2">${escapeHtml(order.address || 'N/A')}</p>
                                        </div>
                                    </div>

                                    ${order.products ? `
                                    <div class="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-200">
                                        <p class="text-xs text-purple-600 font-semibold mb-2 flex items-center gap-2">
                                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                                            </svg>
                                            Sản phẩm
                                        </p>
                                        <p class="text-sm text-gray-700 whitespace-pre-wrap">${escapeHtml(order.products)}</p>
                                    </div>
                                    ` : ''}

                                    <div class="mt-4 flex justify-end">
                                        <button onclick="viewOrderDetail(${order.id})" 
                                            class="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:shadow-lg transition-all flex items-center gap-2">
                                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                            Xem chi tiết
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeCollaboratorOrdersModal();
            }
        });

    } catch (error) {
        console.error('Error loading collaborator orders:', error);
        showToast('Không thể tải danh sách đơn hàng', 'error');
    }
}

// Close collaborator orders modal
function closeCollaboratorOrdersModal() {
    const modal = document.getElementById('collaboratorOrdersModal');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 200);
    }
}

// Edit product - show modal with all fields
function editProductName(productId, orderId, orderCode) {
    // Find the order
    const order = allOrdersData.find(o => o.id === orderId);
    if (!order) {
        showToast('Không tìm thấy đơn hàng', 'error');
        return;
    }

    // Parse products
    let products = [];
    try {
        products = JSON.parse(order.products);
    } catch (e) {
        const lines = order.products.split(/[,\n]/).map(line => line.trim()).filter(line => line);
        products = lines.map(line => {
            const match = line.match(/^(.+?)\s*[xX×]\s*(\d+)$/);
            if (match) {
                return { name: match[1].trim(), quantity: parseInt(match[2]) };
            }
            return { name: line, quantity: 1 };
        });
    }

    // Find the product by matching the productId
    const span = document.getElementById(productId);
    if (!span) return;

    const currentName = span.textContent.trim();
    const productIndex = products.findIndex(p => {
        const pName = typeof p === 'string' ? p : p.name;
        return pName === currentName;
    });

    if (productIndex === -1) {
        showToast('Không tìm thấy sản phẩm', 'error');
        return;
    }

    const product = products[productIndex];
    const productData = typeof product === 'string'
        ? { name: product, quantity: 1, weight: '', size: '' }
        : {
            name: product.name || '',
            quantity: product.quantity || 1,
            weight: product.weight || '',
            size: product.size || ''
        };

    // Smart detection: if weight contains "cm" or looks like size, swap them
    if (productData.weight && !productData.size) {
        const weightValue = productData.weight.toLowerCase();
        // Check if it looks like a size (contains cm, size, tay, etc.)
        if (weightValue.includes('cm') || weightValue.includes('size') || weightValue.includes('tay')) {
            productData.size = productData.weight;
            productData.weight = '';
        }
    }

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'editProductModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';


    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <!-- Header -->
            <div class="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 rounded-t-xl">
                <div class="flex items-center justify-between">
                    <h3 class="text-lg font-bold text-white flex items-center gap-2">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Chỉnh sửa sản phẩm
                    </h3>
                    <button onclick="closeEditProductModal()" class="text-white/80 hover:text-white transition-colors">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <p class="text-sm text-white/80 mt-1">Đơn hàng: ${escapeHtml(orderCode)}</p>
            </div>

            <!-- Form -->
            <div class="p-6 space-y-4">
                <!-- Product Name -->
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                        Tên sản phẩm <span class="text-red-500">*</span>
                    </label>
                    <input 
                        type="text" 
                        id="editProductName" 
                        value="${escapeHtml(productData.name)}"
                        class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Nhập tên sản phẩm"
                    />
                </div>

                <!-- Quantity -->
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                        Số lượng <span class="text-red-500">*</span>
                    </label>
                    <input 
                        type="number" 
                        id="editProductQuantity" 
                        value="${productData.quantity}"
                        min="1"
                        class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Nhập số lượng"
                    />
                </div>

                <!-- Weight or Size (only show relevant field based on product data) -->
                ${productData.weight && !productData.size ? `
                <!-- Only Weight -->
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                        Cân nặng
                    </label>
                    <input 
                        type="text" 
                        id="editProductWeight" 
                        value="${escapeHtml(productData.weight)}"
                        class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="VD: 500g"
                    />
                </div>
                ` : productData.size && !productData.weight ? `
                <!-- Only Size -->
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                        Size/Tay
                    </label>
                    <input 
                        type="text" 
                        id="editProductSize" 
                        value="${escapeHtml(productData.size)}"
                        class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="VD: Size M"
                    />
                </div>
                ` : productData.weight && productData.size ? `
                <!-- Both Weight and Size -->
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            Cân nặng
                        </label>
                        <input 
                            type="text" 
                            id="editProductWeight" 
                            value="${escapeHtml(productData.weight)}"
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="VD: 500g"
                        />
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-gray-700 mb-2">
                            Size/Tay
                        </label>
                        <input 
                            type="text" 
                            id="editProductSize" 
                            value="${escapeHtml(productData.size)}"
                            class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="VD: Size M"
                        />
                    </div>
                </div>
                ` : ''}
            </div>

            <!-- Actions -->
            <div class="px-6 py-4 bg-gray-50 rounded-b-xl flex items-center justify-end gap-3">
                <button 
                    onclick="closeEditProductModal()" 
                    class="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                    Hủy
                </button>
                <button 
                    onclick="saveProductChanges(${orderId}, ${productIndex}, '${escapeHtml(orderCode)}')" 
                    class="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Lưu thay đổi
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Focus first input immediately
    document.getElementById('editProductName')?.focus();

    // Close on Escape
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeEditProductModal();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
}

// Close edit product modal
function closeEditProductModal() {
    const modal = document.getElementById('editProductModal');
    if (modal) {
        modal.remove();
    }
}

// Save product name
async function saveProductName(productId, orderId, orderCode, newName, oldName) {
    const span = document.getElementById(productId);
    if (!span) return;

    newName = newName.trim();

    // If no change, just restore
    if (newName === oldName || newName === '') {
        span.innerHTML = escapeHtml(oldName);
        return;
    }

    // Show loading
    span.innerHTML = `
        <div class="flex items-center gap-2">
            <div class="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span class="text-xs text-gray-600">Đang lưu...</span>
        </div>
    `;

    try {
        // Find the order in allOrdersData
        const orderIndex = allOrdersData.findIndex(o => o.id === orderId);
        if (orderIndex === -1) {
            throw new Error('Không tìm thấy đơn hàng');
        }

        const order = allOrdersData[orderIndex];
        let products = [];

        // Parse current products
        try {
            products = JSON.parse(order.products);
        } catch (e) {
            // If not JSON, parse as text
            const lines = order.products.split(/[,\n]/).map(line => line.trim()).filter(line => line);
            products = lines.map(line => {
                const match = line.match(/^(.+?)\s*[xX×]\s*(\d+)$/);
                if (match) {
                    return { name: match[1].trim(), quantity: parseInt(match[2]) };
                }
                return { name: line, quantity: 1 };
            });
        }

        // Find and update the product
        let updated = false;
        for (let i = 0; i < products.length; i++) {
            const productName = typeof products[i] === 'string' ? products[i] : products[i].name;
            if (productName === oldName) {
                if (typeof products[i] === 'string') {
                    products[i] = newName;
                } else {
                    products[i].name = newName;
                }
                updated = true;
                break;
            }
        }

        if (!updated) {
            throw new Error('Không tìm thấy sản phẩm để cập nhật');
        }

        // Convert back to JSON string
        const updatedProductsJson = JSON.stringify(products);

        // Update in database via API
        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'updateOrderProducts',
                orderId: orderId,
                products: updatedProductsJson
            })
        });

        const data = await response.json();

        if (data.success) {
            // Update local data
            allOrdersData[orderIndex].products = updatedProductsJson;

            // Update filtered data if exists
            const filteredIndex = filteredOrdersData.findIndex(o => o.id === orderId);
            if (filteredIndex !== -1) {
                filteredOrdersData[filteredIndex].products = updatedProductsJson;
            }

            // Update display
            span.innerHTML = escapeHtml(newName);
            showToast(`Đã cập nhật tên sản phẩm cho đơn ${orderCode}`, 'success');
        } else {
            throw new Error(data.error || 'Không thể cập nhật');
        }

    } catch (error) {
        console.error('Error saving product name:', error);
        span.innerHTML = escapeHtml(oldName);
        showToast('Không thể cập nhật tên sản phẩm: ' + error.message, 'error');
    }
}

// Save product changes
async function saveProductChanges(orderId, productIndex, orderCode) {
    // Get values from form
    const name = document.getElementById('editProductName')?.value.trim();
    const quantity = parseInt(document.getElementById('editProductQuantity')?.value) || 1;
    const weightInput = document.getElementById('editProductWeight');
    const sizeInput = document.getElementById('editProductSize');
    const weight = weightInput ? weightInput.value.trim() : '';
    const size = sizeInput ? sizeInput.value.trim() : '';

    // Validate
    if (!name) {
        showToast('Tên sản phẩm không được để trống', 'error');
        return;
    }

    if (quantity < 1) {
        showToast('Số lượng phải lớn hơn 0', 'error');
        return;
    }

    // Close modal and show loading toast
    closeEditProductModal();
    showToast('Đang lưu thay đổi...', 'info');

    try {
        // Find the order in allOrdersData
        const orderIndex = allOrdersData.findIndex(o => o.id === orderId);
        if (orderIndex === -1) {
            throw new Error('Không tìm thấy đơn hàng');
        }

        const order = allOrdersData[orderIndex];
        let products = [];

        // Parse current products
        try {
            products = JSON.parse(order.products);
        } catch (e) {
            const lines = order.products.split(/[,\n]/).map(line => line.trim()).filter(line => line);
            products = lines.map(line => {
                const match = line.match(/^(.+?)\s*[xX×]\s*(\d+)$/);
                if (match) {
                    return { name: match[1].trim(), quantity: parseInt(match[2]) };
                }
                return { name: line, quantity: 1 };
            });
        }

        // Update the product
        const updatedProduct = {
            name: name,
            quantity: quantity
        };

        // Add weight and size if provided
        if (weight) updatedProduct.weight = weight;
        if (size) updatedProduct.size = size;

        products[productIndex] = updatedProduct;

        // Convert back to JSON string
        const updatedProductsJson = JSON.stringify(products);

        // Update in database via API
        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'updateOrderProducts',
                orderId: orderId,
                products: updatedProductsJson
            })
        });

        const data = await response.json();

        if (data.success) {
            // Update local data
            allOrdersData[orderIndex].products = updatedProductsJson;

            // Update filtered data if exists
            const filteredIndex = filteredOrdersData.findIndex(o => o.id === orderId);
            if (filteredIndex !== -1) {
                filteredOrdersData[filteredIndex].products = updatedProductsJson;
            }

            // Re-render the table to show updated product
            renderOrdersTable();

            showToast(`Đã cập nhật sản phẩm cho đơn ${orderCode}`, 'success');
        } else {
            throw new Error(data.error || 'Không thể cập nhật');
        }

    } catch (error) {
        console.error('Error saving product:', error);
        showToast('Không thể cập nhật sản phẩm: ' + error.message, 'error');
    }
}

// Edit customer info
function editCustomerInfo(orderId, orderCode) {
    // Find the order
    const order = allOrdersData.find(o => o.id === orderId);
    if (!order) {
        showToast('Không tìm thấy đơn hàng', 'error');
        return;
    }

    const customerName = order.customer_name || '';
    const customerPhone = order.customer_phone || '';

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'editCustomerModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <!-- Header -->
            <div class="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 rounded-t-xl">
                <div class="flex items-center justify-between">
                    <h3 class="text-lg font-bold text-white flex items-center gap-2">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Chỉnh sửa thông tin khách hàng
                    </h3>
                    <button onclick="closeEditCustomerModal()" class="text-white/80 hover:text-white transition-colors">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <p class="text-sm text-white/80 mt-1">Đơn hàng: ${escapeHtml(orderCode)}</p>
            </div>

            <!-- Form -->
            <div class="p-6 space-y-4">
                <!-- Customer Name -->
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                        Tên khách hàng <span class="text-red-500">*</span>
                    </label>
                    <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg class="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <input 
                            type="text" 
                            id="editCustomerName" 
                            value="${escapeHtml(customerName)}"
                            class="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Nhập tên khách hàng"
                        />
                    </div>
                </div>

                <!-- Customer Phone -->
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                        Số điện thoại <span class="text-red-500">*</span>
                    </label>
                    <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg class="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                        </div>
                        <input 
                            type="tel" 
                            id="editCustomerPhone" 
                            value="${escapeHtml(customerPhone)}"
                            class="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Nhập số điện thoại"
                        />
                    </div>
                    <p class="mt-1.5 text-xs text-gray-500 flex items-center gap-1">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Định dạng: 10 số, bắt đầu bằng 0
                    </p>
                </div>
            </div>

            <!-- Actions -->
            <div class="px-6 py-4 bg-gray-50 rounded-b-xl flex items-center justify-end gap-3">
                <button 
                    onclick="closeEditCustomerModal()" 
                    class="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                    Hủy
                </button>
                <button 
                    onclick="saveCustomerInfo(${orderId}, '${escapeHtml(orderCode)}')" 
                    class="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Lưu thay đổi
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Focus first input immediately
    document.getElementById('editCustomerName')?.focus();

    // Close on Escape
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeEditCustomerModal();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeEditCustomerModal();
        }
    });
}

// Close edit customer modal
function closeEditCustomerModal() {
    const modal = document.getElementById('editCustomerModal');
    if (modal) {
        modal.remove();
    }
}

// Save customer info
async function saveCustomerInfo(orderId, orderCode) {
    // Get values from form
    const name = document.getElementById('editCustomerName')?.value.trim();
    const phone = document.getElementById('editCustomerPhone')?.value.trim();

    // Validate
    if (!name) {
        showToast('Tên khách hàng không được để trống', 'error');
        return;
    }

    if (!phone) {
        showToast('Số điện thoại không được để trống', 'error');
        return;
    }

    // Validate phone format (Vietnamese phone number)
    const phoneRegex = /^0\d{9}$/;
    if (!phoneRegex.test(phone)) {
        showToast('Số điện thoại không hợp lệ. Vui lòng nhập 10 số, bắt đầu bằng 0', 'error');
        return;
    }

    // Close modal and show loading toast
    closeEditCustomerModal();
    showToast('Đang lưu thay đổi...', 'info');

    try {
        // Find the order in allOrdersData
        const orderIndex = allOrdersData.findIndex(o => o.id === orderId);
        if (orderIndex === -1) {
            throw new Error('Không tìm thấy đơn hàng');
        }

        // Update in database via API
        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'updateCustomerInfo',
                orderId: orderId,
                customerName: name,
                customerPhone: phone
            })
        });

        const data = await response.json();

        if (data.success) {
            // Update local data
            allOrdersData[orderIndex].customer_name = name;
            allOrdersData[orderIndex].customer_phone = phone;

            // Update filtered data if exists
            const filteredIndex = filteredOrdersData.findIndex(o => o.id === orderId);
            if (filteredIndex !== -1) {
                filteredOrdersData[filteredIndex].customer_name = name;
                filteredOrdersData[filteredIndex].customer_phone = phone;
            }

            // Re-render the table to show updated info
            renderOrdersTable();

            showToast(`Đã cập nhật thông tin khách hàng cho đơn ${orderCode}`, 'success');
        } else {
            throw new Error(data.error || 'Không thể cập nhật');
        }

    } catch (error) {
        console.error('Error saving customer info:', error);
        showToast('Không thể cập nhật thông tin khách hàng: ' + error.message, 'error');
    }
}

// Edit address
function editAddress(orderId, orderCode) {
    // Find the order
    const order = allOrdersData.find(o => o.id === orderId);
    if (!order) {
        showToast('Không tìm thấy đơn hàng', 'error');
        return;
    }

    const address = order.address || '';

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'editAddressModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <!-- Header -->
            <div class="bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-4 rounded-t-xl">
                <div class="flex items-center justify-between">
                    <h3 class="text-lg font-bold text-white flex items-center gap-2">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Chỉnh sửa địa chỉ giao hàng
                    </h3>
                    <button onclick="closeEditAddressModal()" class="text-white/80 hover:text-white transition-colors">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <p class="text-sm text-white/80 mt-1">Đơn hàng: ${escapeHtml(orderCode)}</p>
            </div>

            <!-- Form -->
            <div class="p-6">
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                        Địa chỉ giao hàng <span class="text-red-500">*</span>
                    </label>
                    <div class="relative">
                        <div class="absolute top-3 left-3 pointer-events-none">
                            <svg class="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                        <textarea 
                            id="editAddressInput" 
                            rows="4"
                            class="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                            placeholder="Nhập địa chỉ đầy đủ: Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
                        >${escapeHtml(address)}</textarea>
                    </div>
                    <p class="mt-1.5 text-xs text-gray-500 flex items-center gap-1">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Nhập địa chỉ chi tiết để giao hàng chính xác
                    </p>
                </div>
            </div>

            <!-- Actions -->
            <div class="px-6 py-4 bg-gray-50 rounded-b-xl flex items-center justify-end gap-3">
                <button 
                    onclick="closeEditAddressModal()" 
                    class="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                    Hủy
                </button>
                <button 
                    onclick="saveAddress(${orderId}, '${escapeHtml(orderCode)}')" 
                    class="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Lưu thay đổi
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Focus textarea immediately
    const textarea = document.getElementById('editAddressInput');
    if (textarea) {
        textarea.focus();
        // Move cursor to end
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }

    // Close on Escape
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeEditAddressModal();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeEditAddressModal();
        }
    });
}

// Close edit address modal
function closeEditAddressModal() {
    const modal = document.getElementById('editAddressModal');
    if (modal) {
        modal.remove();
    }
}

// Save address
async function saveAddress(orderId, orderCode) {
    // Get value from form
    const address = document.getElementById('editAddressInput')?.value.trim();

    // Validate
    if (!address) {
        showToast('Địa chỉ không được để trống', 'error');
        return;
    }

    if (address.length < 10) {
        showToast('Địa chỉ quá ngắn. Vui lòng nhập địa chỉ đầy đủ', 'error');
        return;
    }

    // Close modal and show loading toast
    closeEditAddressModal();
    showToast('Đang lưu thay đổi...', 'info');

    try {
        // Find the order in allOrdersData
        const orderIndex = allOrdersData.findIndex(o => o.id === orderId);
        if (orderIndex === -1) {
            throw new Error('Không tìm thấy đơn hàng');
        }

        // Update in database via API
        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'updateAddress',
                orderId: orderId,
                address: address
            })
        });

        const data = await response.json();

        if (data.success) {
            // Update local data
            allOrdersData[orderIndex].address = address;

            // Update filtered data if exists
            const filteredIndex = filteredOrdersData.findIndex(o => o.id === orderId);
            if (filteredIndex !== -1) {
                filteredOrdersData[filteredIndex].address = address;
            }

            // Re-render the table to show updated info
            renderOrdersTable();

            showToast(`Đã cập nhật địa chỉ cho đơn ${orderCode}`, 'success');
        } else {
            throw new Error(data.error || 'Không thể cập nhật');
        }

    } catch (error) {
        console.error('Error saving address:', error);
        showToast('Không thể cập nhật địa chỉ: ' + error.message, 'error');
    }
}

// Edit amount
function editAmount(orderId, orderCode) {
    // Find the order
    const order = allOrdersData.find(o => o.id === orderId);
    if (!order) {
        showToast('Không tìm thấy đơn hàng', 'error');
        return;
    }

    const currentAmount = order.total_amount || 0;
    const referralCode = order.referral_code;
    const currentCommission = order.commission || 0;

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'editAmountModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <!-- Header -->
            <div class="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 rounded-t-xl">
                <div class="flex items-center justify-between">
                    <h3 class="text-lg font-bold text-white flex items-center gap-2">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Chỉnh sửa giá trị đơn hàng
                    </h3>
                    <button onclick="closeEditAmountModal()" class="text-white/80 hover:text-white transition-colors">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <p class="text-sm text-white/80 mt-1">Đơn hàng: ${escapeHtml(orderCode)}</p>
            </div>

            <!-- Form -->
            <div class="p-6 space-y-4">
                <!-- Current Amount Display -->
                <div class="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                    <p class="text-xs text-green-600 font-medium mb-1">Giá trị hiện tại</p>
                    <p class="text-2xl font-bold text-green-700">${formatCurrency(currentAmount)}</p>
                    ${referralCode ? `
                        <div class="mt-2 pt-2 border-t border-green-200">
                            <p class="text-xs text-orange-600 font-medium">Hoa hồng CTV: <span class="font-bold">${formatCurrency(currentCommission)}</span></p>
                        </div>
                    ` : ''}
                </div>

                <!-- New Amount Input -->
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">
                        Giá trị mới <span class="text-red-500">*</span>
                    </label>
                    <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg class="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <input 
                            type="number" 
                            id="editAmountInput" 
                            value="${currentAmount}"
                            min="0"
                            step="1000"
                            class="w-full pl-10 pr-12 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            placeholder="Nhập giá trị đơn hàng"
                            oninput="updateAmountPreview(${referralCode ? 'true' : 'false'})"
                        />
                        <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <span class="text-gray-500 text-sm font-medium">đ</span>
                        </div>
                    </div>
                    <p class="mt-1.5 text-xs text-gray-500 flex items-center gap-1">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Nhập số tiền không bao gồm dấu phẩy
                    </p>
                </div>

                <!-- Preview -->
                <div id="amountPreview" class="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div class="flex items-center justify-between">
                        <span class="text-sm text-gray-600">Giá trị mới:</span>
                        <span class="text-lg font-bold text-green-600">${formatCurrency(currentAmount)}</span>
                    </div>
                    ${referralCode ? `
                        <div class="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                            <span class="text-sm text-gray-600">Hoa hồng CTV mới:</span>
                            <span class="text-lg font-bold text-orange-600" id="commissionPreview">${formatCurrency(currentCommission)}</span>
                        </div>
                    ` : ''}
                </div>
            </div>

            <!-- Actions -->
            <div class="px-6 py-4 bg-gray-50 rounded-b-xl flex items-center justify-end gap-3">
                <button 
                    onclick="closeEditAmountModal()" 
                    class="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                    Hủy
                </button>
                <button 
                    onclick="saveAmount(${orderId}, '${escapeHtml(orderCode)}', ${referralCode ? `'${escapeHtml(referralCode)}'` : 'null'})" 
                    class="px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Lưu thay đổi
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Focus input immediately
    const input = document.getElementById('editAmountInput');
    if (input) {
        input.focus();
        input.select();
    }

    // Close on Escape
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeEditAmountModal();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeEditAmountModal();
        }
    });
}

// Update amount preview
function updateAmountPreview(hasReferral) {
    const input = document.getElementById('editAmountInput');
    const preview = document.getElementById('amountPreview');
    
    if (!input || !preview) return;

    const newAmount = parseFloat(input.value) || 0;
    
    // Update amount display
    const amountDisplay = preview.querySelector('.text-green-600');
    if (amountDisplay) {
        amountDisplay.textContent = formatCurrency(newAmount);
    }

    // Update commission if has referral
    if (hasReferral) {
        const commissionPreview = document.getElementById('commissionPreview');
        if (commissionPreview) {
            // Calculate commission (10% default)
            const newCommission = newAmount * 0.1;
            commissionPreview.textContent = formatCurrency(newCommission);
        }
    }
}

// Close edit amount modal
function closeEditAmountModal() {
    const modal = document.getElementById('editAmountModal');
    if (modal) {
        modal.remove();
    }
}

// Save amount
async function saveAmount(orderId, orderCode, referralCode) {
    // Get value from form
    const amountInput = document.getElementById('editAmountInput');
    const newAmount = parseFloat(amountInput?.value) || 0;

    // Validate
    if (newAmount <= 0) {
        showToast('Giá trị đơn hàng phải lớn hơn 0', 'error');
        return;
    }

    if (newAmount > 1000000000) {
        showToast('Giá trị đơn hàng quá lớn', 'error');
        return;
    }

    // Calculate new commission if has referral
    let newCommission = 0;
    if (referralCode) {
        newCommission = newAmount * 0.1; // 10% commission
    }

    // Close modal and show loading toast
    closeEditAmountModal();
    showToast('Đang lưu thay đổi...', 'info');

    try {
        // Find the order in allOrdersData
        const orderIndex = allOrdersData.findIndex(o => o.id === orderId);
        if (orderIndex === -1) {
            throw new Error('Không tìm thấy đơn hàng');
        }

        // Update in database via API
        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'updateAmount',
                orderId: orderId,
                totalAmount: newAmount,
                commission: newCommission
            })
        });

        const data = await response.json();

        if (data.success) {
            // Update local data
            allOrdersData[orderIndex].total_amount = newAmount;
            allOrdersData[orderIndex].commission = newCommission;

            // Update filtered data if exists
            const filteredIndex = filteredOrdersData.findIndex(o => o.id === orderId);
            if (filteredIndex !== -1) {
                filteredOrdersData[filteredIndex].total_amount = newAmount;
                filteredOrdersData[filteredIndex].commission = newCommission;
            }

            // Update stats
            updateStats();

            // Re-render the table to show updated info
            renderOrdersTable();

            showToast(`Đã cập nhật giá trị cho đơn ${orderCode}`, 'success');
        } else {
            throw new Error(data.error || 'Không thể cập nhật');
        }

    } catch (error) {
        console.error('Error saving amount:', error);
        showToast('Không thể cập nhật giá trị đơn hàng: ' + error.message, 'error');
    }
}

// Confirm delete order
function confirmDeleteOrder(orderId, orderCode) {
    // Find the order
    const order = allOrdersData.find(o => o.id === orderId);
    if (!order) {
        showToast('Không tìm thấy đơn hàng', 'error');
        return;
    }

    // Create simple confirmation modal
    const modal = document.createElement('div');
    modal.id = 'confirmDeleteModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <!-- Header -->
            <div class="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-4 rounded-t-xl">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                        <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <div>
                        <h3 class="text-lg font-bold text-white">Xác nhận xóa đơn hàng</h3>
                        <p class="text-sm text-white/80">Hành động này không thể hoàn tác</p>
                    </div>
                </div>
            </div>

            <!-- Content -->
            <div class="p-6">
                <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <p class="text-sm text-gray-700 mb-2">Bạn có chắc chắn muốn xóa đơn hàng:</p>
                    <p class="text-base font-bold text-red-600">${escapeHtml(orderCode)}</p>
                    ${order.customer_name ? `
                        <p class="text-sm text-gray-600 mt-2">Khách hàng: <span class="font-semibold">${escapeHtml(order.customer_name)}</span></p>
                    ` : ''}
                    ${order.total_amount ? `
                        <p class="text-sm text-gray-600">Giá trị: <span class="font-semibold text-green-600">${formatCurrency(order.total_amount)}</span></p>
                    ` : ''}
                </div>
                <p class="text-sm text-gray-500 flex items-start gap-2">
                    <svg class="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Đơn hàng sẽ bị xóa vĩnh viễn khỏi hệ thống và không thể khôi phục.</span>
                </p>
            </div>

            <!-- Actions -->
            <div class="px-6 py-4 bg-gray-50 rounded-b-xl flex items-center justify-end gap-3">
                <button 
                    onclick="closeConfirmDeleteModal()" 
                    class="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                    Hủy
                </button>
                <button 
                    onclick="deleteOrder(${orderId}, '${escapeHtml(orderCode)}')" 
                    class="px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Xóa đơn hàng
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Close on Escape
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeConfirmDeleteModal();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeConfirmDeleteModal();
        }
    });
}

// Close confirm delete modal
function closeConfirmDeleteModal() {
    const modal = document.getElementById('confirmDeleteModal');
    if (modal) {
        modal.remove();
    }
}

// Delete order
async function deleteOrder(orderId, orderCode) {
    // Close modal
    closeConfirmDeleteModal();
    
    // Show loading toast
    showToast('Đang xóa đơn hàng...', 'info');

    try {
        // Delete via API
        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'deleteOrder',
                orderId: orderId
            })
        });

        const data = await response.json();

        if (data.success) {
            // Remove from local data
            const orderIndex = allOrdersData.findIndex(o => o.id === orderId);
            if (orderIndex !== -1) {
                allOrdersData.splice(orderIndex, 1);
            }

            // Remove from filtered data
            const filteredIndex = filteredOrdersData.findIndex(o => o.id === orderId);
            if (filteredIndex !== -1) {
                filteredOrdersData.splice(filteredIndex, 1);
            }

            // Update stats
            updateStats();

            // Re-render the table
            renderOrdersTable();

            showToast(`Đã xóa đơn hàng ${orderCode}`, 'success');
        } else {
            throw new Error(data.error || 'Không thể xóa đơn hàng');
        }

    } catch (error) {
        console.error('Error deleting order:', error);
        showToast('Không thể xóa đơn hàng: ' + error.message, 'error');
    }
}

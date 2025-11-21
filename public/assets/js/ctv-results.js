// CTV Results Page - Display orders for a specific CTV
document.addEventListener('DOMContentLoaded', function () {
    const API_URL = CONFIG.API_URL;
    
    // Pagination
    let currentPage = 1;
    const itemsPerPage = 10;
    let allOrders = [];
    let filteredOrders = [];
    let currentReferralCode = '';
    let currentFilter = 'all';

    // Get code from URL
    const urlParams = new URLSearchParams(window.location.search);
    const codeFromUrl = urlParams.get('code');

    if (!codeFromUrl) {
        // No code provided, redirect to search
        window.location.href = 'search.html';
        return;
    }

    // Load data immediately
    loadOrderData(codeFromUrl);

    async function loadOrderData(code) {
        const isPhone = /^0?\d{9,10}$/.test(code);
        
        try {
            const action = isPhone ? 'getCTVOrdersByPhone' : 'getCTVOrders';
            const param = isPhone ? 'phone' : 'referralCode';
            
            const response = await fetch(`${API_URL}?action=${action}&${param}=${encodeURIComponent(code)}&t=${Date.now()}`);
            const result = await response.json();

            if (!result.success || !result.orders || result.orders.length === 0) {
                // No data, redirect back to search
                alert('Không tìm thấy đơn hàng. Vui lòng thử lại.');
                window.location.href = 'search.html';
                return;
            }

            // Store data
            allOrders = result.orders;
            filteredOrders = result.orders;
            currentReferralCode = result.referralCode || code;

            // Display CTV info
            const ctvInfo = result.ctvInfo || {
                name: currentReferralCode ? ('CTV ' + currentReferralCode) : 'Cộng tác viên',
                phone: isPhone ? code : '****',
                address: 'Xem trong đơn hàng'
            };
            displayCTVInfo(ctvInfo);

            // Display orders
            displayOrders();

            // Hide loading
            document.getElementById('loadingState').classList.add('hidden');
        } catch (error) {
            console.error('Load error:', error);
            alert('Có lỗi xảy ra khi tải dữ liệu');
            window.location.href = 'search.html';
        }
    }

    function displayCTVInfo(ctvInfo) {
        const capitalizeName = (name) => name?.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        const maskPhone = (phone) => {
            if (!phone || phone === '****') return '****';
            let p = phone.toString().trim();
            if (!/^\d+$/.test(p)) return '****';
            if (!p.startsWith('0') && p.length === 9) p = '0' + p;
            return p.length >= 4 ? p.slice(0, -4) + '****' : '****';
        };

        document.getElementById('ctvName').textContent = capitalizeName(ctvInfo.name) || 'Cộng tác viên';
        document.getElementById('ctvPhone').textContent = maskPhone(ctvInfo.phone);
        document.getElementById('ctvCode').textContent = currentReferralCode || '-';
    }

    function displayOrders() {
        const totalOrders = filteredOrders.length;
        let totalRevenue = 0;
        let totalCommission = 0;

        filteredOrders.forEach(order => {
            const amount = parseAmount(order.total_amount || order.totalAmount);
            totalRevenue += amount;
            totalCommission += order.commission || (amount * CONFIG.COMMISSION_RATE);
        });

        // Update stats
        document.getElementById('totalOrders').textContent = totalOrders;
        document.getElementById('totalRevenue').textContent = formatCurrency(totalRevenue);
        document.getElementById('totalCommission').textContent = formatCurrency(totalCommission);

        // Display grid
        const startIndex = (currentPage - 1) * itemsPerPage;
        const ordersToDisplay = filteredOrders.slice(startIndex, startIndex + itemsPerPage);
        const ordersGrid = document.getElementById('ordersGrid');
        ordersGrid.innerHTML = '';

        if (!ordersToDisplay.length) {
            ordersGrid.innerHTML = `
                <div class="col-span-full py-16 text-center">
                    <svg class="w-20 h-20 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    <p class="text-gray-600 text-lg font-medium">${currentFilter === 'today' ? 'Hôm nay chưa có đơn' : 'Chưa có đơn hàng'}</p>
                </div>`;
        } else {
            ordersToDisplay.forEach(order => ordersGrid.appendChild(createOrderCard(order)));
        }

        updatePagination();
    }

    function createOrderCard(order) {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200 cursor-pointer transform hover:-translate-y-1';
        
        const amount = parseAmount(order.total_amount || order.totalAmount);
        const commission = order.commission || (amount * CONFIG.COMMISSION_RATE);
        const date = formatDate(order.created_at || order.order_date || order.orderDate);
        const orderId = order.id || order.orderId;
        
        // Customer info with masked phone
        const customerName = order.customer_name || 'Khách hàng';
        const customerPhone = order.customer_phone || '';
        const maskedPhone = maskPhone(customerPhone);

        card.onclick = () => showOrderDetail(orderId);

        card.innerHTML = `
            <div class="p-4">
                <!-- Header: Date + Icon -->
                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center gap-2">
                        <div class="w-9 h-9 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center flex-shrink-0">
                            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                            </svg>
                        </div>
                        <div>
                            <div class="text-xs text-gray-500">Đơn hàng</div>
                            <div class="text-sm font-bold text-gray-900">${date}</div>
                        </div>
                    </div>
                    <svg class="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                </div>

                <!-- Customer Info -->
                <div class="bg-gray-50 rounded-xl p-2.5 mb-3 border border-gray-200">
                    <div class="flex items-center gap-2">
                        <svg class="w-4 h-4 text-gray-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
                        </svg>
                        <div class="flex-1 min-w-0">
                            <div class="text-sm font-semibold text-gray-900 truncate">${customerName}</div>
                            <div class="text-xs text-gray-600">${maskedPhone}</div>
                        </div>
                    </div>
                </div>

                <!-- Amount & Commission in one row -->
                <div class="grid grid-cols-2 gap-2">
                    <div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-3 border border-blue-200">
                        <div class="text-xs text-blue-700 mb-0.5">Tổng tiền</div>
                        <div class="text-base font-bold text-blue-900">${formatCurrency(amount)}</div>
                    </div>
                    <div class="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-3 border border-green-200">
                        <div class="text-xs text-green-700 mb-0.5">Hoa hồng</div>
                        <div class="text-base font-bold text-green-900">${formatCurrency(commission)}</div>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div class="bg-gradient-to-r from-purple-50 to-pink-50 px-4 py-2.5 border-t border-purple-100">
                <div class="flex items-center justify-center gap-2 text-purple-600 font-medium text-xs">
                    <span>Xem chi tiết</span>
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                </div>
            </div>
        `;
        
        return card;
    }

    // Mask phone number (show first 7 digits, hide last 3)
    function maskPhone(phone) {
        if (!phone) return '***';
        const phoneStr = phone.toString().trim();
        if (phoneStr.length < 7) return phoneStr;
        return phoneStr.slice(0, 7) + '***';
    }

    function updatePagination() {
        const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
        const container = document.getElementById('paginationContainer');

        if (filteredOrders.length <= itemsPerPage) {
            container.classList.add('hidden');
            return;
        }

        container.classList.remove('hidden');
        const startIndex = (currentPage - 1) * itemsPerPage + 1;
        const endIndex = Math.min(currentPage * itemsPerPage, filteredOrders.length);
        
        // Update desktop pagination
        document.getElementById('pageInfo').textContent = `${startIndex}-${endIndex}`;
        document.getElementById('totalOrdersCount').textContent = filteredOrders.length;

        // Update mobile pagination
        document.getElementById('currentPageMobile').textContent = currentPage;
        document.getElementById('totalPagesMobile').textContent = totalPages;
        document.getElementById('pageInfoMobile').textContent = `${startIndex}-${endIndex}`;
        document.getElementById('totalOrdersCountMobile').textContent = filteredOrders.length;

        // Update buttons state
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        const prevBtnMobile = document.getElementById('prevPageBtnMobile');
        const nextBtnMobile = document.getElementById('nextPageBtnMobile');
        
        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPages;
        prevBtnMobile.disabled = currentPage === 1;
        nextBtnMobile.disabled = currentPage === totalPages;

        // Render page numbers (desktop only)
        renderPageNumbers(totalPages);
    }

    function renderPageNumbers(totalPages) {
        const pageNumbersContainer = document.getElementById('pageNumbers');
        pageNumbersContainer.innerHTML = '';

        // Show max 7 page buttons
        let startPage = Math.max(1, currentPage - 3);
        let endPage = Math.min(totalPages, currentPage + 3);

        // Adjust if near start or end
        if (currentPage <= 4) {
            endPage = Math.min(7, totalPages);
        }
        if (currentPage >= totalPages - 3) {
            startPage = Math.max(1, totalPages - 6);
        }

        // First page + ellipsis
        if (startPage > 1) {
            pageNumbersContainer.appendChild(createPageButton(1));
            if (startPage > 2) {
                pageNumbersContainer.appendChild(createEllipsis());
            }
        }

        // Page numbers
        for (let i = startPage; i <= endPage; i++) {
            pageNumbersContainer.appendChild(createPageButton(i));
        }

        // Ellipsis + last page
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                pageNumbersContainer.appendChild(createEllipsis());
            }
            pageNumbersContainer.appendChild(createPageButton(totalPages));
        }
    }

    function createPageButton(pageNum) {
        const button = document.createElement('button');
        const isActive = pageNum === currentPage;
        
        button.className = isActive 
            ? 'w-10 h-10 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl shadow-lg transition-all'
            : 'w-10 h-10 bg-white border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:border-purple-300 hover:bg-purple-50 hover:text-purple-600 transition-all';
        
        button.textContent = pageNum;
        button.onclick = () => goToPage(pageNum);
        
        return button;
    }

    function createEllipsis() {
        const span = document.createElement('span');
        span.className = 'w-10 h-10 flex items-center justify-center text-gray-400 font-bold';
        span.textContent = '...';
        return span;
    }

    function goToPage(pageNum) {
        currentPage = pageNum;
        displayOrders();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Event listeners for desktop
    document.getElementById('prevPageBtn').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            displayOrders();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    document.getElementById('nextPageBtn').addEventListener('click', () => {
        const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            displayOrders();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    // Event listeners for mobile
    document.getElementById('prevPageBtnMobile').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            displayOrders();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    document.getElementById('nextPageBtnMobile').addEventListener('click', () => {
        const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            displayOrders();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    // Filter function
    window.filterOrders = function (filter) {
        currentFilter = filter;
        currentPage = 1;

        document.getElementById('filterAllTime').classList.toggle('active', filter === 'all');
        document.getElementById('filterToday').classList.toggle('active', filter === 'today');

        if (filter === 'today') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            filteredOrders = allOrders.filter(order => {
                const orderDate = new Date(order.created_at || order.order_date || order.orderDate);
                return orderDate >= today;
            });
        } else {
            filteredOrders = [...allOrders];
        }

        displayOrders();
    };

    // Order detail modal - Use data from allOrders (already loaded)
    window.showOrderDetail = function (orderId) {
        try {
            // Find order in allOrders array
            const order = allOrders.find(o => (o.id || o.orderId) == orderId);
            
            if (!order) {
                console.error('Order not found:', orderId);
                return;
            }

            const amount = parseAmount(order.total_amount || order.totalAmount);
            const commission = order.commission || (amount * CONFIG.COMMISSION_RATE);

            document.getElementById('modalOrderId').textContent = order.order_id || '#' + orderId;
            document.getElementById('modalOrderDate').textContent = formatDate(order.created_at || order.order_date || order.orderDate);
            document.getElementById('modalOrderStatus').textContent = order.status || 'Hoàn thành';
            document.getElementById('modalCustomerName').textContent = order.customer_name || 'N/A';
            document.getElementById('modalCustomerPhone').textContent = order.customer_phone || 'N/A';
            
            // Format products nicely
            const productsContainer = document.getElementById('modalProducts');
            productsContainer.innerHTML = formatProducts(order.products_display || order.products);
            
            document.getElementById('modalTotalAmount').textContent = formatCurrency(amount);
            document.getElementById('modalCommission').textContent = formatCurrency(commission);

            document.getElementById('orderDetailModal').classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        } catch (error) {
            console.error('Error showing order detail:', error);
        }
    };

    // Format products for display
    function formatProducts(productsData) {
        if (!productsData) return '<div class="text-gray-500 text-sm">Không có thông tin</div>';

        try {
            let products = [];
            
            // Try to parse if it's a JSON string
            if (typeof productsData === 'string') {
                // Check if it's JSON array
                if (productsData.trim().startsWith('[')) {
                    products = JSON.parse(productsData);
                } else {
                    // Plain text, return as is
                    return `<div class="text-sm text-gray-800">${productsData}</div>`;
                }
            } else if (Array.isArray(productsData)) {
                products = productsData;
            } else {
                return `<div class="text-sm text-gray-800">${productsData}</div>`;
            }

            // Format as list
            if (products.length === 0) {
                return '<div class="text-gray-500 text-sm">Không có sản phẩm</div>';
            }

            return products.map((product, index) => {
                const name = product.name || 'Sản phẩm';
                const quantity = product.quantity || 1;
                const price = product.price || 0;
                const size = product.size ? `${product.size}kg` : '';
                
                return `
                    <div class="flex items-start gap-3 bg-white rounded-lg p-3 border border-orange-100">
                        <div class="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span class="text-orange-600 font-bold text-sm">${index + 1}</span>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="font-semibold text-gray-900 text-sm mb-1">${name}</div>
                            <div class="flex items-center gap-3 text-xs text-gray-600">
                                <span class="flex items-center gap-1">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                    </svg>
                                    SL: ${quantity}
                                </span>
                                ${size ? `<span class="flex items-center gap-1 text-blue-600 font-medium">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                                    </svg>
                                    ${size}
                                </span>` : ''}
                                <span class="flex items-center gap-1 font-semibold text-orange-600">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    ${formatCurrency(price)}
                                </span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

        } catch (error) {
            console.error('Error formatting products:', error);
            return `<div class="text-sm text-gray-800">${productsData}</div>`;
        }
    }

    window.closeOrderDetailModal = function () {
        document.getElementById('orderDetailModal').classList.add('hidden');
        document.body.style.overflow = ''; // Restore scroll
    };

    // Helper functions
    function parseAmount(value) {
        if (typeof value === 'number') return value;
        if (!value) return 0;
        return parseInt(value.toString().replace(/[^\d]/g, '')) || 0;
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    }

    function formatDate(dateStr) {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
});

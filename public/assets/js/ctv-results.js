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

            // Check if CTV exists but has no orders
            if (result.success && result.ctvInfo) {
                // CTV exists - show info even if no orders
                allOrders = result.orders || [];
                filteredOrders = allOrders;
                currentReferralCode = result.referralCode || code;

                // Display CTV info
                const ctvInfo = result.ctvInfo || {
                    name: currentReferralCode ? ('CTV ' + currentReferralCode) : 'Cộng tác viên',
                    phone: isPhone ? code : '****',
                    address: 'Xem trong đơn hàng'
                };
                displayCTVInfo(ctvInfo);

                // Initialize custom slug modal
                if (window.initCustomSlugModal) {
                    window.initCustomSlugModal(currentReferralCode, result.customSlug || null);
                }

                // Display orders (will show empty state if no orders)
                displayOrders();

                // Hide loading
                document.getElementById('loadingState').classList.add('hidden');
                return;
            }

            // CTV doesn't exist at all
            if (!result.success) {
                // Show error state
                showCTVNotFoundError(code, isPhone);
                document.getElementById('loadingState').classList.add('hidden');
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
            showCTVNotFoundError(code, isPhone);
            document.getElementById('loadingState').classList.add('hidden');
        }
    }

    function showCTVNotFoundError(code, isPhone) {
        const contentState = document.getElementById('contentState');
        contentState.classList.remove('hidden');
        contentState.innerHTML = `
            <div class="max-w-2xl mx-auto text-center py-16">
                <!-- Error Icon -->
                <div class="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-orange-100 to-red-100 rounded-full flex items-center justify-center">
                    <svg class="w-12 h-12 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>

                <!-- Error Message -->
                <h2 class="text-2xl font-bold text-gray-900 mb-3">
                    ${isPhone ? 'Số điện thoại chưa đăng ký' : 'Mã CTV không tồn tại'}
                </h2>
                <p class="text-gray-600 mb-2">
                    ${isPhone 
                        ? `Số điện thoại <span class="font-semibold text-gray-900">${code}</span> chưa được đăng ký làm CTV`
                        : `Mã CTV <span class="font-semibold text-gray-900">${code}</span> không tồn tại trong hệ thống`
                    }
                </p>
                <p class="text-gray-500 text-sm mb-8">Vui lòng kiểm tra lại hoặc đăng ký mới</p>

                <!-- Actions -->
                <div class="flex flex-col sm:flex-row gap-4 justify-center">
                    <a href="index.html" 
                        class="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-all">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Tìm kiếm lại
                    </a>
                    <a href="register.html" 
                        class="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                        Đăng ký CTV ngay
                    </a>
                </div>

                <!-- Help Text -->
                <div class="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-200 inline-block">
                    <p class="text-sm text-blue-800">
                        <span class="font-semibold">💡 Gợi ý:</span> Nếu bạn vừa đăng ký, vui lòng đợi vài phút để hệ thống cập nhật
                    </p>
                </div>
            </div>
        `;
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
            const emptyMessages = {
                'today': 'Hôm nay chưa có đơn hàng',
                'week': 'Tuần này chưa có đơn hàng',
                'month': 'Tháng này chưa có đơn hàng',
                '3months': '3 tháng gần đây chưa có đơn hàng',
                '6months': '6 tháng gần đây chưa có đơn hàng',
                'all': 'Chưa có đơn hàng'
            };
            
            ordersGrid.innerHTML = `
                <div class="col-span-full py-16 text-center">
                    <div class="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-purple-100 to-pink-100 rounded-3xl flex items-center justify-center">
                        <svg class="w-12 h-12 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                    </div>
                    <p class="text-gray-600 text-lg font-semibold mb-2">${emptyMessages[currentFilter] || 'Chưa có đơn hàng'}</p>
                    <p class="text-gray-500 text-sm">Đơn hàng sẽ xuất hiện ở đây khi có khách đặt hàng</p>
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
        const timestamp = order.created_at_unix || order.created_at || order.order_date || order.orderDate;
        const date = formatDate(timestamp);
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

        // Update active state for all filter buttons
        document.getElementById('filterAllTime').classList.toggle('active', filter === 'all');
        document.getElementById('filterToday').classList.toggle('active', filter === 'today');
        document.getElementById('filterWeek').classList.toggle('active', filter === 'week');
        document.getElementById('filterMonth').classList.toggle('active', filter === 'month');
        document.getElementById('filter3Months').classList.toggle('active', filter === '3months');
        document.getElementById('filter6Months').classList.toggle('active', filter === '6months');

        // Calculate date ranges using Vietnam timezone
        let startDate = null;

        if (filter === 'today') {
            // Today: from 00:00:00 VN time
            startDate = getVNStartOfToday();
        } else if (filter === 'week') {
            // This week: from Monday 00:00:00 VN time
            startDate = getVNStartOfWeek();
        } else if (filter === 'month') {
            // This month: from 1st day VN time
            startDate = getVNStartOfMonth();
        } else if (filter === '3months') {
            // Last 3 months from start of month 3 months ago
            const now = new Date();
            const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
            const [year, month] = vnDateStr.split('-');
            const targetMonth = parseInt(month) - 3;
            const targetYear = targetMonth <= 0 ? parseInt(year) - 1 : parseInt(year);
            const adjustedMonth = targetMonth <= 0 ? targetMonth + 12 : targetMonth;
            startDate = new Date(`${targetYear}-${String(adjustedMonth).padStart(2, '0')}-01T00:00:00+07:00`);
        } else if (filter === '6months') {
            // Last 6 months from start of month 6 months ago
            const now = new Date();
            const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
            const [year, month] = vnDateStr.split('-');
            const targetMonth = parseInt(month) - 6;
            const targetYear = targetMonth <= 0 ? parseInt(year) - 1 : parseInt(year);
            const adjustedMonth = targetMonth <= 0 ? targetMonth + 12 : targetMonth;
            startDate = new Date(`${targetYear}-${String(adjustedMonth).padStart(2, '0')}-01T00:00:00+07:00`);
        }

        // Apply filter
        if (startDate) {
            filteredOrders = allOrders.filter(order => {
                const timestamp = order.created_at_unix || order.created_at || order.order_date || order.orderDate;
                const orderDate = new Date(timestamp);
                return orderDate >= startDate;
            });
        } else {
            // 'all' - show all orders
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
            const timestamp = order.created_at_unix || order.created_at || order.order_date || order.orderDate;

            document.getElementById('modalOrderId').textContent = order.order_id || '#' + orderId;
            document.getElementById('modalOrderDate').textContent = formatDate(timestamp);
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

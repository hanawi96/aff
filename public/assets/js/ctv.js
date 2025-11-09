// CTV Order Lookup System
document.addEventListener('DOMContentLoaded', function () {
    const searchForm = document.getElementById('searchForm');
    const referralCodeInput = document.getElementById('referralCode');
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');
    const resultsContainer = document.getElementById('resultsContainer');

    // Google Apps Script Web App URL
    const GOOGLE_SCRIPT_URL = CONFIG.GOOGLE_SCRIPT_URL;

    // Pagination state
    let currentPage = 1;
    let itemsPerPage = 2; // Giảm xuống 2 để test giao diện phân trang
    let allOrders = [];
    let currentReferralCode = '';

    // Kiểm tra URL có mã CTV không và tự động load
    const urlParams = new URLSearchParams(window.location.search);
    const codeFromUrl = urlParams.get('code');

    if (codeFromUrl) {
        referralCodeInput.value = codeFromUrl.toUpperCase();
        // Tự động tìm kiếm khi có mã trong URL
        searchOrders(codeFromUrl.toUpperCase());
    } else {
        // Nếu không có mã CTV trong URL, load 10 đơn hàng mới nhất
        loadRecentOrders();
    }

    searchForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const referralCode = referralCodeInput.value.trim().toUpperCase();

        if (!referralCode) {
            showError('Vui lòng nhập mã Referral');
            return;
        }

        // Cập nhật URL với mã CTV
        updateUrlWithCode(referralCode);

        // Thực hiện tìm kiếm
        await searchOrders(referralCode);
    });

    // Hàm cập nhật URL
    function updateUrlWithCode(code) {
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('code', code);
        window.history.pushState({}, '', newUrl);
    }

    // Hàm tìm kiếm đơn hàng
    async function searchOrders(referralCode) {
        // Show loading
        hideAllStates();
        loadingState.classList.remove('hidden');

        try {
            // Fetch orders from Google Sheets
            const url = `${GOOGLE_SCRIPT_URL}?action=getOrders&referralCode=${encodeURIComponent(referralCode)}&t=${Date.now()}`;
            console.log('Fetching from:', url);

            const response = await fetch(url, {
                cache: 'no-cache'
            });
            console.log('Response status:', response.status);
            console.log('Response headers:', response.headers);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Response is not JSON:', text);
                throw new Error('Server trả về dữ liệu không đúng định dạng. Vui lòng kiểm tra lại Google Apps Script đã deploy chưa.');
            }

            const result = await response.json();
            console.log('Result:', result);

            if (!result.success) {
                throw new Error(result.error || 'Có lỗi xảy ra');
            }

            if (!result.orders || result.orders.length === 0) {
                showError(`Không tìm thấy đơn hàng nào với mã Referral: ${referralCode}`);
                return;
            }

            // Store orders and display with pagination
            allOrders = result.orders;
            currentReferralCode = referralCode;
            currentPage = 1;
            displayResults(referralCode);

        } catch (error) {
            console.error('Error:', error);
            showError(error.message || 'Có lỗi xảy ra khi tải dữ liệu');
        }
    }

    // Hàm load 10 đơn hàng mới nhất
    async function loadRecentOrders() {
        const recentLoadingState = document.getElementById('recentLoadingState');
        const recentOrdersContent = document.getElementById('recentOrdersContent');
        const recentOrdersSection = document.getElementById('recentOrdersSection');

        try {
            // Fetch recent orders from Google Sheets
            const url = `${GOOGLE_SCRIPT_URL}?action=getRecentOrders&limit=10&t=${Date.now()}`;
            console.log('Fetching recent orders from:', url);

            const response = await fetch(url, {
                cache: 'no-cache'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Server trả về dữ liệu không đúng định dạng');
            }

            const result = await response.json();
            console.log('Recent orders result:', result);

            if (result.success && result.orders && result.orders.length > 0) {
                displayRecentOrders(result.orders);
                recentLoadingState.classList.add('hidden');
                recentOrdersContent.classList.remove('hidden');
            } else {
                // Nếu không có đơn hàng, ẩn section
                recentOrdersSection.classList.add('hidden');
            }

        } catch (error) {
            console.error('Error loading recent orders:', error);
            // Ẩn section nếu có lỗi
            recentOrdersSection.classList.add('hidden');
        }
    }

    // Hàm hiển thị đơn hàng mới nhất
    function displayRecentOrders(orders) {
        const tableBody = document.getElementById('recentOrdersTableBody');
        tableBody.innerHTML = '';

        orders.forEach(order => {
            const row = createRecentOrderRow(order);
            tableBody.appendChild(row);
        });
    }

    // Hàm tạo row cho đơn hàng mới nhất
    function createRecentOrderRow(order) {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 transition-colors';

        const amount = parseAmount(order.totalAmount);

        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <button onclick="searchByCode('${order.referralCode}')" 
                    class="text-sm font-medium text-mom-pink hover:text-mom-purple transition-colors">
                    ${order.referralCode || 'N/A'}
                </button>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">${order.orderId || 'N/A'}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">${order.orderDate || 'N/A'}</div>
            </td>
            <td class="px-6 py-4">
                <div class="text-sm text-gray-900">${order.products || 'N/A'}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right">
                <div class="text-sm font-medium text-gray-900">${formatCurrency(amount)}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center">
                ${getStatusBadge(order.status)}
            </td>
        `;

        return tr;
    }

    // Hàm tìm kiếm theo mã CTV (được gọi từ onclick)
    window.searchByCode = function(code) {
        referralCodeInput.value = code;
        updateUrlWithCode(code);
        searchOrders(code);
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    function hideAllStates() {
        loadingState.classList.add('hidden');
        errorState.classList.add('hidden');
        resultsContainer.classList.add('hidden');
        // Ẩn recent orders section khi search
        const recentOrdersSection = document.getElementById('recentOrdersSection');
        if (recentOrdersSection) {
            recentOrdersSection.classList.add('hidden');
        }
    }

    function showError(message) {
        hideAllStates();
        
        // Tạo message thân thiện hơn cho mẹ bỉm
        let friendlyMessage = message;
        
        if (message.includes('Không tìm thấy đơn hàng')) {
            // Extract mã CTV từ message
            const codeMatch = message.match(/: (.+)$/);
            const code = codeMatch ? codeMatch[1] : '';
            
            friendlyMessage = `Mã CTV <strong class="font-bold text-purple-600">${code}</strong> chưa có đơn hàng nào. ` +
                            `Hãy bắt đầu chia sẻ link giới thiệu để nhận đơn đầu tiên nhé! 💪`;
        }
        
        document.getElementById('errorMessage').innerHTML = friendlyMessage;
        errorState.classList.remove('hidden');
        
        // Scroll to error message
        errorState.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function displayResults(referralCode) {
        hideAllStates();

        console.log('Orders data:', allOrders);

        // Calculate summary (for all orders)
        const totalOrders = allOrders.length;
        let totalRevenue = 0;
        let totalCommission = 0;

        allOrders.forEach(order => {
            const amount = parseAmount(order.totalAmount);
            console.log('Order amount:', order.totalAmount, '-> Parsed:', amount);
            totalRevenue += amount;
            totalCommission += amount * CONFIG.COMMISSION_RATE;
        });

        // Update summary cards
        document.getElementById('totalOrders').textContent = totalOrders;
        document.getElementById('totalRevenue').textContent = formatCurrency(totalRevenue);
        document.getElementById('totalCommission').textContent = formatCurrency(totalCommission);

        // Get orders for current page
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const ordersToDisplay = allOrders.slice(startIndex, endIndex);

        // Populate orders table
        const tableBody = document.getElementById('ordersTableBody');
        tableBody.innerHTML = '';

        ordersToDisplay.forEach(order => {
            const row = createOrderRow(order);
            tableBody.appendChild(row);
        });

        // Update pagination
        updatePagination();

        // Hiển thị nút sao chép link
        showCopyLinkButton(referralCode);

        resultsContainer.classList.remove('hidden');
    }

    function updatePagination() {
        const totalPages = Math.ceil(allOrders.length / itemsPerPage);
        const paginationContainer = document.getElementById('paginationContainer');
        
        // Show/hide pagination based on number of orders
        if (allOrders.length <= itemsPerPage) {
            paginationContainer.classList.add('hidden');
            return;
        }
        
        paginationContainer.classList.remove('hidden');

        // Update page info
        const startIndex = (currentPage - 1) * itemsPerPage + 1;
        const endIndex = Math.min(currentPage * itemsPerPage, allOrders.length);
        document.getElementById('pageInfo').textContent = `${startIndex}-${endIndex}`;
        document.getElementById('totalOrdersCount').textContent = allOrders.length;

        // Update prev/next buttons
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        
        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPages;

        // Generate page numbers
        const pageNumbersContainer = document.getElementById('pageNumbers');
        pageNumbersContainer.innerHTML = '';

        // Show max 5 page numbers
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        
        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }

        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.textContent = i;
            pageBtn.className = i === currentPage 
                ? 'px-3 py-1 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-lg text-sm font-medium'
                : 'px-3 py-1 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors';
            
            pageBtn.addEventListener('click', () => {
                currentPage = i;
                displayResults(currentReferralCode);
                // Scroll to top of results
                resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            
            pageNumbersContainer.appendChild(pageBtn);
        }
    }

    // Pagination button handlers
    document.getElementById('prevPageBtn').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            displayResults(currentReferralCode);
            resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });

    document.getElementById('nextPageBtn').addEventListener('click', () => {
        const totalPages = Math.ceil(allOrders.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            displayResults(currentReferralCode);
            resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });

    // Hàm hiển thị và xử lý nút sao chép link
    function showCopyLinkButton(referralCode) {
        const copyLinkContainer = document.getElementById('copyLinkContainer');
        const copyLinkBtn = document.getElementById('copyLinkBtn');

        copyLinkContainer.classList.remove('hidden');

        // Xóa event listener cũ (nếu có)
        const newBtn = copyLinkBtn.cloneNode(true);
        copyLinkBtn.parentNode.replaceChild(newBtn, copyLinkBtn);

        // Thêm event listener mới
        newBtn.addEventListener('click', async function () {
            const shareUrl = `${window.location.origin}${window.location.pathname}?code=${referralCode}`;

            try {
                await navigator.clipboard.writeText(shareUrl);

                // Thay đổi text tạm thời
                const originalText = newBtn.querySelector('span').textContent;
                newBtn.querySelector('span').textContent = '✓ Đã sao chép!';
                newBtn.classList.add('bg-green-100', 'text-green-600');
                newBtn.classList.remove('bg-blue-50', 'text-blue-600');

                setTimeout(() => {
                    newBtn.querySelector('span').textContent = originalText;
                    newBtn.classList.remove('bg-green-100', 'text-green-600');
                    newBtn.classList.add('bg-blue-50', 'text-blue-600');
                }, 2000);
            } catch (err) {
                console.error('Failed to copy:', err);
                alert('Không thể sao chép link. Vui lòng thử lại!');
            }
        });
    }

    function parseAmount(value) {
        if (!value) return 0;

        // Nếu đã là số
        if (typeof value === 'number') {
            // Nếu số nhỏ hơn 10000, nhân với 1000 (vì có thể đã bị format)
            if (value < 10000) {
                console.log('Parse amount (number < 10000):', value, '-> Multiplied by 1000:', value * 1000);
                return value * 1000;
            }
            return value;
        }

        // Loại bỏ tất cả ký tự không phải số (giữ lại dấu chấm và dấu phẩy)
        const cleanValue = value.toString()
            .replace(/[^\d.,]/g, '')  // Giữ số, dấu chấm, dấu phẩy
            .replace(/\./g, '')        // Xóa dấu chấm (phân cách hàng nghìn)
            .replace(/,/g, '.');       // Thay dấu phẩy thành dấu chấm (thập phân)

        const parsed = parseFloat(cleanValue) || 0;
        console.log('Parse amount (string):', value, '->', cleanValue, '->', parsed);
        return parsed;
    }

    function createOrderRow(order) {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 transition-colors';

        const amount = parseAmount(order.totalAmount);
        const commission = amount * CONFIG.COMMISSION_RATE;

        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">${order.orderId || 'N/A'}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">${order.orderDate || 'N/A'}</div>
            </td>
            <td class="px-6 py-4">
                <div class="text-sm text-gray-900">${order.customerName || 'N/A'}</div>
                <div class="text-sm text-gray-500">${order.customerPhone || ''}</div>
            </td>
            <td class="px-6 py-4">
                <div class="text-sm text-gray-900">${order.products || 'N/A'}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right">
                <div class="text-sm font-medium text-gray-900">${formatCurrency(amount)}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right">
                <div class="text-sm font-bold text-green-600">${formatCurrency(commission)}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center">
                ${getStatusBadge(order.status)}
            </td>
        `;

        return tr;
    }

    function getStatusBadge(status) {
        const statusMap = {
            'Đang xử lý': 'bg-yellow-100 text-yellow-800',
            'Đã xác nhận': 'bg-blue-100 text-blue-800',
            'Đang giao': 'bg-purple-100 text-purple-800',
            'Hoàn thành': 'bg-green-100 text-green-800',
            'Đã hủy': 'bg-red-100 text-red-800'
        };

        const colorClass = statusMap[status] || 'bg-gray-100 text-gray-800';

        return `
            <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${colorClass}">
                ${status || 'N/A'}
            </span>
        `;
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount);
    }
});

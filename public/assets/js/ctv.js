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
    let itemsPerPage = 10; // 10 đơn hàng mỗi trang
    let allOrders = [];
    let filteredOrders = [];
    let currentReferralCode = '';
    let currentFilter = 'all'; // 'all' hoặc 'today'

    // Kiểm tra URL có mã CTV hoặc SĐT không và tự động load
    const urlParams = new URLSearchParams(window.location.search);
    const codeFromUrl = urlParams.get('code');

    if (codeFromUrl) {
        referralCodeInput.value = codeFromUrl;
        
        // Tự động nhận diện và tìm kiếm
        const isPhone = /^0?\d{9,10}$/.test(codeFromUrl);
        
        if (isPhone) {
            console.log('🔍 Auto-search by phone from URL:', codeFromUrl);
            searchOrdersByPhone(codeFromUrl);
        } else {
            console.log('🔍 Auto-search by referral code from URL:', codeFromUrl);
            searchOrders(codeFromUrl.toUpperCase());
        }
    } else {
        // Nếu không có mã CTV trong URL, load dashboard
        loadDashboard();
    }

    // Helper function to show/hide loading state
    function setButtonLoading(isLoading) {
        const searchButton = document.getElementById('searchButton');
        const searchIcon = document.getElementById('searchIcon');
        const loadingSpinner = document.getElementById('loadingSpinner');
        const searchButtonText = document.getElementById('searchButtonText');

        if (isLoading) {
            // Show loading
            searchIcon.classList.add('hidden');
            loadingSpinner.classList.remove('hidden');
            if (searchButtonText) searchButtonText.textContent = 'Đang tìm...';
            if (searchButton) searchButton.disabled = true;
        } else {
            // Hide loading
            searchIcon.classList.remove('hidden');
            loadingSpinner.classList.add('hidden');
            if (searchButtonText) searchButtonText.textContent = 'Tra cứu';
            if (searchButton) searchButton.disabled = false;
        }
    }

    searchForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const input = referralCodeInput.value.trim();

        if (!input) {
            showError('Vui lòng nhập mã CTV hoặc số điện thoại');
            return;
        }

        // Show loading
        setButtonLoading(true);

        try {
            // Tự động nhận diện: Mã CTV hay số điện thoại?
            const isPhone = /^0?\d{9,10}$/.test(input); // Số điện thoại VN: 0xxxxxxxxx hoặc xxxxxxxxx
            
            if (isPhone) {
                console.log('🔍 Detected phone number:', input);
                // Cập nhật URL với số điện thoại
                updateUrlWithCode(input);
                // Tìm kiếm theo số điện thoại
                await searchOrdersByPhone(input);
            } else {
                console.log('🔍 Detected referral code:', input);
                const referralCode = input.toUpperCase();
                // Cập nhật URL với mã CTV
                updateUrlWithCode(referralCode);
                // Tìm kiếm theo mã CTV
                await searchOrders(referralCode);
            }
        } finally {
            // Hide loading (always execute, even if error)
            setButtonLoading(false);
        }
    });

    // Hàm cập nhật URL
    function updateUrlWithCode(code) {
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('code', code);
        window.history.pushState({}, '', newUrl);
    }

    // Hàm tìm kiếm đơn hàng theo mã CTV
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
            console.log('📦 Full API Response:', result);
            console.log('📋 CTV Info from backend:', result.ctvInfo);
            console.log('📊 CTV Info type:', typeof result.ctvInfo);
            console.log('📊 CTV Info is null?', result.ctvInfo === null);
            console.log('📊 CTV Info is undefined?', result.ctvInfo === undefined);

            if (!result.success) {
                throw new Error(result.error || 'Có lỗi xảy ra');
            }

            if (!result.orders || result.orders.length === 0) {
                showError(`Không tìm thấy đơn hàng nào với mã Referral: ${referralCode}`);
                return;
            }

            // Store orders and display with pagination
            allOrders = result.orders;
            filteredOrders = result.orders;
            currentReferralCode = referralCode;
            currentPage = 1;
            currentFilter = 'all';
            
            // Hiển thị thông tin CTV với fallback
            let ctvInfo = result.ctvInfo;
            
            console.log('🔍 Checking ctvInfo validity...');
            console.log('  - ctvInfo exists?', !!ctvInfo);
            console.log('  - ctvInfo.name:', ctvInfo?.name);
            console.log('  - ctvInfo.phone:', ctvInfo?.phone);
            console.log('  - ctvInfo.address:', ctvInfo?.address);
            
            // Nếu không có ctvInfo hoặc ctvInfo rỗng, tạo fallback từ mã CTV
            if (!ctvInfo || !ctvInfo.name || ctvInfo.name === 'Chưa cập nhật' || ctvInfo.name === 'Không tìm thấy') {
                console.warn('⚠️ No CTV info from backend, using fallback');
                console.warn('   Reason:', !ctvInfo ? 'ctvInfo is null/undefined' : 
                            !ctvInfo.name ? 'ctvInfo.name is empty' : 
                            `ctvInfo.name is "${ctvInfo.name}"`);
                ctvInfo = {
                    name: 'CTV ' + referralCode,
                    phone: '****', // Sẽ hiển thị là ****
                    address: 'Xem trong đơn hàng'
                };
                console.log('📝 Fallback ctvInfo:', ctvInfo);
            } else {
                console.log('✅ Using backend ctvInfo:', ctvInfo);
            }
            
            displayCollaboratorInfo(ctvInfo);
            displayResults(referralCode);

        } catch (error) {
            console.error('Error:', error);
            showError(error.message || 'Có lỗi xảy ra khi tải dữ liệu');
        }
    }

    // ⭐ Hàm mới: Tìm kiếm đơn hàng theo số điện thoại
    async function searchOrdersByPhone(phone) {
        // Show loading
        hideAllStates();
        loadingState.classList.remove('hidden');

        try {
            // Fetch orders from Google Sheets by phone
            const url = `${GOOGLE_SCRIPT_URL}?action=getOrdersByPhone&phone=${encodeURIComponent(phone)}&t=${Date.now()}`;
            console.log('📞 Fetching orders by phone from:', url);

            const response = await fetch(url, {
                cache: 'no-cache'
            });
            console.log('Response status:', response.status);

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
                showError(`Không tìm thấy đơn hàng nào với số điện thoại: ${phone}`);
                return;
            }

            // Store orders and display with pagination
            allOrders = result.orders;
            filteredOrders = result.orders;
            currentReferralCode = result.referralCode; // Lưu mã CTV tìm được
            currentPage = 1;
            currentFilter = 'all';
            
            // Hiển thị thông tin CTV với fallback
            let ctvInfo = result.ctvInfo;
            
            // Nếu không có ctvInfo hoặc ctvInfo rỗng, tạo fallback
            if (!ctvInfo || !ctvInfo.name || ctvInfo.name === 'Chưa cập nhật' || ctvInfo.name === 'Không tìm thấy') {
                console.warn('⚠️ No CTV info from backend, using fallback');
                ctvInfo = {
                    name: result.referralCode ? ('CTV ' + result.referralCode) : 'Cộng tác viên',
                    phone: phone || '****', // Hiển thị SĐT tìm kiếm hoặc ****
                    address: 'Xem trong đơn hàng'
                };
            }
            
            displayCollaboratorInfo(ctvInfo);
            
            // Hiển thị kết quả với thông tin số điện thoại
            displayResults(result.referralCode, phone);

        } catch (error) {
            console.error('Error:', error);
            showError(error.message || 'Có lỗi xảy ra khi tải dữ liệu');
        }
    }

    // Hàm load dashboard
    async function loadDashboard() {
        console.log('🚀 loadDashboard() called');

        const dashboardLoadingState = document.getElementById('dashboardLoadingState');
        const dashboardContent = document.getElementById('dashboardContent');
        const dashboardSection = document.getElementById('dashboardSection');

        console.log('📍 Dashboard elements:', {
            loadingState: dashboardLoadingState ? 'found' : 'NOT FOUND',
            content: dashboardContent ? 'found' : 'NOT FOUND',
            section: dashboardSection ? 'found' : 'NOT FOUND'
        });

        try {
            // Fetch dashboard stats from Google Sheets
            const url = `${GOOGLE_SCRIPT_URL}?action=getDashboardStats&t=${Date.now()}`;
            console.log('📡 Fetching dashboard stats from:', url);

            const response = await fetch(url, {
                cache: 'no-cache'
            });

            console.log('📥 Response status:', response.status);
            console.log('📥 Response ok:', response.ok);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const contentType = response.headers.get('content-type');
            console.log('📄 Content-Type:', contentType);

            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('❌ Response is not JSON:', text);
                throw new Error('Server trả về dữ liệu không đúng định dạng');
            }

            const result = await response.json();
            console.log('✅ Dashboard stats result:', result);
            console.log('📊 Stats data:', result.stats);

            if (result.success) {
                console.log('✅ Success! Displaying dashboard...');
                displayDashboard(result.stats);
                dashboardLoadingState.classList.add('hidden');
                dashboardContent.classList.remove('hidden');
            } else {
                console.warn('⚠️ Result success = false, showing empty dashboard');
                // Nếu có lỗi, vẫn hiển thị dashboard với số 0
                displayDashboard({
                    totalCTV: 0,
                    totalOrders: 0,
                    totalRevenue: 0,
                    totalCommission: 0,
                    topPerformers: []
                });
                dashboardLoadingState.classList.add('hidden');
                dashboardContent.classList.remove('hidden');
            }

        } catch (error) {
            console.error('❌ Error loading dashboard:', error);
            console.error('❌ Error stack:', error.stack);
            // Hiển thị dashboard với số 0 nếu có lỗi
            displayDashboard({
                totalCTV: 0,
                totalOrders: 0,
                totalRevenue: 0,
                totalCommission: 0,
                topPerformers: []
            });
            dashboardLoadingState.classList.add('hidden');
            dashboardContent.classList.remove('hidden');
        }
    }

    // Hàm hiển thị dashboard
    function displayDashboard(stats) {
        console.log('🎨 displayDashboard() called with stats:', stats);

        // Update stats cards
        console.log('📝 Updating stats cards...');
        document.getElementById('dashTotalCTV').textContent = stats.totalCTV || 0;
        document.getElementById('dashTotalOrders').textContent = stats.totalOrders || 0;
        document.getElementById('dashTotalRevenue').textContent = formatCurrency(stats.totalRevenue || 0);
        document.getElementById('dashTotalCommission').textContent = formatCurrency(stats.totalCommission || 0);

        console.log('✅ Stats cards updated:', {
            totalCTV: stats.totalCTV,
            totalOrders: stats.totalOrders,
            totalRevenue: stats.totalRevenue,
            totalCommission: stats.totalCommission
        });

        // Display top performers
        const topPerformersContainer = document.getElementById('topPerformersContainer');
        console.log('🏆 Top performers container:', topPerformersContainer ? 'found' : 'NOT FOUND');
        console.log('🏆 Top performers data:', stats.topPerformers);

        if (!stats.topPerformers || stats.topPerformers.length === 0) {
            console.log('⚠️ No top performers, showing empty state');
            topPerformersContainer.innerHTML = `
                <div class="text-center py-8">
                    <svg class="w-16 h-16 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
                    </svg>
                    <p class="text-gray-500 text-sm">Chưa có dữ liệu CTV</p>
                </div>
            `;
            return;
        }

        console.log(`✅ Displaying ${stats.topPerformers.length} top performers`);
        topPerformersContainer.innerHTML = stats.topPerformers.map((performer, index) => {
            const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
            const colors = [
                'from-yellow-50 to-orange-50 border-yellow-200',
                'from-gray-50 to-slate-100 border-gray-200',
                'from-orange-50 to-amber-50 border-orange-200',
                'from-blue-50 to-cyan-50 border-blue-200',
                'from-purple-50 to-pink-50 border-purple-200'
            ];

            // Che 4 ký tự cuối của mã CTV
            const maskedCode = performer.referralCode.length > 4
                ? performer.referralCode.slice(0, -4) + '****'
                : performer.referralCode;

            console.log(`  ${medals[index]} ${maskedCode}: ${performer.orderCount} đơn, ${formatCurrency(performer.totalRevenue)}`);

            return `
                <div class="flex items-center justify-between p-3 bg-gradient-to-r ${colors[index]} rounded-lg border mb-2 last:mb-0 hover:shadow-sm transition-shadow">
                    <div class="flex items-center gap-3 flex-1 min-w-0">
                        <div class="text-2xl flex-shrink-0 drop-shadow-sm">${medals[index]}</div>
                        <div class="flex-1 min-w-0">
                            <p class="font-bold text-gray-800 text-sm truncate">${maskedCode}</p>
                            <p class="text-xs text-gray-600">${performer.orderCount} đơn</p>
                        </div>
                    </div>
                    <div class="text-right flex-shrink-0 ml-2">
                        <p class="font-bold text-gray-800 text-sm">${formatCurrency(performer.totalRevenue)}</p>
                        <p class="text-xs text-green-600 font-medium">Hoa hồng: ${formatCurrency(performer.commission)}</p>
                    </div>
                </div>
            `;
        }).join('');

        console.log('✅ Dashboard display complete!');
    }

    function hideAllStates() {
        loadingState.classList.add('hidden');
        errorState.classList.add('hidden');
        resultsContainer.classList.add('hidden');
        // Ẩn dashboard section khi search
        const dashboardSection = document.getElementById('dashboardSection');
        if (dashboardSection) {
            dashboardSection.classList.add('hidden');
        }
    }

    function showError(message) {
        hideAllStates();

        // Tạo message thân thiện hơn cho mẹ bỉm
        let friendlyMessage = message;

        if (message.includes('Không tìm thấy đơn hàng')) {
            // Extract mã CTV hoặc SĐT từ message
            const codeMatch = message.match(/: (.+)$/);
            const code = codeMatch ? codeMatch[1] : '';

            if (message.includes('số điện thoại')) {
                friendlyMessage = `Số điện thoại <strong class="font-bold text-purple-600">${code}</strong> chưa có đơn hàng nào. ` +
                    `Hãy bắt đầu chia sẻ link giới thiệu để nhận đơn đầu tiên nhé! 💪`;
            } else {
                friendlyMessage = `Mã CTV <strong class="font-bold text-purple-600">${code}</strong> chưa có đơn hàng nào. ` +
                    `Hãy bắt đầu chia sẻ link giới thiệu để nhận đơn đầu tiên nhé! 💪`;
            }
        } else if (message.includes('Không tìm thấy cộng tác viên')) {
            // Extract SĐT từ message
            const phoneMatch = message.match(/: (.+)$/);
            const phone = phoneMatch ? phoneMatch[1] : '';
            
            friendlyMessage = `Không tìm thấy cộng tác viên với số điện thoại <strong class="font-bold text-purple-600">${phone}</strong>. ` +
                `Vui lòng kiểm tra lại số điện thoại hoặc <a href="/" class="text-pink-600 hover:underline font-semibold">đăng ký làm CTV</a> nếu bạn chưa đăng ký! 😊`;
        }

        document.getElementById('errorMessage').innerHTML = friendlyMessage;
        errorState.classList.remove('hidden');

        // Scroll to error message
        errorState.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Hàm hiển thị thông tin cộng tác viên
    function displayCollaboratorInfo(ctvInfo) {
        console.log('📋 displayCollaboratorInfo called with:', ctvInfo);
        
        // Viết hoa chữ cái đầu của tên
        const capitalizeName = (name) => {
            if (!name) return name;
            
            // Tách các từ bằng khoảng trắng
            return name.split(' ')
                .map(word => {
                    if (!word) return word;
                    // Viết hoa chữ cái đầu, viết thường phần còn lại
                    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
                })
                .join(' ');
        };
        
        // Che 4 số cuối của số điện thoại
        const maskPhone = (phone) => {
            if (!phone) return '****';
            
            let phoneStr = phone.toString().trim();
            
            // Nếu là "****" thì giữ nguyên
            if (phoneStr === '****') return '****';
            
            // Nếu là số điện thoại (chỉ chứa số)
            if (/^\d+$/.test(phoneStr)) {
                // Thêm số 0 ở đầu nếu chưa có (số điện thoại VN)
                if (!phoneStr.startsWith('0') && phoneStr.length === 9) {
                    phoneStr = '0' + phoneStr;
                    console.log('📱 Added leading 0 to phone:', phoneStr);
                }
                
                // Nếu đủ dài (>= 4 số), che 4 số cuối
                if (phoneStr.length >= 4) {
                    return phoneStr.slice(0, -4) + '****';
                }
                // Nếu quá ngắn, trả về ****
                return '****';
            }
            
            // Nếu là text khác, trả về ****
            return '****';
        };

        // Đảm bảo có giá trị mặc định
        const defaultInfo = {
            name: 'Cộng tác viên',
            phone: '****',
            address: 'Xem trong đơn hàng'
        };

        const finalInfo = {
            name: (ctvInfo && ctvInfo.name) ? capitalizeName(ctvInfo.name) : defaultInfo.name,
            phone: (ctvInfo && ctvInfo.phone) ? ctvInfo.phone : defaultInfo.phone,
            address: (ctvInfo && ctvInfo.address) ? ctvInfo.address : defaultInfo.address
        };

        // Cập nhật thông tin vào inline box (trong search box)
        const nameInlineEl = document.getElementById('ctvNameInline');
        const phoneInlineEl = document.getElementById('ctvPhoneInline');
        const addressInlineEl = document.getElementById('ctvAddressInline');
        const inlineBoxEl = document.getElementById('ctvInfoInline');

        if (nameInlineEl) {
            nameInlineEl.textContent = finalInfo.name;
        }
        
        if (phoneInlineEl) {
            phoneInlineEl.textContent = maskPhone(finalInfo.phone);
        }
        
        if (addressInlineEl) {
            addressInlineEl.textContent = finalInfo.address;
        }

        // Hiển thị inline box
        if (inlineBoxEl) {
            inlineBoxEl.classList.remove('hidden');
        }

        console.log('✅ CTV info displayed inline:', {
            name: nameInlineEl ? nameInlineEl.textContent : 'element not found',
            phone: phoneInlineEl ? phoneInlineEl.textContent : 'element not found',
            address: addressInlineEl ? addressInlineEl.textContent : 'element not found'
        });
    }

    function displayResults(referralCode, phone = null) {
        hideAllStates();

        console.log('Orders data:', allOrders);
        console.log('Filtered orders:', filteredOrders);
        console.log('Referral code:', referralCode);
        console.log('Phone:', phone);

        // Calculate summary (based on filtered orders)
        const totalOrders = filteredOrders.length;
        let totalRevenue = 0;
        let totalCommission = 0;

        filteredOrders.forEach(order => {
            const amount = parseAmount(order.totalAmount);
            console.log('Order amount:', order.totalAmount, '-> Parsed:', amount);
            totalRevenue += amount;
            totalCommission += amount * CONFIG.COMMISSION_RATE;
        });

        // Update summary cards
        document.getElementById('totalOrders').textContent = totalOrders;
        document.getElementById('totalRevenue').textContent = formatCurrency(totalRevenue);
        document.getElementById('totalCommission').textContent = formatCurrency(totalCommission);

        // Get orders for current page (from filtered orders)
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const ordersToDisplay = filteredOrders.slice(startIndex, endIndex);

        // Populate orders table
        const tableBody = document.getElementById('ordersTableBody');
        tableBody.innerHTML = '';

        // Check if no orders found (especially for "today" filter)
        if (ordersToDisplay.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = `
                <td colspan="4" class="px-6 py-12 text-center">
                    <div class="flex flex-col items-center justify-center">
                        <svg class="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                        <p class="text-gray-600 text-lg font-medium mb-1">
                            ${currentFilter === 'today' ? 'Hôm nay bạn chưa có đơn hàng nào cả?' : 'Chưa có đơn hàng nào'}
                        </p>
                        <p class="text-gray-500 text-sm">
                            ${currentFilter === 'today' ? 'Hãy cố gắng hơn nha! 💪' : 'Hãy bắt đầu chia sẻ link để có đơn đầu tiên'}
                        </p>
                    </div>
                </td>
            `;
            tableBody.appendChild(emptyRow);
        } else {
            ordersToDisplay.forEach(order => {
                const row = createOrderRow(order);
                tableBody.appendChild(row);
            });
        }

        // Update pagination
        updatePagination();

        resultsContainer.classList.remove('hidden');
    }

    function updatePagination() {
        const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
        const paginationContainer = document.getElementById('paginationContainer');

        // Show/hide pagination based on number of orders
        if (filteredOrders.length <= itemsPerPage) {
            paginationContainer.classList.add('hidden');
            return;
        }

        paginationContainer.classList.remove('hidden');

        // Update page info
        const startIndex = (currentPage - 1) * itemsPerPage + 1;
        const endIndex = Math.min(currentPage * itemsPerPage, filteredOrders.length);
        document.getElementById('pageInfo').textContent = `${startIndex}-${endIndex}`;
        document.getElementById('totalOrdersCount').textContent = filteredOrders.length;

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
        const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            displayResults(currentReferralCode);
            resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });

    // Filter orders function
    window.filterOrders = function (filter) {
        console.log('Filter changed to:', filter);
        currentFilter = filter;
        currentPage = 1;

        // Update tab active state
        document.getElementById('filterAllTime').classList.toggle('active', filter === 'all');
        document.getElementById('filterToday').classList.toggle('active', filter === 'today');

        // Filter orders
        if (filter === 'today') {
            const today = new Date();
            const todayStr = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;

            filteredOrders = allOrders.filter(order => {
                return order.orderDate && order.orderDate.includes(todayStr);
            });

            console.log('Today orders:', filteredOrders.length);
        } else {
            filteredOrders = allOrders;
        }

        displayResults(currentReferralCode);
    };

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
            <td class="px-3 sm:px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">${order.orderDate || 'N/A'}</div>
            </td>
            <td class="px-3 sm:px-6 py-4 whitespace-nowrap text-right">
                <div class="text-sm font-medium text-gray-900">${formatCurrency(amount)}</div>
            </td>
            <td class="px-3 sm:px-6 py-4 whitespace-nowrap text-right">
                <div class="text-sm font-bold text-green-600">${formatCurrency(commission)}</div>
            </td>
            <td class="px-3 sm:px-6 py-4 whitespace-nowrap text-center">
                <button onclick='showOrderDetail(${JSON.stringify(order).replace(/'/g, "&apos;")})' 
                    class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg transition-all">
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                        <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
                    </svg>
                </button>
            </td>
        `;

        return tr;
    }

    // Show order detail modal
    window.showOrderDetail = function (order) {
        const amount = parseAmount(order.totalAmount);
        const commission = amount * CONFIG.COMMISSION_RATE;

        // Populate modal with order data
        document.getElementById('modalOrderId').textContent = order.orderId || 'N/A';
        document.getElementById('modalOrderDate').textContent = order.orderDate || 'N/A';
        document.getElementById('modalCustomerName').textContent = order.customerName || 'N/A';
        document.getElementById('modalCustomerPhone').textContent = order.customerPhone || 'N/A';
        document.getElementById('modalProducts').textContent = order.products || 'N/A';
        document.getElementById('modalTotalAmount').textContent = formatCurrency(amount);
        document.getElementById('modalCommission').textContent = formatCurrency(commission);

        // Update status badge
        const statusHtml = getStatusBadge(order.status);
        document.getElementById('modalOrderStatus').innerHTML = statusHtml;

        // Show modal
        document.getElementById('orderDetailModal').classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Prevent background scroll
    };

    // Close order detail modal
    window.closeOrderDetailModal = function () {
        document.getElementById('orderDetailModal').classList.add('hidden');
        document.body.style.overflow = ''; // Restore scroll
    };

    // Close modal when clicking outside
    document.getElementById('orderDetailModal').addEventListener('click', function (e) {
        if (e.target === this) {
            closeOrderDetailModal();
        }
    });

    function getStatusBadge(status) {
        const statusMap = {
            'Đang xử lý': 'bg-yellow-100 text-yellow-800',
            'Đã xác nhận': 'bg-blue-100 text-blue-800',
            'Đang giao': 'bg-purple-100 text-purple-800',
            'Hoàn thành': 'bg-green-100 text-green-800',
            'Đã hủy': 'bg-red-100 text-red-800'
        };

        // Nếu không có status hoặc status rỗng, mặc định là "Đã xác nhận"
        const displayStatus = status && status.trim() !== '' ? status : 'Đã xác nhận';
        const colorClass = statusMap[displayStatus] || 'bg-blue-100 text-blue-800';

        return `
            <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${colorClass}">
                ${displayStatus}
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

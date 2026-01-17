// Orders CTV Modal Module
// Handles collaborator (CTV) information modal
// NOTE: All functions are global scope for compatibility with existing code

// Show collaborator modal
async function showCollaboratorModal(referralCode) {
    try {
        // Get collaborator info from existing orders data
        const ctvOrders = allOrdersData.filter(order => order.referral_code === referralCode);

        if (ctvOrders.length === 0) {
            showToast('Không tìm thấy thông tin CTV', 'error');
            return;
        }

        // Calculate stats from orders - use product_total + shipping_fee for accurate revenue
        const stats = {
            totalOrders: ctvOrders.length,
            totalRevenue: ctvOrders.reduce((sum, order) => {
                return sum + (order.total_amount || 0);
            }, 0),
            totalCommission: ctvOrders.reduce((sum, order) => {
                // Recalculate commission based on current CTV commission_rate if available
                if (order.ctv_commission_rate !== undefined && order.ctv_commission_rate !== null) {
                    // Calculate product_total from total_amount - shipping_fee
                    const totalAmount = order.total_amount || 0;
                    const shippingFee = order.shipping_fee || 0;
                    const productTotal = totalAmount - shippingFee;
                    return sum + Math.round(productTotal * order.ctv_commission_rate);
                }
                return sum + (order.commission || 0);
            }, 0)
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
                        <a href="ctv-detail.html?code=${encodeURIComponent(referralCode)}" 
                            class="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center gap-3">
                            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            <span>Xem chi tiết CTV</span>
                            <svg class="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                            </svg>
                        </a>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

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


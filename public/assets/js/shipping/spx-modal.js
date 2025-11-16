// SPX Order Creation Modal

/**
 * Hiển thị modal tạo vận đơn SPX
 * @param {number} orderId - ID đơn hàng
 */
async function showCreateSPXModal(orderId) {
    const order = allOrdersData.find(o => o.id === orderId);
    if (!order) {
        showToast('Không tìm thấy đơn hàng', 'error');
        return;
    }

    // Parse products
    let productsDescription = '';
    try {
        let products = [];
        try {
            products = JSON.parse(order.products);
        } catch (e) {
            products = [{ name: order.products || 'Sản phẩm' }];
        }

        productsDescription = products.map(p => {
            const name = typeof p === 'string' ? p : (p.name || 'Sản phẩm');
            const qty = typeof p === 'object' && p.quantity ? p.quantity : 1;
            return `${name} x${qty}`;
        }).join(', ');
    } catch (e) {
        productsDescription = order.products || 'Sản phẩm';
    }

    const modalHtml = `
        <div id="spxModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <!-- Header -->
                <div class="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                        <h3 class="text-xl font-bold text-white">Tạo vận đơn Shopee Express</h3>
                    </div>
                    <button onclick="closeSPXModal()" class="text-white hover:text-gray-200">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <!-- Body -->
                <div class="p-6">
                    <!-- Order Info -->
                    <div class="bg-blue-50 rounded-lg p-4 mb-6">
                        <h4 class="font-semibold text-blue-900 mb-2">Thông tin đơn hàng</h4>
                        <div class="grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <span class="text-gray-600">Mã đơn:</span>
                                <span class="font-semibold ml-2">${escapeHtml(order.order_id)}</span>
                            </div>
                            <div>
                                <span class="text-gray-600">Giá trị COD:</span>
                                <span class="font-semibold ml-2 text-green-600">${formatCurrency(order.total_amount || 0)}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Receiver Info -->
                    <div class="mb-6">
                        <h4 class="font-semibold text-gray-900 mb-3">Thông tin người nhận</h4>
                        <div class="space-y-3">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Họ và tên</label>
                                <input type="text" id="spx_receiver_name" value="${escapeHtml(order.customer_name || '')}" 
                                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                                <input type="text" id="spx_receiver_phone" value="${escapeHtml(order.customer_phone || '')}" 
                                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Địa chỉ đầy đủ</label>
                                <textarea id="spx_receiver_address" rows="3" 
                                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent">${escapeHtml(order.address || '')}</textarea>
                            </div>
                        </div>
                    </div>

                    <!-- Parcel Info -->
                    <div class="mb-6">
                        <h4 class="font-semibold text-gray-900 mb-3">Thông tin hàng hóa</h4>
                        <div class="space-y-3">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Mô tả hàng hóa</label>
                                <input type="text" id="spx_parcel_description" value="${escapeHtml(productsDescription)}" 
                                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent">
                            </div>
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Cân nặng (gram)</label>
                                    <input type="number" id="spx_parcel_weight" value="500" 
                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Giá trị COD (đ)</label>
                                    <input type="number" id="spx_cod_amount" value="${order.total_amount || 0}" 
                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent">
                                </div>
                            </div>
                            <div class="grid grid-cols-3 gap-3">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Dài (cm)</label>
                                    <input type="number" id="spx_parcel_length" value="20" 
                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Rộng (cm)</label>
                                    <input type="number" id="spx_parcel_width" value="15" 
                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Cao (cm)</label>
                                    <input type="number" id="spx_parcel_height" value="10" 
                                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Note -->
                    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
                        <p class="text-sm text-yellow-800">
                            <strong>Lưu ý:</strong> Vui lòng kiểm tra kỹ thông tin trước khi tạo vận đơn. 
                            Sau khi tạo, mã vận đơn sẽ được lưu vào đơn hàng.
                        </p>
                    </div>
                </div>

                <!-- Footer -->
                <div class="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3">
                    <button onclick="closeSPXModal()" 
                        class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                        Hủy
                    </button>
                    <button onclick="confirmCreateSPXOrder(${orderId})" 
                        class="px-6 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:from-orange-600 hover:to-red-600 transition-colors font-semibold">
                        Tạo vận đơn
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

/**
 * Đóng modal
 */
function closeSPXModal() {
    const modal = document.getElementById('spxModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Xác nhận tạo vận đơn SPX
 */
async function confirmCreateSPXOrder(orderId) {
    const receiverName = document.getElementById('spx_receiver_name').value.trim();
    const receiverPhone = document.getElementById('spx_receiver_phone').value.trim();
    const receiverAddress = document.getElementById('spx_receiver_address').value.trim();
    const parcelDescription = document.getElementById('spx_parcel_description').value.trim();
    const parcelWeight = parseInt(document.getElementById('spx_parcel_weight').value) || 500;
    const codAmount = parseInt(document.getElementById('spx_cod_amount').value) || 0;
    const parcelLength = parseInt(document.getElementById('spx_parcel_length').value) || 20;
    const parcelWidth = parseInt(document.getElementById('spx_parcel_width').value) || 15;
    const parcelHeight = parseInt(document.getElementById('spx_parcel_height').value) || 10;

    // Validation
    if (!receiverName || !receiverPhone || !receiverAddress) {
        showToast('Vui lòng điền đầy đủ thông tin người nhận', 'error');
        return;
    }

    if (!parcelDescription) {
        showToast('Vui lòng nhập mô tả hàng hóa', 'error');
        return;
    }

    // Show loading
    const submitBtn = event.target;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="inline-block animate-spin mr-2">⏳</span> Đang tạo...';

    try {
        // Prepare order data
        const orderData = {
            orderId: orderId,
            receiver: {
                name: receiverName,
                phone: receiverPhone,
                address: receiverAddress
            },
            parcel: {
                description: parcelDescription,
                weight: parcelWeight,
                length: parcelLength,
                width: parcelWidth,
                height: parcelHeight,
                codAmount: codAmount
            }
        };

        // Call API
        const result = await spxClient.createOrder(orderData);

        if (result.success) {
            showToast('✅ Tạo vận đơn SPX thành công!', 'success');
            closeSPXModal();
            
            // Reload orders to show tracking number
            await loadOrdersData();
            
            // Show tracking info
            if (result.trackingNumber) {
                showToast(`Mã vận đơn: ${result.trackingNumber}`, 'success');
            }
        } else {
            throw new Error(result.error || 'Không thể tạo vận đơn');
        }
    } catch (error) {
        console.error('Error creating SPX order:', error);
        showToast('❌ Lỗi: ' + error.message, 'error');
        
        // Restore button
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Tạo vận đơn';
    }
}

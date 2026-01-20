// Orders Profit Modal Module
// Handles profit breakdown modal display
// NOTE: All functions are global scope for compatibility with existing code

// Show profit breakdown modal
function showProfitBreakdown(orderId) {
    const order = allOrdersData.find(o => o.id === orderId);
    if (!order) return;

    const { totalAmount, productCost } = calculateOrderTotals(order);

    // Get actual costs from order
    const shippingFee = order.shipping_fee || 0;
    const shippingCost = order.shipping_cost || 0;
    const commission = order.commission || 0;
    
    // Parse packaging details first to recalculate packaging cost
    let packagingDetails = null;
    let packagingCost = 0;
    try {
        packagingDetails = order.packaging_details ? JSON.parse(order.packaging_details) : null;
        
        // Recalculate packaging cost from details (only per_order items)
        if (packagingDetails && packagingDetails.per_order) {
            // Handle both old format (direct numbers) and new format (objects with cost/name)
            const perOrder = packagingDetails.per_order;
            
            // Support both old field names (box_shipping) and new field names (hop_carton)
            const hopCartonCost = perOrder.hop_carton 
                ? (typeof perOrder.hop_carton === 'object' ? perOrder.hop_carton.cost : perOrder.hop_carton)
                : (typeof perOrder.box_shipping === 'object' ? perOrder.box_shipping.cost : perOrder.box_shipping || 0);
            
            packagingCost = 
                (typeof perOrder.bag_zip === 'object' ? perOrder.bag_zip.cost : perOrder.bag_zip || 0) +
                (typeof perOrder.bag_red === 'object' ? perOrder.bag_red.cost : perOrder.bag_red || 0) +
                hopCartonCost +
                (typeof perOrder.thank_card === 'object' ? perOrder.thank_card.cost : perOrder.thank_card || 0) +
                (typeof perOrder.paper_print === 'object' ? perOrder.paper_print.cost : perOrder.paper_print || 0) +
                (typeof perOrder.bang_dinh === 'object' ? perOrder.bang_dinh.cost : perOrder.bang_dinh || 0);
        } else {
            // Fallback to saved value for old orders without details
            packagingCost = order.packaging_cost || 0;
        }
    } catch (e) {
        console.error('Error parsing packaging_details:', e);
        // Fallback to saved value
        packagingCost = order.packaging_cost || 0;
    }

    // Debug log
    console.log('🔍 Profit Analysis Debug:', {
        order_id: order.order_id,
        total_amount_in_db: order.total_amount,
        shipping_fee: order.shipping_fee,
        discount_amount: order.discount_amount,
        calculated_productTotal: totalAmount,
        formula: `productTotal = ${order.total_amount} - ${order.shipping_fee} + ${order.discount_amount} = ${totalAmount}`,
        product_cost_from_order: order.product_cost,
        calculated_productCost: productCost,
        has_items: order.items ? order.items.length : 'no items',
        has_products_json: !!order.products
    });

    // Debug: Parse products to see cost_price
    if (order.products) {
        try {
            const products = JSON.parse(order.products);
            console.log('📦 Products in order:', products);
            products.forEach((p, i) => {
                console.log(`  [${i}] ${p.name}: cost=${p.cost_price || p.cost || 0}, qty=${p.quantity || 1}, total=${(p.cost_price || p.cost || 0) * (p.quantity || 1)}`);
            });
        } catch (e) {
            console.log('⚠️ Could not parse products:', e);
        }
    }

    // Calculate revenue
    // IMPORTANT: totalAmount from calculateOrderTotals() is productTotal (before discount)
    // revenue = productTotal + shippingFee - discountAmount
    const discountAmount = order.discount_amount || 0;
    const revenue = totalAmount + shippingFee - discountAmount;

    // Use saved tax_amount if available, otherwise calculate
    const tax = order.tax_amount || Math.round(revenue * (order.tax_rate || COST_CONSTANTS.TAX_RATE));
    const taxRate = order.tax_rate || COST_CONSTANTS.TAX_RATE;

    // Get commission rate from order (saved at creation time)
    const commissionRate = order.commission_rate || 0;

    // Calculate profit
    const totalCost = productCost + shippingCost + packagingCost + commission + tax;
    const profit = revenue - totalCost;
    const profitMargin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0;

    // packagingDetails already parsed above
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <!-- Header -->
            <div class="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 px-6 py-5 rounded-t-2xl">
                <div class="flex items-center justify-between">
                    <div>
                        <h3 class="text-xl font-bold text-white">Phân tích Lãi/Lỗ</h3>
                        <p class="text-sm text-blue-100 mt-1">Đơn hàng: ${escapeHtml(order.order_id)}</p>
                    </div>
                    <button onclick="this.closest('.fixed').remove()" class="text-white/80 hover:text-white">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            <div class="p-6">
                <!-- Revenue Section -->
                <div class="mb-4">
                    <div class="flex items-center gap-2 mb-3">
                        <div class="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                            <svg class="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h4 class="font-semibold text-gray-900">Doanh thu</h4>
                    </div>
                    <div class="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 space-y-2">
                        <div class="flex justify-between items-center">
                            <span class="text-sm text-gray-600">Tiền sản phẩm</span>
                            <span class="font-semibold text-gray-900">${formatCurrency(totalAmount)}</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-sm text-gray-600">Phí ship (khách trả)</span>
                            <span class="font-semibold text-gray-900">${formatCurrency(shippingFee)}</span>
                        </div>
                        ${order.discount_amount && order.discount_amount > 0 ? `
                        <div class="flex justify-between items-center bg-purple-50 -mx-2 px-2 py-1.5 rounded">
                            <div class="flex items-center gap-1.5">
                                <svg class="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                                <span class="text-sm text-purple-700 font-medium">Mã giảm giá (${escapeHtml(order.discount_code || '')})</span>
                            </div>
                            <span class="font-semibold text-purple-700">-${formatCurrency(order.discount_amount)}</span>
                        </div>
                        ` : ''}
                        <div class="flex justify-between items-center pt-2 border-t border-green-200">
                            <span class="font-bold text-gray-900">Tổng doanh thu</span>
                            <span class="text-lg font-bold text-green-600">${formatCurrency(revenue)}</span>
                        </div>
                    </div>
                </div>

                <!-- Cost Section -->
                <div class="mb-4">
                    <div class="flex items-center gap-2 mb-3">
                        <div class="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                            <svg class="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
                            </svg>
                        </div>
                        <h4 class="font-semibold text-gray-900">Chi phí</h4>
                    </div>
                    <div class="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-4 space-y-2">
                        <div class="flex justify-between items-center">
                            <span class="text-sm text-gray-600">Giá vốn sản phẩm</span>
                            <span class="font-semibold ${productCost === 0 ? 'text-orange-600' : 'text-gray-900'}">${formatCurrency(productCost)}</span>
                        </div>
                        ${productCost === 0 ? `
                        <div class="bg-orange-100 border border-orange-300 rounded-lg p-2 text-xs text-orange-800">
                            <div class="flex items-start gap-2">
                                <svg class="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <div>
                                    <div class="font-semibold mb-1">Chưa có giá vốn</div>
                                    <div>Đơn hàng cũ chưa có dữ liệu giá vốn. Vui lòng:</div>
                                    <div class="mt-1">• Sửa sản phẩm trong đơn để cập nhật giá vốn</div>
                                    <div>• Hoặc reload trang để lấy dữ liệu mới</div>
                                </div>
                            </div>
                        </div>
                        ` : ''}
                        
                        <!-- Packaging Cost with Toggle -->
                        <div class="space-y-2">
                            <div class="flex justify-between items-center group">
                                <div class="flex items-center gap-2">
                                    <span class="text-sm text-gray-600">Chi phí đóng gói</span>
                                    <button onclick="event.stopPropagation(); this.closest('.space-y-2').querySelector('.packaging-details-toggle').classList.toggle('hidden'); this.querySelector('svg').classList.toggle('rotate-180');" 
                                        class="text-gray-400 hover:text-gray-600" 
                                        title="Xem chi tiết">
                                        <svg class="w-4 h-4 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                </div>
                                <span class="font-semibold ${packagingCost > 0 ? 'text-gray-900' : 'text-gray-400'}">${formatCurrency(packagingCost)}</span>
                            </div>
                            
                            <!-- Packaging Details (Hidden by default) -->
                            ${packagingDetails ? `
                            <div class="packaging-details-toggle hidden ml-6 pl-3 border-l-2 border-purple-300 space-y-1.5">
                                ${packagingDetails.per_order ? `
                                <div class="text-xs font-semibold text-purple-700 mb-1.5">Chi phí theo đơn hàng (1 lần):</div>
                                <div class="flex justify-between items-center text-xs">
                                    <span class="text-gray-600">• ${typeof packagingDetails.per_order.bag_zip === 'object' ? packagingDetails.per_order.bag_zip.name : 'Túi zip'}</span>
                                    <span class="font-medium text-gray-700">${formatCurrency(typeof packagingDetails.per_order.bag_zip === 'object' ? packagingDetails.per_order.bag_zip.cost : packagingDetails.per_order.bag_zip || 0)}</span>
                                </div>
                                <div class="flex justify-between items-center text-xs">
                                    <span class="text-gray-600">• ${typeof packagingDetails.per_order.bag_red === 'object' ? packagingDetails.per_order.bag_red.name : 'Túi đỏ'}</span>
                                    <span class="font-medium text-gray-700">${formatCurrency(typeof packagingDetails.per_order.bag_red === 'object' ? packagingDetails.per_order.bag_red.cost : packagingDetails.per_order.bag_red || 0)}</span>
                                </div>
                                <div class="flex justify-between items-center text-xs">
                                    <span class="text-gray-600">• ${
                                        packagingDetails.per_order.hop_carton 
                                            ? (typeof packagingDetails.per_order.hop_carton === 'object' ? packagingDetails.per_order.hop_carton.name : 'Hộp carton')
                                            : (typeof packagingDetails.per_order.box_shipping === 'object' ? packagingDetails.per_order.box_shipping.name : 'Hộp carton')
                                    }</span>
                                    <span class="font-medium text-gray-700">${formatCurrency(
                                        packagingDetails.per_order.hop_carton 
                                            ? (typeof packagingDetails.per_order.hop_carton === 'object' ? packagingDetails.per_order.hop_carton.cost : packagingDetails.per_order.hop_carton)
                                            : (typeof packagingDetails.per_order.box_shipping === 'object' ? packagingDetails.per_order.box_shipping.cost : packagingDetails.per_order.box_shipping || 0)
                                    )}</span>
                                </div>
                                <div class="flex justify-between items-center text-xs">
                                    <span class="text-gray-600">• ${typeof packagingDetails.per_order.thank_card === 'object' ? packagingDetails.per_order.thank_card.name : 'Thiệp cảm ơn'}</span>
                                    <span class="font-medium text-gray-700">${formatCurrency(typeof packagingDetails.per_order.thank_card === 'object' ? packagingDetails.per_order.thank_card.cost : packagingDetails.per_order.thank_card || 0)}</span>
                                </div>
                                <div class="flex justify-between items-center text-xs">
                                    <span class="text-gray-600">• ${typeof packagingDetails.per_order.paper_print === 'object' ? packagingDetails.per_order.paper_print.name : 'Giấy in'}</span>
                                    <span class="font-medium text-gray-700">${formatCurrency(typeof packagingDetails.per_order.paper_print === 'object' ? packagingDetails.per_order.paper_print.cost : packagingDetails.per_order.paper_print || 0)}</span>
                                </div>
                                <div class="flex justify-between items-center text-xs">
                                    <span class="text-gray-600">• ${typeof packagingDetails.per_order.bang_dinh === 'object' ? packagingDetails.per_order.bang_dinh.name : 'Băng dính'}</span>
                                    <span class="font-medium text-gray-700">${formatCurrency(typeof packagingDetails.per_order.bang_dinh === 'object' ? packagingDetails.per_order.bang_dinh.cost : packagingDetails.per_order.bang_dinh || 0)}</span>
                                </div>
                                ` : ''}
                            </div>
                            ` : ''}
                        </div>
                        
                        <div class="flex justify-between items-center">
                            <span class="text-sm text-gray-600">Phí ship (thực tế)</span>
                            <span class="font-semibold text-gray-900">${formatCurrency(shippingCost)}</span>
                        </div>
                        ${commission > 0 ? `
                        <div class="flex justify-between items-center">
                            <span class="text-sm text-gray-600">Hoa hồng CTV (${(commissionRate * 100).toFixed(1)}%)</span>
                            <span class="font-semibold text-gray-900">${formatCurrency(commission)}</span>
                        </div>
                        ` : ''}
                        <div class="flex justify-between items-center">
                            <span class="text-sm text-gray-600">Thuế (${(taxRate * 100).toFixed(1)}%)</span>
                            <span class="font-semibold text-gray-900">${formatCurrency(tax)}</span>
                        </div>
                        <div class="flex justify-between items-center pt-2 border-t border-red-200">
                            <span class="font-bold text-gray-900">Tổng chi phí</span>
                            <span class="text-lg font-bold text-red-600">${formatCurrency(totalCost)}</span>
                        </div>
                    </div>
                </div>

                <!-- Profit Section -->
                <div class="bg-gradient-to-br ${profit >= 0 ? 'from-blue-50 to-indigo-50 border-blue-200' : 'from-gray-50 to-slate-50 border-gray-200'} border-2 rounded-xl p-4">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-base font-bold text-gray-900">Lợi nhuận ròng</span>
                        <span class="text-2xl font-bold ${profit > 0 ? 'text-blue-600' : profit < 0 ? 'text-red-600' : 'text-gray-600'}">
                            ${formatCurrency(profit)}
                        </span>
                    </div>
                    <div class="flex items-center justify-between text-sm">
                        <span class="text-gray-600">Tỷ suất lợi nhuận</span>
                        <span class="font-semibold ${profit > 0 ? 'text-blue-600' : profit < 0 ? 'text-red-600' : 'text-gray-600'}">
                            ${profitMargin}%
                        </span>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div class="px-6 py-4 bg-gray-50 rounded-b-2xl flex justify-end gap-2">
                <button onclick="this.closest('.fixed').remove()" 
                    class="px-5 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-medium transition-colors shadow-sm">
                    Đóng
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}


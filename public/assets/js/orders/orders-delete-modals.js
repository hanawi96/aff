/**
 * Orders Delete Modals
 * Extracted from orders.js
 * 
 * Dependencies:
 * - allOrdersData, filteredOrdersData (global)
 * - updateOrderData() from orders-constants.js
 * - updateStats() from orders-stats.js
 * - renderOrdersTable() from orders-table.js
 * - escapeHtml(), formatCurrency() from orders-utils.js
 * - showToast() from toast-manager.js
 * - CONFIG.API_URL from config.js
 */

// ============================================
// DELETE ORDER MODAL
// ============================================

// Confirm delete order
function confirmDeleteOrder(orderId, orderCode) {
    // Find the order
    const order = allOrdersData.find(o => o.id === orderId);
    if (!order) {
        showToast('Không tìm thấy đơn hàng', 'error');
        return;
    }

    const shippingFee = order.shipping_fee || 0;
    const discountAmount = order.discount_amount || 0;
    let totalAmount = order.total_amount || 0;
    if (totalAmount === 0 && order.product_total) {
        totalAmount = (order.product_total || 0) + shippingFee - discountAmount;
    }
    const customerName = typeof titleCaseCustomerName === 'function'
        ? titleCaseCustomerName(order.customer_name)
        : (order.customer_name || '');

    // Create simple confirmation modal
    const modal = document.createElement('div');
    modal.id = 'confirmDeleteModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,0.45);';

    modal.innerHTML = `
        <div style="width:100%;max-width:320px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;box-shadow:0 12px 32px rgba(15,23,42,0.18);overflow:hidden;flex-shrink:0;">
            <div style="padding:16px 16px 12px;">
                <div style="display:flex;align-items:flex-start;gap:10px;">
                    <div style="width:32px;height:32px;border-radius:9999px;background:#fef2f2;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        <svg style="width:16px;height:16px;color:#dc2626;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                    </div>
                    <div style="flex:1;min-width:0;padding-top:1px;">
                        <h3 style="margin:0;font-size:15px;font-weight:600;color:#111827;line-height:1.35;">Xóa đơn hàng?</h3>
                        <p style="margin:4px 0 0;font-size:12px;color:#6b7280;line-height:1.4;">Hành động này không thể hoàn tác.</p>
                    </div>
                </div>
            </div>

            <div style="padding:0 16px 12px;">
                <div style="border:1px solid #f3f4f6;border-radius:10px;background:#f9fafb;overflow:hidden;font-size:12px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;border-bottom:1px solid #f3f4f6;">
                        <span style="color:#6b7280;flex-shrink:0;">Mã đơn</span>
                        <span style="font-weight:600;color:#111827;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(orderCode)}</span>
                    </div>
                    ${customerName ? `
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;border-bottom:1px solid #f3f4f6;">
                        <span style="color:#6b7280;flex-shrink:0;">Khách hàng</span>
                        <span style="font-weight:500;color:#111827;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right;">${escapeHtml(customerName)}</span>
                    </div>
                    ` : ''}
                    ${totalAmount > 0 ? `
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;">
                        <span style="color:#6b7280;flex-shrink:0;">Giá trị</span>
                        <span style="font-weight:600;color:#047857;">${formatCurrency(totalAmount)}</span>
                    </div>
                    ` : ''}
                </div>
                <p style="margin:10px 0 0;font-size:11px;color:#6b7280;line-height:1.45;">
                    Đơn hàng sẽ bị xóa vĩnh viễn và không thể khôi phục.
                </p>
            </div>

            <div style="display:flex;align-items:center;gap:8px;padding:12px 16px;border-top:1px solid #f3f4f6;">
                <button
                    type="button"
                    onclick="closeConfirmDeleteModal()"
                    style="flex:1;padding:8px 12px;font-size:13px;font-weight:500;color:#374151;background:#fff;border:1px solid #e5e7eb;border-radius:8px;cursor:pointer;">
                    Hủy
                </button>
                <button
                    type="button"
                    onclick="deleteOrder(${orderId}, '${escapeHtml(orderCode)}')"
                    style="flex:1;padding:8px 12px;font-size:13px;font-weight:600;color:#fff;background:#dc2626;border:1px solid #dc2626;border-radius:8px;cursor:pointer;">
                    Xóa đơn
                </button>
            </div>
        </div>
    `;

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeConfirmDeleteModal();
    });

    document.body.appendChild(modal);

    // Close on Escape
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeConfirmDeleteModal();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
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

    // Show loading toast với ID
    const deleteId = `delete-order-${orderId}`;
    showToast('Đang xóa đơn hàng...', 'info', 0, deleteId);

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

            // Invalidate search cache since data changed
            invalidateSearchCache();

            // Một lần filter: bảng + badge thẻ tên + thống kê (tránh nháy 2 lần)
            if (typeof filterOrdersData === 'function') {
                filterOrdersData(true);
            } else {
                updateStats();
                renderOrdersTable();
                if (typeof updateMissingSizeBadge === 'function') updateMissingSizeBadge();
                if (typeof refreshTheTenBePanelAfterDataChange === 'function') {
                    refreshTheTenBePanelAfterDataChange();
                }
            }

            showToast(`Đã xóa đơn hàng ${orderCode}`, 'success', null, deleteId);
        } else {
            throw new Error(data.error || 'Không thể xóa đơn hàng');
        }

    } catch (error) {
        console.error('Error deleting order:', error);
        showToast('Không thể xóa đơn hàng: ' + error.message, 'error', null, deleteId);
    }
}

// ============================================
// DELETE PRODUCT MODAL
// ============================================

// Confirm delete product
function confirmDeleteProduct(orderId, productIndex, orderCode) {
    // Look up productName & product count từ allOrdersData (tránh vỡ onclick khi tên có dấu nháy đơn)
    let productName = 'Sản phẩm';
    const _order = allOrdersData.find(o => o.id === orderId);
    if (_order) {
        let _count = 1;
        try {
            const _prods = JSON.parse(_order.products);
            _count = Array.isArray(_prods) ? _prods.length : 1;
            if (Array.isArray(_prods) && _prods[productIndex]) {
                productName = (typeof _prods[productIndex] === 'string')
                    ? _prods[productIndex]
                    : (_prods[productIndex].name || 'Sản phẩm');
            }
        } catch(_) {}
        if (_count <= 1) {
            showToast('Không thể xóa vì chỉ có 1 sản phẩm duy nhất', 'warning');
            return;
        }
    }

    // Create confirmation modal
    const modal = document.createElement('div');
    modal.id = 'confirmDeleteProductModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <!-- Header -->
            <div class="bg-gradient-to-r from-orange-600 to-red-600 px-6 py-4 rounded-t-xl">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                        <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <div>
                        <h3 class="text-lg font-bold text-white">Xác nhận xóa sản phẩm</h3>
                        <p class="text-sm text-white/80">Đơn hàng: ${escapeHtml(orderCode)}</p>
                    </div>
                </div>
            </div>

            <!-- Content -->
            <div class="p-6">
                <div class="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                    <p class="text-sm text-gray-700 mb-2">Bạn có chắc chắn muốn xóa sản phẩm:</p>
                    <p class="text-base font-bold text-orange-600">${escapeHtml(productName)}</p>
                </div>
                <p class="text-sm text-gray-500 flex items-start gap-2">
                    <svg class="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Sản phẩm sẽ bị xóa khỏi đơn hàng này.</span>
                </p>
            </div>

            <!-- Actions -->
            <div class="px-6 py-4 bg-gray-50 rounded-b-xl flex items-center justify-end gap-3">
                <button 
                    onclick="closeConfirmDeleteProductModal()" 
                    class="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                    Hủy
                </button>
                <button 
                    onclick="deleteProduct(${orderId}, ${productIndex}, '${escapeHtml(orderCode)}')" 
                    class="px-5 py-2.5 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Xóa sản phẩm
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Close on Escape
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeConfirmDeleteProductModal();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
}

// Close confirm delete product modal
function closeConfirmDeleteProductModal() {
    const modal = document.getElementById('confirmDeleteProductModal');
    if (modal) {
        modal.remove();
    }
}

// Delete product from order
async function deleteProduct(orderId, productIndex, orderCode) {
    // Close modal
    closeConfirmDeleteProductModal();

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

        // Check if there's only one product
        if (products.length <= 1) {
            showToast('Không thể xóa vì chỉ có 1 sản phẩm duy nhất', 'warning');
            return;
        }

        // Remove the product at index
        products.splice(productIndex, 1);

        const updatedProductsJson = JSON.stringify(products);

        // Recalculate freeship after removing a product
        const shouldFreeship = _shouldFreeship(products);
        const curFee = order.shipping_fee || 0;
        const newShippingFee = shouldFreeship ? 0
            : (curFee === 0 ? _getCustomerShippingFee() : curFee);

        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'updateOrderProducts',
                orderId: orderId,
                products: updatedProductsJson,
                shipping_fee: newShippingFee
            })
        });

        const data = await response.json();

        if (data.success) {
            const updates = { products: updatedProductsJson };
            if (data.total_amount !== undefined) updates.total_amount = data.total_amount;
            if (data.shipping_fee  !== undefined) updates.shipping_fee  = data.shipping_fee;
            if (data.product_cost !== undefined) updates.product_cost = data.product_cost;
            if (data.commission !== undefined) updates.commission = data.commission;

            updateOrderData(orderId, updates);

            // Re-render the table to show updated products
            renderOrdersTable();

            showToast(`Đã xóa sản phẩm khỏi đơn ${orderCode}`, 'success');
        } else {
            throw new Error(data.error || 'Không thể xóa sản phẩm');
        }

    } catch (error) {
        console.error('Error deleting product:', error);
        showToast('Không thể xóa sản phẩm: ' + error.message, 'error');
    }
}

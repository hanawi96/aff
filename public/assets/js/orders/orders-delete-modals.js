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

            // Update stats
            updateStats();

            // Re-render the table
            renderOrdersTable();

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
function confirmDeleteProduct(orderId, productIndex, orderCode, productName) {
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

    // Show loading toast với ID
    const deleteId = `delete-product-${orderId}-${productIndex}`;
    showToast('Đang xóa sản phẩm...', 'info', 0, deleteId);

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
            showToast('Không thể xóa sản phẩm cuối cùng. Hãy xóa toàn bộ đơn hàng nếu cần.', 'warning');
            return;
        }

        // Remove the product at index
        products.splice(productIndex, 1);

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
            // Update local data using helper function
            const updates = { products: updatedProductsJson };
            if (data.total_amount !== undefined) updates.total_amount = data.total_amount;
            if (data.product_cost !== undefined) updates.product_cost = data.product_cost;
            if (data.commission !== undefined) updates.commission = data.commission;

            updateOrderData(orderId, updates);

            // Re-render the table to show updated products
            renderOrdersTable();

            showToast(`Đã xóa sản phẩm khỏi đơn ${orderCode}`, 'success', null, deleteId);
        } else {
            throw new Error(data.error || 'Không thể xóa sản phẩm');
        }

    } catch (error) {
        console.error('Error deleting product:', error);
        showToast('Không thể xóa sản phẩm: ' + error.message, 'error', null, deleteId);
    }
}

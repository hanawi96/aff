// Orders Bulk Actions Functions
// Extracted from orders.js for better code organization
// NOTE: All functions remain at global scope for backward compatibility
// DEPENDENCIES: Uses global variables from orders.js (selectedOrderIds, allOrdersData)

// ============================================
// CHECKBOX HANDLING
// ============================================

/**
 * Handle individual order checkbox change
 */
function handleOrderCheckbox(orderId, isChecked) {
    if (isChecked) {
        selectedOrderIds.add(orderId);
    } else {
        selectedOrderIds.delete(orderId);
    }
    updateBulkActionsUI();
}

/**
 * Select/deselect all orders on current page
 */
function toggleSelectAll(checked) {
    const checkboxes = document.querySelectorAll('.order-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = checked;
        const orderId = parseInt(cb.dataset.orderId);
        if (checked) {
            selectedOrderIds.add(orderId);
        } else {
            selectedOrderIds.delete(orderId);
        }
    });
    updateBulkActionsUI();
}

/**
 * Update bulk actions UI based on selection count
 */
function updateBulkActionsUI() {
    const count = selectedOrderIds.size;
    const bulkActionsBar = document.getElementById('bulkActionsBar');
    const selectedCount = document.getElementById('selectedCount');

    if (count > 0) {
        if (selectedCount) selectedCount.textContent = count;
        if (bulkActionsBar) {
            // Show with smooth animation
            bulkActionsBar.classList.remove('hidden');
            bulkActionsBar.style.opacity = '0';
            bulkActionsBar.style.transform = 'translateX(-50%) translateY(20px)';

            requestAnimationFrame(() => {
                bulkActionsBar.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                bulkActionsBar.style.opacity = '1';
                bulkActionsBar.style.transform = 'translateX(-50%) translateY(0)';
            });
        }
    } else {
        if (bulkActionsBar) {
            bulkActionsBar.style.opacity = '0';
            bulkActionsBar.style.transform = 'translateX(-50%) translateY(20px)';
            setTimeout(() => {
                bulkActionsBar.classList.add('hidden');
            }, 300);
        }
    }
}

/**
 * Clear all selections
 */
function clearSelection() {
    selectedOrderIds.clear();
    document.querySelectorAll('.order-checkbox').forEach(cb => cb.checked = false);
    const selectAllCb = document.getElementById('selectAllCheckbox');
    if (selectAllCb) selectAllCb.checked = false;
    updateBulkActionsUI();
}

// ============================================
// BULK EXPORT
// ============================================

/**
 * Bulk Export - Export selected orders to SPX Excel format
 */
async function bulkExport() {
    if (selectedOrderIds.size === 0) {
        showToast('Vui lòng chọn ít nhất một đơn hàng', 'warning');
        return;
    }

    try {
        // Check if XLSX library is loaded (silently load if needed)
        if (typeof XLSX === 'undefined') {
            await loadXLSXLibrary();
        }

        const selectedOrders = allOrdersData.filter(o => selectedOrderIds.has(o.id));
        
        // ============================================
        // IMPROVEMENT: Check for shipped orders
        // ============================================
        const shippedOrders = selectedOrders.filter(o => o.status === 'shipped');
        
        console.log('🔍 Bulk Export Debug:');
        console.log('  Total selected:', selectedOrders.length);
        console.log('  Shipped orders:', shippedOrders.length);
        console.log('  Selected orders statuses:', selectedOrders.map(o => ({ id: o.id, status: o.status })));
        
        if (shippedOrders.length > 0) {
            console.log('  ✅ Showing confirmation modal');
            // Show confirmation modal
            showShippedOrdersConfirmModal(shippedOrders.length, selectedOrders);
            return; // Wait for user decision
        }
        
        console.log('  ⏭️ No shipped orders, proceeding with export');
        // No shipped orders, proceed with export
        await performExport(selectedOrders);
        
    } catch (error) {
        console.error('Error exporting:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}

/**
 * Show confirmation modal for shipped orders
 */
function showShippedOrdersConfirmModal(shippedCount, allSelectedOrders) {
    console.log('📢 showShippedOrdersConfirmModal called');
    console.log('  Shipped count:', shippedCount);
    console.log('  All selected orders:', allSelectedOrders.length);
    
    const modal = document.getElementById('shippedOrdersConfirmModal');
    const countElement = document.getElementById('shippedOrdersCount');
    
    console.log('  Modal element:', modal);
    console.log('  Count element:', countElement);
    
    if (!modal) {
        console.error('❌ Modal element not found!');
        return;
    }
    
    if (!countElement) {
        console.error('❌ Count element not found!');
        return;
    }
    
    countElement.textContent = shippedCount;
    modal.classList.remove('hidden');
    
    console.log('  ✅ Modal shown, classes:', modal.className);
    
    // Store orders for later use
    window.pendingExportOrders = allSelectedOrders;
}

/**
 * Continue export all orders (including shipped)
 */
async function continueExportAll() {
    const modal = document.getElementById('shippedOrdersConfirmModal');
    modal.classList.add('hidden');
    
    if (window.pendingExportOrders) {
        await performExport(window.pendingExportOrders);
        window.pendingExportOrders = null;
    }
}

/**
 * Skip shipped orders and export only non-shipped
 */
async function skipShippedOrders() {
    const modal = document.getElementById('shippedOrdersConfirmModal');
    modal.classList.add('hidden');
    
    if (window.pendingExportOrders) {
        const nonShippedOrders = window.pendingExportOrders.filter(o => o.status !== 'shipped');
        
        if (nonShippedOrders.length === 0) {
            showToast('Không có đơn hàng nào để export (tất cả đã gửi hàng)', 'warning');
            window.pendingExportOrders = null;
            return;
        }
        
        showToast(`Đang export ${nonShippedOrders.length} đơn hàng (bỏ qua ${window.pendingExportOrders.length - nonShippedOrders.length} đơn đã gửi)`, 'info');
        await performExport(nonShippedOrders);
        window.pendingExportOrders = null;
    }
}

/**
 * Perform the actual export
 */
async function performExport(orders) {
    showToast('Đang tạo file Excel...', 'info');
    
    // Export to SPX format and save to R2
    const result = await exportToSPXExcelAndSave(orders);
    
    if (result.success) {
        showToast(`✅ Đã tạo file export - ${result.filename}`, 'success');
        
        // Clear selection
        clearSelection();
        
        // Invalidate cache and update badge
        exportHistoryCache = null;
        await updateExportHistoryBadge();
        
        // Show export history modal
        showExportHistoryModal();
    }
}

/**
 * Load XLSX library dynamically
 */
function loadXLSXLibrary() {
    return new Promise((resolve, reject) => {
        if (typeof XLSX !== 'undefined') {
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Không thể tải thư viện Excel'));
        document.head.appendChild(script);
    });
}

// ============================================
// BULK STATUS UPDATE
// ============================================

/**
 * Show bulk status menu
 */
function showBulkStatusMenu(event) {
    event.stopPropagation();

    // Close any existing menu
    const existingMenu = document.getElementById('bulkStatusMenu');
    if (existingMenu) {
        existingMenu.remove();
        return;
    }

    const statuses = [
        { value: 'pending', label: 'Chờ xử lý', color: 'yellow' },
        { value: 'shipped', label: 'Đã gửi hàng', color: 'blue' },
        { value: 'in_transit', label: 'Đang vận chuyển', color: 'purple' },
        { value: 'delivered', label: 'Đã giao hàng', color: 'emerald' },
        { value: 'failed', label: 'Giao hàng thất bại', color: 'red' }
    ];

    // Get button position
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();

    // Create menu
    const menu = document.createElement('div');
    menu.id = 'bulkStatusMenu';
    menu.className = 'fixed bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[200px]';
    menu.style.zIndex = '10000';
    menu.style.left = rect.left + 'px';
    menu.style.bottom = (window.innerHeight - rect.top + 8) + 'px';

    menu.innerHTML = statuses.map(s => `
        <button 
            onclick="bulkUpdateStatus('${s.value}', '${s.label}')"
            class="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
        >
            <div class="w-3 h-3 rounded-full bg-${s.color}-500 flex-shrink-0"></div>
            <span class="text-sm text-gray-700 flex-1">${s.label}</span>
        </button>
    `).join('');

    document.body.appendChild(menu);

    // Close menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!button.contains(e.target) && !menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 10);
}

/**
 * Bulk Update Status - Update status for selected orders
 */
async function bulkUpdateStatus(newStatus, statusLabel) {
    // Close menu
    const menu = document.getElementById('bulkStatusMenu');
    if (menu) menu.remove();

    if (selectedOrderIds.size === 0) {
        showToast('Vui lòng chọn ít nhất một đơn hàng', 'warning');
        return;
    }

    const count = selectedOrderIds.size;
    const confirmed = confirm(`Bạn có chắc chắn muốn đổi trạng thái ${count} đơn hàng sang "${statusLabel}"?`);

    if (!confirmed) return;

    try {
        showToast(`Đang cập nhật ${count} đơn hàng...`, 'info', 0, 'bulk-status');

        let successCount = 0;
        let failCount = 0;

        for (const orderId of selectedOrderIds) {
            try {
                const response = await fetch(`${CONFIG.API_URL}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'updateOrderStatus',
                        orderId: orderId,
                        status: newStatus
                    })
                });

                const data = await response.json();
                if (data.success) {
                    successCount++;
                    // Update local data
                    updateOrderData(orderId, { status: newStatus });
                } else {
                    failCount++;
                }
            } catch (error) {
                failCount++;
                console.error(`Error updating order ${orderId}:`, error);
            }
        }

        // Clear selection and re-render
        clearSelection();
        renderOrdersTable();

        // Show result
        if (failCount === 0) {
            showToast(`Đã cập nhật thành công ${successCount} đơn hàng sang "${statusLabel}"`, 'success', null, 'bulk-status');
        } else {
            showToast(`Đã cập nhật ${successCount} đơn, thất bại ${failCount} đơn`, 'warning', null, 'bulk-status');
        }
    } catch (error) {
        console.error('Error bulk updating status:', error);
        showToast('Không thể cập nhật trạng thái: ' + error.message, 'error', null, 'bulk-status');
    }
}

// ============================================
// BULK DELETE
// ============================================

/**
 * Bulk Delete - Delete selected orders
 */
async function bulkDelete() {
    if (selectedOrderIds.size === 0) {
        showToast('Vui lòng chọn ít nhất một đơn hàng', 'warning');
        return;
    }

    const count = selectedOrderIds.size;
    const confirmed = confirm(`Bạn có chắc chắn muốn xóa ${count} đơn hàng đã chọn?\n\nHành động này không thể hoàn tác!`);

    if (!confirmed) return;

    try {
        showToast(`Đang xóa ${count} đơn hàng...`, 'info', 0, 'bulk-delete');

        let successCount = 0;
        let failCount = 0;

        for (const orderId of selectedOrderIds) {
            try {
                const response = await fetch(`${CONFIG.API_URL}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'deleteOrder',
                        orderId: orderId
                    })
                });

                const data = await response.json();
                if (data.success) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (error) {
                failCount++;
                console.error(`Error deleting order ${orderId}:`, error);
            }
        }

        // Clear selection and reload data
        clearSelection();
        await loadOrdersData();

        // Show result
        if (failCount === 0) {
            showToast(`Đã xóa thành công ${successCount} đơn hàng`, 'success', null, 'bulk-delete');
        } else {
            showToast(`Đã xóa ${successCount} đơn, thất bại ${failCount} đơn`, 'warning', null, 'bulk-delete');
        }
    } catch (error) {
        console.error('Error bulk deleting:', error);
        showToast('Không thể xóa đơn hàng: ' + error.message, 'error', null, 'bulk-delete');
    }
}

// ============================================
// BULK PRIORITY TOGGLE
// ============================================

/**
 * Bulk Toggle Priority - Mark/unmark selected orders as priority
 * @param {boolean} setPriority - true to mark as priority, false to unmark
 */
async function bulkTogglePriority(setPriority) {
    if (selectedOrderIds.size === 0) {
        showToast('Vui lòng chọn ít nhất một đơn hàng', 'warning');
        return;
    }

    const count = selectedOrderIds.size;
    const action = setPriority ? 'đánh dấu ưu tiên' : 'bỏ đánh dấu ưu tiên';

    try {
        showToast(`Đang ${action} ${count} đơn hàng...`, 'info', 0, 'bulk-priority');

        let successCount = 0;
        let failCount = 0;

        for (const orderId of selectedOrderIds) {
            try {
                const response = await fetch(`${CONFIG.API_URL}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'toggleOrderPriority',
                        orderId: orderId,
                        isPriority: setPriority ? 1 : 0 // Explicit value for bulk actions
                    })
                });

                const data = await response.json();
                if (data.success) {
                    successCount++;
                    // Update local data with actual value from backend
                    updateOrderData(orderId, { is_priority: data.isPriority });
                } else {
                    failCount++;
                }
            } catch (error) {
                failCount++;
                console.error(`Error toggling priority for order ${orderId}:`, error);
            }
        }

        // Re-sort and re-render to move priority orders to top
        applySorting();
        renderOrdersTable();
        
        // Clear selection
        clearSelection();

        // Show result
        if (failCount === 0) {
            showToast(`✅ Đã ${action} ${successCount} đơn hàng`, 'success', null, 'bulk-priority');
        } else {
            showToast(`⚠️ Đã ${action} ${successCount} đơn, ${failCount} đơn lỗi`, 'warning', null, 'bulk-priority');
        }
    } catch (error) {
        console.error('Error bulk toggling priority:', error);
        showToast(`Lỗi: ${error.message}`, 'error', null, 'bulk-priority');
    }
}

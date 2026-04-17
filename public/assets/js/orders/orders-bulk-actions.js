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
 * Modal cảnh báo: trong các đơn đã chọn có đơn còn sản phẩm thiếu cân/size (giống copy SPX)
 * @param {Array<{ order: object, missing: string[] }>} entries
 * @param {function} onConfirm — gọi khi bấm "Có, export tiếp"
 */
function showBulkExportMissingSizeModal(entries, onConfirm) {
    const modalId = 'bulkExportMissingSizeModal';
    document.getElementById(modalId)?.remove();

    const overlay = document.createElement('div');
    overlay.id = modalId;
    overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[200] p-4';

    const listHtml = entries.map(({ order, missing }) => {
        const code = escapeHtml(String(order.order_id || order.id || ''));
        const names = missing.slice(0, 10).map((n) => escapeHtml(n)).join(', ');
        const more = missing.length > 10 ? ` … (+${missing.length - 10} SP)` : '';
        return `<li class="text-sm text-gray-800 border-b border-gray-100 pb-2 mb-2 last:border-0 last:pb-0 last:mb-0">
            <span class="font-semibold text-amber-800">${code}</span>
            <span class="text-gray-600"> — ${names}${more}</span>
        </li>`;
    }).join('');

    overlay.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-amber-200 overflow-hidden" role="dialog" aria-modal="true">
            <div class="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4">
                <h3 class="text-lg font-bold text-white flex items-center gap-2">
                    <svg class="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Thiếu cân nặng / size
                </h3>
            </div>
            <div class="p-5">
                <p class="text-sm text-gray-700 mb-3">Có <strong>${entries.length}</strong> đơn (trong số đã chọn) còn sản phẩm chưa có cân hoặc size. Export Excel thường cần đủ thông tin.</p>
                <ul class="max-h-56 overflow-y-auto space-y-0 pr-1 list-none pl-0">${listHtml}</ul>
                <p class="text-sm font-medium text-gray-900 mt-4">Bạn vẫn muốn export?</p>
                <div class="flex flex-wrap gap-2 justify-end mt-5">
                    <button type="button" class="bulk-export-miss-cancel px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium">Hủy</button>
                    <button type="button" class="bulk-export-miss-ok px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium">Có, export tiếp</button>
                </div>
            </div>
        </div>
    `;

    const close = () => overlay.remove();

    overlay.querySelector('.bulk-export-miss-cancel').addEventListener('click', close);
    overlay.querySelector('.bulk-export-miss-ok').addEventListener('click', () => {
        close();
        onConfirm();
    });
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });

    document.body.appendChild(overlay);
}

/**
 * Sau khi qua cảnh báo thiếu size (nếu có): kiểm tra đơn đã gửi hàng rồi export
 */
async function proceedBulkExportFlow(selectedOrders) {
    const shippedOrders = selectedOrders.filter((o) => o.status === 'shipped');

    if (shippedOrders.length > 0) {
        showShippedOrdersConfirmModal(shippedOrders.length, selectedOrders);
        return;
    }

    await performExport(selectedOrders);
}

/**
 * Bulk Export - Export selected orders to SPX Excel format
 */
async function bulkExport() {
    if (selectedOrderIds.size === 0) {
        showToast('Vui lòng chọn ít nhất một đơn hàng', 'warning');
        return;
    }

    try {
        if (typeof XLSX === 'undefined') {
            await loadXLSXLibrary();
        }

        const selectedOrders = allOrdersData.filter((o) => selectedOrderIds.has(o.id));

        const missingEntries = [];
        for (const order of selectedOrders) {
            const missing = getOrderProductsMissingSizeWeight(order);
            if (missing.length > 0) {
                missingEntries.push({ order, missing });
            }
        }

        if (missingEntries.length > 0) {
            showBulkExportMissingSizeModal(missingEntries, () => {
                proceedBulkExportFlow(selectedOrders).catch((err) => {
                    console.error('Error exporting:', err);
                    showToast('Lỗi: ' + err.message, 'error');
                });
            });
            return;
        }

        await proceedBulkExportFlow(selectedOrders);
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
                    const patch = { status: newStatus };
                    if (Object.prototype.hasOwnProperty.call(data, 'shipped_at_unix')) {
                        patch.shipped_at_unix = data.shipped_at_unix;
                    }
                    updateOrderData(orderId, patch);
                } else {
                    failCount++;
                }
            } catch (error) {
                failCount++;
                console.error(`Error updating order ${orderId}:`, error);
            }
        }

        // Clear selection — refilter để đơn đổi trạng thái không còn khớp bộ lọc sẽ biến khỏi danh sách
        clearSelection();
        filterOrdersData(true);

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

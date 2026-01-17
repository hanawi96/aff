// Orders Priority Functions
// Handle priority marking for orders

/**
 * Toggle order priority status
 */
async function toggleOrderPriority(orderId, currentPriority) {
    const isPriority = currentPriority === 1;
    
    try {
        // Optimistic UI update
        updatePriorityIcon(orderId, !isPriority);
        updateRowStyle(orderId, !isPriority);
        
        // Call API
        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'toggleOrderPriority',
                orderId: orderId
            })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Không thể cập nhật');
        }
        
        // Update local data
        const orderIndex = allOrdersData.findIndex(o => o.id === orderId);
        if (orderIndex !== -1) {
            allOrdersData[orderIndex].is_priority = data.isPriority;
        }
        
        const filteredIndex = filteredOrdersData.findIndex(o => o.id === orderId);
        if (filteredIndex !== -1) {
            filteredOrdersData[filteredIndex].is_priority = data.isPriority;
        }
        
        // Re-sort to move priority orders to top
        applySorting();
        renderOrdersTable();
        
        showToast(data.message, 'success');
        
    } catch (error) {
        console.error('Error toggling priority:', error);
        
        // Rollback UI
        updatePriorityIcon(orderId, isPriority);
        updateRowStyle(orderId, isPriority);
        
        showToast('Lỗi: ' + error.message, 'error');
    }
}

/**
 * Update priority icon appearance
 */
function updatePriorityIcon(orderId, isPriority) {
    const iconButton = document.querySelector(`[data-priority-order-id="${orderId}"]`);
    
    if (isPriority) {
        // Priority: Show yellow star
        if (iconButton) {
            // Icon already exists, just update it
            iconButton.innerHTML = `
                <svg class="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
            `;
            iconButton.title = 'Đơn ưu tiên - Click để bỏ đánh dấu';
            iconButton.style.display = '';
        } else {
            // Icon doesn't exist, create it
            const row = document.querySelector(`tr[data-order-id="${orderId}"]`);
            if (row) {
                const tdIndex = row.querySelector('td:first-child > div');
                if (tdIndex) {
                    const newIcon = document.createElement('button');
                    newIcon.onclick = () => toggleOrderPriority(orderId, 1);
                    newIcon.className = 'priority-icon hover:scale-110 transition-transform cursor-pointer';
                    newIcon.setAttribute('data-priority-order-id', orderId);
                    newIcon.title = 'Đơn ưu tiên - Click để bỏ đánh dấu';
                    newIcon.innerHTML = `
                        <svg class="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                    `;
                    tdIndex.insertBefore(newIcon, tdIndex.firstChild);
                }
            }
        }
    } else {
        // Normal: Hide icon completely
        if (iconButton) {
            iconButton.remove();
        }
    }
}

/**
 * Update row styling based on priority
 */
function updateRowStyle(orderId, isPriority) {
    const row = document.querySelector(`tr[data-order-id="${orderId}"]`);
    if (!row) return;
    
    if (isPriority) {
        // Priority: Yellow background
        row.classList.add('bg-yellow-50', 'border-l-4', 'border-yellow-400');
        row.classList.remove('hover:bg-gray-50');
    } else {
        // Normal: Default styling
        row.classList.remove('bg-yellow-50', 'border-l-4', 'border-yellow-400');
        row.classList.add('hover:bg-gray-50');
    }
}

/**
 * Bulk toggle priority for selected orders
 */
async function bulkTogglePriority(setPriority) {
    const selectedIds = getSelectedOrderIds();
    
    if (selectedIds.length === 0) {
        showToast('Vui lòng chọn ít nhất 1 đơn hàng', 'warning');
        return;
    }
    
    const action = setPriority ? 'đánh dấu ưu tiên' : 'bỏ đánh dấu ưu tiên';
    if (!confirm(`Bạn có chắc chắn muốn ${action} ${selectedIds.length} đơn hàng đã chọn?`)) {
        return;
    }
    
    try {
        showToast(`Đang ${action}...`, 'info');
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const orderId of selectedIds) {
            try {
                const response = await fetch(`${CONFIG.API_URL}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'toggleOrderPriority',
                        orderId: orderId
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // Update local data
                    const orderIndex = allOrdersData.findIndex(o => o.id === orderId);
                    if (orderIndex !== -1) {
                        allOrdersData[orderIndex].is_priority = data.isPriority;
                    }
                    
                    const filteredIndex = filteredOrdersData.findIndex(o => o.id === orderId);
                    if (filteredIndex !== -1) {
                        filteredOrdersData[filteredIndex].is_priority = data.isPriority;
                    }
                    
                    successCount++;
                } else {
                    errorCount++;
                }
                
            } catch (error) {
                console.error(`Error toggling priority for order ${orderId}:`, error);
                errorCount++;
            }
        }
        
        // Re-render table
        applySorting();
        renderOrdersTable();
        
        // Clear selection
        clearSelection();
        
        // Show result
        if (errorCount === 0) {
            showToast(`✅ Đã ${action} ${successCount} đơn hàng`, 'success');
        } else {
            showToast(`⚠️ Đã ${action} ${successCount} đơn, ${errorCount} đơn lỗi`, 'warning');
        }
        
    } catch (error) {
        console.error('Error bulk toggling priority:', error);
        showToast('Lỗi: ' + error.message, 'error');
    }
}

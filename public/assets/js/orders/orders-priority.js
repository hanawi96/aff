// Orders Priority Functions
// Handle priority marking for orders

/**
 * Toggle order priority status
 */
async function toggleOrderPriority(orderId, currentPriority, silent = false, skipRender = false) {
    const isPriority = currentPriority === 1;
    const newPriority = !isPriority;
    
    try {
        // Optimistic UI update (only if not skipping render)
        if (!skipRender) {
            updatePriorityIcon(orderId, newPriority);
            updateRowStyle(orderId, newPriority);
        }
        
        // Call API (toggle mode - no explicit value)
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
        
        // Update local data with actual value from backend
        const orderIndex = allOrdersData.findIndex(o => o.id === orderId);
        if (orderIndex !== -1) {
            allOrdersData[orderIndex].is_priority = data.isPriority;
        }
        
        const filteredIndex = filteredOrdersData.findIndex(o => o.id === orderId);
        if (filteredIndex !== -1) {
            filteredOrdersData[filteredIndex].is_priority = data.isPriority;
        }
        
        // Re-sort and render (only if not skipped)
        if (!skipRender) {
            applySorting();
            renderOrdersTable();
        }
        
        // Show toast only if not silent
        if (!silent) {
            showToast(data.message, 'success');
        }
        
    } catch (error) {
        console.error('Error toggling priority:', error);
        
        // Rollback UI on error (only if not skipping render)
        if (!skipRender) {
            updatePriorityIcon(orderId, isPriority);
            updateRowStyle(orderId, isPriority);
        }
        
        // Show error toast only if not silent
        if (!silent) {
            showToast('Lỗi: ' + error.message, 'error');
        }
    }
}

/**
 * Update priority icon appearance (only in Actions column)
 */
function updatePriorityIcon(orderId, isPriority) {
    // Update icon in Actions column
    const row = document.querySelector(`tr[data-order-id="${orderId}"]`);
    if (row) {
        const actionsCell = row.querySelector('td:last-child');
        if (actionsCell) {
            const starButton = actionsCell.querySelector('button:first-child');
            if (starButton) {
                if (isPriority) {
                    // Show filled yellow star
                    starButton.className = 'text-yellow-500 hover:text-yellow-600 transition-all hover:scale-110';
                    starButton.title = 'Bỏ đánh dấu ưu tiên';
                    starButton.innerHTML = `
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                    `;
                } else {
                    // Show outline gray star
                    starButton.className = 'text-gray-400 hover:text-yellow-500 transition-all hover:scale-110';
                    starButton.title = 'Đánh dấu ưu tiên';
                    starButton.innerHTML = `
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 20 20" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                    `;
                }
            }
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

// NOTE: bulkTogglePriority() is defined in orders-bulk-actions.js
// This avoids code duplication and keeps bulk operations in one place

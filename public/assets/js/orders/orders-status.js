// Orders Status Module
// Handles status badge display and status updates
// NOTE: All functions are global scope for compatibility with existing code

// Get status badge HTML
function getStatusBadge(status, orderId, orderCode) {
    const statusConfig = {
        'pending': {
            label: 'Chờ xử lý',
            color: 'bg-yellow-100 text-yellow-700 border-yellow-300',
            icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />`
        },
        'shipped': {
            label: 'Đã gửi hàng',
            color: 'bg-blue-100 text-blue-700 border-blue-300',
            icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />`
        },
        'in_transit': {
            label: 'Đang vận chuyển',
            color: 'bg-purple-100 text-purple-700 border-purple-300',
            icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />`
        },
        'delivered': {
            label: 'Đã giao hàng',
            color: 'bg-emerald-100 text-emerald-700 border-emerald-300',
            icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />`
        },
        'failed': {
            label: 'Giao hàng thất bại',
            color: 'bg-red-100 text-red-700 border-red-300',
            icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />`
        }
    };

    const currentStatus = status || 'pending';
    const config = statusConfig[currentStatus] || statusConfig['pending'];

    return `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${config.color} cursor-pointer hover:shadow-md transition-all group" 
             onclick="showStatusMenu(${orderId}, '${escapeHtml(orderCode)}', '${currentStatus}', event)">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                ${config.icon}
            </svg>
            <span class="text-xs font-semibold whitespace-nowrap">${config.label}</span>
            <svg class="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
        </span>
    `;
}


// Show status menu
function showStatusMenu(orderId, orderCode, currentStatus, event) {
    event.stopPropagation();

    // Close any existing menu
    const existingMenu = document.getElementById('statusMenu');
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

    // Get the badge element position
    const badge = event.currentTarget;
    const rect = badge.getBoundingClientRect();

    // Create menu with fixed positioning (outside table container)
    const menu = document.createElement('div');
    menu.id = 'statusMenu';
    menu.className = 'fixed bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[180px]';
    menu.style.zIndex = '9999';

    // Calculate position - check if there's enough space below
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuHeight = 250; // Estimated menu height

    if (spaceBelow < menuHeight && rect.top > menuHeight) {
        // Show above
        menu.style.left = rect.left + 'px';
        menu.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
    } else {
        // Show below
        menu.style.left = rect.left + 'px';
        menu.style.top = (rect.bottom + 4) + 'px';
    }

    menu.innerHTML = statuses.map(s => `
        <button 
            onclick="updateOrderStatus(${orderId}, '${s.value}', '${escapeHtml(orderCode)}')"
            class="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left ${s.value === currentStatus ? 'bg-blue-50' : ''}"
        >
            <div class="w-3 h-3 rounded-full bg-${s.color}-500 flex-shrink-0"></div>
            <span class="text-base text-gray-700 flex-1">${s.label}</span>
            ${s.value === currentStatus ? `
                <svg class="w-5 h-5 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
            ` : ''}
        </button>
    `).join('');

    // Append to body (not to badge) to avoid overflow issues
    document.body.appendChild(menu);

    // Close menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!badge.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 10);
}

// Update order status
async function updateOrderStatus(orderId, newStatus, orderCode, silent = false, skipRender = false) {
    // Close menu
    const menu = document.getElementById('statusMenu');
    if (menu) menu.remove();

    // Show loading toast với ID (only if not silent)
    const updateId = `update-status-${orderId}`;
    if (!silent) {
        showToast('Đang cập nhật trạng thái...', 'info', 0, updateId);
    }

    try {
        // Update via API
        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'updateOrderStatus',
                orderId: orderId,
                status: newStatus
            })
        });

        const data = await response.json();

        if (data.success) {
            // Update local data
            const orderIndex = allOrdersData.findIndex(o => o.id === orderId);
            if (orderIndex !== -1) {
                allOrdersData[orderIndex].status = newStatus;
            }

            // Update filtered data
            const filteredIndex = filteredOrdersData.findIndex(o => o.id === orderId);
            if (filteredIndex !== -1) {
                filteredOrdersData[filteredIndex].status = newStatus;
            }

            // Re-render the table (only if not skipped)
            if (!skipRender) {
                renderOrdersTable();
            }

            // Show success toast (only if not silent)
            if (!silent) {
                // Get status label
                const statusLabels = {
                    'pending': 'Chờ xử lý',
                    'shipped': 'Đã gửi hàng',
                    'in_transit': 'Đang vận chuyển',
                    'delivered': 'Đã giao hàng',
                    'failed': 'Giao hàng thất bại'
                };

                showToast(`Đã cập nhật trạng thái đơn ${orderCode} thành "${statusLabels[newStatus]}"`, 'success', null, updateId);
            }
        } else {
            throw new Error(data.error || 'Không thể cập nhật trạng thái');
        }

    } catch (error) {
        console.error('Error updating status:', error);
        if (!silent) {
            showToast('Không thể cập nhật trạng thái: ' + error.message, 'error', null, updateId);
        }
    }
}

// Quick status update buttons (for bulk actions later)
function quickUpdateStatus(orderId, status) {
    const order = allOrdersData.find(o => o.id === orderId);
    if (order) {
        updateOrderStatus(orderId, status, order.order_id);
    }
}


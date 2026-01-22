// ============================================
// DISCOUNT EVENTS MANAGEMENT (Simple Version)
// ============================================
// Purpose: Display discounts grouped by special events
// 1 event = 1 discount code

let eventDiscounts = [];

async function loadEventDiscounts() {
    try {
        showEventsLoading();
        
        // Get all discounts that have special_event tag
        const response = await fetch(`${API_URL}?action=getAllDiscounts`);
        const data = await response.json();
        
        if (data.success) {
            // Filter only discounts with special_event
            eventDiscounts = (data.discounts || []).filter(d => d.special_event && d.special_event.trim());
            
            // Sort by event_date (if available), then by expiry_date
            eventDiscounts.sort((a, b) => {
                const dateA = a.event_date || a.expiry_date;
                const dateB = b.event_date || b.expiry_date;
                return new Date(dateB) - new Date(dateA);
            });
            
            renderEventDiscounts();
            updateEventCount();
        } else {
            showError('Không thể tải danh sách mã sự kiện');
        }
    } catch (error) {
        console.error('Error loading event discounts:', error);
        showError('Lỗi kết nối đến server');
    }
}

function renderEventDiscounts() {
    const loadingState = document.getElementById('eventsLoadingState');
    const eventsList = document.getElementById('eventsList');
    const emptyState = document.getElementById('eventsEmptyState');
    const tbody = document.getElementById('eventsTableBody');
    
    loadingState.classList.add('hidden');
    
    if (eventDiscounts.length === 0) {
        eventsList.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    eventsList.classList.remove('hidden');
    
    const now = new Date();
    
    tbody.innerHTML = eventDiscounts.map(discount => {
        const isExpired = new Date(discount.expiry_date) < now;
        const isActive = discount.active && !isExpired;
        const icon = discount.event_icon || '🎉';
        const eventName = discount.special_event || 'Sự kiện';
        
        // Calculate days remaining/passed
        let daysText = '';
        let daysClass = '';
        if (isActive) {
            const daysLeft = Math.ceil((new Date(discount.expiry_date) - now) / (1000 * 60 * 60 * 24));
            daysText = `Còn ${daysLeft} ngày`;
            daysClass = daysLeft <= 3 ? 'text-red-600 font-semibold' : 'text-gray-600';
        } else if (isExpired) {
            const daysPassed = Math.ceil((now - new Date(discount.expiry_date)) / (1000 * 60 * 60 * 24));
            daysText = `Hết hạn ${daysPassed} ngày trước`;
            daysClass = 'text-gray-500';
        } else {
            daysText = 'Tạm dừng';
            daysClass = 'text-orange-600';
        }
        
        return `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="text-3xl">${icon}</div>
                        <div>
                            <div class="font-semibold text-gray-900">${eventName}</div>
                            ${discount.event_date ? `<div class="text-xs text-gray-500">${formatDate(discount.event_date)}</div>` : ''}
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <code class="px-3 py-1.5 bg-gray-100 text-gray-800 rounded font-mono text-sm font-bold">
                        ${discount.code}
                    </code>
                </td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-2">
                        ${getTypeBadge(discount.type)}
                        <span class="font-semibold text-gray-900">${getValueDisplay(discount)}</span>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <div class="text-sm">
                        <div class="text-gray-600">${formatDate(discount.start_date || discount.created_at_unix)}</div>
                        <div class="text-gray-600">→ ${formatDate(discount.expiry_date)}</div>
                        <div class="${daysClass} text-xs mt-1">${daysText}</div>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <div class="text-sm">
                        <div class="font-semibold text-gray-900">${discount.usage_count || 0} lượt</div>
                        ${discount.max_total_uses ? `<div class="text-xs text-gray-500">/ ${discount.max_total_uses}</div>` : ''}
                    </div>
                </td>
                <td class="px-6 py-4">
                    ${getStatusBadge(isActive, isExpired)}
                </td>
                <td class="px-6 py-4 text-right">
                    <div class="flex items-center justify-end gap-2">
                        <button onclick="extendEventDiscount(${discount.id})" 
                            class="px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors font-medium"
                            title="Gia hạn">
                            <svg class="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Gia hạn
                        </button>
                        <button onclick="editDiscount(${discount.id})" 
                            class="p-2 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                            title="Sửa">
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button onclick="duplicateDiscount(${discount.id})" 
                            class="p-2 text-purple-600 hover:bg-purple-50 rounded transition-colors"
                            title="Sao chép">
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </button>
                        <button onclick="deleteDiscount(${discount.id}, '${discount.code}')" 
                            class="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Xóa">
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function showEventsLoading() {
    document.getElementById('eventsLoadingState').classList.remove('hidden');
    document.getElementById('eventsList').classList.add('hidden');
    document.getElementById('eventsEmptyState').classList.add('hidden');
}

function updateEventCount() {
    const countEl = document.getElementById('campaignCount');
    if (countEl) {
        countEl.textContent = eventDiscounts.length;
    }
}

// Extend discount expiry date
async function extendEventDiscount(id) {
    const discount = eventDiscounts.find(d => d.id === id);
    if (!discount) return;
    
    const days = prompt(`Gia hạn mã "${discount.code}" thêm bao nhiêu ngày?`, '30');
    if (!days || isNaN(days) || parseInt(days) <= 0) return;
    
    try {
        const currentExpiry = new Date(discount.expiry_date);
        const newExpiry = new Date(currentExpiry);
        newExpiry.setDate(newExpiry.getDate() + parseInt(days));
        
        const response = await fetch(`${API_URL}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'updateDiscount',
                id: id,
                ...discount,
                expiry_date: newExpiry.toISOString().split('T')[0]
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess(`Đã gia hạn mã "${discount.code}" thêm ${days} ngày!`);
            loadDiscounts(); // Reload main list
            loadEventDiscounts(); // Reload events list
        } else {
            showError(data.error || 'Không thể gia hạn mã');
        }
    } catch (error) {
        console.error('Error extending discount:', error);
        showError('Lỗi khi gia hạn mã');
    }
}

// Helper functions (reuse from main discounts.js)
function getTypeBadge(type) {
    const badges = {
        'fixed': '<span class="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">Cố định</span>',
        'percentage': '<span class="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-semibold">%</span>',
        'gift': '<span class="px-2 py-1 bg-pink-100 text-pink-800 rounded-full text-xs font-semibold">Quà</span>',
        'freeship': '<span class="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">Ship</span>'
    };
    return badges[type] || type;
}

function getValueDisplay(discount) {
    switch(discount.type) {
        case 'fixed':
            return formatMoney(discount.discount_value);
        case 'percentage':
            return `${discount.discount_value}%`;
        case 'gift':
            return discount.gift_product_name || 'Quà tặng';
        case 'freeship':
            return 'Miễn phí';
        default:
            return '-';
    }
}

function getStatusBadge(isActive, isExpired) {
    if (isExpired) {
        return '<span class="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-semibold">Hết hạn</span>';
    }
    if (isActive) {
        return '<span class="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">Hoạt động</span>';
    }
    return '<span class="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-semibold">Tạm dừng</span>';
}

function formatMoney(amount) {
    if (!amount) return '0đ';
    return new Intl.NumberFormat('vi-VN', { 
        style: 'currency', 
        currency: 'VND' 
    }).format(amount);
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', { 
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
    });
}

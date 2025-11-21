# 🎯 Đề Xuất Nâng Cấp Bộ Lọc - Trang Thanh Toán CTV

## 📊 Phân Tích Hiện Trạng

### Bộ Lọc Hiện Tại
```
[Month Selector] [Tải dữ liệu] [Tháng trước] | [🔍 Tìm kiếm...]
```

**Ưu điểm**:
- ✅ Đơn giản, dễ sử dụng
- ✅ Có tìm kiếm CTV

**Hạn chế**:
- ❌ Chỉ lọc được 1 tháng cụ thể
- ❌ Không lọc theo trạng thái (đã trả/chưa trả)
- ❌ Không có quick filters (3 tháng, 6 tháng, năm nay)
- ❌ Không lọc theo khoảng thời gian tùy chỉnh
- ❌ Không lọc theo số tiền

---

## 💡 Đề Xuất Nâng Cấp

### Option 1: Bộ Lọc Cơ Bản (Khuyến Nghị) ⭐⭐⭐⭐⭐

**Phù hợp**: Hầu hết trường hợp sử dụng

```
┌─────────────────────────────────────────────────────────────────────┐
│  Quick Filters:                                                     │
│  [Tháng này] [Tháng trước] [3 tháng] [6 tháng] [Năm nay] [Tất cả] │
│                                                                      │
│  Trạng thái: [Tất cả ▼] [Chưa thanh toán] [Đã thanh toán]         │
│                                                                      │
│  🔍 [Tìm CTV, SĐT, STK, ngân hàng...]                              │
└─────────────────────────────────────────────────────────────────────┘
```

**Lợi ích**:
- ✅ Nhanh chóng, 1 click
- ✅ Phù hợp với quy trình thanh toán theo tháng/quý
- ✅ Dễ theo dõi công nợ
- ✅ Không làm phức tạp UI

**Code mẫu**:
```html
<!-- Quick Filters -->
<div class="flex flex-wrap gap-2 mb-4">
    <button onclick="filterByPeriod('thisMonth')" 
            class="quick-filter-btn active">
        Tháng này
    </button>
    <button onclick="filterByPeriod('lastMonth')" 
            class="quick-filter-btn">
        Tháng trước
    </button>
    <button onclick="filterByPeriod('3months')" 
            class="quick-filter-btn">
        3 tháng
    </button>
    <button onclick="filterByPeriod('6months')" 
            class="quick-filter-btn">
        6 tháng
    </button>
    <button onclick="filterByPeriod('thisYear')" 
            class="quick-filter-btn">
        Năm nay
    </button>
    <button onclick="filterByPeriod('all')" 
            class="quick-filter-btn">
        Tất cả
    </button>
</div>

<!-- Status Filter -->
<div class="flex gap-2 mb-4">
    <select id="statusFilter" onchange="applyFilters()" 
            class="px-4 py-2 border rounded-lg">
        <option value="all">Tất cả trạng thái</option>
        <option value="pending">Chưa thanh toán</option>
        <option value="paid">Đã thanh toán</option>
    </select>
</div>
```

---

### Option 2: Bộ Lọc Nâng Cao (Cho Power Users) ⭐⭐⭐⭐

**Phù hợp**: Admin cần phân tích chi tiết

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Tháng này] [Tháng trước] [3 tháng] [6 tháng] [Năm nay] [Tùy chỉnh▼]│
│                                                                      │
│  ┌─ Tùy chỉnh (ẩn mặc định) ────────────────────────────────────┐  │
│  │  Từ ngày: [📅 01/11/2025]  Đến ngày: [📅 30/11/2025]  [Áp dụng] │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Trạng thái: [Tất cả ▼]  Số tiền: [Từ: 0đ] [Đến: 10tr]            │
│                                                                      │
│  🔍 [Tìm CTV, SĐT, STK, ngân hàng...]                              │
└─────────────────────────────────────────────────────────────────────┘
```

**Lợi ích**:
- ✅ Linh hoạt cao
- ✅ Phù hợp đối soát công nợ
- ✅ Tìm các khoản thanh toán bất thường
- ⚠️ Phức tạp hơn một chút

---

### Option 3: Bộ Lọc Tối Giản (Cho Mobile) ⭐⭐⭐

**Phù hợp**: Responsive, mobile-first

```
┌─────────────────────────────────────────────────────────────────────┐
│  [≡ Bộ lọc (3)]  🔍 [Tìm kiếm...]                                  │
│                                                                      │
│  ┌─ Dropdown khi click "Bộ lọc" ──────────────────────────────┐   │
│  │  ☑ Tháng này                                                 │   │
│  │  ☐ Tháng trước                                               │   │
│  │  ☐ 3 tháng                                                   │   │
│  │  ☐ 6 tháng                                                   │   │
│  │  ☐ Năm nay                                                   │   │
│  │  ─────────────                                               │   │
│  │  Trạng thái: [Tất cả ▼]                                      │   │
│  │  ─────────────                                               │   │
│  │  [Áp dụng] [Xóa bộ lọc]                                      │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

**Lợi ích**:
- ✅ Tiết kiệm không gian
- ✅ Tốt cho mobile
- ✅ Hiển thị số lượng filter đang áp dụng

---

## 🎨 Thiết Kế Chi Tiết - Option 1 (Khuyến Nghị)

### Layout Hoàn Chỉnh

```html
<!-- Filters Section -->
<div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
    <!-- Quick Period Filters -->
    <div class="mb-4">
        <label class="block text-sm font-semibold text-gray-700 mb-2">
            Khoảng thời gian
        </label>
        <div class="flex flex-wrap gap-2">
            <button onclick="filterByPeriod('thisMonth')" 
                    id="filter-thisMonth"
                    class="px-4 py-2 text-sm font-medium rounded-lg border-2 border-indigo-600 bg-indigo-50 text-indigo-700">
                Tháng này
            </button>
            <button onclick="filterByPeriod('lastMonth')" 
                    id="filter-lastMonth"
                    class="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
                Tháng trước
            </button>
            <button onclick="filterByPeriod('3months')" 
                    id="filter-3months"
                    class="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
                3 tháng gần đây
            </button>
            <button onclick="filterByPeriod('6months')" 
                    id="filter-6months"
                    class="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
                6 tháng gần đây
            </button>
            <button onclick="filterByPeriod('thisYear')" 
                    id="filter-thisYear"
                    class="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
                Năm nay
            </button>
            <button onclick="filterByPeriod('all')" 
                    id="filter-all"
                    class="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
                Tất cả
            </button>
        </div>
    </div>

    <!-- Status & Search Row -->
    <div class="flex flex-col md:flex-row gap-4">
        <!-- Status Filter -->
        <div class="w-full md:w-64">
            <label class="block text-sm font-semibold text-gray-700 mb-2">
                Trạng thái
            </label>
            <select id="statusFilter" onchange="applyFilters()" 
                    class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm">
                <option value="all">Tất cả trạng thái</option>
                <option value="pending">Chưa thanh toán</option>
                <option value="paid">Đã thanh toán</option>
            </select>
        </div>

        <!-- Search -->
        <div class="flex-1">
            <label class="block text-sm font-semibold text-gray-700 mb-2">
                Tìm kiếm
            </label>
            <div class="relative">
                <input type="text" id="searchInput" 
                       placeholder="Tìm CTV, SĐT, STK, ngân hàng..." 
                       onkeyup="applyFilters()" 
                       class="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm">
                <div class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
                <button id="searchClearBtn" onclick="clearSearch()" 
                        class="hidden absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>

        <!-- Clear Filters Button -->
        <div class="w-full md:w-auto flex items-end">
            <button onclick="clearAllFilters()" 
                    class="w-full md:w-auto px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium">
                <svg class="w-4 h-4 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Xóa bộ lọc
            </button>
        </div>
    </div>

    <!-- Active Filters Display -->
    <div id="activeFilters" class="hidden mt-4 pt-4 border-t border-gray-200">
        <div class="flex items-center gap-2 flex-wrap">
            <span class="text-sm text-gray-600">Đang lọc:</span>
            <!-- Filter tags will be inserted here -->
        </div>
    </div>
</div>
```

### JavaScript Functions

```javascript
// Global filter state
let currentFilters = {
    period: 'thisMonth',
    status: 'all',
    search: '',
    dateRange: null
};

// Filter by period
function filterByPeriod(period) {
    currentFilters.period = period;
    
    // Update button states
    document.querySelectorAll('[id^="filter-"]').forEach(btn => {
        btn.classList.remove('border-indigo-600', 'bg-indigo-50', 'text-indigo-700', 'border-2');
        btn.classList.add('border', 'border-gray-300', 'text-gray-700');
    });
    
    const activeBtn = document.getElementById(`filter-${period}`);
    if (activeBtn) {
        activeBtn.classList.remove('border', 'border-gray-300', 'text-gray-700');
        activeBtn.classList.add('border-2', 'border-indigo-600', 'bg-indigo-50', 'text-indigo-700');
    }
    
    // Calculate date range based on period
    const now = new Date();
    let startDate, endDate;
    
    switch(period) {
        case 'thisMonth':
            startDate = getVNStartOfMonth();
            endDate = getVNEndOfMonth();
            break;
        case 'lastMonth':
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            startDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
            endDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0, 23, 59, 59);
            break;
        case '3months':
            startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
            endDate = getVNEndOfMonth();
            break;
        case '6months':
            startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
            endDate = getVNEndOfMonth();
            break;
        case 'thisYear':
            startDate = getVNStartOfYear();
            endDate = getVNEndOfYear();
            break;
        case 'all':
            startDate = null;
            endDate = null;
            break;
    }
    
    currentFilters.dateRange = startDate && endDate ? { startDate, endDate } : null;
    
    applyFilters();
}

// Apply all filters
function applyFilters() {
    const statusFilter = document.getElementById('statusFilter').value;
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    
    currentFilters.status = statusFilter;
    currentFilters.search = searchTerm;
    
    // Show/hide clear button
    const clearBtn = document.getElementById('searchClearBtn');
    if (searchTerm) {
        clearBtn.classList.remove('hidden');
    } else {
        clearBtn.classList.add('hidden');
    }
    
    // Filter data
    let filtered = [...allPaymentsData];
    
    // Filter by date range
    if (currentFilters.dateRange) {
        const { startDate, endDate } = currentFilters.dateRange;
        filtered = filtered.filter(payment => {
            const paymentDate = new Date(payment.created_at || payment.payment_date);
            return paymentDate >= startDate && paymentDate <= endDate;
        });
    }
    
    // Filter by status
    if (statusFilter !== 'all') {
        filtered = filtered.filter(payment => payment.status === statusFilter);
    }
    
    // Filter by search
    if (searchTerm) {
        filtered = filtered.filter(payment => {
            return (
                (payment.referral_code && payment.referral_code.toLowerCase().includes(searchTerm)) ||
                (payment.ctv_name && payment.ctv_name.toLowerCase().includes(searchTerm)) ||
                (payment.phone && payment.phone.includes(searchTerm)) ||
                (payment.bank_account && payment.bank_account.includes(searchTerm)) ||
                (payment.bank_name && payment.bank_name.toLowerCase().includes(searchTerm))
            );
        });
    }
    
    filteredPaymentsData = filtered;
    updateActiveFiltersDisplay();
    renderPaymentsList();
    updateStats();
}

// Update active filters display
function updateActiveFiltersDisplay() {
    const container = document.getElementById('activeFilters');
    const hasFilters = currentFilters.period !== 'all' || 
                      currentFilters.status !== 'all' || 
                      currentFilters.search;
    
    if (!hasFilters) {
        container.classList.add('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    
    let tags = [];
    
    // Period tag
    const periodLabels = {
        'thisMonth': 'Tháng này',
        'lastMonth': 'Tháng trước',
        '3months': '3 tháng gần đây',
        '6months': '6 tháng gần đây',
        'thisYear': 'Năm nay',
        'all': 'Tất cả'
    };
    
    if (currentFilters.period !== 'all') {
        tags.push(`<span class="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm">
            ${periodLabels[currentFilters.period]}
            <button onclick="filterByPeriod('all')" class="hover:text-indigo-900">×</button>
        </span>`);
    }
    
    // Status tag
    if (currentFilters.status !== 'all') {
        const statusLabel = currentFilters.status === 'pending' ? 'Chưa thanh toán' : 'Đã thanh toán';
        tags.push(`<span class="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
            ${statusLabel}
            <button onclick="document.getElementById('statusFilter').value='all'; applyFilters();" class="hover:text-blue-900">×</button>
        </span>`);
    }
    
    // Search tag
    if (currentFilters.search) {
        tags.push(`<span class="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
            Tìm: "${currentFilters.search}"
            <button onclick="clearSearch()" class="hover:text-green-900">×</button>
        </span>`);
    }
    
    container.querySelector('div').innerHTML = `
        <span class="text-sm text-gray-600">Đang lọc:</span>
        ${tags.join('')}
    `;
}

// Clear all filters
function clearAllFilters() {
    currentFilters = {
        period: 'thisMonth',
        status: 'all',
        search: '',
        dateRange: null
    };
    
    document.getElementById('statusFilter').value = 'all';
    document.getElementById('searchInput').value = '';
    document.getElementById('searchClearBtn').classList.add('hidden');
    
    filterByPeriod('thisMonth');
}

// Clear search
function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('searchClearBtn').classList.add('hidden');
    currentFilters.search = '';
    applyFilters();
}
```

---

## 📊 So Sánh Các Options

| Tiêu chí | Option 1 (Cơ bản) | Option 2 (Nâng cao) | Option 3 (Tối giản) |
|----------|-------------------|---------------------|---------------------|
| **Dễ sử dụng** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Tính năng** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Mobile-friendly** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Tốc độ** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Phù hợp** | Hầu hết users | Power users | Mobile users |

---

## 🎯 Khuyến Nghị Cuối Cùng

### Giai Đoạn 1: Triển Khai Ngay (Option 1)
- ✅ Quick period filters (6 buttons)
- ✅ Status filter (dropdown)
- ✅ Search (đã có)
- ✅ Active filters display
- ✅ Clear all button

**Thời gian**: ~2-3 giờ  
**Lợi ích**: Cải thiện UX ngay lập tức

### Giai Đoạn 2: Nâng Cấp Sau (Option 2)
- ⏳ Custom date range picker
- ⏳ Amount range filter
- ⏳ Export filtered data
- ⏳ Save filter presets

**Thời gian**: ~4-5 giờ  
**Lợi ích**: Power features cho admin

### Giai Đoạn 3: Tối Ưu Mobile (Option 3)
- ⏳ Responsive filter panel
- ⏳ Bottom sheet on mobile
- ⏳ Touch-friendly controls

**Thời gian**: ~2-3 giờ  
**Lợi ích**: Trải nghiệm mobile tốt hơn

---

## 🚀 Bắt Đầu Ngay

Tôi có thể implement Option 1 cho bạn ngay bây giờ. Bạn có muốn không?

**Bao gồm**:
1. ✅ HTML layout mới
2. ✅ JavaScript functions
3. ✅ CSS styles
4. ✅ Timezone integration
5. ✅ Test cases

**Thời gian**: ~30 phút

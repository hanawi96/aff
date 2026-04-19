// Orders Utility Functions
// Extracted from orders.js for better code organization
// NOTE: All functions remain at global scope for backward compatibility

// ============================================
// DEBOUNCE
// ============================================

/**
 * Debounce function - delays execution until after wait milliseconds
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================
// CLIPBOARD
// ============================================

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 */
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Đã copy: ' + text);
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}

// ============================================
// HTML & TEXT FORMATTING
// ============================================

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// PAYMENT METHOD (admin desktop ↔ mobile / shop)
// DB có thể là "bank" (updatePaymentMethod) hoặc "bank_transfer" (form mobile, updateOrderFull).
// Khớp logic normalize trên public/admin/m.html — một nơi dùng chung để hiển thị & lọc.
// ============================================

/** Chuẩn hóa status từ DB/UI (VN hoặc slug) → slug dùng cho lọc/hiển thị */
function normalizeOrderStatusSlug(status) {
    const s = (status == null ? '' : String(status)).toLowerCase().trim();
    const statusMap = {
        'mới': 'pending',
        'chờ xử lý': 'pending',
        'đã gửi hàng': 'shipped',
        'đang vận chuyển': 'in_transit',
        'đã giao hàng': 'delivered',
        'giao hàng thất bại': 'failed'
    };
    return statusMap[s] || s;
}

/** Chỉ hiện block thời gian gửi khi đơn đang ở trạng thái đã gửi / vận chuyển / đã giao */
function orderShouldShowShipTime(order) {
    if (!order || !order.shipped_at_unix) return false;
    const slug = normalizeOrderStatusSlug(order.status);
    return slug === 'shipped' || slug === 'in_transit' || slug === 'delivered';
}

function normalizeOrderPaymentMethodStored(v) {
    if (v == null || v === '') return 'cod';
    if (typeof v === 'number') return v === 1 ? 'bank_transfer' : 'cod';
    const s = String(v).trim().toLowerCase().replace(/\s+/g, '_');
    if (s === 'bank_transfer' || s === 'bank' || s === 'transfer' || s === 'chuyen_khoan' || s === 'chuyển_khoản' || s === 'ck' || s === 'da_ck' || s === 'đã_ck') {
        return 'bank_transfer';
    }
    return 'cod';
}

function isOrderBankPayment(v) {
    return normalizeOrderPaymentMethodStored(v) === 'bank_transfer';
}

/** 'bank' | 'cod' — khớp API updatePaymentMethod và modal sửa trên desktop */
function orderPaymentApiKey(v) {
    return isOrderBankPayment(v) ? 'bank' : 'cod';
}

// ============================================
// CURRENCY FORMATTING
// ============================================

/**
 * Parse price from various formats to number
 * Handles: number, "75000", "75.000", "75.000đ", "75 đ", etc.
 * @param {number|string} price - Price in any format
 * @returns {number} Parsed price as number
 */
function parsePrice(price) {
    if (price === null || price === undefined) return 0;
    
    // If already a number, return it
    if (typeof price === 'number') return price;
    
    // If string, clean it up
    // Remove all non-digit characters (including dots, spaces, currency symbols)
    const cleanPrice = String(price).replace(/[^\d]/g, '');
    const parsed = parseFloat(cleanPrice) || 0;
    
    return parsed;
}

/**
 * Định dạng ô nhập tiền VN (90.000) khi gõ: chỉ giữ chữ số rồi format locale vi-VN.
 * Dùng chung modal đơn hàng (SP tùy chỉnh, chỉnh sửa dòng).
 */
function formatVnMoneyInput(inputEl) {
    if (!inputEl) return;
    const digits = String(inputEl.value || '').replace(/\D/g, '');
    if (digits === '') {
        inputEl.value = '';
        return;
    }
    let num = parseInt(digits, 10);
    if (Number.isNaN(num) || num < 0) num = 0;
    if (num > 999999999) num = 999999999;
    inputEl.value = new Intl.NumberFormat('vi-VN').format(num);
    requestAnimationFrame(() => {
        try {
            const len = inputEl.value.length;
            inputEl.setSelectionRange(len, len);
        } catch (e) {
            /* ignore */
        }
    });
}

/**
 * Hiển thị số nguyên kiểu VN (90.000), chuỗi rỗng nếu <= 0 hoặc không hợp lệ
 */
function formatVnIntegerString(amount) {
    if (amount === null || amount === undefined || amount === '') return '';
    const n = Math.round(Number(amount));
    if (Number.isNaN(n) || n <= 0) return '';
    return new Intl.NumberFormat('vi-VN').format(n);
}

/**
 * Format number as Vietnamese currency
 * @param {number|string} amount - Amount to format
 * @returns {string} Formatted currency string (e.g., "100.000đ")
 */
function formatCurrency(amount) {
    // Handle invalid values
    if (amount === null || amount === undefined || isNaN(amount)) return '0đ';
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return '0đ';

    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(numAmount);
}

// ============================================
// WEIGHT/SIZE FORMATTING
// ============================================

/**
 * Chuẩn hóa cân/size trước khi gửi API: rỗng hoặc "chưa có" → null (đồng bộ DB)
 */
function normalizeOrderItemSizeClient(value) {
    if (value == null) return null;
    const s = String(value).trim();
    if (s === '') return null;
    const lower = s.toLowerCase();
    if (lower === 'chưa có' || lower === 'chua co' || lower === 'chua có') return null;
    return s;
}

/**
 * SPX 文案：由 size/weight 得到展示用 Size 标签（含 cm 手围、kg 体重；空则「Chưa có」）
 * @param {string|number|null|undefined} sizeOrWeight - 优先 size，其次 weight
 * @returns {string} 如 "5kg"、"14cm" 或 "Chưa có"
 */
function getSPXSizeLabel(sizeOrWeight) {
    if (sizeOrWeight === null || sizeOrWeight === undefined) return 'Chưa có';
    const raw = String(sizeOrWeight).trim();
    if (raw === '') return 'Chưa có';

    const sizeStr = raw.toLowerCase();
    if (sizeStr.includes('cm')) {
        const cmValue = sizeStr.replace(/[^0-9.]/g, '');
        if (cmValue) return `${cmValue}cm`;
        return 'Chưa có';
    }
    const kgValue = sizeStr.replace(/[^0-9.]/g, '');
    if (kgValue) return `${kgValue}kg`;
    return 'Chưa có';
}

/** Giữa các ngoặc sản phẩm: khoảng trắng + năm dấu gạch + khoảng trắng. */
const SPX_INTER_PRODUCT_SEP = ' ----- ';
/** Trước khối lưu ý cả đơn: khoảng trắng + ba dấu gạch + khoảng trắng. */
const SPX_BEFORE_ORDER_NOTE = ' --- ';

/**
 * SPX 单行括号格式（Copy SPX / Excel 商品列一致）：[Tên -- Size: … - Số lượng: n]
 * Chỉ lưu ý từng sản phẩm (nhãn LƯU Ý:); lưu ý cả đơn gắn một lần ở cuối qua buildSPXProductColumnText.
 * @param {string} name - 商品原名（不再拼接「cho bé Xkg」）
 * @param {string|number|null|undefined} sizeOrWeight
 * @param {number} quantity
 * @param {string|null|undefined} notes - lưu ý từng dòng sản phẩm
 */
function formatSPXProductBracketLine(name, sizeOrWeight, quantity, notes) {
    const baseName = (name || 'Sản phẩm').trim() || 'Sản phẩm';
    const sizeLabel = getSPXSizeLabel(sizeOrWeight);
    let line = `${baseName} -- Size: ${sizeLabel} - Số lượng: ${quantity}`;
    if (notes) line += ` - LƯU Ý: ${notes}`;
    return `[${line}]`;
}

/**
 * Cột *Tên sản phẩm* / copy SPX: tiền tố thương hiệu + từng SP (-----) + một khối [LƯU Ý TỔNG: …] (---) nếu có ghi chú đơn.
 * @param {string[]} productBracketLines - kết quả formatSPXProductBracketLine từng phần tử
 * @param {string} [orderNoteTrimmed] - ghi chú đơn (đã trim), có thể rỗng
 */
function buildSPXProductColumnText(productBracketLines, orderNoteTrimmed) {
    const order = orderNoteTrimmed && String(orderNoteTrimmed).trim() ? String(orderNoteTrimmed).trim() : '';
    let t = '';
    if (productBracketLines && productBracketLines.length > 0) {
        t = '[VÒNG DÂU TẰM] - ' + productBracketLines.join(SPX_INTER_PRODUCT_SEP);
    }
    if (order) {
        const block = '[LƯU Ý TỔNG: ' + order + ']';
        t = t ? t + SPX_BEFORE_ORDER_NOTE + block : block;
    }
    return t;
}

/**
 * Danh sách tên sản phẩm trong đơn chưa có cân hoặc size (sau chuẩn hóa).
 * Dùng trước khi copy format SPX / in để cảnh báo.
 */
function getOrderProductsMissingSizeWeight(order) {
    if (!order || order.products == null || order.products === '') return [];
    let products = [];
    try {
        products = JSON.parse(order.products);
        if (!Array.isArray(products)) products = [];
    } catch (e) {
        const lines = String(order.products).split(/[,\n]/).map((line) => line.trim()).filter(Boolean);
        products = lines.map((line) => {
            const match = line.match(/^(.+?)\s*[xX×]\s*(\d+)$/);
            if (match) return { name: match[1].trim(), quantity: parseInt(match[2], 10) };
            return { name: line, quantity: 1 };
        });
    }

    const missing = [];
    for (const p of products) {
        if (typeof p === 'string') {
            missing.push(p.trim() || 'Sản phẩm');
            continue;
        }
        if (!p || typeof p !== 'object') {
            missing.push('Sản phẩm');
            continue;
        }
        const name = (p.name || 'Sản phẩm').trim() || 'Sản phẩm';
        const size = normalizeOrderItemSizeClient(p.size ?? null);
        const weight = normalizeOrderItemSizeClient(p.weight ?? null);
        if (!size && !weight) missing.push(name);
    }
    return missing;
}

/**
 * Một lượt quét allOrdersData — đơn nào có ≥1 SP thiếu cân/size (dùng chung bộ lọc / SPX)
 */
function computeOrdersWithMissingSize() {
    if (typeof allOrdersData === 'undefined' || !Array.isArray(allOrdersData)) return [];
    const out = [];
    for (const order of allOrdersData) {
        if ((order.status || 'pending') !== 'pending') continue;
        const missing = getOrderProductsMissingSizeWeight(order);
        if (missing.length > 0) out.push({ order, missing });
    }
    return out;
}

/**
 * Cập nhật dòng "Lưu ý" phía trên bảng đơn (ẩn nếu không có đơn thiếu size)
 */
function updateMissingSizeBanner() {
    const wrap = document.getElementById('ordersMissingSizeBanner');
    const textEl = document.getElementById('ordersMissingSizeBannerText');
    if (!wrap || !textEl) return;
    const n = computeOrdersWithMissingSize().length;
    if (n === 0) {
        wrap.classList.add('hidden');
        return;
    }
    textEl.textContent = `Có ${n} đơn hàng chưa có cân nặng`;
    wrap.classList.remove('hidden');
}

/**
 * Modal danh sách đơn thiếu cân/size (bấm icon mắt trên banner)
 */
function showOrdersMissingSizeListModal() {
    const entries = computeOrdersWithMissingSize();
    const modalId = 'ordersMissingSizeListModal';
    document.getElementById(modalId)?.remove();

    if (entries.length === 0) {
        showToast('Không còn đơn nào thiếu cân/size', 'info');
        return;
    }

    const overlay = document.createElement('div');
    overlay.id = modalId;
    overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[200] p-4';

    const rows = entries.map(({ order, missing }) => {
        const code = escapeHtml(String(order.order_id || order.id || ''));
        const cust = escapeHtml(String(order.customer_name || '—'));
        const productBadges = missing
            .map(
                (m) =>
                    `<span class="inline-block max-w-full rounded-lg border border-amber-200/90 bg-amber-50 px-2.5 py-1.5 text-xs font-medium leading-snug text-amber-950 shadow-sm break-words">${escapeHtml(m)}</span>`
            )
            .join('');
        const productsCell = `<div class="py-0.5">
            <div class="flex flex-wrap gap-2 max-h-52 overflow-y-auto overscroll-y-contain pr-0.5 -mr-0.5 [scrollbar-gutter:stable]">${productBadges}</div>
        </div>`;
        return `<tr class="border-b border-gray-100 hover:bg-amber-50/50">
            <td class="align-top py-3 px-3 text-sm font-semibold text-amber-900 whitespace-nowrap">${code}</td>
            <td class="align-top py-3 px-3 text-sm text-gray-800">${cust}</td>
            <td class="align-top py-3 px-3 text-sm text-gray-700 min-w-[12rem]">${productsCell}</td>
        </tr>`;
    }).join('');

    overlay.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[88vh] overflow-hidden border border-amber-200 flex flex-col" role="dialog" aria-modal="true">
            <div class="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4 flex items-center justify-between flex-shrink-0">
                <h3 class="text-lg font-bold text-white">Đơn hàng chưa đủ cân / size</h3>
                <button type="button" class="orders-missing-list-close text-white/90 hover:text-white p-1 rounded-lg hover:bg-white/10" aria-label="Đóng">
                    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>
            <div class="p-4 overflow-y-auto flex-1">
                <p class="text-sm text-gray-600 mb-3">Tổng <strong>${entries.length}</strong> đơn — sản phẩm thiếu cân hoặc size:</p>
                <div class="overflow-x-auto rounded-lg border border-gray-200">
                    <table class="min-w-full text-left">
                        <thead class="bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                            <tr>
                                <th class="py-2.5 px-3 whitespace-nowrap">Mã đơn</th>
                                <th class="py-2.5 px-3 whitespace-nowrap">Khách hàng</th>
                                <th class="py-2.5 px-3">Sản phẩm thiếu size</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white">${rows}</tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    const close = () => overlay.remove();
    overlay.querySelector('.orders-missing-list-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });
    document.body.appendChild(overlay);
}

/**
 * Format weight/size value with proper unit
 * @param {string|number} value - Weight or size value
 * @returns {string} Formatted value with unit (e.g., "5kg", "100g")
 */
function formatWeightSize(value) {
    if (!value) return '';
    let str = String(value).trim();
    const lower = str.toLowerCase();
    if (lower === 'chưa có' || lower === 'chua co' || lower === 'chua có') return '';

    // Loại bỏ khoảng trắng thừa: "5 kg" -> "5kg"
    str = str.replace(/\s+/g, '');

    // Nếu chỉ là số thuần túy (không có chữ cái) thì thêm "kg"
    if (/^\d+(\.\d+)?$/.test(str)) {
        return str + 'kg';
    }

    // Chuẩn hóa các đơn vị phổ biến
    str = str
        .replace(/^(\d+(\.\d+)?)g$/i, '$1g')           // "5g" -> "5g"
        .replace(/^(\d+(\.\d+)?)kg$/i, '$1kg')         // "5kg" -> "5kg"
        .replace(/^(\d+(\.\d+)?)cm$/i, '$1cm')         // "5cm" -> "5cm"
        .replace(/^(\d+(\.\d+)?)mm$/i, '$1mm')         // "5mm" -> "5mm"
        .replace(/gram$/i, 'g')                         // "5gram" -> "5g"
        .replace(/kilogram$/i, 'kg');                   // "5kilogram" -> "5kg"

    return str;
}

// ============================================
// DATE/TIME FORMATTING
// ============================================

/**
 * Format date string to Vietnamese format
 * Uses timezone-utils for UTC to VN timezone conversion
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date string
 */
function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    try {
        // Use timezone-utils to convert UTC to VN timezone
        return toVNDateString(dateString);
    } catch (e) {
        return dateString;
    }
}

/**
 * Format date string or Unix timestamp to separate time and date parts
 * @param {string|number} dateInput - ISO date string or Unix timestamp (milliseconds)
 * @returns {{time: string, date: string}} Object with time (HH:mm:ss) and date (DD/MM/YYYY)
 */
function formatDateTimeSplit(dateInput) {
    if (!dateInput) return { time: 'N/A', date: '' };
    try {
        // If it's a Unix timestamp (number), create Date directly
        // Unix timestamps are already in the correct timezone (Vietnam time when created)
        let vnDate;
        if (typeof dateInput === 'number' || /^\d+$/.test(dateInput)) {
            // Unix timestamp - already in Vietnam time
            vnDate = new Date(Number(dateInput));
        } else {
            // ISO string - needs timezone conversion
            vnDate = toVNDate(dateInput);
        }

        // Format time (HH:mm:ss)
        const hours = vnDate.getHours().toString().padStart(2, '0');
        const minutes = vnDate.getMinutes().toString().padStart(2, '0');
        const seconds = vnDate.getSeconds().toString().padStart(2, '0');
        const time = `${hours}:${minutes}:${seconds}`;

        // Format date (DD/MM/YYYY)
        const day = vnDate.getDate().toString().padStart(2, '0');
        const month = (vnDate.getMonth() + 1).toString().padStart(2, '0');
        const year = vnDate.getFullYear();
        const date = `${day}/${month}/${year}`;

        return { time, date };
    } catch (e) {
        return { time: String(dateInput), date: '' };
    }
}

/**
 * Milliseconds timestamp for order display (same parsing rules as formatDateTimeSplit).
 * @param {string|number} dateInput
 * @returns {number}
 */
function parseOrderTimestampMs(dateInput) {
    if (dateInput == null || dateInput === '') return NaN;
    try {
        if (typeof dateInput === 'number' || /^\d+$/.test(String(dateInput))) {
            return Number(dateInput);
        }
        return new Date(dateInput).getTime();
    } catch (e) {
        return NaN;
    }
}

/**
 * Vietnamese relative time: "Vừa xong", "N phút trước", "N giờ trước" (same calendar day in VN only).
 * @param {number} eventMs
 * @returns {string}
 */
function formatVietnameseRelativeAgo(eventMs) {
    const now = Date.now();
    let diffSec = Math.floor((now - eventMs) / 1000);
    if (diffSec < 0) diffSec = 0;
    if (diffSec < 45) return 'Vừa xong';
    if (diffSec < 3600) {
        const m = Math.max(1, Math.floor(diffSec / 60));
        return `${m} phút trước`;
    }
    const h = Math.max(1, Math.floor(diffSec / 3600));
    return `${h} giờ trước`;
}

/**
 * Đặt / Gửi: trong cùng ngày lịch VN → tương đối; sang ngày khác → giờ + ngày như cũ.
 * @param {string|number} dateInput
 * @returns {{ isRelative: boolean, main: string, sub: string, title: string }}
 */
function formatOrderTimeDisplayParts(dateInput) {
    const split = formatDateTimeSplit(dateInput);
    const title = split.date ? `${split.time} · ${split.date}` : split.time;

    const ms = parseOrderTimestampMs(dateInput);
    if (!Number.isFinite(ms)) {
        return { isRelative: false, main: split.time, sub: split.date, title };
    }

    const eventDayVN = new Date(ms).toLocaleDateString('en-CA', { timeZone: VIETNAM_TIMEZONE });
    const todayVN = new Date().toLocaleDateString('en-CA', { timeZone: VIETNAM_TIMEZONE });

    if (eventDayVN === todayVN) {
        return {
            isRelative: true,
            main: formatVietnameseRelativeAgo(ms),
            sub: '',
            title
        };
    }

    return { isRelative: false, main: split.time, sub: split.date, title };
}

/**
 * Orders CTV Verification
 * Extracted from orders.js
 * 
 * Dependencies:
 * - updateOrderSummary() from orders-add-modal.js
 * - CONFIG.API_URL from config.js
 */

// ============================================
// CTV Auto-Verify - Simple Version
// ============================================

let ctvCheckTimeout = null;
let ctvVerified = false; // Track verification status

// Listen to CTV input changes
document.addEventListener('input', function (e) {
    if (e.target.id === 'newOrderReferralCode') {
        const code = e.target.value.trim();
        const statusDiv = document.getElementById('ctvVerifyStatus');

        if (!statusDiv) return;

        // Clear previous timeout
        clearTimeout(ctvCheckTimeout);

        // Reset verification status
        ctvVerified = false;

        // Clear if empty (empty is allowed)
        if (!code) {
            statusDiv.innerHTML = '';
            ctvVerified = true; // Empty is valid

            // Remove commission_rate
            const commissionRateInput = document.getElementById('ctvCommissionRate');
            if (commissionRateInput) commissionRateInput.remove();

            // Update order summary to recalculate commission
            updateOrderSummary();
            return;
        }

        // Show loading
        statusDiv.innerHTML = '<div class="text-xs text-gray-500 mt-1">Đang kiểm tra...</div>';

        // Check after 600ms
        ctvCheckTimeout = setTimeout(async () => {
            try {
                const response = await fetch(`${CONFIG.API_URL}?action=verifyCTV&code=${encodeURIComponent(code)}`);
                const data = await response.json();

                if (data.success && data.verified) {
                    const rate = (data.data.rate * 100).toFixed(0);
                    statusDiv.innerHTML = `
                        <div class="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
                            <div class="text-green-800 font-semibold">✓ ${data.data.name}</div>
                            <div class="text-green-600">Hoa hồng: ${rate}% • ${data.data.phone}</div>
                        </div>
                    `;

                    // Store commission_rate in hidden input for calculation
                    let commissionRateInput = document.getElementById('ctvCommissionRate');
                    if (!commissionRateInput) {
                        commissionRateInput = document.createElement('input');
                        commissionRateInput.type = 'hidden';
                        commissionRateInput.id = 'ctvCommissionRate';
                        statusDiv.appendChild(commissionRateInput);
                    }
                    commissionRateInput.value = data.data.rate;

                    ctvVerified = true; // Valid CTV

                    // Update order summary to recalculate commission
                    updateOrderSummary();
                } else {
                    statusDiv.innerHTML = `
                        <div class="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-semibold">
                            ✗ Không tìm thấy CTV với mã này
                        </div>
                    `;

                    // Remove commission_rate
                    const commissionRateInput = document.getElementById('ctvCommissionRate');
                    if (commissionRateInput) commissionRateInput.remove();

                    ctvVerified = false; // Invalid CTV

                    // Update order summary to recalculate commission
                    updateOrderSummary();
                }
            } catch (error) {
                console.error('Error verifying CTV:', error);
                statusDiv.innerHTML = '<div class="text-xs text-red-500 mt-1">Lỗi kết nối</div>';
                ctvVerified = false;
            }
        }, 600);
    }
});

// Validation function for CTV code
function validateCTVCode() {
    const ctvInput = document.getElementById('newOrderReferralCode');
    if (!ctvInput) return true; // If input doesn't exist, allow

    const code = ctvInput.value.trim();

    // If empty, allow (optional field)
    if (!code) return true;

    // If has value but not verified, block
    if (!ctvVerified) {
        alert('⚠️ Mã CTV không hợp lệ!\n\nVui lòng kiểm tra lại mã CTV hoặc để trống nếu không có.');
        ctvInput.focus();
        return false;
    }

    return true;
}

// ============================================
// Chọn CTV từ danh sách (modal trong form đơn hàng)
// ============================================

let ctvPickerModalRoot = null;
let ctvPickerListCache = null;
let ctvPickerLoadPromise = null;

function ctvPickerNormalizeText(s) {
    try {
        return (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    } catch (_) {
        return (s || '').toString().toLowerCase();
    }
}

function ctvPickerDigits(s) {
    return (s || '').toString().replace(/\D/g, '');
}

function ctvPickerMatchesSearch(ctv, query) {
    const q = (query || '').trim();
    if (!q) return true;
    const n = ctvPickerNormalizeText(q);
    const qDigits = ctvPickerDigits(q);
    const name = ctvPickerNormalizeText(ctv.fullName || '');
    const code = ctvPickerNormalizeText(ctv.referralCode || '');
    const phone = ctvPickerDigits(ctv.phone || '');
    if (name.includes(n) || code.includes(n)) return true;
    if (qDigits.length >= 2 && phone.includes(qDigits)) return true;
    return false;
}

function ctvPickerStatusRank(st) {
    if (st === 'Đang hoạt động') return 0;
    if (st === 'Mới') return 1;
    return 2;
}

function ensureCTVPickerModal() {
    if (ctvPickerModalRoot) return;

    const root = document.createElement('div');
    root.id = 'ctvPickerModal';
    root.className = 'fixed inset-0 z-[70] hidden flex items-center justify-center p-4 bg-black/50';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden border border-gray-200">
            <div class="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600">
                <h3 class="text-base font-bold text-white">Chọn cộng tác viên</h3>
                <button type="button" class="ctv-picker-close w-9 h-9 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center" aria-label="Đóng">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>
            <div class="p-3 border-b border-gray-100">
                <div class="relative">
                    <svg class="w-4 h-4 text-gray-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    <input type="text" id="ctvPickerSearch" autocomplete="off" placeholder="Tìm theo tên, SĐT hoặc mã CTV…" class="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
            </div>
            <div id="ctvPickerList" class="flex-1 overflow-y-auto min-h-[200px] p-2"></div>
        </div>
    `;

    root.addEventListener('click', (e) => {
        if (e.target === root) closeCTVPickerModal();
    });
    root.querySelector('.ctv-picker-close').addEventListener('click', closeCTVPickerModal);

    const searchEl = root.querySelector('#ctvPickerSearch');
    let raf = 0;
    searchEl.addEventListener('input', () => {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => renderCTVPickerList(searchEl.value));
    });

    document.body.appendChild(root);
    ctvPickerModalRoot = root;
}

function renderCTVPickerList(query) {
    const container = document.getElementById('ctvPickerList');
    if (!container || !ctvPickerListCache) return;

    const filtered = ctvPickerListCache.filter(c => ctvPickerMatchesSearch(c, query));
    filtered.sort((a, b) => {
        const dr = ctvPickerStatusRank(a.status) - ctvPickerStatusRank(b.status);
        if (dr !== 0) return dr;
        return (a.fullName || '').localeCompare(b.fullName || '', 'vi');
    });

    if (filtered.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-500 text-center py-8">Không có CTV khớp tìm kiếm</p>';
        return;
    }

    container.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (const ctv of filtered) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'w-full text-left px-3 py-2.5 rounded-lg border border-transparent hover:border-blue-200 hover:bg-blue-50/80 transition-colors mb-1';
        const okOrder = ctv.status === 'Mới' || ctv.status === 'Đang hoạt động';
        btn.innerHTML = `
            <div class="flex items-start justify-between gap-2">
                <div class="min-w-0 flex-1">
                    <div class="font-semibold text-gray-900 text-sm truncate">${escapeHtml(ctv.fullName || '—')}</div>
                    <div class="text-xs text-gray-600 mt-0.5"><span class="font-mono text-blue-700">${escapeHtml(ctv.referralCode || '')}</span> · ${escapeHtml(ctv.phone || '')}</div>
                </div>
                <span class="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${okOrder ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}">${escapeHtml(ctv.status || '')}</span>
            </div>
        `;
        btn.addEventListener('click', () => selectCTVFromPicker(ctv.referralCode));
        frag.appendChild(btn);
    }
    container.appendChild(frag);
}

async function loadCTVPickerData() {
    if (ctvPickerListCache) return;
    if (!ctvPickerLoadPromise) {
        ctvPickerLoadPromise = fetch(`${CONFIG.API_URL}?action=getAllCTV&timestamp=${Date.now()}`)
            .then(r => r.json())
            .then(data => {
                if (!data.success || !Array.isArray(data.ctvList)) {
                    throw new Error(data.error || 'Không tải được danh sách CTV');
                }
                ctvPickerListCache = data.ctvList;
            })
            .finally(() => {
                ctvPickerLoadPromise = null;
            });
    }
    await ctvPickerLoadPromise;
}

function openCTVPickerModal() {
    if (!document.getElementById('newOrderReferralCode')) {
        showToast?.('Mở form đơn hàng trước khi chọn CTV', 'warning');
        return;
    }

    ensureCTVPickerModal();
    const root = ctvPickerModalRoot;
    const listEl = root.querySelector('#ctvPickerList');
    const searchEl = root.querySelector('#ctvPickerSearch');

    root.classList.remove('hidden');
    searchEl.value = '';
    listEl.innerHTML = '<div class="flex flex-col items-center justify-center py-12 gap-2 text-gray-500 text-sm"><div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>Đang tải danh sách…</div>';

    loadCTVPickerData()
        .then(() => {
            renderCTVPickerList('');
            searchEl.focus();
        })
        .catch(err => {
            listEl.innerHTML = `<p class="text-sm text-red-600 text-center py-8 px-4">${escapeHtml(err.message || 'Lỗi tải')}</p>`;
        });
}

function closeCTVPickerModal() {
    if (ctvPickerModalRoot) {
        ctvPickerModalRoot.classList.add('hidden');
    }
}

function selectCTVFromPicker(referralCode) {
    const input = document.getElementById('newOrderReferralCode');
    if (!input || !referralCode) {
        closeCTVPickerModal();
        return;
    }
    input.value = String(referralCode).trim();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    closeCTVPickerModal();
    input.focus();
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ctvPickerModalRoot && !ctvPickerModalRoot.classList.contains('hidden')) {
        closeCTVPickerModal();
    }
});

// Nguồn khách — modal thêm/sửa đơn desktop (Zalo / Facebook / TikTok)

const CUSTOMER_SOURCE_OPTIONS = [
    { slug: 'zalo', label: 'Zalo', chipClass: 'customer-source-chip--zalo' },
    { slug: 'facebook', label: 'Facebook', chipClass: 'customer-source-chip--facebook' },
    { slug: 'tiktok', label: 'TikTok', chipClass: 'customer-source-chip--tiktok' }
];

function normalizeCustomerSourceClient(raw) {
    if (raw == null || raw === '') return '';
    const s = String(raw).toLowerCase().trim();
    return CUSTOMER_SOURCE_OPTIONS.some((o) => o.slug === s) ? s : '';
}

function getCustomerSourceSelection() {
    const v = document.getElementById('newOrderCustomerSource')?.value || '';
    return normalizeCustomerSourceClient(v) || null;
}

function _syncCustomerSourceChipUI() {
    const hidden = document.getElementById('newOrderCustomerSource');
    const current = normalizeCustomerSourceClient(hidden?.value || '');
    document.querySelectorAll('.customer-source-chip').forEach((btn) => {
        const slug = btn.getAttribute('data-source') || '';
        btn.classList.toggle('active', slug === current && current !== '');
        btn.setAttribute('aria-pressed', slug === current && current !== '' ? 'true' : 'false');
    });
}

function setCustomerSourceSelection(slug) {
    const hidden = document.getElementById('newOrderCustomerSource');
    if (!hidden) return;
    hidden.value = normalizeCustomerSourceClient(slug);
    _syncCustomerSourceChipUI();
    if (hidden.value) clearCustomerSourceRequiredHint();
}

function selectCustomerSource(slug) {
    const normalized = normalizeCustomerSourceClient(slug);
    if (!normalized) return;
    const hidden = document.getElementById('newOrderCustomerSource');
    if (!hidden) return;
    const current = normalizeCustomerSourceClient(hidden.value);
    const next = current === normalized ? '' : normalized;
    hidden.value = next;
    _syncCustomerSourceChipUI();
    if (next) clearCustomerSourceRequiredHint();
}

/** Toast + viền đỏ — dùng chung một toast validate form. */
function warnCustomerSourceRequired() {
    if (typeof showOrderFormValidationWarning === 'function') {
        showOrderFormValidationWarning('Vui lòng chọn nguồn khách');
    } else {
        showToast('Vui lòng chọn nguồn khách', 'warning', 4000, 'order-form-validation');
    }
    const block = document.querySelector('.customer-source-block');
    if (!block) return;
    const firstWarn = !block.classList.contains('customer-source-block--error');
    block.classList.add('customer-source-block--error');
    block.classList.remove('customer-source-block--shake');
    void block.offsetWidth;
    block.classList.add('customer-source-block--shake');
    if (firstWarn) block.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clearCustomerSourceRequiredHint() {
    document.querySelector('.customer-source-block')?.classList.remove(
        'customer-source-block--error',
        'customer-source-block--shake'
    );
}

/**
 * @param {string} [seedSource] — từ đơn sửa
 * @param {{ isEdit?: boolean }} [opts]
 */
function initCustomerSourcePicker(seedSource, opts = {}) {
    const seed = normalizeCustomerSourceClient(seedSource);
    setCustomerSourceSelection((opts.isEdit || seed) ? seed : '');
}

const _CUSTOMER_SOURCE_BADGE_CLS = {
    zalo: 'bg-green-100 text-green-700 border-green-200/80',
    facebook: 'bg-blue-100 text-blue-700 border-blue-200/80',
    tiktok: 'bg-slate-100 text-slate-800 border-slate-200/80'
};

/** Badge HTML nguồn khách — dùng cột Khách hàng bảng đơn. */
function renderCustomerSourceBadgeHtml(raw) {
    const slug = normalizeCustomerSourceClient(raw);
    if (!slug) return '';
    const opt = CUSTOMER_SOURCE_OPTIONS.find((o) => o.slug === slug);
    if (!opt) return '';
    const cls = _CUSTOMER_SOURCE_BADGE_CLS[slug] || 'bg-gray-100 text-gray-700 border-gray-200';
    return `<span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold leading-none border ${cls}">${escapeHtml(opt.label)}</span>`;
}


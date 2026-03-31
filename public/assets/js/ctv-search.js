// CTV Search — không phụ thuộc Tailwind; tab chỉ đổi class .tab--active
(function () {
    const STORAGE_KEY = 'ctv_saved_code';

    document.addEventListener('DOMContentLoaded', function () {
        try {
            sessionStorage.removeItem('ctv_search_mode');
        } catch (e) { /* ignore */ }

        const searchForm = document.getElementById('searchForm');
        const codeInput = document.getElementById('referralCode');
        const searchButton = document.getElementById('searchButton');
        const searchIcon = document.getElementById('searchIcon');
        const loadingSpinner = document.getElementById('loadingSpinner');
        const searchButtonText = document.getElementById('searchButtonText');
        const clearInputBtn = document.getElementById('clearInputBtn');
        const savedCodeHint = document.getElementById('savedCodeHint');
        const savedCodeText = document.getElementById('savedCodeText');
        const forgetCodeBtn = document.getElementById('forgetCodeBtn');
        const modeCtvBtn = document.getElementById('modeCtvBtn');
        const modeOrderBtn = document.getElementById('modeOrderBtn');
        const searchFieldLabel = document.getElementById('searchFieldLabel');
        const pageSubtitle = document.getElementById('pageSubtitle');
        const inputWrap = document.getElementById('inputWrap');

        /** @type {'ctv'|'order'} */
        let mode = 'ctv';

        function setMode(next) {
            mode = next;
            const isCtv = mode === 'ctv';

            modeCtvBtn.setAttribute('aria-selected', isCtv ? 'true' : 'false');
            modeOrderBtn.setAttribute('aria-selected', !isCtv ? 'true' : 'false');
            modeCtvBtn.classList.toggle('tab--active', isCtv);
            modeOrderBtn.classList.toggle('tab--active', !isCtv);

            if (searchFieldLabel) {
                searchFieldLabel.textContent = isCtv ? 'Mã CTV hoặc Số Điện Thoại' : 'Mã đơn hàng';
            }
            if (pageSubtitle) {
                pageSubtitle.textContent = isCtv
                    ? 'Nhập mã CTV hoặc số điện thoại để xem toàn bộ đơn'
                    : 'Nhập mã đơn (từ khách hoặc admin) để xem nhanh một đơn cụ thể';
            }

            codeInput.placeholder = isCtv
                ? 'VD: CTV123456 hoặc 0386190596'
                : 'VD: mã đơn trên hệ thống hoặc số ID';

            if (savedCodeHint) {
                if (isCtv) {
                    const saved = localStorage.getItem(STORAGE_KEY);
                    if (saved) {
                        if (!codeInput.value.trim()) codeInput.value = saved;
                        savedCodeText.textContent = saved;
                        savedCodeHint.classList.remove('saved-hint--empty');
                        savedCodeHint.classList.add('saved-hint--has');
                    } else {
                        savedCodeHint.classList.add('saved-hint--empty');
                        savedCodeHint.classList.remove('saved-hint--has');
                    }
                } else {
                    savedCodeHint.classList.add('saved-hint--empty');
                    savedCodeHint.classList.remove('saved-hint--has');
                }
            }

            syncClearState();
        }

        function syncClearState() {
            const has = !!codeInput.value.trim();
            if (inputWrap) inputWrap.classList.toggle('has-value', has);
        }

        modeCtvBtn.addEventListener('click', function () {
            if (mode !== 'ctv') setMode('ctv');
        });
        modeOrderBtn.addEventListener('click', function () {
            if (mode !== 'order') setMode('order');
        });

        // Đồng bộ nút xóa nếu inline script đã điền mã
        syncClearState();

        codeInput.addEventListener('input', syncClearState);

        clearInputBtn.addEventListener('click', function () {
            codeInput.value = '';
            codeInput.focus();
            syncClearState();
        });

        forgetCodeBtn.addEventListener('click', function () {
            localStorage.removeItem(STORAGE_KEY);
            if (savedCodeHint) {
                savedCodeHint.classList.add('saved-hint--empty');
                savedCodeHint.classList.remove('saved-hint--has');
            }
            codeInput.value = '';
            codeInput.focus();
            syncClearState();
        });

        searchForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const input = codeInput.value.trim();

            if (!input) {
                codeInput.focus();
                return;
            }

            setButtonLoading(true);

            if (mode === 'order') {
                const orderId = normalizeOrderId(input);
                if (!orderId) {
                    setButtonLoading(false);
                    codeInput.focus();
                    return;
                }
                window.location.replace('results.html?orderId=' + encodeURIComponent(orderId));
                return;
            }

            const isPhone = /^0?\d{9,10}$/.test(input);
            const code = isPhone ? input : input.toUpperCase();

            localStorage.setItem(STORAGE_KEY, code);

            window.location.replace('results.html?code=' + encodeURIComponent(code));
        });

        function normalizeOrderId(raw) {
            return String(raw).trim().replace(/^#+/, '');
        }

        function setButtonLoading(isLoading) {
            searchIcon.classList.toggle('hidden', isLoading);
            loadingSpinner.classList.toggle('hidden', !isLoading);
            searchButtonText.textContent = isLoading ? 'Đang kiểm tra...' : 'Tra cứu ngay';
            searchButton.disabled = isLoading;
        }
    });
})();

/**
 * UI trang chuyển địa chỉ 3 cấp → 2 cấp
 */
(function () {
    'use strict';

    const HISTORY_KEY = 'addr_convert_history_v1';
    const HISTORY_MAX = 12;

    const $ = (id) => document.getElementById(id);

    let _lastResult = null;
    let _lastInput = '';

    function toast(msg, type) {
        if (typeof showToast === 'function') {
            showToast(msg, type || 'info', 2500);
        }
    }

    async function copyText(text) {
        const s = String(text || '').trim();
        if (!s) return false;
        try {
            await navigator.clipboard.writeText(s);
            return true;
        } catch {
            const ta = document.createElement('textarea');
            ta.value = s;
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand('copy');
            ta.remove();
            return ok;
        }
    }

    function loadHistory() {
        try {
            return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        } catch {
            return [];
        }
    }

    function saveHistory(input, result) {
        if (!result || result.status === 'error' || !result.fullNew) return;
        const item = {
            input,
            fullNew: result.fullNew,
            adminNew: result.adminNew,
            ts: Date.now(),
        };
        const list = loadHistory().filter((x) => x.input !== input);
        list.unshift(item);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_MAX)));
        renderHistory();
    }

    function renderHistory() {
        const wrap = $('historyPanel');
        const listEl = $('historyList');
        if (!wrap || !listEl) return;
        const list = loadHistory();
        if (!list.length) {
            wrap.classList.add('hidden');
            return;
        }
        wrap.classList.remove('hidden');
        listEl.innerHTML = list.map((item, i) => `
            <button type="button" class="history-item w-full text-left px-3 py-2 rounded-lg border border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50 transition text-sm" data-idx="${i}">
                <span class="block text-slate-500 text-xs truncate">${escapeHtml(item.input)}</span>
                <span class="block text-green-700 font-medium truncate mt-0.5">${escapeHtml(item.fullNew)}</span>
            </button>
        `).join('');
        listEl.querySelectorAll('.history-item').forEach((btn) => {
            btn.addEventListener('click', () => {
                const idx = Number(btn.dataset.idx);
                const item = loadHistory()[idx];
                if (!item) return;
                $('inputAddress').value = item.input;
                runConvert();
            });
        });
    }

    function escapeHtml(s) {
        return String(s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function setLoading(on) {
        $('btnConvert')?.toggleAttribute('disabled', on);
        $('btnConvert')?.classList.toggle('opacity-60', on);
        $('loadingHint')?.classList.toggle('hidden', !on);
    }

    function hidePanels() {
        ['parsedPanel', 'resultPanel', 'suggestPanel', 'failPanel'].forEach((id) => {
            $(id)?.classList.add('hidden');
        });
    }

    function showParsed(result) {
        const panel = $('parsedPanel');
        if (!panel) return;
        const o = result.oldAdmin || {};
        const parts = [o.ward, o.district, o.province].filter(Boolean);
        if (!parts.length && result.status === 'fail') {
            panel.classList.add('hidden');
            return;
        }
        $('parsedStreet').textContent = result.street || '(không có số nhà/thôn)';
        $('parsedAdmin').textContent = parts.join(' · ') || '—';
        panel.classList.remove('hidden');
    }

    function showResult(result) {
        const panel = $('resultPanel');
        if (!panel) return;
        $('resultFull').textContent = result.fullNew || '';
        $('resultAdmin').textContent = result.adminNew || '';
        panel.classList.remove('hidden');
        _lastResult = result;
    }

    function showSuggestions(result) {
        const panel = $('suggestPanel');
        const list = $('suggestList');
        if (!panel || !list) return;
        list.innerHTML = (result.suggestions || []).map((s, i) => `
            <button type="button" class="suggest-item w-full text-left p-3 rounded-xl border-2 border-amber-200 bg-amber-50/80 hover:border-amber-400 hover:bg-amber-50 transition" data-idx="${i}">
                <p class="text-xs text-amber-800 font-semibold mb-1">Gợi ý ${i + 1}</p>
                <p class="text-sm text-slate-800">${escapeHtml(s.label)}</p>
                <p class="text-sm text-green-700 font-medium mt-1">${escapeHtml(s.fullNew)}</p>
            </button>
        `).join('');
        panel.classList.remove('hidden');
        list.querySelectorAll('.suggest-item').forEach((btn) => {
            btn.addEventListener('click', () => {
                const idx = Number(btn.dataset.idx);
                const s = result.suggestions[idx];
                if (!s) return;
                const picked = AddressConvertCore.applySuggestion(result.street, s);
                picked.oldAdmin = result.oldAdmin;
                hidePanels();
                showParsed(picked);
                showResult(picked);
                saveHistory(_lastInput, picked);
            });
        });
    }

    function showFail(result) {
        const panel = $('failPanel');
        if (!panel) return;
        $('failMessage').textContent = result.message || 'Không tra được địa chỉ.';
        panel.classList.remove('hidden');
    }

    async function runConvert() {
        const input = $('inputAddress')?.value.trim();
        _lastInput = input;
        hidePanels();
        if (!input) {
            toast('Dán địa chỉ cần chuyển đổi', 'warning');
            $('inputAddress')?.focus();
            return;
        }

        setLoading(true);
        try {
            await AddressConvertCore.loadMapping();
            const result = AddressConvertCore.convertAddress(input);
            showParsed(result);

            if (result.status === 'exact') {
                showResult(result);
                saveHistory(input, result);
            } else if (result.status === 'suggest') {
                showSuggestions(result);
            } else if (result.status === 'fail') {
                showFail(result);
            } else {
                toast(result.message || 'Lỗi', 'error');
            }
        } catch (e) {
            toast(e.message || 'Lỗi tra cứu', 'error');
        } finally {
            setLoading(false);
        }
    }

    function bindEvents() {
        $('btnConvert')?.addEventListener('click', runConvert);
        $('btnClear')?.addEventListener('click', () => {
            $('inputAddress').value = '';
            hidePanels();
            $('inputAddress')?.focus();
        });
        $('inputAddress')?.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                runConvert();
            }
        });
        $('btnCopyFull')?.addEventListener('click', async () => {
            if (await copyText(_lastResult?.fullNew)) toast('Đã copy địa chỉ đầy đủ', 'success');
        });
        $('btnCopyAdmin')?.addEventListener('click', async () => {
            if (await copyText(_lastResult?.adminNew)) toast('Đã copy phần hành chính', 'success');
        });
    }

    async function init() {
        bindEvents();
        renderHistory();
        $('inputAddress')?.focus();
        AddressConvertCore.loadMapping().catch(() => {
            toast('Không tải được dữ liệu mapping', 'error');
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

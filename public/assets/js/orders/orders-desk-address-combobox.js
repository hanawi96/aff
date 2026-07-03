/**
 * Desktop order form — badge-triggered address picker (2 cấp: Tỉnh/TP → Phường/Xã).
 * Bấm badge → mở danh sách; tìm kiếm nằm trong panel dropdown (không chiếm chỗ form).
 */
(function () {
    'use strict';

    const MAX_RESULTS = 40;
    const DEBOUNCE_MS = 120;

    function normText(t) {
        return String(t || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'd');
    }

    function matchText(text, query) {
        if (!query) return true;
        if (query.length === 1) return text.includes(query);
        if (query.length === 2) {
            const words = text.split(' ');
            for (const word of words) {
                if (word.startsWith(query)) return true;
            }
            return text.includes(query);
        }
        const words = text.split(' ');
        for (const word of words) {
            if (word === query) return true;
            if (word.startsWith(query)) {
                const remaining = word.substring(query.length);
                if (remaining === '') return true;
                const vowels = ['a', 'e', 'i', 'o', 'u', 'y'];
                if (vowels.includes(remaining[0])) continue;
                return true;
            }
        }
        return text.includes(query);
    }

    function calcScore(text, query) {
        const words = text.split(' ');
        if (text === query) return 1000;
        if (words[0] === query) return 500;
        if (text.startsWith(query)) return 100 + (100 / text.length);
        for (let i = 0; i < words.length; i++) {
            if (words[i].startsWith(query)) return 70 - (i * 5);
        }
        if (text.includes(query)) {
            const position = text.indexOf(query);
            return 50 - (position / text.length * 20);
        }
        return 10;
    }

    function shortPlaceName(name, level) {
        if (!name) return '';
        let s = name;
        if (level === 'province') {
            s = s.replace(/^Tỉnh\s+/i, '').replace(/^Thành phố\s+/i, 'TP ');
        } else {
            s = s.replace(/^Phường\s+/i, 'P. ')
                .replace(/^Xã\s+/i, 'X. ')
                .replace(/^Thị trấn\s+/i, 'TT ');
        }
        return s;
    }

    class DeskAddressCombobox {
        constructor(options) {
            this.container = options.container;
            this.onChange = options.onChange || (() => {});
            this.debounceTimer = null;
            this.isOpen = false;
            this.listMode = 'province';
            this.selectedProvinceId = '';
            this.selectedWardId = '';
            this.focusIdx = -1;
            this.resultItems = [];
            this._docClick = null;
            this._repositionBound = null;
            this._suppressDocCloseUntil = 0;
        }

        async ensureData() {
            if (!window.addressSelector?.loaded) {
                await window.addressSelector.init();
            }
            this.provinces = window.addressSelector.data || [];
        }

        async mount() {
            await this.ensureData();

            const provinceSelect = document.getElementById('newOrderProvince');
            if (provinceSelect) {
                window.addressSelector.renderProvinces(provinceSelect);
            }

            this._repositionBound = () => {
                if (this.isOpen) this._positionDropdown();
            };

            this.container.innerHTML =
                '<div class="desk-addr-combo">' +
                '<div class="relative">' +
                '<div class="desk-addr-chips flex flex-wrap items-center gap-1.5 min-h-[2rem]" id="deskAddrChips"></div>' +
                '<div id="deskAddrDropdown" class="desk-addr-dropdown hidden absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg" role="listbox">' +
                '<div class="desk-addr-dropdown-search border-b border-gray-100 p-2 bg-gray-50/90">' +
                '<input type="text" id="deskAddrPanelSearch" autocomplete="off" ' +
                'class="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent" ' +
                'placeholder="Tìm kiếm…" aria-autocomplete="list">' +
                '</div>' +
                '<div id="deskAddrResults" class="desk-addr-results"></div>' +
                '</div>' +
                '</div>' +
                '</div>';

            this.el = {
                panelSearch: document.getElementById('deskAddrPanelSearch'),
                dropdown: document.getElementById('deskAddrDropdown'),
                chips: document.getElementById('deskAddrChips'),
                results: document.getElementById('deskAddrResults')
            };

            this._bindEvents();
            this._renderChips();
        }

        _bindEvents() {
            const { panelSearch, results } = this.el;

            panelSearch.addEventListener('input', () => {
                clearTimeout(this.debounceTimer);
                this.debounceTimer = setTimeout(() => this._runSearch(panelSearch.value), DEBOUNCE_MS);
            });

            panelSearch.addEventListener('keydown', (e) => this._onKeydown(e));

            results.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
            results.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true });

            results.addEventListener('click', (e) => {
                const row = e.target.closest('[data-desk-addr-pick]');
                if (!row) return;
                e.preventDefault();
                e.stopPropagation();
                const type = row.dataset.deskAddrPick;
                const pid = row.dataset.provinceId;
                const wid = row.dataset.wardId || '';
                if (type === 'province') {
                    this.applySelection(pid, '', { fromProvincePick: true });
                } else if (type === 'ward') {
                    this.applySelection(pid, wid);
                }
            });

            this.el.chips.addEventListener('click', (e) => {
                const clearBtn = e.target.closest('[data-desk-clear]');
                if (clearBtn) {
                    e.stopPropagation();
                    const level = clearBtn.dataset.deskClear;
                    if (level === 'province') {
                        this.applySelection('', '');
                    } else if (level === 'ward') {
                        this.applySelection(this.selectedProvinceId, '');
                    }
                    return;
                }
                const openBtn = e.target.closest('[data-desk-open]');
                if (openBtn) {
                    e.stopPropagation();
                    this._openPicker(openBtn.dataset.deskOpen);
                }
            });

            this._docClick = (e) => {
                if (Date.now() < this._suppressDocCloseUntil) return;
                if (!this.container.contains(e.target)) this._closeDropdown();
            };
            document.addEventListener('click', this._docClick, true);
            window.addEventListener('resize', this._repositionBound);
            window.addEventListener('scroll', this._repositionBound, true);
            this._mobileScrollEl = this.container.closest('#createScrollArea');
            if (this._mobileScrollEl) {
                this._mobileScrollEl.addEventListener('scroll', this._repositionBound, { passive: true });
            }
        }

        _scrollMobileAddressIntoView() {
            const scrollEl = document.getElementById('createScrollArea');
            const block = document.getElementById('mAddressFormBlock');
            if (!scrollEl || !block || scrollEl.clientHeight <= 0) return;
            const gap = 8;
            const pr = scrollEl.getBoundingClientRect();
            const ar = block.getBoundingClientRect();
            let nextTop = scrollEl.scrollTop + (ar.top - pr.top) - gap;
            const maxScroll = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight);
            nextTop = Math.max(0, Math.min(nextTop, maxScroll));
            if (Math.abs(nextTop - scrollEl.scrollTop) < 2) return;
            scrollEl.scrollTo({ top: nextTop, behavior: 'auto' });
        }

        _positionDropdownMobile(anchor, dd, gap) {
            const panel = document.getElementById('createPanel');
            const footer = panel?.querySelector(':scope > .shrink-0');
            const footerRect = footer?.getBoundingClientRect();
            const footerTop = footerRect?.top ?? window.innerHeight;
            const footerH = footerRect?.height ?? 56;
            const pad = 8;
            const rect = anchor.getBoundingClientRect();

            const minPanelH = 260;
            const maxCap = Math.floor(window.innerHeight * 0.62);
            const spaceBelow = footerTop - rect.bottom - pad;
            const useSheet = spaceBelow < minPanelH;

            dd.classList.add('is-fixed');
            dd.classList.toggle('is-mobile-sheet', useSheet);

            if (useSheet) {
                const topMargin = Math.floor(window.innerHeight * 0.1);
                const sheetH = Math.max(
                    minPanelH,
                    Math.min(maxCap, footerTop - pad - topMargin)
                );
                dd.style.left = '10px';
                dd.style.right = '10px';
                dd.style.width = 'auto';
                dd.style.top = 'auto';
                dd.style.bottom = `${Math.ceil(footerH + pad)}px`;
                dd.style.maxHeight = `${sheetH}px`;
                return;
            }

            const maxH = Math.max(minPanelH, Math.min(maxCap, spaceBelow));
            dd.style.left = `${Math.max(8, rect.left)}px`;
            dd.style.top = `${rect.bottom + gap}px`;
            dd.style.width = `${Math.max(200, rect.width)}px`;
            dd.style.bottom = '';
            dd.style.right = '';
            dd.style.maxHeight = `${maxH}px`;
        }

        _positionDropdown() {
            const dd = this.el.dropdown;
            const anchor = this.container.querySelector('.relative');
            if (!dd || !anchor) return;

            const inModal = !!this.container.closest('#addOrderModal');
            const inMobilePanel = !!this.container.closest('#createPanel');
            if (inMobilePanel) {
                this._positionDropdownMobile(anchor, dd, 4);
                return;
            }
            if (!inModal) {
                dd.classList.remove('is-fixed', 'is-mobile-sheet');
                dd.style.left = '';
                dd.style.top = '';
                dd.style.width = '';
                dd.style.maxHeight = '';
                dd.style.bottom = '';
                dd.style.right = '';
                return;
            }

            const rect = anchor.getBoundingClientRect();
            const gap = 4;
            const spaceBelow = window.innerHeight - rect.bottom - gap - 12;
            const maxH = Math.max(140, Math.min(320, spaceBelow));

            dd.classList.add('is-fixed');
            dd.classList.remove('is-mobile-sheet');
            dd.style.left = `${Math.max(8, rect.left)}px`;
            dd.style.top = `${rect.bottom + gap}px`;
            dd.style.width = `${Math.max(200, rect.width)}px`;
            dd.style.bottom = '';
            dd.style.right = '';
            dd.style.maxHeight = `${maxH}px`;
        }

        _resetDropdownPosition() {
            const dd = this.el.dropdown;
            if (!dd) return;
            dd.classList.remove('is-fixed', 'is-mobile-sheet');
            dd.style.left = '';
            dd.style.top = '';
            dd.style.width = '';
            dd.style.maxHeight = '';
            dd.style.bottom = '';
            dd.style.right = '';
        }

        _showWardList() {
            this.listMode = 'ward';
            this._openDropdown();
            if (this.el.panelSearch) {
                this.el.panelSearch.value = '';
                this.el.panelSearch.placeholder = 'Tìm phường/xã…';
            }
            this._runSearch('');
            if (this.el.results) this.el.results.scrollTop = 0;
            requestAnimationFrame(() => this.el.panelSearch?.focus());
        }

        _focusStreetInput() {
            if (typeof syncDeskOrderStreetInputVisibility === 'function') {
                syncDeskOrderStreetInputVisibility();
            }
            requestAnimationFrame(() => {
                const el = document.getElementById('newOrderStreetAddress');
                if (!el) return;
                el.focus({ preventScroll: false });
                const len = el.value.length;
                try {
                    el.setSelectionRange(len, len);
                } catch (_) { /* input types without selection */ }
            });
        }

        _openPicker(level) {
            if (level === 'ward' && !this.selectedProvinceId) {
                level = 'province';
            }
            this.listMode = level;
            this._openDropdown();
            if (this.el.panelSearch) {
                this.el.panelSearch.value = '';
                this.el.panelSearch.placeholder = level === 'ward'
                    ? 'Tìm phường/xã…'
                    : 'Tìm tỉnh/thành phố…';
            }
            this._runSearch('');
            setTimeout(() => this.el.panelSearch?.focus(), 40);
        }

        _onKeydown(e) {
            const items = this.resultItems;
            if (!items.length) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    this._closeDropdown();
                }
                return;
            }

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.focusIdx = Math.min(this.focusIdx + 1, items.length - 1);
                this._updateFocus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.focusIdx = Math.max(this.focusIdx - 1, 0);
                this._updateFocus();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (this.focusIdx >= 0 && items[this.focusIdx]) {
                    items[this.focusIdx].click();
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this._closeDropdown();
            }
        }

        _updateFocus() {
            this.resultItems.forEach((el, i) => {
                el.classList.toggle('bg-indigo-50', i === this.focusIdx);
            });
            const cur = this.resultItems[this.focusIdx];
            if (cur) cur.scrollIntoView({ block: 'nearest' });
        }

        _openDropdown() {
            this.el.dropdown.classList.remove('hidden');
            this.isOpen = true;
            const inMobile = !!this.container.closest('#createPanel');
            if (inMobile) {
                this._scrollMobileAddressIntoView();
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => this._positionDropdown());
                });
            } else {
                this._positionDropdown();
            }
        }

        _closeDropdown() {
            this.el.dropdown.classList.add('hidden');
            this.isOpen = false;
            this.focusIdx = -1;
            this._resetDropdownPosition();
        }

        _search(query) {
            const q = normText(String(query || '').trim());

            if (this.listMode === 'ward') {
                const p = this.provinces.find((x) => x.Id === this.selectedProvinceId);
                if (!p) return [];
                const wards = p.Wards || [];
                if (!q) {
                    return wards.map((w, i) => ({
                        type: 'ward',
                        province: p,
                        ward: w,
                        score: 100 - i * 0.01
                    }));
                }
                return wards
                    .map((w) => ({
                        type: 'ward',
                        province: p,
                        ward: w,
                        score: calcScore(normText(w.Name), q)
                    }))
                    .filter((r) => r.score > 10)
                    .sort((a, b) => b.score - a.score)
                    .slice(0, MAX_RESULTS);
            }

            let list = this.provinces.map((p, i) => ({
                type: 'province',
                province: p,
                ward: null,
                score: (p.Id === '79' ? 200 : p.Id === '01' ? 190 : 0) - i * 0.01
            }));

            if (q) {
                list = this.provinces
                    .map((p) => ({
                        type: 'province',
                        province: p,
                        ward: null,
                        score: calcScore(normText(p.Name), q)
                    }))
                    .filter((r) => matchText(normText(r.province.Name), q))
                    .sort((a, b) => b.score - a.score);
            }

            return list.slice(0, MAX_RESULTS);
        }

        _runSearch(query) {
            const list = this._search(query);
            this.focusIdx = -1;

            if (!list.length) {
                this.el.results.innerHTML =
                    '<p class="px-3 py-4 text-sm text-gray-400 text-center">Không tìm thấy</p>';
                this.resultItems = [];
                return;
            }

            const hint = this.listMode === 'ward' ? 'Chọn phường/xã' : 'Chọn tỉnh/thành phố';

            let html = '<p class="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">' +
                hint + '</p>';

            html += list.map((r) => {
                const pid = r.province.Id;
                const wid = r.ward ? r.ward.Id : '';
                const type = r.type;
                const main = type === 'ward' ? r.ward.Name : r.province.Name;
                const sub = type === 'ward' ? shortPlaceName(r.province.Name, 'province') : 'Tỉnh / Thành phố';
                return '<button type="button" role="option" tabindex="-1" data-desk-addr-pick="' + type + '" ' +
                    'data-province-id="' + pid + '" data-ward-id="' + wid + '" ' +
                    'class="desk-addr-row w-full text-left px-3 py-2.5 hover:bg-indigo-50 active:bg-indigo-100 transition-colors border-b border-gray-50 last:border-0">' +
                    '<span class="block text-sm font-medium text-gray-900 leading-snug">' + escapeHtml(main) + '</span>' +
                    (type === 'ward'
                        ? '<span class="block text-xs text-gray-500 mt-0.5">' + escapeHtml(sub) + '</span>'
                        : '') +
                    '</button>';
            }).join('');

            this.el.results.innerHTML = html;
            this.resultItems = Array.from(this.el.results.querySelectorAll('[data-desk-addr-pick]'));
        }

        applySelection(provinceId, wardId, opts) {
            opts = opts || {};
            this.selectedProvinceId = provinceId ? String(provinceId) : '';
            this.selectedWardId = wardId ? String(wardId) : '';

            const provinceSelect = document.getElementById('newOrderProvince');
            const wardSelect = document.getElementById('newOrderWard');

            if (provinceSelect) {
                provinceSelect.value = this.selectedProvinceId;
                if (this.selectedProvinceId && wardSelect) {
                    window.addressSelector.renderWards(wardSelect, this.selectedProvinceId);
                } else if (wardSelect) {
                    wardSelect.innerHTML = '<option value="">-- Chọn Phường/Xã --</option>';
                    wardSelect.disabled = !this.selectedProvinceId;
                }
            }

            if (wardSelect) {
                wardSelect.value = this.selectedWardId;
                wardSelect.disabled = !this.selectedProvinceId;
            }

            this._renderChips();

            if (this.selectedProvinceId && !this.selectedWardId) {
                this._suppressDocCloseUntil = Date.now() + 350;
                this._showWardList();
            } else {
                this._closeDropdown();
                if (this.selectedWardId) {
                    this._focusStreetInput();
                }
            }

            if (typeof syncDeskOrderStreetInputVisibility === 'function') {
                syncDeskOrderStreetInputVisibility();
            }

            this.onChange();
        }

        _chipHtml(label, level, colorCls) {
            return '<button type="button" data-desk-open="' + level + '" ' +
                'class="inline-flex items-center gap-0.5 pl-2.5 pr-1 py-1 rounded-full text-xs font-semibold border cursor-pointer ' +
                'hover:brightness-95 active:scale-[0.98] transition-all ' + colorCls + '">' +
                '<span>' + escapeHtml(label) + '</span>' +
                '<span role="button" tabindex="-1" data-desk-clear="' + level + '" ' +
                'class="p-0.5 rounded-full hover:bg-black/10 opacity-70 hover:opacity-100" aria-label="Xóa">' +
                '<svg class="w-3 h-3 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">' +
                '<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></span></button>';
        }

        _renderChips() {
            const p = this.selectedProvinceId
                ? this.provinces.find((x) => x.Id === this.selectedProvinceId)
                : null;
            const w = p && this.selectedWardId
                ? (p.Wards || []).find((x) => x.Id === this.selectedWardId)
                : null;

            const parts = [];

            if (p) {
                parts.push(this._chipHtml(shortPlaceName(p.Name, 'province'), 'province',
                    'bg-blue-100 text-blue-800 border-blue-200/80'));
            } else {
                parts.push(
                    '<button type="button" data-desk-open="province" ' +
                    'class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-gray-500 ' +
                    'border border-dashed border-gray-300 bg-white hover:border-blue-300 hover:text-blue-600 transition-colors">' +
                    '📍 Chọn tỉnh/thành phố</button>'
                );
            }

            if (p && w) {
                parts.push(this._chipHtml(shortPlaceName(w.Name, 'ward'), 'ward',
                    'bg-indigo-100 text-indigo-800 border-indigo-200/80'));
            } else if (p && !w) {
                parts.push(
                    '<button type="button" data-desk-open="ward" ' +
                    'class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-gray-500 ' +
                    'border border-dashed border-gray-300 bg-white hover:border-indigo-300 hover:text-indigo-600 transition-colors">' +
                    'Chọn phường/xã</button>'
                );
            }

            this.el.chips.innerHTML = parts.join('');
        }

        hydrate({ province_id, ward_id } = {}) {
            const pid = province_id != null && province_id !== '' ? String(province_id) : '';
            const wid = ward_id != null && ward_id !== '' ? String(ward_id) : '';
            if (!pid) {
                this.selectedProvinceId = '';
                this.selectedWardId = '';
                const provinceSelect = document.getElementById('newOrderProvince');
                const wardSelect = document.getElementById('newOrderWard');
                if (provinceSelect) provinceSelect.value = '';
                if (wardSelect) {
                    wardSelect.value = '';
                    wardSelect.disabled = true;
                }
                this._closeDropdown();
                this._renderChips();
                return;
            }

            this.selectedProvinceId = pid;
            this.selectedWardId = wid ? String(wid) : '';

            const provinceSelect = document.getElementById('newOrderProvince');
            const wardSelect = document.getElementById('newOrderWard');
            if (provinceSelect) {
                provinceSelect.value = pid;
                if (wardSelect) {
                    window.addressSelector.renderWards(wardSelect, pid);
                    wardSelect.value = this.selectedWardId;
                    wardSelect.disabled = false;
                }
            }

            this._closeDropdown();
            this._renderChips();
            if (typeof syncDeskOrderStreetInputVisibility === 'function') {
                syncDeskOrderStreetInputVisibility();
            }
            this.onChange();
        }

        syncFromHiddenSelects() {
            const provinceSelect = document.getElementById('newOrderProvince');
            const wardSelect = document.getElementById('newOrderWard');
            this.selectedProvinceId = provinceSelect?.value || '';
            this.selectedWardId = wardSelect?.value || '';
            this._renderChips();
            if (typeof syncDeskOrderStreetInputVisibility === 'function') {
                syncDeskOrderStreetInputVisibility();
            }
        }

        destroy() {
            clearTimeout(this.debounceTimer);
            if (this._docClick) {
                document.removeEventListener('click', this._docClick, true);
                this._docClick = null;
            }
            if (this._repositionBound) {
                window.removeEventListener('resize', this._repositionBound);
                window.removeEventListener('scroll', this._repositionBound, true);
                if (this._mobileScrollEl) {
                    this._mobileScrollEl.removeEventListener('scroll', this._repositionBound);
                    this._mobileScrollEl = null;
                }
                this._repositionBound = null;
            }
            if (this.container) this.container.innerHTML = '';
        }
    }

    function escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    window.DeskAddressCombobox = DeskAddressCombobox;

    window.destroyDeskAddressCombobox = function () {
        if (window._deskAddressCombobox) {
            window._deskAddressCombobox.destroy();
            window._deskAddressCombobox = null;
        }
    };

    window.syncDeskAddressComboboxFromHidden = function () {
        if (window._deskAddressCombobox) {
            window._deskAddressCombobox.syncFromHiddenSelects();
        }
    };
})();

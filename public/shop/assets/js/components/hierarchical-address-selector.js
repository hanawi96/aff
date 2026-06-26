// ============================================
// HIERARCHICAL ADDRESS SELECTOR WITH SEARCH (2 cấp: Tỉnh/TP → Phường/Xã)
// ============================================

import { addressService } from '../shared/services/address.service.js';

/** Static shell markup (admin m.html template #mOrderAddressShellTpl must stay in sync). */
export const HIERARCHICAL_ADDRESS_SHELL_HTML =
    '<div class="hierarchical-address-selector">' +
    '<div class="address-chips-wrapper">' +
    '<div class="address-selector-display" id="addressSelectorDisplay" role="button" tabindex="0" aria-haspopup="listbox" aria-expanded="false">' +
    '<div class="address-chips" id="addressChips">' +
    '<span class="address-placeholder">📍 Chọn địa chỉ giao hàng</span>' +
    '</div>' +
    '<svg class="address-dropdown-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">' +
    '<path fill-rule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clip-rule="evenodd" />' +
    '</svg>' +
    '</div>' +
    '<div class="address-dropdown hidden" id="addressDropdown" role="listbox">' +
    '<div class="address-dropdown-search">' +
    '<svg class="search-icon-inside" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">' +
    '<path fill-rule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" clip-rule="evenodd" />' +
    '</svg>' +
    '<input type="text" class="address-search-input" id="addressSearchInput" placeholder="Tìm nhanh địa chỉ..." autocomplete="off">' +
    '</div>' +
    '<div class="address-dropdown-content" id="addressDropdownContent">' +
    '<!-- Results will be rendered here -->' +
    '</div>' +
    '</div>' +
    '</div>' +
    '<div class="address-street-wrapper hidden" id="addressStreetWrapper">' +
    '<input type="text" class="checkout-form-input" id="streetInput" placeholder="Nhập số nhà, tên đường" aria-label="Số nhà, tên đường">' +
    '</div>' +
    '<div class="address-display hidden" id="addressDisplay" role="status" aria-live="polite">' +
    '<div class="address-display-label">📍 Địa chỉ đầy đủ:</div>' +
    '<div class="address-display-text">Vui lòng chọn địa chỉ</div>' +
    '</div>' +
    '</div>';

export class HierarchicalAddressSelector {
    constructor(containerId) {
        this.containerId = containerId;
        this.provinceCode = '';
        this.wardCode = '';
        this.street = '';

        this.searchQuery = '';
        this.isDropdownOpen = false;
        this.currentLevel = 'province'; // 'province' | 'ward'
        this.selectedProvince = null;
        this.selectedWard = null;

        this.normalizedData = null;
        this.searchDebounceTimer = null;
        this.isInteracting = false;
        this.focusedIndex = -1;
        this.resultItems = [];

        this.boundHandlers = { handleClickOutside: null };

        this.DEBOUNCE_DELAY = 150;
        this.MAX_RESULTS = 30;
        this.SCROLL_OFFSET = 80;
        this.KEYBOARD_DELAY = 300;
        this.FOCUS_DELAY = 50;

        this.LOCATION_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="m11.54 22.351.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clip-rule="evenodd" /></svg>';
        this.CLOSE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" /></svg>';
    }

    async init() {
        try {
            await addressService.loadAddressData();
            if (!addressService.addressData || Object.keys(addressService.addressData).length === 0) {
                throw new Error('Address data is empty');
            }
            this.prepareNormalizedData();
            this.render();
            this.setupEventListeners();
        } catch (error) {
            console.error('❌ Error initializing HierarchicalAddressSelector:', error);
            const container = document.getElementById(this.containerId);
            if (container) {
                container.innerHTML = '<div style="padding: 1rem; color: #f44336; background: #ffebee; border-radius: 8px; text-align: center;">' +
                    '<strong>⚠️ Lỗi tải dữ liệu địa chỉ</strong><br><small>' + error.message + '</small></div>';
            }
            throw error;
        }
    }

    sortByViDisplayName(items) {
        return [...items].sort((a, b) =>
            String(a.name).localeCompare(String(b.name), 'vi', { sensitivity: 'base' })
        );
    }

    compareProvincesDisplayOrder(a, b) {
        const pri = (code) => { const c = String(code); if (c === '79') return 0; if (c === '01') return 1; return 100; };
        const pa = pri(a.code), pb = pri(b.code);
        if (pa !== pb) return pa - pb;
        return String(a.name).localeCompare(String(b.name), 'vi', { sensitivity: 'base' });
    }

    prepareNormalizedData() {
        const provinces = addressService.getProvinces();
        if (!provinces || provinces.length === 0) {
            this.normalizedData = [];
            return;
        }

        this.normalizedData = provinces.map(province => {
            const wards = this.sortByViDisplayName(
                addressService.getWards(province.code).map(ward => ({
                    code: ward.code,
                    name: ward.nameWithType,
                    normalizedName: this.normalizeText(ward.nameWithType),
                    level: 'ward'
                }))
            );

            return {
                code: province.code,
                name: province.nameWithType,
                normalizedName: this.normalizeText(province.nameWithType),
                wards: wards,
                level: 'province'
            };
        });

        this.normalizedData.sort((a, b) => this.compareProvincesDisplayOrder(a, b));
    }

    normalizeText(text) {
        return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd');
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;
        const shell = container.querySelector('.hierarchical-address-selector');
        const display = container.querySelector('#addressSelectorDisplay');
        if (shell && display) return;
        container.innerHTML = HIERARCHICAL_ADDRESS_SHELL_HTML;
    }

    setupEventListeners() {
        const selectorDisplay = document.getElementById('addressSelectorDisplay');
        const searchInput = document.getElementById('addressSearchInput');
        const streetInput = document.getElementById('streetInput');
        const dropdown = document.getElementById('addressDropdown');

        if (selectorDisplay) {
            const openFromDisplay = () => {
                if (this.containerId === 'mOrderAddressSelectorContainer') {
                    this._scrollMOrderAddressBlockToTop();
                    requestAnimationFrame(() => this.performSearch());
                } else {
                    this.scrollInputIntoView();
                    this.performSearch();
                }
            };
            selectorDisplay.addEventListener('click', openFromDisplay);
            selectorDisplay.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFromDisplay(); }
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.handleSearchInput(e.target.value));
            searchInput.addEventListener('focus', () => {
                if (this.containerId === 'mOrderAddressSelectorContainer') this._scrollMOrderAddressBlockToTop();
                this.performSearch();
            });
            searchInput.addEventListener('keydown', (e) => this.handleKeyboardNavigation(e));
        }

        const chipsContainer = document.getElementById('addressChips');
        if (chipsContainer) {
            chipsContainer.addEventListener('click', (e) => {
                const removeBtn = e.target.closest('[data-action="remove-chip"]');
                if (removeBtn) {
                    e.stopPropagation();
                    this.isInteracting = true;
                    this.deleteLevel(removeBtn.dataset.level);
                    setTimeout(() => this.isInteracting = false, 100);
                }
            });
        }

        if (streetInput) {
            streetInput.addEventListener('input', (e) => { this.street = e.target.value.trim(); this.updateFullAddress(); });
        }

        if (dropdown) {
            const dropdownContent = dropdown.querySelector('.address-dropdown-content');
            dropdown.addEventListener('click', (e) => {
                const target = e.target.closest('[data-action]');
                if (!target) return;
                const action = target.dataset.action;
                const code = target.dataset.code;
                if (action === 'select-province') this.selectProvince(code);
                else if (action === 'select-ward') this.selectWard(code);
                else if (action === 'select-result') this.selectResult(target);
            });
            if (dropdownContent) {
                dropdownContent.addEventListener('touchstart', () => { this.isInteracting = true; }, { passive: true });
                dropdownContent.addEventListener('touchend', () => { setTimeout(() => this.isInteracting = false, 100); }, { passive: true });
            }
        }

        this.boundHandlers.handleClickOutside = (e) => {
            if (this.isInteracting) return;
            const wrapper = document.querySelector('.hierarchical-address-selector');
            if (wrapper && !wrapper.contains(e.target)) this.closeDropdown();
        };
        document.addEventListener('click', this.boundHandlers.handleClickOutside);
    }

    scrollInputIntoView() {
        const searchInput = document.getElementById('addressSearchInput');
        if (!searchInput) return;
        setTimeout(() => {
            const chipsWrapper = searchInput.closest('.address-chips-wrapper');
            if (!chipsWrapper) return;
            const modal = chipsWrapper.closest('.quick-checkout-modal');
            if (modal) {
                const modalBody = modal.querySelector('.quick-checkout-body');
                const modalHeader = modal.querySelector('.quick-checkout-header');
                if (modalBody) {
                    const formGroup = chipsWrapper.closest('.checkout-form-group');
                    if (formGroup) {
                        let offsetTop = 0; let element = formGroup;
                        while (element && element !== modalBody) { offsetTop += element.offsetTop; element = element.offsetParent; }
                        const headerHeight = modalHeader ? modalHeader.offsetHeight : 0;
                        modalBody.scrollTo({ top: Math.max(0, offsetTop - headerHeight - 10), behavior: 'smooth' });
                    }
                }
            } else {
                const elementPosition = chipsWrapper.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - this.SCROLL_OFFSET;
                window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
            }
        }, this.KEYBOARD_DELAY);
    }

    _scrollMOrderAddressBlockToTop() {
        if (this.containerId !== 'mOrderAddressSelectorContainer') return;
        const scrollEl = document.getElementById('createScrollArea');
        const block = document.getElementById('mAddressFormBlock');
        if (!scrollEl || !block || scrollEl.clientHeight <= 0) return;
        const sticky = scrollEl.querySelector('.sticky');
        const headerH = sticky ? sticky.offsetHeight : 0;
        const gap = 8;
        const pr = scrollEl.getBoundingClientRect();
        const ar = block.getBoundingClientRect();
        let nextTop = scrollEl.scrollTop + (ar.top - pr.top) - headerH - gap;
        const maxScroll = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight);
        nextTop = Math.max(0, Math.min(nextTop, maxScroll));
        if (Math.abs(nextTop - scrollEl.scrollTop) < 2) return;
        scrollEl.scrollTo({ top: nextTop, behavior: 'auto' });
    }

    _syncMCreateDropdownMaxHeight() {
        if (this.containerId !== 'mOrderAddressSelectorContainer') return;
        const panel = document.getElementById('createPanel');
        const dd = document.getElementById('addressDropdown');
        if (!panel || panel.classList.contains('hidden') || !dd || dd.classList.contains('hidden')) return;
        const footer = panel.querySelector(':scope > .shrink-0');
        if (!footer) return;
        const gap = 8;
        const dr = dd.getBoundingClientRect();
        const fr = footer.getBoundingClientRect();
        let maxH = fr.top - dr.top - gap;
        if (maxH < 120) maxH = 120;
        const cap = Math.floor(window.innerHeight * 0.92);
        if (maxH > cap) maxH = cap;
        dd.style.maxHeight = `${Math.floor(maxH)}px`;
    }

    _requestMCreateDropdownHeightSync() {
        if (this.containerId !== 'mOrderAddressSelectorContainer' || !this.isDropdownOpen) return;
        requestAnimationFrame(() => this._syncMCreateDropdownMaxHeight());
    }

    _bindMCreateDropdownLayoutListeners() {
        if (this.containerId !== 'mOrderAddressSelectorContainer') return;
        this._unbindMCreateDropdownLayoutListeners();
        const sync = () => {
            if (this._mCreateDDFooterRaf) cancelAnimationFrame(this._mCreateDDFooterRaf);
            this._mCreateDDFooterRaf = requestAnimationFrame(() => { this._mCreateDDFooterRaf = 0; this._syncMCreateDropdownMaxHeight(); });
        };
        this._mCreateDDFooterSync = sync;
        const scrollEl = document.getElementById('createScrollArea');
        this._mCreateDDFooterScrollEl = scrollEl || null;
        if (scrollEl) scrollEl.addEventListener('scroll', sync, { passive: true });
        window.addEventListener('resize', sync);
        if (window.visualViewport) { window.visualViewport.addEventListener('resize', sync); window.visualViewport.addEventListener('scroll', sync); }
    }

    _unbindMCreateDropdownLayoutListeners() {
        const sync = this._mCreateDDFooterSync;
        if (!sync) return;
        const scrollEl = this._mCreateDDFooterScrollEl;
        if (scrollEl) scrollEl.removeEventListener('scroll', sync);
        window.removeEventListener('resize', sync);
        if (window.visualViewport) { window.visualViewport.removeEventListener('resize', sync); window.visualViewport.removeEventListener('scroll', sync); }
        this._mCreateDDFooterSync = null; this._mCreateDDFooterScrollEl = null;
        if (this._mCreateDDFooterRaf) { cancelAnimationFrame(this._mCreateDDFooterRaf); this._mCreateDDFooterRaf = 0; }
    }

    cleanup() {
        if (this.boundHandlers.handleClickOutside) document.removeEventListener('click', this.boundHandlers.handleClickOutside);
        clearTimeout(this.searchDebounceTimer);
        this._unbindMCreateDropdownLayoutListeners();
        const dd = document.getElementById('addressDropdown');
        if (dd) dd.style.maxHeight = '';
        this._toggleCreateScrollLock(false);
    }

    _toggleCreateScrollLock(lock) {
        if (this.containerId !== 'mOrderAddressSelectorContainer') return;
        const scrollArea = document.getElementById('createScrollArea');
        if (!scrollArea) return;
        scrollArea.style.overflowY = lock ? 'hidden' : '';
    }

    handleKeyboardNavigation(e) {
        if (!this.isDropdownOpen) return;
        const items = document.querySelectorAll('.address-list-item, .address-result-item');
        this.resultItems = Array.from(items);
        switch(e.key) {
            case 'ArrowDown': e.preventDefault(); this.focusedIndex = Math.min(this.focusedIndex + 1, this.resultItems.length - 1); this.updateFocusedItem(); break;
            case 'ArrowUp': e.preventDefault(); this.focusedIndex = Math.max(this.focusedIndex - 1, -1); this.updateFocusedItem(); break;
            case 'Enter': e.preventDefault(); if (this.focusedIndex >= 0 && this.resultItems[this.focusedIndex]) this.resultItems[this.focusedIndex].click(); break;
            case 'Escape': e.preventDefault(); this.closeDropdown(); break;
        }
    }

    updateFocusedItem() {
        this.resultItems.forEach(item => item.classList.remove('keyboard-focused'));
        if (this.focusedIndex >= 0 && this.resultItems[this.focusedIndex]) {
            const item = this.resultItems[this.focusedIndex];
            item.classList.add('keyboard-focused');
            item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    handleSearchInput(query) {
        this.searchQuery = query.trim();
        clearTimeout(this.searchDebounceTimer);
        this.searchDebounceTimer = setTimeout(() => this.performSearch(), this.DEBOUNCE_DELAY);
    }

    resetState(level) {
        if (level === 'province') {
            this.provinceCode = '';
            this.selectedProvince = null;
        }
        this.wardCode = '';
        this.selectedWard = null;
        this.currentLevel = level;
        this.searchQuery = '';
        this.hideStreetInput();
        this.updateChipsDisplay();
        this.updateFullAddress();
    }

    deleteLevel(level) {
        this.resetState(level);
        const searchInput = document.getElementById('addressSearchInput');
        if (!searchInput) return;
        searchInput.value = '';
        this.renderList(level);
        if (this.containerId === 'mOrderAddressSelectorContainer') this._scrollMOrderAddressBlockToTop();
        this.openDropdown();
        setTimeout(() => searchInput.focus(), this.FOCUS_DELAY);
    }

    renderList(level) {
        if (level === 'province') this.renderProvinces();
        else if (level === 'ward') this.renderWards();
    }

    performSearch() {
        this.openDropdown();
        this.focusedIndex = -1;
        if (!this.searchQuery) { this.renderList(this.currentLevel); return; }
        const results = this.searchAddresses(this.normalizeText(this.searchQuery));
        this.renderSearchResults(results);
    }

    searchAddresses(normalizedQuery) {
        const results = [];
        if (this.currentLevel === 'province') {
            for (const province of this.normalizedData) {
                if (this.matchText(province.normalizedName, normalizedQuery)) {
                    results.push({ type: 'province', province, matchLevel: 'province', score: this.calculateScore(province.normalizedName, normalizedQuery) });
                    if (results.length >= this.MAX_RESULTS) break;
                }
            }
        } else if (this.currentLevel === 'ward' && this.selectedProvince) {
            for (const ward of this.selectedProvince.wards) {
                if (this.matchText(ward.normalizedName, normalizedQuery)) {
                    results.push({ type: 'ward', province: this.selectedProvince, ward, matchLevel: 'ward', score: this.calculateScore(ward.normalizedName, normalizedQuery) });
                    if (results.length >= this.MAX_RESULTS) break;
                }
            }
        }
        results.sort((a, b) => b.score - a.score);
        return results;
    }

    matchText(text, query) {
        if (query.length === 1) return text.includes(query);
        if (query.length === 2) {
            const words = text.split(' ');
            for (const word of words) { if (word.startsWith(query)) return true; }
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
        if (text.includes(query)) return true;
        return false;
    }

    calculateScore(text, query) {
        const words = text.split(' ');
        if (text === query) return 1000;
        if (words[0] === query) return 500;
        if (text.startsWith(query)) return 100 + (100 / text.length);
        for (let i = 0; i < words.length; i++) { if (words[i].startsWith(query)) return 70 - (i * 5); }
        if (text.includes(query)) { const position = text.indexOf(query); return 50 - (position / text.length * 20); }
        return 10;
    }

    renderSearchResults(results) {
        const content = document.getElementById('addressDropdownContent');
        if (!content) return;
        if (results.length === 0) {
            content.innerHTML = '<div class="address-dropdown-empty">Không tìm thấy địa chỉ phù hợp</div>';
            this._requestMCreateDropdownHeightSync();
            return;
        }
        let header = this.currentLevel === 'province' ? 'Chọn Tỉnh/Thành phố' : 'Chọn Phường/Xã';
        let html = `<div class="address-dropdown-header">${header}</div><div class="address-dropdown-results">`;
        results.forEach(result => { html += this.renderResultItem(result); });
        html += '</div>';
        content.innerHTML = html;
        this._requestMCreateDropdownHeightSync();
    }

    renderResultItem(result) {
        const { type, province, ward } = result;
        const datasets = `data-action="select-result" data-type="${type}" data-province="${province.code}"${ward ? ` data-ward="${ward.code}"` : ''}`;
        const mainText = type === 'province' ? province.name : ward.name;
        const subText = type === 'ward' ? province.name : '';
        return `<div class="address-result-item" role="option" tabindex="-1" ${datasets}>
            <span class="result-icon" aria-hidden="true">${this.LOCATION_ICON}</span>
            <div class="result-content">
                <div class="result-main">${this.highlightMatch(mainText, this.searchQuery)}</div>
                ${subText ? `<div class="result-sub">${subText}</div>` : ''}
            </div>
            ${type !== 'ward' ? '<span class="result-arrow" aria-hidden="true">›</span>' : ''}
        </div>`;
    }

    highlightMatch(text, query) {
        if (!query) return text;
        const normalizedText = this.normalizeText(text);
        const normalizedQuery = this.normalizeText(query);
        const index = normalizedText.indexOf(normalizedQuery);
        if (index === -1) return text;
        return text.substring(0, index) + '<mark>' + text.substring(index, index + query.length) + '</mark>' + text.substring(index + query.length);
    }

    selectResult(element) {
        const type = element.dataset.type;
        const provinceCode = element.dataset.province;
        const wardCode = element.dataset.ward;
        if (type === 'province') {
            this.selectProvince(provinceCode);
        } else if (type === 'ward') {
            this.selectProvince(provinceCode);
            setTimeout(() => this.selectWard(wardCode), 100);
        }
    }

    selectLevel(level, code) {
        this.isInteracting = true;
        if (level === 'province') {
            this.provinceCode = code;
            this.selectedProvince = this.normalizedData.find(p => p.code === code);
            this.currentLevel = 'ward';
            this.wardCode = '';
            this.selectedWard = null;
            this.updateChipsDisplay();
            this.renderWards();
        } else if (level === 'ward') {
            this.wardCode = code;
            this.selectedWard = this.selectedProvince?.wards.find(w => w.code === code);
            this.currentLevel = 'complete';
            this.updateChipsDisplay();
            this.closeDropdown();
            this.showStreetInput();
            const streetInput = document.getElementById('streetInput');
            if (streetInput) setTimeout(() => streetInput.focus(), 200);
        }
        this.updateFullAddress();
        setTimeout(() => this.isInteracting = false, 100);
    }

    selectProvince(code) { this.selectLevel('province', code); }
    selectWard(code) { this.selectLevel('ward', code); }

    renderGenericList(items, header, action) {
        const content = document.getElementById('addressDropdownContent');
        if (!content) return;
        const itemsHtml = items.map(item =>
            `<div class="address-list-item" role="option" tabindex="-1" data-action="${action}" data-code="${item.code}">
                <span class="item-icon" aria-hidden="true">${this.LOCATION_ICON}</span>
                <span class="item-text">${item.name}</span>
                ${action !== 'select-ward' ? '<span class="item-arrow" aria-hidden="true">›</span>' : ''}
            </div>`
        ).join('');
        content.innerHTML = `<div class="address-dropdown-header">${header}</div>
            <div class="address-dropdown-list" role="listbox">${itemsHtml}</div>`;
        this._requestMCreateDropdownHeightSync();
    }

    renderProvinces() {
        this.renderGenericList(this.normalizedData, 'Chọn Tỉnh/Thành phố', 'select-province');
    }

    renderWards() {
        if (!this.selectedProvince) return;
        this.renderGenericList(this.selectedProvince.wards, 'Chọn Phường/Xã', 'select-ward');
    }

    updateChipsDisplay() {
        const chipsContainer = document.getElementById('addressChips');
        if (!chipsContainer) return;
        const chips = [];
        const levels = [
            { selected: this.selectedProvince, prefix: ['Tỉnh ', 'Thành phố '], replace: 'TP ', level: 'province' },
            { selected: this.selectedWard, prefix: ['Phường ', 'Xã ', 'Thị trấn '], replace: ['P.', 'X.', 'TT '], level: 'ward' }
        ];
        levels.forEach(({ selected, prefix, replace, level }) => {
            if (!selected) return;
            let shortName = selected.name;
            prefix.forEach((p, i) => { shortName = shortName.replace(p, Array.isArray(replace) ? replace[i] : replace); });
            chips.push(`<div class="address-chip" data-level="${level}">
                <span class="chip-text">${shortName}</span>
                <button class="chip-remove" data-action="remove-chip" data-level="${level}" aria-label="Xóa ${shortName}">${this.CLOSE_ICON}</button>
            </div>`);
        });
        chipsContainer.innerHTML = chips.length > 0 ? chips.join('') : '<span class="address-placeholder">📍 Chọn địa chỉ giao hàng</span>';
    }

    showStreetInput() {
        const wrapper = document.getElementById('addressStreetWrapper');
        if (wrapper) wrapper.classList.remove('hidden');
    }

    hideStreetInput() {
        const wrapper = document.getElementById('addressStreetWrapper');
        const streetInput = document.getElementById('streetInput');
        if (wrapper) wrapper.classList.add('hidden');
        if (streetInput) { streetInput.value = ''; this.street = ''; }
    }

    updateFullAddress() {
        const display = document.getElementById('addressDisplay');
        if (!display) return;
        const fullAddress = addressService.getFullAddress(this.provinceCode, this.wardCode, this.street);
        const textElement = display.querySelector('.address-display-text');
        if (textElement) textElement.textContent = fullAddress || 'Vui lòng chọn địa chỉ';
        if (this.provinceCode) display.classList.remove('hidden');
        else display.classList.add('hidden');
    }

    openDropdown() {
        const dropdown = document.getElementById('addressDropdown');
        const searchInput = document.getElementById('addressSearchInput');
        const selectorDisplay = document.getElementById('addressSelectorDisplay');
        if (dropdown) {
            dropdown.classList.remove('hidden');
            this.isDropdownOpen = true;
            this._toggleCreateScrollLock(true);
            if (this.containerId === 'mOrderAddressSelectorContainer') {
                requestAnimationFrame(() => { requestAnimationFrame(() => { this._syncMCreateDropdownMaxHeight(); this._bindMCreateDropdownLayoutListeners(); }); });
            }
        }
        if (searchInput) searchInput.setAttribute('aria-expanded', 'true');
        if (selectorDisplay) selectorDisplay.setAttribute('aria-expanded', 'true');
    }

    closeDropdown() {
        const dropdown = document.getElementById('addressDropdown');
        const searchInput = document.getElementById('addressSearchInput');
        const selectorDisplay = document.getElementById('addressSelectorDisplay');
        this._unbindMCreateDropdownLayoutListeners();
        if (dropdown) { dropdown.style.maxHeight = ''; dropdown.classList.add('hidden'); this.isDropdownOpen = false; }
        if (searchInput) searchInput.setAttribute('aria-expanded', 'false');
        if (selectorDisplay) selectorDisplay.setAttribute('aria-expanded', 'false');
        this.focusedIndex = -1;
        this._toggleCreateScrollLock(false);
    }

    hydrateFromCodes({ provinceCode, wardCode, street } = {}) {
        const p = provinceCode != null && provinceCode !== '' ? String(provinceCode) : '';
        if (!p || !this.normalizedData || this.normalizedData.length === 0) {
            this.updateChipsDisplay();
            this.updateFullAddress();
            return;
        }
        const prov = this.normalizedData.find(x => x.code === p);
        if (!prov) { console.warn('hydrateFromCodes: province not found', p); return; }

        this.provinceCode = p;
        this.selectedProvince = prov;
        this.wardCode = '';
        this.selectedWard = null;
        this.currentLevel = 'ward';

        const w = wardCode != null && wardCode !== '' ? String(wardCode) : '';
        if (w && prov.wards && prov.wards.length) {
            const wrd = prov.wards.find(x => x.code === w);
            if (wrd) {
                this.wardCode = w;
                this.selectedWard = wrd;
                this.currentLevel = 'complete';
            }
        }

        if (this.wardCode) {
            this.showStreetInput();
            this.street = street != null ? String(street).trim() : '';
            const streetInput = document.getElementById('streetInput');
            if (streetInput) streetInput.value = this.street;
        } else {
            this.hideStreetInput();
        }

        this.searchQuery = '';
        const searchInput = document.getElementById('addressSearchInput');
        if (searchInput) searchInput.value = '';
        this.updateChipsDisplay();
        this.updateFullAddress();
        this.closeDropdown();
    }

    getAddressData() {
        return {
            provinceCode: this.provinceCode,
            provinceName: this.selectedProvince?.name || null,
            districtCode: null,
            districtName: null,
            wardCode: this.wardCode,
            wardName: this.selectedWard?.name || null,
            street: this.street,
            fullAddress: addressService.getFullAddress(this.provinceCode, this.wardCode, this.street)
        };
    }

    validate() {
        if (!this.provinceCode) return { isValid: false, message: 'Vui lòng chọn Tỉnh/Thành phố' };
        if (!this.wardCode) return { isValid: false, message: 'Vui lòng chọn Phường/Xã' };
        if (!this.street) return { isValid: false, message: 'Vui lòng nhập số nhà, tên đường' };
        return { isValid: true };
    }

    reset() {
        this.provinceCode = '';
        this.wardCode = '';
        this.street = '';
        this.searchQuery = '';
        this.currentLevel = 'province';
        this.selectedProvince = null;
        this.selectedWard = null;
        this.focusedIndex = -1;
        const searchInput = document.getElementById('addressSearchInput');
        const streetInput = document.getElementById('streetInput');
        if (searchInput) searchInput.value = '';
        if (streetInput) streetInput.value = '';
        this.updateChipsDisplay();
        this.hideStreetInput();
        this.closeDropdown();
        this.updateFullAddress();
    }

    destroy() {
        this.cleanup();
        const container = document.getElementById(this.containerId);
        if (container) container.innerHTML = '';
        this.normalizedData = null;
        this.selectedProvince = null;
        this.selectedWard = null;
        this.resultItems = [];
    }
}

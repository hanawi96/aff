// ============================================
// LIST ADDRESS SELECTOR (Non-dropdown version, 2 cấp: Tỉnh/TP → Phường/Xã)
// ============================================

import { addressService } from '../shared/services/address.service.js';

export class ListAddressSelector {
    constructor(containerId) {
        this.containerId = containerId;
        this.provinceCode = '';
        this.wardCode = '';
        this.street = '';

        this.selectedProvince = null;
        this.selectedWard = null;

        this.provinceSearch = '';
        this.wardSearch = '';

        this.searchTimers = {};
    }

    async init() {
        try {
            await addressService.loadAddressData();
            if (!addressService.addressData || Object.keys(addressService.addressData).length === 0) {
                throw new Error('Address data is empty');
            }
            this.render();
            this.setupEventListeners();
            console.log('✅ ListAddressSelector initialized');
        } catch (error) {
            console.error('❌ Error initializing ListAddressSelector:', error);
            throw error;
        }
    }

    _addressItemSortLabel(item) {
        return String(item.nameWithType || item.name || '');
    }

    sortByViDisplayName(items) {
        return [...items].sort((a, b) =>
            this._addressItemSortLabel(a).localeCompare(this._addressItemSortLabel(b), 'vi', { sensitivity: 'base' })
        );
    }

    sortProvincesForDisplay(provinces) {
        const pri = (code) => { const c = String(code); if (c === '79') return 0; if (c === '01') return 1; return 100; };
        return [...provinces].sort((a, b) => {
            const pa = pri(a.code), pb = pri(b.code);
            if (pa !== pb) return pa - pb;
            return this._addressItemSortLabel(a).localeCompare(this._addressItemSortLabel(b), 'vi', { sensitivity: 'base' });
        });
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="list-address-selector">
                <div class="address-box">
                    <div class="address-breadcrumb" id="addressBreadcrumb"></div>
                    <div class="selected-address-display hidden" id="selectedAddressDisplay"></div>
                    <div class="address-search-box">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="search-icon">
                            <path fill-rule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" clip-rule="evenodd" />
                        </svg>
                        <input type="text" class="address-search-input" id="addressSearchInput" placeholder="Tìm kiếm..." autocomplete="off">
                    </div>
                    <div class="address-list" id="addressList"></div>
                </div>
                <div class="street-section hidden" id="streetSection">
                    <div class="selected-address-summary">
                        <div class="summary-content" id="selectedAddressSummary"></div>
                    </div>
                    <label class="address-label">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="label-icon">
                            <path fill-rule="evenodd" d="m11.54 22.351.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clip-rule="evenodd" />
                        </svg>
                        Địa chỉ cụ thể
                    </label>
                    <input type="text" class="address-input" id="streetInput" placeholder="Số nhà, tên đường..." autocomplete="off">
                </div>
            </div>
        `;

        this.currentLevel = 'province';
        this.renderList();
        this.updateBreadcrumb();
    }

    updateSelectedAddressDisplay() {
        const display = document.getElementById('selectedAddressDisplay');
        if (!display) return;
        let html = '';
        if (this.selectedProvince) {
            html += `<span class="summary-address-group">
                <span class="summary-breadcrumb-item">${this.escapeHtml(this.selectedProvince.name)}</span>
                <button class="summary-edit-icon" data-level="province" title="Đổi Tỉnh/Thành phố">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32L19.513 8.2Z" /></svg>
                </button>
            </span>`;
        }
        if (this.selectedWard) {
            html += `<span class="summary-separator">›</span>
            <span class="summary-address-group">
                <span class="summary-breadcrumb-item">${this.escapeHtml(this.selectedWard.name)}</span>
                <button class="summary-edit-icon" data-level="ward" title="Đổi Phường/Xã">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32L19.513 8.2Z" /></svg>
                </button>
            </span>`;
        }
        if (html) { display.innerHTML = html; display.classList.remove('hidden'); }
        else display.classList.add('hidden');
    }

    renderList() {
        const listEl = document.getElementById('addressList');
        const searchInput = document.getElementById('addressSearchInput');
        if (!listEl) return;
        let items = [];
        const searchQuery = searchInput?.value || '';
        if (this.currentLevel === 'province') {
            items = this.sortProvincesForDisplay(addressService.getProvinces());
        } else if (this.currentLevel === 'ward' && this.provinceCode) {
            items = this.sortByViDisplayName(addressService.getWards(this.provinceCode));
        }
        const filtered = this.filterItems(items, searchQuery);
        if (filtered.length === 0) { listEl.innerHTML = '<div class="address-empty">Không tìm thấy kết quả</div>'; return; }
        listEl.innerHTML = filtered.map(item => `
            <div class="address-item" data-code="${item.code}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="address-item-icon">
                    <path fill-rule="evenodd" d="m11.54 22.351.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clip-rule="evenodd" />
                </svg>
                <span class="item-name">${this.escapeHtml(item.name)}</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="chevron-icon">
                    <path fill-rule="evenodd" d="M16.28 11.47a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 0 1 1.06-1.06l7.5 7.5Z" clip-rule="evenodd" />
                </svg>
            </div>
        `).join('');
    }

    updateBreadcrumb() {
        const breadcrumb = document.getElementById('addressBreadcrumb');
        if (!breadcrumb) return;
        const parts = [];
        if (this.currentLevel === 'province') {
            parts.push('<span class="breadcrumb-item active">Chọn Tỉnh/Thành phố</span>');
        } else {
            parts.push(`<span class="breadcrumb-item clickable" data-level="province">${this.selectedProvince?.name || 'Tỉnh/TP'}</span>`);
            if (this.currentLevel === 'ward') {
                parts.push('<span class="breadcrumb-separator">›</span>');
                parts.push('<span class="breadcrumb-item active">Chọn Phường/Xã</span>');
            }
        }
        breadcrumb.innerHTML = parts.join('');
    }

    setupEventListeners() {
        const container = document.getElementById(this.containerId);
        if (!container) return;
        container.addEventListener('click', (e) => {
            const item = e.target.closest('.address-item');
            if (item) { e.preventDefault(); this.selectItem(item.dataset.code); return; }
            const breadcrumbItem = e.target.closest('.breadcrumb-item.clickable');
            if (breadcrumbItem) { e.preventDefault(); this.goToLevel(breadcrumbItem.dataset.level); return; }
            const summaryEditIcon = e.target.closest('.summary-edit-icon');
            if (summaryEditIcon) { e.preventDefault(); this.editAddressLevel(summaryEditIcon.dataset.level); return; }
            const editBtn = e.target.closest('#btnEditAddress');
            if (editBtn) { e.preventDefault(); this.editAddress(); return; }
        });
        const searchInput = document.getElementById('addressSearchInput');
        if (searchInput) searchInput.addEventListener('input', () => this.renderList());
        const streetInput = document.getElementById('streetInput');
        if (streetInput) streetInput.addEventListener('input', (e) => { this.street = e.target.value; this.emitChange(); });
    }

    editAddress() {
        const addressBox = document.querySelector('.address-box');
        if (addressBox) addressBox.classList.remove('hidden');
        const streetSection = document.getElementById('streetSection');
        if (streetSection) streetSection.classList.add('hidden');
        this.currentLevel = 'ward';
        this.renderList();
        this.updateBreadcrumb();
    }

    editAddressLevel(level) {
        const addressBox = document.querySelector('.address-box');
        if (addressBox) addressBox.classList.remove('hidden');
        const streetSection = document.getElementById('streetSection');
        if (streetSection) streetSection.classList.add('hidden');
        const searchInput = document.getElementById('addressSearchInput');
        if (searchInput) searchInput.value = '';
        if (level === 'province') {
            this.selectedProvince = null;
            this.selectedWard = null;
            this.provinceCode = '';
            this.wardCode = '';
            this.street = '';
            this.currentLevel = 'province';
        } else if (level === 'ward') {
            this.selectedWard = null;
            this.wardCode = '';
            this.street = '';
            this.currentLevel = 'ward';
        }
        this.renderList();
        this.updateBreadcrumb();
        this.updateSelectedAddressDisplay();
        this.emitChange();
    }

    selectItem(code) {
        if (this.currentLevel === 'province') this.selectProvince(code);
        else if (this.currentLevel === 'ward') this.selectWard(code);
    }

    goToLevel(level) {
        this.currentLevel = level;
        const addressBox = document.querySelector('.address-box');
        if (addressBox) addressBox.classList.remove('hidden');
        const searchInput = document.getElementById('addressSearchInput');
        if (searchInput) searchInput.value = '';
        if (level === 'province') {
            this.selectedProvince = null;
            this.selectedWard = null;
            this.provinceCode = '';
            this.wardCode = '';
            this.street = '';
            const streetSection = document.getElementById('streetSection');
            if (streetSection) streetSection.classList.add('hidden');
        }
        this.renderList();
        this.updateBreadcrumb();
        this.updateSelectedAddressDisplay();
        this.emitChange();
    }

    selectProvince(code) {
        const provinces = addressService.getProvinces();
        this.selectedProvince = provinces.find(p => p.code === code);
        this.provinceCode = code;
        this.selectedWard = null;
        this.wardCode = '';
        this.street = '';
        this.currentLevel = 'ward';
        const searchInput = document.getElementById('addressSearchInput');
        if (searchInput) searchInput.value = '';
        this.renderList();
        this.updateBreadcrumb();
        this.updateSelectedAddressDisplay();
        this.emitChange();
    }

    selectWard(code) {
        const wards = addressService.getWards(this.provinceCode);
        this.selectedWard = wards.find(w => w.code === code);
        this.wardCode = code;
        const addressBox = document.querySelector('.address-box');
        if (addressBox) addressBox.classList.add('hidden');
        const summary = document.getElementById('selectedAddressSummary');
        if (summary && this.selectedProvince && this.selectedWard) {
            summary.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="summary-icon">
                    <path fill-rule="evenodd" d="m11.54 22.351.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clip-rule="evenodd" />
                </svg>
                <span class="summary-breadcrumb">
                    <span class="summary-address-group">
                        <span class="summary-breadcrumb-item">${this.escapeHtml(this.selectedProvince.name)}</span>
                        <button class="summary-edit-icon" data-level="province" title="Đổi Tỉnh/Thành phố">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32L19.513 8.2Z" /></svg>
                        </button>
                    </span>
                    <span class="summary-separator">›</span>
                    <span class="summary-address-group">
                        <span class="summary-breadcrumb-item">${this.escapeHtml(this.selectedWard.name)}</span>
                        <button class="summary-edit-icon" data-level="ward" title="Đổi Phường/Xã">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32L19.513 8.2Z" /></svg>
                        </button>
                    </span>
                </span>
            `;
        }
        const streetSection = document.getElementById('streetSection');
        const streetInput = document.getElementById('streetInput');
        if (streetSection) streetSection.classList.remove('hidden');
        if (streetInput) setTimeout(() => streetInput.focus(), 100);
        this.emitChange();
    }

    filterItems(items, query) {
        if (!query || query.trim() === '') return items;
        const normalized = this.normalizeText(query);
        return items.filter(item => this.normalizeText(item.name).includes(normalized));
    }

    normalizeText(text) {
        return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd');
    }

    debounceSearch(level, callback) {
        if (this.searchTimers[level]) clearTimeout(this.searchTimers[level]);
        this.searchTimers[level] = setTimeout(callback, 200);
    }

    emitChange() {
        const event = new CustomEvent('addressChange', {
            detail: {
                provinceCode: this.provinceCode,
                districtCode: null,
                wardCode: this.wardCode,
                street: this.street,
                provinceName: this.selectedProvince?.name || '',
                districtName: null,
                wardName: this.selectedWard?.name || '',
                fullAddress: this.getFullAddress(),
                isComplete: this.isComplete()
            }
        });
        document.dispatchEvent(event);
    }

    getFullAddress() {
        const parts = [];
        if (this.street) parts.push(this.street);
        if (this.selectedWard) parts.push(this.selectedWard.name);
        if (this.selectedProvince) parts.push(this.selectedProvince.name);
        return parts.join(', ');
    }

    isComplete() {
        return !!(this.provinceCode && this.wardCode && this.street);
    }

    getAddress() {
        return {
            provinceCode: this.provinceCode,
            districtCode: null,
            wardCode: this.wardCode,
            street: this.street,
            provinceName: this.selectedProvince?.name || '',
            districtName: null,
            wardName: this.selectedWard?.name || '',
            fullAddress: this.getFullAddress(),
            isComplete: this.isComplete()
        };
    }

    setAddress(address) {
        if (address.provinceCode) this.selectProvince(address.provinceCode);
        if (address.wardCode) {
            setTimeout(() => this.selectWard(address.wardCode), 100);
        }
        if (address.street) {
            setTimeout(() => {
                this.street = address.street;
                const streetInput = document.getElementById('streetInput');
                if (streetInput) streetInput.value = address.street;
            }, 200);
        }
    }

    reset() {
        this.provinceCode = '';
        this.wardCode = '';
        this.street = '';
        this.selectedProvince = null;
        this.selectedWard = null;
        this.provinceSearch = '';
        this.wardSearch = '';
        this.render();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    destroy() {
        const container = document.getElementById(this.containerId);
        if (container) container.innerHTML = '';
        Object.values(this.searchTimers).forEach(timer => clearTimeout(timer));
    }
}

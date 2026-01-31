// ============================================
// LIST ADDRESS SELECTOR (Non-dropdown version)
// ============================================

import { addressService } from '../shared/services/address.service.js';

/**
 * List-based Address Selector
 * Shows provinces, districts, wards as expandable lists instead of dropdown
 */
export class ListAddressSelector {
    constructor(containerId) {
        this.containerId = containerId;
        this.provinceCode = '';
        this.districtCode = '';
        this.wardCode = '';
        this.street = '';
        
        // Selection state
        this.selectedProvince = null;
        this.selectedDistrict = null;
        this.selectedWard = null;
        
        // Search queries for each level
        this.provinceSearch = '';
        this.districtSearch = '';
        this.wardSearch = '';
        
        // Debounce timers
        this.searchTimers = {};
    }
    
    /**
     * Initialize selector
     */
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

    
    /**
     * Render the selector UI
     */
    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;
        
        container.innerHTML = `
            <div class="list-address-selector">
                <!-- Single Box for all levels -->
                <div class="address-box">
                    <!-- Breadcrumb -->
                    <div class="address-breadcrumb" id="addressBreadcrumb"></div>
                    
                    <!-- Selected Address Display (shows as user selects) -->
                    <div class="selected-address-display hidden" id="selectedAddressDisplay"></div>
                    
                    <!-- Search Box -->
                    <div class="address-search-box">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="search-icon">
                            <path fill-rule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" clip-rule="evenodd" />
                        </svg>
                        <input type="text" 
                               class="address-search-input" 
                               id="addressSearchInput"
                               placeholder="Tìm kiếm..."
                               autocomplete="off">
                    </div>
                    
                    <!-- List Container -->
                    <div class="address-list" id="addressList"></div>
                </div>
                
                <!-- Street Input (shown after selecting ward) -->
                <div class="street-section hidden" id="streetSection">
                    <!-- Selected address summary with edit icons -->
                    <div class="selected-address-summary">
                        <div class="summary-content" id="selectedAddressSummary"></div>
                    </div>
                    
                    <label class="address-label">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="label-icon">
                            <path fill-rule="evenodd" d="m11.54 22.351.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clip-rule="evenodd" />
                        </svg>
                        Địa chỉ cụ thể
                    </label>
                    <input type="text" 
                           class="address-input" 
                           id="streetInput"
                           placeholder="Số nhà, tên đường..."
                           autocomplete="off">
                </div>
            </div>
        `;
        
        // Set initial level and render
        this.currentLevel = 'province';
        this.renderList();
        this.updateBreadcrumb();
    }

    
    /**
     * Update selected address display (shows selected addresses with edit icons)
     */
    updateSelectedAddressDisplay() {
        const display = document.getElementById('selectedAddressDisplay');
        if (!display) return;
        
        // Build HTML for selected addresses
        let html = '';
        
        if (this.selectedProvince) {
            html += `
                <span class="summary-address-group">
                    <span class="summary-breadcrumb-item">${this.escapeHtml(this.selectedProvince.name)}</span>
                    <button class="summary-edit-icon" data-level="province" title="Đổi Tỉnh/Thành phố">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32L19.513 8.2Z" />
                        </svg>
                    </button>
                </span>
            `;
        }
        
        if (this.selectedDistrict) {
            html += `
                <span class="summary-separator">›</span>
                <span class="summary-address-group">
                    <span class="summary-breadcrumb-item">${this.escapeHtml(this.selectedDistrict.name)}</span>
                    <button class="summary-edit-icon" data-level="district" title="Đổi Quận/Huyện">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32L19.513 8.2Z" />
                        </svg>
                    </button>
                </span>
            `;
        }
        
        if (this.selectedWard) {
            html += `
                <span class="summary-separator">›</span>
                <span class="summary-address-group">
                    <span class="summary-breadcrumb-item">${this.escapeHtml(this.selectedWard.name)}</span>
                    <button class="summary-edit-icon" data-level="ward" title="Đổi Phường/Xã">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32L19.513 8.2Z" />
                        </svg>
                    </button>
                </span>
            `;
        }
        
        if (html) {
            display.innerHTML = html;
            display.classList.remove('hidden');
        } else {
            display.classList.add('hidden');
        }
    }
    
    /**
     * Render list based on current level
     */
    renderList() {
        const listEl = document.getElementById('addressList');
        const searchInput = document.getElementById('addressSearchInput');
        if (!listEl) return;
        
        let items = [];
        const searchQuery = searchInput?.value || '';
        
        if (this.currentLevel === 'province') {
            items = addressService.getProvinces();
        } else if (this.currentLevel === 'district' && this.provinceCode) {
            items = addressService.getDistricts(this.provinceCode);
        } else if (this.currentLevel === 'ward' && this.provinceCode && this.districtCode) {
            items = addressService.getWards(this.provinceCode, this.districtCode);
        }
        
        const filtered = this.filterItems(items, searchQuery);
        
        if (filtered.length === 0) {
            listEl.innerHTML = '<div class="address-empty">Không tìm thấy kết quả</div>';
            return;
        }
        
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
    
    /**
     * Update breadcrumb
     */
    updateBreadcrumb() {
        const breadcrumb = document.getElementById('addressBreadcrumb');
        if (!breadcrumb) return;
        
        const parts = [];
        
        if (this.currentLevel === 'province') {
            parts.push('<span class="breadcrumb-item active">Chọn Tỉnh/Thành phố</span>');
        } else {
            parts.push(`<span class="breadcrumb-item clickable" data-level="province">${this.selectedProvince?.name || 'Tỉnh/TP'}</span>`);
            
            if (this.currentLevel === 'district') {
                parts.push('<span class="breadcrumb-separator">›</span>');
                parts.push('<span class="breadcrumb-item active">Chọn Quận/Huyện</span>');
            } else if (this.currentLevel === 'ward') {
                parts.push('<span class="breadcrumb-separator">›</span>');
                parts.push(`<span class="breadcrumb-item clickable" data-level="district">${this.selectedDistrict?.name || 'Quận/Huyện'}</span>`);
                parts.push('<span class="breadcrumb-separator">›</span>');
                parts.push('<span class="breadcrumb-item active">Chọn Phường/Xã</span>');
            }
        }
        
        breadcrumb.innerHTML = parts.join('');
    }

    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        const container = document.getElementById(this.containerId);
        if (!container) return;
        
        // Click on list items
        container.addEventListener('click', (e) => {
            const item = e.target.closest('.address-item');
            if (item) {
                e.preventDefault();
                this.selectItem(item.dataset.code);
                return;
            }
            
            // Click on breadcrumb in address box
            const breadcrumbItem = e.target.closest('.breadcrumb-item.clickable');
            if (breadcrumbItem) {
                e.preventDefault();
                const level = breadcrumbItem.dataset.level;
                this.goToLevel(level);
                return;
            }
            
            // Click on edit icon in summary (pencil icon)
            const summaryEditIcon = e.target.closest('.summary-edit-icon');
            if (summaryEditIcon) {
                e.preventDefault();
                const level = summaryEditIcon.dataset.level;
                this.editAddressLevel(level);
                return;
            }
            
            // Click on edit address button (removed - no longer needed)
            const editBtn = e.target.closest('#btnEditAddress');
            if (editBtn) {
                e.preventDefault();
                this.editAddress();
                return;
            }
        });
        
        // Search input
        const searchInput = document.getElementById('addressSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this.renderList();
            });
        }
        
        // Street input
        const streetInput = document.getElementById('streetInput');
        if (streetInput) {
            streetInput.addEventListener('input', (e) => {
                this.street = e.target.value;
                this.emitChange();
            });
        }
    }
    
    /**
     * Edit address - go back to ward selection
     */
    editAddress() {
        // Show address box again
        const addressBox = document.querySelector('.address-box');
        if (addressBox) addressBox.classList.remove('hidden');
        
        // Hide street section
        const streetSection = document.getElementById('streetSection');
        if (streetSection) streetSection.classList.add('hidden');
        
        // Go to ward level
        this.currentLevel = 'ward';
        this.renderList();
        this.updateBreadcrumb();
    }
    
    /**
     * Edit specific address level from summary breadcrumb
     */
    editAddressLevel(level) {
        // Show address box again
        const addressBox = document.querySelector('.address-box');
        if (addressBox) addressBox.classList.remove('hidden');
        
        // Hide street section
        const streetSection = document.getElementById('streetSection');
        if (streetSection) streetSection.classList.add('hidden');
        
        // Clear search
        const searchInput = document.getElementById('addressSearchInput');
        if (searchInput) searchInput.value = '';
        
        // Reset based on level
        if (level === 'province') {
            // Reset everything
            this.selectedProvince = null;
            this.selectedDistrict = null;
            this.selectedWard = null;
            this.provinceCode = '';
            this.districtCode = '';
            this.wardCode = '';
            this.street = '';
            this.currentLevel = 'province';
        } else if (level === 'district') {
            // Keep province, reset district and ward
            this.selectedDistrict = null;
            this.selectedWard = null;
            this.districtCode = '';
            this.wardCode = '';
            this.street = '';
            this.currentLevel = 'district';
        } else if (level === 'ward') {
            // Keep province and district, reset ward
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
    
    /**
     * Select item based on current level
     */
    selectItem(code) {
        if (this.currentLevel === 'province') {
            this.selectProvince(code);
        } else if (this.currentLevel === 'district') {
            this.selectDistrict(code);
        } else if (this.currentLevel === 'ward') {
            this.selectWard(code);
        }
    }
    
    /**
     * Go to specific level
     */
    goToLevel(level) {
        this.currentLevel = level;
        
        // Show address box again
        const addressBox = document.querySelector('.address-box');
        if (addressBox) addressBox.classList.remove('hidden');
        
        // Clear search
        const searchInput = document.getElementById('addressSearchInput');
        if (searchInput) searchInput.value = '';
        
        // Reset lower levels
        if (level === 'province') {
            this.selectedProvince = null;
            this.selectedDistrict = null;
            this.selectedWard = null;
            this.provinceCode = '';
            this.districtCode = '';
            this.wardCode = '';
            this.street = '';
            
            // Hide street section
            const streetSection = document.getElementById('streetSection');
            if (streetSection) streetSection.classList.add('hidden');
        } else if (level === 'district') {
            this.selectedDistrict = null;
            this.selectedWard = null;
            this.districtCode = '';
            this.wardCode = '';
            this.street = '';
            
            // Hide street section
            const streetSection = document.getElementById('streetSection');
            if (streetSection) streetSection.classList.add('hidden');
        }
        
        this.renderList();
        this.updateBreadcrumb();
        this.updateSelectedAddressDisplay();
        this.emitChange();
    }
    
    /**
     * Select province
     */
    selectProvince(code) {
        const provinces = addressService.getProvinces();
        this.selectedProvince = provinces.find(p => p.code === code);
        this.provinceCode = code;
        
        // Reset lower levels
        this.selectedDistrict = null;
        this.selectedWard = null;
        this.districtCode = '';
        this.wardCode = '';
        this.street = '';
        
        // Move to district level
        this.currentLevel = 'district';
        
        // Clear search
        const searchInput = document.getElementById('addressSearchInput');
        if (searchInput) searchInput.value = '';
        
        this.renderList();
        this.updateBreadcrumb();
        this.updateSelectedAddressDisplay();
        this.emitChange();
    }
    
    /**
     * Select district
     */
    selectDistrict(code) {
        const districts = addressService.getDistricts(this.provinceCode);
        this.selectedDistrict = districts.find(d => d.code === code);
        this.districtCode = code;
        
        // Reset lower levels
        this.selectedWard = null;
        this.wardCode = '';
        this.street = '';
        
        // Move to ward level
        this.currentLevel = 'ward';
        
        // Clear search
        const searchInput = document.getElementById('addressSearchInput');
        if (searchInput) searchInput.value = '';
        
        this.renderList();
        this.updateBreadcrumb();
        this.updateSelectedAddressDisplay();
        this.emitChange();
    }
    
    /**
     * Select ward
     */
    selectWard(code) {
        const wards = addressService.getWards(this.provinceCode, this.districtCode);
        this.selectedWard = wards.find(w => w.code === code);
        this.wardCode = code;
        
        // Hide address box
        const addressBox = document.querySelector('.address-box');
        if (addressBox) addressBox.classList.add('hidden');
        
        // Update selected address summary with clickable breadcrumb and edit icons
        const summary = document.getElementById('selectedAddressSummary');
        if (summary && this.selectedProvince && this.selectedDistrict && this.selectedWard) {
            summary.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="summary-icon">
                    <path fill-rule="evenodd" d="m11.54 22.351.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clip-rule="evenodd" />
                </svg>
                <span class="summary-breadcrumb">
                    <span class="summary-address-group">
                        <span class="summary-breadcrumb-item">${this.escapeHtml(this.selectedProvince.name)}</span>
                        <button class="summary-edit-icon" data-level="province" title="Đổi Tỉnh/Thành phố">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32L19.513 8.2Z" />
                            </svg>
                        </button>
                    </span>
                    <span class="summary-separator">›</span>
                    <span class="summary-address-group">
                        <span class="summary-breadcrumb-item">${this.escapeHtml(this.selectedDistrict.name)}</span>
                        <button class="summary-edit-icon" data-level="district" title="Đổi Quận/Huyện">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32L19.513 8.2Z" />
                            </svg>
                        </button>
                    </span>
                    <span class="summary-separator">›</span>
                    <span class="summary-address-group">
                        <span class="summary-breadcrumb-item">${this.escapeHtml(this.selectedWard.name)}</span>
                        <button class="summary-edit-icon" data-level="ward" title="Đổi Phường/Xã">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712ZM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32L19.513 8.2Z" />
                            </svg>
                        </button>
                    </span>
                </span>
            `;
        }
        
        // Show street section
        const streetSection = document.getElementById('streetSection');
        const streetInput = document.getElementById('streetInput');
        if (streetSection) streetSection.classList.remove('hidden');
        if (streetInput) {
            setTimeout(() => streetInput.focus(), 100);
        }
        
        this.emitChange();
    }

    
    /**
     * Filter items by search query
     */
    filterItems(items, query) {
        if (!query || query.trim() === '') {
            return items;
        }
        
        const normalized = this.normalizeText(query);
        return items.filter(item => {
            const itemName = this.normalizeText(item.name);
            return itemName.includes(normalized);
        });
    }
    
    /**
     * Normalize text for search (remove diacritics, lowercase)
     */
    normalizeText(text) {
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'd');
    }
    
    /**
     * Debounce search
     */
    debounceSearch(level, callback) {
        if (this.searchTimers[level]) {
            clearTimeout(this.searchTimers[level]);
        }
        
        this.searchTimers[level] = setTimeout(callback, 200);
    }
    
    /**
     * Emit change event
     */
    emitChange() {
        const event = new CustomEvent('addressChange', {
            detail: {
                provinceCode: this.provinceCode,
                districtCode: this.districtCode,
                wardCode: this.wardCode,
                street: this.street,
                provinceName: this.selectedProvince?.name || '',
                districtName: this.selectedDistrict?.name || '',
                wardName: this.selectedWard?.name || '',
                fullAddress: this.getFullAddress(),
                isComplete: this.isComplete()
            }
        });
        
        document.dispatchEvent(event);
    }
    
    /**
     * Get full address string
     */
    getFullAddress() {
        const parts = [];
        
        if (this.street) parts.push(this.street);
        if (this.selectedWard) parts.push(this.selectedWard.name);
        if (this.selectedDistrict) parts.push(this.selectedDistrict.name);
        if (this.selectedProvince) parts.push(this.selectedProvince.name);
        
        return parts.join(', ');
    }
    
    /**
     * Check if address is complete
     */
    isComplete() {
        return !!(this.provinceCode && this.districtCode && this.wardCode && this.street);
    }
    
    /**
     * Get selected address data
     */
    getAddress() {
        return {
            provinceCode: this.provinceCode,
            districtCode: this.districtCode,
            wardCode: this.wardCode,
            street: this.street,
            provinceName: this.selectedProvince?.name || '',
            districtName: this.selectedDistrict?.name || '',
            wardName: this.selectedWard?.name || '',
            fullAddress: this.getFullAddress(),
            isComplete: this.isComplete()
        };
    }
    
    /**
     * Set address (for editing)
     */
    setAddress(address) {
        if (address.provinceCode) {
            this.selectProvince(address.provinceCode);
        }
        
        if (address.districtCode) {
            setTimeout(() => {
                this.selectDistrict(address.districtCode);
            }, 100);
        }
        
        if (address.wardCode) {
            setTimeout(() => {
                this.selectWard(address.wardCode);
            }, 200);
        }
        
        if (address.street) {
            setTimeout(() => {
                this.street = address.street;
                const streetInput = document.getElementById('streetInput');
                if (streetInput) {
                    streetInput.value = address.street;
                }
            }, 300);
        }
    }
    
    /**
     * Reset selector
     */
    reset() {
        this.provinceCode = '';
        this.districtCode = '';
        this.wardCode = '';
        this.street = '';
        this.selectedProvince = null;
        this.selectedDistrict = null;
        this.selectedWard = null;
        this.provinceSearch = '';
        this.districtSearch = '';
        this.wardSearch = '';
        
        this.render();
    }
    
    /**
     * Escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Destroy selector
     */
    destroy() {
        const container = document.getElementById(this.containerId);
        if (container) {
            container.innerHTML = '';
        }
        
        // Clear timers
        Object.values(this.searchTimers).forEach(timer => clearTimeout(timer));
    }
}

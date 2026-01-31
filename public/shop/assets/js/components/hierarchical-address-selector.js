// ============================================
// HIERARCHICAL ADDRESS SELECTOR WITH SEARCH
// ============================================

import { addressService } from '../shared/services/address.service.js';

/**
 * Hierarchical Address Selector with Smart Search
 * Allows users to search and select province > district > ward in one unified dropdown
 */
export class HierarchicalAddressSelector {
    constructor(containerId) {
        this.containerId = containerId;
        this.provinceCode = '';
        this.districtCode = '';
        this.wardCode = '';
        this.street = '';
        
        // Search state
        this.searchQuery = '';
        this.isDropdownOpen = false;
        this.currentLevel = 'province'; // 'province' | 'district' | 'ward'
        this.selectedProvince = null;
        this.selectedDistrict = null;
        this.selectedWard = null;
        
        // Normalized data for fast search
        this.normalizedData = null;
        
        // Debounce timer
        this.searchDebounceTimer = null;
        
        // Single flag for preventing dropdown close during interactions
        this.isInteracting = false;
        
        // Touch tracking for scroll prevention
        this.lastTouchY = null;
        
        // Keyboard navigation
        this.focusedIndex = -1;
        this.resultItems = [];
        
        // Event listeners for cleanup
        this.boundHandlers = {
            handleClickOutside: null
        };
        
        // Constants
        this.DEBOUNCE_DELAY = 150;
        this.MAX_RESULTS = 50;
        this.SCROLL_OFFSET = 80;
        this.KEYBOARD_DELAY = 300;
        this.FOCUS_DELAY = 50;
        
        // SVG icon template
        this.LOCATION_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="m11.54 22.351.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clip-rule="evenodd" /></svg>';
        this.CLOSE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" /></svg>';
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
            
            this.prepareNormalizedData();
            this.render();
            this.setupEventListeners();
            
            console.log('✅ HierarchicalAddressSelector initialized');
        } catch (error) {
            console.error('❌ Error initializing HierarchicalAddressSelector:', error);
            
            // Show error in UI
            const container = document.getElementById(this.containerId);
            if (container) {
                container.innerHTML = '<div style="padding: 1rem; color: #f44336; background: #ffebee; border-radius: 8px; text-align: center;">' +
                    '<strong>⚠️ Lỗi tải dữ liệu địa chỉ</strong><br>' +
                    '<small>' + error.message + '</small>' +
                    '</div>';
            }
            
            throw error;
        }
    }
    
    /**
     * Prepare normalized data for fast searching
     * Pre-process all text to lowercase and remove diacritics
     */
    prepareNormalizedData() {
        const provinces = addressService.getProvinces();
        
        if (!provinces || provinces.length === 0) {
            console.warn('⚠️ No provinces data available');
            this.normalizedData = [];
            return;
        }
        
        this.normalizedData = provinces.map(province => {
            const districts = addressService.getDistricts(province.code).map(district => {
                const wards = addressService.getWards(province.code, district.code).map(ward => ({
                    code: ward.code,
                    name: ward.nameWithType,
                    normalizedName: this.normalizeText(ward.nameWithType),
                    level: 'ward'
                }));
                
                return {
                    code: district.code,
                    name: district.nameWithType,
                    normalizedName: this.normalizeText(district.nameWithType),
                    wards: wards,
                    level: 'district'
                };
            });
            
            return {
                code: province.code,
                name: province.nameWithType,
                normalizedName: this.normalizeText(province.nameWithType),
                districts: districts,
                level: 'province'
            };
        });
        
        console.log('✅ Normalized address data prepared:', this.normalizedData.length, 'provinces');
    }
    
    /**
     * Normalize text for searching (remove diacritics, lowercase)
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
     * Render component
     */
    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;
        
        let html = '<div class="hierarchical-address-selector">';
        
        // Chips + Selector button wrapper (with dropdown inside for proper positioning)
        html += '<div class="address-chips-wrapper">';
        
        // Clickable selector area (not an input)
        html += '<div class="address-selector-display" id="addressSelectorDisplay" role="button" tabindex="0" aria-haspopup="listbox" aria-expanded="false">';
        html += '<div class="address-chips" id="addressChips">';
        html += '<span class="address-placeholder">📍 Chọn địa chỉ giao hàng</span>';
        html += '</div>';
        html += '<svg class="address-dropdown-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">';
        html += '<path fill-rule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clip-rule="evenodd" />';
        html += '</svg>';
        html += '</div>';
        
        // Dropdown results (inside chips-wrapper for proper positioning)
        html += '<div class="address-dropdown hidden" id="addressDropdown" role="listbox">';
        
        // Search input inside dropdown
        html += '<div class="address-dropdown-search">';
        html += '<svg class="search-icon-inside" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">';
        html += '<path fill-rule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" clip-rule="evenodd" />';
        html += '</svg>';
        html += '<input type="text" ';
        html += 'class="address-search-input" ';
        html += 'id="addressSearchInput" ';
        html += 'placeholder="Tìm nhanh địa chỉ..." ';
        html += 'autocomplete="off">';
        html += '</div>';
        
        html += '<div class="address-dropdown-content" id="addressDropdownContent">';
        html += '<!-- Results will be rendered here -->';
        html += '</div>';
        html += '</div>';
        
        html += '</div>'; // Close address-chips-wrapper
        
        // Street input (shown after ward selection)
        html += '<div class="address-street-wrapper hidden" id="addressStreetWrapper">';
        html += '<input type="text" ';
        html += 'class="checkout-form-input" ';
        html += 'id="streetInput" ';
        html += 'placeholder="Nhập số nhà, tên đường" ';
        html += 'aria-label="Số nhà, tên đường">';
        html += '</div>';
        
        // Full address display
        html += '<div class="address-display hidden" id="addressDisplay" role="status" aria-live="polite">';
        html += '<div class="address-display-label">📍 Địa chỉ đầy đủ:</div>';
        html += '<div class="address-display-text">Vui lòng chọn địa chỉ</div>';
        html += '</div>';
        
        html += '</div>';
        
        container.innerHTML = html;
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        const selectorDisplay = document.getElementById('addressSelectorDisplay');
        const searchInput = document.getElementById('addressSearchInput');
        const streetInput = document.getElementById('streetInput');
        const dropdown = document.getElementById('addressDropdown');
        
        // Selector display click - open dropdown
        if (selectorDisplay) {
            selectorDisplay.addEventListener('click', () => {
                this.scrollInputIntoView();
                this.performSearch();
                this.openDropdown();
            });
            
            // Keyboard support
            selectorDisplay.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.scrollInputIntoView();
                    this.performSearch();
                    this.openDropdown();
                }
            });
        }
        
        // Search input inside dropdown
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearchInput(e.target.value);
            });
            
            searchInput.addEventListener('focus', () => {
                this.performSearch();
            });
            
            // Keyboard navigation
            searchInput.addEventListener('keydown', (e) => {
                this.handleKeyboardNavigation(e);
            });
        }
        
        // Event delegation for chip removal
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
        
        // Street input
        if (streetInput) {
            streetInput.addEventListener('input', (e) => {
                this.street = e.target.value.trim();
                this.updateFullAddress();
            });
        }
        
        // Event delegation for dropdown clicks
        if (dropdown) {
            const dropdownContent = dropdown.querySelector('.address-dropdown-content');
            
            dropdown.addEventListener('click', (e) => {
                const target = e.target.closest('[data-action]');
                if (!target) return;
                
                const action = target.dataset.action;
                const code = target.dataset.code;
                const level = target.dataset.level;
                
                if (action === 'select-province') {
                    this.selectProvince(code);
                } else if (action === 'select-district') {
                    this.selectDistrict(code);
                } else if (action === 'select-ward') {
                    this.selectWard(code);
                } else if (action === 'goto-level') {
                    this.goToLevel(level);
                } else if (action === 'select-result') {
                    this.selectResult(target);
                }
            });
            
            // Prevent scroll propagation - Improved approach
            if (dropdownContent) {
                let touchStartY = 0;
                let touchStartScrollTop = 0;
                
                dropdownContent.addEventListener('touchstart', (e) => {
                    this.isInteracting = true;
                    touchStartY = e.touches[0].clientY;
                    touchStartScrollTop = dropdownContent.scrollTop;
                }, { passive: true });
                
                dropdownContent.addEventListener('touchmove', (e) => {
                    const touchY = e.touches[0].clientY;
                    const touchDelta = touchY - touchStartY;
                    const scrollTop = dropdownContent.scrollTop;
                    const scrollHeight = dropdownContent.scrollHeight;
                    const clientHeight = dropdownContent.clientHeight;
                    
                    // Check if content is scrollable
                    const isScrollable = scrollHeight > clientHeight;
                    
                    if (!isScrollable) {
                        // Not scrollable - prevent all scrolling
                        e.preventDefault();
                        return;
                    }
                    
                    // Calculate if we're at boundaries
                    const isAtTop = scrollTop <= 0;
                    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;
                    
                    // Prevent scroll propagation at boundaries
                    const isScrollingUp = touchDelta > 0;
                    const isScrollingDown = touchDelta < 0;
                    
                    if ((isAtTop && isScrollingUp) || (isAtBottom && isScrollingDown)) {
                        e.preventDefault();
                    }
                }, { passive: false });
                
                dropdownContent.addEventListener('touchend', () => {
                    setTimeout(() => this.isInteracting = false, 100);
                }, { passive: true });
                
                dropdownContent.addEventListener('touchcancel', () => {
                    setTimeout(() => this.isInteracting = false, 100);
                }, { passive: true });
            }
        }
        
        // Click outside to close dropdown
        this.boundHandlers.handleClickOutside = (e) => {
            if (this.isInteracting) return;
            
            const wrapper = document.querySelector('.hierarchical-address-selector');
            if (wrapper && !wrapper.contains(e.target)) {
                this.closeDropdown();
            }
        };
        document.addEventListener('click', this.boundHandlers.handleClickOutside);
    }
    
    /**
     * Scroll input into view for better visibility on mobile
     */
    scrollInputIntoView() {
        const searchInput = document.getElementById('addressSearchInput');
        if (!searchInput) return;
        
        setTimeout(() => {
            const chipsWrapper = searchInput.closest('.address-chips-wrapper');
            if (!chipsWrapper) return;
            
            // Check if we're inside a modal
            const modal = chipsWrapper.closest('.quick-checkout-modal');
            
            if (modal) {
                // Inside modal - scroll the modal body to bring input to top
                const modalBody = modal.querySelector('.quick-checkout-body');
                const modalHeader = modal.querySelector('.quick-checkout-header');
                
                if (modalBody) {
                    // Find the parent form group
                    const formGroup = chipsWrapper.closest('.checkout-form-group');
                    if (formGroup) {
                        // Get offsetTop of form group relative to modal body
                        let offsetTop = 0;
                        let element = formGroup;
                        
                        // Calculate total offset from modal body
                        while (element && element !== modalBody) {
                            offsetTop += element.offsetTop;
                            element = element.offsetParent;
                        }
                        
                        // Get header height to avoid being covered
                        const headerHeight = modalHeader ? modalHeader.offsetHeight : 0;
                        
                        // Scroll to position: offsetTop - headerHeight - small padding (10px)
                        // This ensures input appears right below the header
                        modalBody.scrollTo({ 
                            top: Math.max(0, offsetTop - headerHeight - 10), 
                            behavior: 'smooth' 
                        });
                    }
                }
            } else {
                // Not in modal - scroll the window (cart page)
                const elementPosition = chipsWrapper.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - this.SCROLL_OFFSET;
                
                window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
            }
        }, this.KEYBOARD_DELAY);
    }
    
    /**
     * Cleanup event listeners
     */
    cleanup() {
        if (this.boundHandlers.handleClickOutside) {
            document.removeEventListener('click', this.boundHandlers.handleClickOutside);
        }
        
        clearTimeout(this.searchDebounceTimer);
        
        // Unlock body scroll if it was locked
        this.unlockBodyScroll();
    }
    
    /**
     * Handle keyboard navigation
     */
    handleKeyboardNavigation(e) {
        if (!this.isDropdownOpen) return;
        
        const items = document.querySelectorAll('.address-list-item, .address-result-item');
        this.resultItems = Array.from(items);
        
        switch(e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.focusedIndex = Math.min(this.focusedIndex + 1, this.resultItems.length - 1);
                this.updateFocusedItem();
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                this.focusedIndex = Math.max(this.focusedIndex - 1, -1);
                this.updateFocusedItem();
                break;
                
            case 'Enter':
                e.preventDefault();
                if (this.focusedIndex >= 0 && this.resultItems[this.focusedIndex]) {
                    this.resultItems[this.focusedIndex].click();
                }
                break;
                
            case 'Escape':
                e.preventDefault();
                this.closeDropdown();
                break;
        }
    }
    
    /**
     * Update focused item visual
     */
    updateFocusedItem() {
        // Remove previous focus
        this.resultItems.forEach(item => item.classList.remove('keyboard-focused'));
        
        // Add focus to current item
        if (this.focusedIndex >= 0 && this.resultItems[this.focusedIndex]) {
            const item = this.resultItems[this.focusedIndex];
            item.classList.add('keyboard-focused');
            
            // Scroll into view if needed
            item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }
    
    /**
     * Handle search input with debounce
     */
    handleSearchInput(query) {
        this.searchQuery = query.trim();
        
        // Debounce search
        clearTimeout(this.searchDebounceTimer);
        this.searchDebounceTimer = setTimeout(() => {
            this.performSearch();
        }, this.DEBOUNCE_DELAY);
    }
    
    /**
     * Reset state helper
     */
    resetState(level) {
        const levels = { province: 0, district: 1, ward: 2 };
        const resetLevel = levels[level];
        
        if (resetLevel <= 0) {
            this.provinceCode = '';
            this.selectedProvince = null;
        }
        if (resetLevel <= 1) {
            this.districtCode = '';
            this.selectedDistrict = null;
        }
        if (resetLevel <= 2) {
            this.wardCode = '';
            this.selectedWard = null;
        }
        
        this.currentLevel = level;
        this.searchQuery = '';
        this.hideStreetInput();
        this.updateChipsDisplay();
        this.updateFullAddress();
    }
    
    /**
     * Delete a specific level
     */
    deleteLevel(level) {
        this.resetState(level);
        
        const searchInput = document.getElementById('addressSearchInput');
        if (!searchInput) return;
        
        searchInput.value = '';
        this.renderList(level);
        this.openDropdown();
        setTimeout(() => searchInput.focus(), this.FOCUS_DELAY);
    }
    
    /**
     * Render list based on level
     */
    renderList(level) {
        const renderMap = {
            province: () => this.renderProvinces(),
            district: () => this.renderDistricts(),
            ward: () => this.renderWards()
        };
        renderMap[level]?.();
    }
    
    /**
     * Perform search and render results
     */
    performSearch() {
        this.openDropdown();
        this.focusedIndex = -1;
        
        if (!this.searchQuery) {
            this.renderList(this.currentLevel);
            return;
        }
        
        const results = this.searchAddresses(this.normalizeText(this.searchQuery));
        this.renderSearchResults(results);
    }
    
    /**
     * Search addresses across all levels (context-aware)
     */
    searchAddresses(normalizedQuery) {
        const results = [];
        
        // Context-aware search based on current level
        if (this.currentLevel === 'province') {
            // Only search provinces
            for (const province of this.normalizedData) {
                if (this.matchText(province.normalizedName, normalizedQuery)) {
                    results.push({
                        type: 'province',
                        province: province,
                        matchLevel: 'province',
                        score: this.calculateScore(province.normalizedName, normalizedQuery)
                    });
                    
                    if (results.length >= this.MAX_RESULTS) break;
                }
            }
        } else if (this.currentLevel === 'district' && this.selectedProvince) {
            // Only search districts within selected province
            for (const district of this.selectedProvince.districts) {
                if (this.matchText(district.normalizedName, normalizedQuery)) {
                    results.push({
                        type: 'district',
                        province: this.selectedProvince,
                        district: district,
                        matchLevel: 'district',
                        score: this.calculateScore(district.normalizedName, normalizedQuery)
                    });
                    
                    if (results.length >= this.MAX_RESULTS) break;
                }
            }
        } else if (this.currentLevel === 'ward' && this.selectedDistrict) {
            // Only search wards within selected district
            for (const ward of this.selectedDistrict.wards) {
                if (this.matchText(ward.normalizedName, normalizedQuery)) {
                    results.push({
                        type: 'ward',
                        province: this.selectedProvince,
                        district: this.selectedDistrict,
                        ward: ward,
                        matchLevel: 'ward',
                        score: this.calculateScore(ward.normalizedName, normalizedQuery)
                    });
                    
                    if (results.length >= this.MAX_RESULTS) break;
                }
            }
        }
        
        // Sort by score (higher is better)
        results.sort((a, b) => b.score - a.score);
        
        return results;
    }
    
    /**
     * Match text - Optimized Vietnamese-aware matching
     */
    matchText(text, query) {
        // For very short queries (1 char), allow anywhere match
        if (query.length === 1) {
            return text.includes(query);
        }
        
        // For 2-char queries, prefer word start but allow anywhere
        if (query.length === 2) {
            const words = text.split(' ');
            // Check if any word starts with query
            for (const word of words) {
                if (word.startsWith(query)) return true;
            }
            // Fallback: allow anywhere match
            return text.includes(query);
        }
        
        // For longer queries (3+ chars), use smart syllable matching
        const words = text.split(' ');
        
        // Check if query matches start of any complete word
        for (const word of words) {
            if (word === query) {
                return true; // Exact match
            }
            
            if (word.startsWith(query)) {
                const remaining = word.substring(query.length);
                
                // If remaining is empty, it's exact match
                if (remaining === '') return true;
                
                // If remaining starts with a vowel, it's likely part of same syllable
                // Vietnamese syllables: consonant + vowel + (optional consonant)
                // So "ha" + "i" = "hai" (one syllable) - should NOT match
                // But "ha" + " " + "noi" = two syllables - should match
                const vowels = ['a', 'e', 'i', 'o', 'u', 'y'];
                if (vowels.includes(remaining[0])) {
                    continue; // Skip this match, it's part of same syllable
                }
                
                // Otherwise it's a valid match
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Calculate match score - Improved scoring
     * Higher score = better match
     */
    calculateScore(text, query) {
        const words = text.split(' ');
        
        // Exact match = highest score
        if (text === query) return 1000;
        
        // First word exact match = very high score
        if (words[0] === query) return 500;
        
        // Starts with query = high score
        if (text.startsWith(query)) {
            // Bonus for shorter text (more specific)
            return 100 + (100 / text.length);
        }
        
        // Any word starts with query = medium-high score
        for (let i = 0; i < words.length; i++) {
            if (words[i].startsWith(query)) {
                // Earlier words get higher score
                return 70 - (i * 5);
            }
        }
        
        // Contains query = medium score
        if (text.includes(query)) {
            // Bonus for position (earlier is better)
            const position = text.indexOf(query);
            return 50 - (position / text.length * 20);
        }
        
        // Fallback
        return 10;
    }
    
    /**
     * Render search results
     */
    renderSearchResults(results) {
        const content = document.getElementById('addressDropdownContent');
        if (!content) return;
        
        if (results.length === 0) {
            content.innerHTML = '<div class="address-dropdown-empty">Không tìm thấy địa chỉ phù hợp</div>';
            return;
        }
        
        // Determine header based on current level
        let header = 'Kết quả tìm kiếm';
        if (this.currentLevel === 'province') {
            header = 'Chọn Tỉnh/Thành phố';
        } else if (this.currentLevel === 'district') {
            header = 'Chọn Quận/Huyện';
        } else if (this.currentLevel === 'ward') {
            header = 'Chọn Phường/Xã';
        }
        
        let html = `<div class="address-dropdown-header">${header}</div>`;
        html += '<div class="address-dropdown-results">';
        
        results.forEach(result => {
            html += this.renderResultItem(result);
        });
        
        html += '</div>';
        
        content.innerHTML = html;
    }
    
    /**
     * Render a single result item
     */
    renderResultItem(result) {
        const { type, province, district, ward } = result;
        const datasets = `data-action="select-result" data-type="${type}" data-province="${province.code}"${district ? ` data-district="${district.code}"` : ''}${ward ? ` data-ward="${ward.code}"` : ''}`;
        
        const mainText = type === 'province' ? province.name : (type === 'district' ? district.name : ward.name);
        const subText = type === 'district' ? province.name : (type === 'ward' ? `${district.name}, ${province.name}` : '');
        
        return `<div class="address-result-item" role="option" tabindex="-1" ${datasets}>
            <span class="result-icon" aria-hidden="true">${this.LOCATION_ICON}</span>
            <div class="result-content">
                <div class="result-main">${this.highlightMatch(mainText, this.searchQuery)}</div>
                ${subText ? `<div class="result-sub">${subText}</div>` : ''}
            </div>
            ${type !== 'ward' ? '<span class="result-arrow" aria-hidden="true">›</span>' : ''}
        </div>`;
    }
    
    /**
     * Highlight matching text
     */
    highlightMatch(text, query) {
        if (!query) return text;
        
        const normalizedText = this.normalizeText(text);
        const normalizedQuery = this.normalizeText(query);
        const index = normalizedText.indexOf(normalizedQuery);
        
        if (index === -1) return text;
        
        const before = text.substring(0, index);
        const match = text.substring(index, index + query.length);
        const after = text.substring(index + query.length);
        
        return before + '<mark>' + match + '</mark>' + after;
    }
    
    /**
     * Select a result item
     */
    selectResult(element) {
        const type = element.dataset.type;
        const provinceCode = element.dataset.province;
        const districtCode = element.dataset.district;
        const wardCode = element.dataset.ward;
        
        if (type === 'province') {
            this.selectProvince(provinceCode);
        } else if (type === 'district') {
            this.selectProvince(provinceCode);
            setTimeout(() => this.selectDistrict(districtCode), 100);
        } else if (type === 'ward') {
            this.selectProvince(provinceCode);
            setTimeout(() => {
                this.selectDistrict(districtCode);
                setTimeout(() => this.selectWard(wardCode), 100);
            }, 100);
        }
    }
    
    /**
     * Select address level
     */
    selectLevel(level, code) {
        this.isInteracting = true;
        
        if (level === 'province') {
            this.provinceCode = code;
            this.selectedProvince = this.normalizedData.find(p => p.code === code);
            this.currentLevel = 'district';
            this.districtCode = '';
            this.wardCode = '';
            this.selectedDistrict = null;
            this.selectedWard = null;
            this.updateChipsDisplay();
            this.renderDistricts();
        } else if (level === 'district') {
            this.districtCode = code;
            this.selectedDistrict = this.selectedProvince?.districts.find(d => d.code === code);
            this.currentLevel = 'ward';
            this.wardCode = '';
            this.selectedWard = null;
            this.updateChipsDisplay();
            this.renderWards();
        } else if (level === 'ward') {
            this.wardCode = code;
            this.selectedWard = this.selectedDistrict?.wards.find(w => w.code === code);
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
    selectDistrict(code) { this.selectLevel('district', code); }
    selectWard(code) { this.selectLevel('ward', code); }
    
    /**
     * Render generic list (provinces/districts/wards)
     */
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
        
        if (action !== 'select-province') this.openDropdown();
    }
    
    renderProvinces() {
        this.renderGenericList(this.normalizedData, 'Chọn Tỉnh/Thành phố', 'select-province');
    }
    
    renderDistricts() {
        if (!this.selectedProvince) return;
        this.renderGenericList(this.selectedProvince.districts, 'Chọn Quận/Huyện', 'select-district');
    }
    
    renderWards() {
        if (!this.selectedDistrict) return;
        this.renderGenericList(this.selectedDistrict.wards, 'Chọn Phường/Xã', 'select-ward');
    }
    
    /**
     * Update chips display
     */
    updateChipsDisplay() {
        const chipsContainer = document.getElementById('addressChips');
        const placeholder = chipsContainer?.querySelector('.address-placeholder');
        
        if (!chipsContainer) return;
        
        const chips = [];
        const levels = [
            { selected: this.selectedProvince, prefix: ['Tỉnh ', 'Thành phố '], replace: 'TP ', level: 'province' },
            { selected: this.selectedDistrict, prefix: ['Quận ', 'Huyện ', 'Thành phố ', 'Thị xã '], replace: ['Q.', 'H.', 'TP ', 'TX '], level: 'district' },
            { selected: this.selectedWard, prefix: ['Phường ', 'Xã ', 'Thị trấn '], replace: ['P.', 'X.', 'TT '], level: 'ward' }
        ];
        
        levels.forEach(({ selected, prefix, replace, level }) => {
            if (!selected) return;
            let shortName = selected.name;
            prefix.forEach((p, i) => {
                shortName = shortName.replace(p, Array.isArray(replace) ? replace[i] : replace);
            });
            chips.push(`<div class="address-chip" data-level="${level}">
                <span class="chip-text">${shortName}</span>
                <button class="chip-remove" data-action="remove-chip" data-level="${level}" aria-label="Xóa ${shortName}">
                    ${this.CLOSE_ICON}
                </button>
            </div>`);
        });
        
        // Show/hide placeholder based on chips
        if (chips.length > 0) {
            chipsContainer.innerHTML = chips.join('');
        } else {
            chipsContainer.innerHTML = '<span class="address-placeholder">📍 Chọn địa chỉ giao hàng</span>';
        }
    }
    
    /**
     * Navigate to a specific level (unused - can be removed if not needed)
     */
    goToLevel(level) {
        const resetMap = {
            province: () => {
                this.districtCode = '';
                this.wardCode = '';
                this.selectedDistrict = null;
                this.selectedWard = null;
                this.currentLevel = 'district';
                this.renderDistricts();
            },
            district: () => {
                this.wardCode = '';
                this.selectedWard = null;
                this.currentLevel = 'ward';
                this.renderWards();
            }
        };
        
        resetMap[level]?.();
        this.updateChipsDisplay();
        this.updateFullAddress();
        this.hideStreetInput();
    }
    
    /**
     * Show street input
     */
    showStreetInput() {
        const wrapper = document.getElementById('addressStreetWrapper');
        if (wrapper) {
            wrapper.classList.remove('hidden');
        }
    }
    
    /**
     * Hide street input
     */
    hideStreetInput() {
        const wrapper = document.getElementById('addressStreetWrapper');
        const streetInput = document.getElementById('streetInput');
        
        if (wrapper) {
            wrapper.classList.add('hidden');
        }
        
        if (streetInput) {
            streetInput.value = '';
            this.street = '';
        }
    }
    
    /**
     * Update full address display
     */
    updateFullAddress() {
        const display = document.getElementById('addressDisplay');
        if (!display) return;
        
        const fullAddress = addressService.getFullAddress(
            this.provinceCode,
            this.districtCode,
            this.wardCode,
            this.street
        );
        
        const textElement = display.querySelector('.address-display-text');
        if (textElement) {
            textElement.textContent = fullAddress || 'Vui lòng chọn địa chỉ';
        }
        
        if (this.provinceCode) {
            display.classList.remove('hidden');
        } else {
            display.classList.add('hidden');
        }
    }
    
    /**
     * Open dropdown
     */
    openDropdown() {
        const dropdown = document.getElementById('addressDropdown');
        const searchInput = document.getElementById('addressSearchInput');
        const selectorDisplay = document.getElementById('addressSelectorDisplay');
        
        if (dropdown) {
            dropdown.classList.remove('hidden');
            this.isDropdownOpen = true;
            
            // Lock body scroll to prevent scroll propagation (only on mobile)
            if (window.innerWidth <= 768) {
                this.lockBodyScroll();
            }
        }
        
        if (searchInput) {
            searchInput.setAttribute('aria-expanded', 'true');
        }
        
        if (selectorDisplay) {
            selectorDisplay.setAttribute('aria-expanded', 'true');
        }
    }
    
    /**
     * Close dropdown
     */
    closeDropdown() {
        const dropdown = document.getElementById('addressDropdown');
        const searchInput = document.getElementById('addressSearchInput');
        const selectorDisplay = document.getElementById('addressSelectorDisplay');
        
        if (dropdown) {
            dropdown.classList.add('hidden');
            this.isDropdownOpen = false;
            
            // Unlock body scroll
            this.unlockBodyScroll();
        }
        
        if (searchInput) {
            searchInput.setAttribute('aria-expanded', 'false');
        }
        
        if (selectorDisplay) {
            selectorDisplay.setAttribute('aria-expanded', 'false');
        }
        
        this.focusedIndex = -1;
    }
    
    /**
     * Lock body scroll (prevent page scroll when dropdown is open)
     */
    lockBodyScroll() {
        // Check if we're in a modal (modal already locks body)
        const modal = document.querySelector('.quick-checkout-modal');
        if (modal && !modal.classList.contains('hidden')) {
            // In modal - don't lock body, it's already locked
            return;
        }
        
        // Simple overflow hidden approach (no position fixed to avoid layout issues)
        document.body.style.overflow = 'hidden';
        document.body.style.touchAction = 'none';
    }
    
    /**
     * Unlock body scroll
     */
    unlockBodyScroll() {
        // Check if we're in a modal
        const modal = document.querySelector('.quick-checkout-modal');
        if (modal && !modal.classList.contains('hidden')) {
            // In modal - don't unlock body
            return;
        }
        
        // Unlock body
        document.body.style.overflow = '';
        document.body.style.touchAction = '';
    }
    
    /**
     * Clear search (unused - can be removed)
     */
    clearSearch() {
        const searchInput = document.getElementById('addressSearchInput');
        if (searchInput) {
            searchInput.value = '';
            this.searchQuery = '';
            searchInput.focus();
        }
        this.renderList(this.currentLevel);
    }
    
    /**
     * Get address data
     */
    getAddressData() {
        return {
            provinceCode: this.provinceCode,
            provinceName: this.selectedProvince?.name || null,
            districtCode: this.districtCode,
            districtName: this.selectedDistrict?.name || null,
            wardCode: this.wardCode,
            wardName: this.selectedWard?.name || null,
            street: this.street,
            fullAddress: addressService.getFullAddress(
                this.provinceCode,
                this.districtCode,
                this.wardCode,
                this.street
            )
        };
    }
    
    /**
     * Validate address
     */
    validate() {
        if (!this.provinceCode) {
            return { isValid: false, message: 'Vui lòng chọn Tỉnh/Thành phố' };
        }
        if (!this.districtCode) {
            return { isValid: false, message: 'Vui lòng chọn Quận/Huyện' };
        }
        if (!this.wardCode) {
            return { isValid: false, message: 'Vui lòng chọn Phường/Xã' };
        }
        if (!this.street) {
            return { isValid: false, message: 'Vui lòng nhập số nhà, tên đường' };
        }
        return { isValid: true };
    }
    
    /**
     * Reset selector
     */
    reset() {
        this.provinceCode = '';
        this.districtCode = '';
        this.wardCode = '';
        this.street = '';
        this.searchQuery = '';
        this.currentLevel = 'province';
        this.selectedProvince = null;
        this.selectedDistrict = null;
        this.selectedWard = null;
        this.focusedIndex = -1;
        
        const searchInput = document.getElementById('addressSearchInput');
        const streetInput = document.getElementById('streetInput');
        const clearBtn = document.getElementById('addressSearchClear');
        
        if (searchInput) searchInput.value = '';
        if (streetInput) streetInput.value = '';
        
        this.updateChipsDisplay();
        this.hideStreetInput();
        this.closeDropdown();
        this.updateFullAddress();
    }
    
    /**
     * Destroy component and cleanup
     */
    destroy() {
        this.cleanup();
        
        const container = document.getElementById(this.containerId);
        if (container) {
            container.innerHTML = '';
        }
        
        // Clear references
        this.normalizedData = null;
        this.selectedProvince = null;
        this.selectedDistrict = null;
        this.selectedWard = null;
        this.resultItems = [];
    }
}

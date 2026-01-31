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
        this.DEBOUNCE_DELAY = 150;
        
        // Flag to prevent search when programmatically clearing input
        this.isSelecting = false;
        
        // Flag to prevent closing dropdown immediately after selection
        this.justSelected = false;
        
        // Flag to prevent closing dropdown when deleting chip
        this.isDeletingChip = false;
        
        // Keyboard navigation
        this.focusedIndex = -1;
        this.resultItems = [];
        
        // Event listeners for cleanup
        this.boundHandlers = {
            handleClickOutside: null,
            handleKeyDown: null
        };
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
        
        // Chips + Search input wrapper (with dropdown inside for proper positioning)
        html += '<div class="address-chips-wrapper">';
        html += '<div class="address-chips" id="addressChips"></div>';
        html += '<input type="text" ';
        html += 'class="address-search-input" ';
        html += 'id="addressSearchInput" ';
        html += 'placeholder="🔍 Tìm tỉnh/thành phố, quận/huyện, phường/xã..." ';
        html += 'autocomplete="off" ';
        html += 'role="combobox" ';
        html += 'aria-expanded="false" ';
        html += 'aria-controls="addressDropdown" ';
        html += 'aria-autocomplete="list">';
        
        // Dropdown results (inside chips-wrapper for proper positioning)
        html += '<div class="address-dropdown hidden" id="addressDropdown" role="listbox">';
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
        const searchInput = document.getElementById('addressSearchInput');
        const clearBtn = document.getElementById('addressSearchClear');
        const streetInput = document.getElementById('streetInput');
        const dropdown = document.getElementById('addressDropdown');
        
        // Search input
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearchInput(e.target.value);
            });
            
            searchInput.addEventListener('focus', () => {
                // Scroll input to top on mobile for better visibility
                this.scrollInputIntoView();
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
                    e.stopPropagation(); // Prevent event bubbling
                    this.isDeletingChip = true; // Set flag
                    const level = removeBtn.dataset.level;
                    this.deleteLevel(level);
                    
                    // Reset flag after event loop
                    setTimeout(() => {
                        this.isDeletingChip = false;
                    }, 100);
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
        }
        
        // Click outside to close dropdown
        this.boundHandlers.handleClickOutside = (e) => {
            // Ignore if we just selected something
            if (this.justSelected) return;
            
            // Ignore if we're deleting a chip
            if (this.isDeletingChip) return;
            
            const wrapper = document.querySelector('.hierarchical-address-selector');
            
            // Only close if click is truly outside the entire component
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
        
        // Small delay to ensure keyboard is shown
        setTimeout(() => {
            // Get the chips wrapper (parent of input)
            const chipsWrapper = searchInput.closest('.address-chips-wrapper');
            if (!chipsWrapper) return;
            
            // Calculate position to scroll to (with some offset from top)
            const offset = 80; // Space from top of viewport
            const elementPosition = chipsWrapper.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - offset;
            
            // Smooth scroll to position
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }, 300); // Wait for keyboard animation on mobile
    }
    
    /**
     * Cleanup event listeners
     */
    cleanup() {
        if (this.boundHandlers.handleClickOutside) {
            document.removeEventListener('click', this.boundHandlers.handleClickOutside);
        }
        
        clearTimeout(this.searchDebounceTimer);
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
        // Skip if we're in the middle of selecting
        if (this.isSelecting) return;
        
        // Extract search query from input (after the selected address part)
        const searchInput = document.getElementById('addressSearchInput');
        if (searchInput && searchInput.getAttribute('data-display-mode') === 'true') {
            // Get the base address text
            const baseAddress = this.getSelectedAddressText();
            const fullText = query;
            
            // Extract only the search part (after base address)
            if (fullText.startsWith(baseAddress)) {
                this.searchQuery = fullText.substring(baseAddress.length).trim();
            } else {
                this.searchQuery = query.trim();
            }
        } else {
            this.searchQuery = query.trim();
        }
        
        // Show/hide clear button
        const clearBtn = document.getElementById('addressSearchClear');
        if (clearBtn) {
            if (this.searchQuery) {
                clearBtn.classList.remove('hidden');
            } else {
                clearBtn.classList.add('hidden');
            }
        }
        
        // Debounce search
        clearTimeout(this.searchDebounceTimer);
        this.searchDebounceTimer = setTimeout(() => {
            this.performSearch();
        }, this.DEBOUNCE_DELAY);
    }
    
    /**
     * Handle click on delete (X) symbol
     */
    handleDeleteClick(text, clickPosition) {
        // Find all X positions
        const xPositions = [];
        for (let i = 0; i < text.length; i++) {
            if (text[i] === 'ⓧ') {
                xPositions.push({ pos: i, level: null });
            }
        }
        
        // Determine which level each X belongs to
        if (xPositions.length === 3) {
            // Province X / District X / Ward X
            xPositions[0].level = 'province';
            xPositions[1].level = 'district';
            xPositions[2].level = 'ward';
        } else if (xPositions.length === 2) {
            // Province X / District X
            xPositions[0].level = 'province';
            xPositions[1].level = 'district';
        } else if (xPositions.length === 1) {
            // Province X
            xPositions[0].level = 'province';
        }
        
        // Find which X was clicked (within 2 characters range)
        for (const xPos of xPositions) {
            if (Math.abs(clickPosition - xPos.pos) <= 2) {
                this.deleteLevel(xPos.level);
                return;
            }
        }
    }
    
    /**
     * Delete a specific level
     */
    deleteLevel(level) {
        if (level === 'province') {
            // Reset everything
            this.provinceCode = '';
            this.districtCode = '';
            this.wardCode = '';
            this.selectedProvince = null;
            this.selectedDistrict = null;
            this.selectedWard = null;
            this.currentLevel = 'province';
            this.street = '';
            this.searchQuery = '';
            
            this.hideStreetInput();
            this.updateChipsDisplay();
            this.updateFullAddress();
            
            // Open dropdown to select province
            const searchInput = document.getElementById('addressSearchInput');
            if (searchInput) {
                searchInput.value = '';
                this.renderProvinces();
                this.openDropdown();
                // Focus after a small delay to ensure dropdown is open
                setTimeout(() => searchInput.focus(), 50);
            }
        } else if (level === 'district') {
            // Keep province, reset district and ward
            this.districtCode = '';
            this.wardCode = '';
            this.selectedDistrict = null;
            this.selectedWard = null;
            this.currentLevel = 'district';
            this.searchQuery = '';
            
            this.hideStreetInput();
            this.updateChipsDisplay();
            this.updateFullAddress();
            
            // Open dropdown to select district
            const searchInput = document.getElementById('addressSearchInput');
            if (searchInput) {
                searchInput.value = '';
                this.renderDistricts();
                this.openDropdown();
                // Focus after a small delay to ensure dropdown is open
                setTimeout(() => searchInput.focus(), 50);
            }
        } else if (level === 'ward') {
            // Keep province and district, reset ward
            this.wardCode = '';
            this.selectedWard = null;
            this.currentLevel = 'ward';
            this.searchQuery = '';
            
            this.hideStreetInput();
            this.updateChipsDisplay();
            this.updateFullAddress();
            
            // Open dropdown to select ward
            const searchInput = document.getElementById('addressSearchInput');
            if (searchInput) {
                searchInput.value = '';
                this.renderWards();
                this.openDropdown();
                // Focus after a small delay to ensure dropdown is open
                setTimeout(() => searchInput.focus(), 50);
            }
        }
    }
    
    /**
     * Get selected address text for display with delete buttons
     */
    getSelectedAddressText() {
        let text = '';
        
        if (this.selectedWard) {
            text = `${this.selectedProvince.name} ⓧ / ${this.selectedDistrict.name} ⓧ / ${this.selectedWard.name} ⓧ`;
        } else if (this.selectedDistrict) {
            text = `${this.selectedProvince.name} ⓧ / ${this.selectedDistrict.name} ⓧ`;
        } else if (this.selectedProvince) {
            text = `${this.selectedProvince.name} ⓧ`;
        }
        
        return text;
    }
    
    /**
     * Perform search and render results
     */
    performSearch() {
        this.openDropdown();
        this.focusedIndex = -1; // Reset keyboard focus
        
        if (!this.searchQuery) {
            // Show appropriate list based on current level
            if (this.currentLevel === 'province') {
                this.renderProvinces();
            } else if (this.currentLevel === 'district') {
                this.renderDistricts();
            } else if (this.currentLevel === 'ward') {
                this.renderWards();
            }
            return;
        }
        
        const normalizedQuery = this.normalizeText(this.searchQuery);
        const results = this.searchAddresses(normalizedQuery);
        
        this.renderSearchResults(results);
    }
    
    /**
     * Search addresses across all levels (context-aware)
     */
    searchAddresses(normalizedQuery) {
        const results = [];
        const MAX_RESULTS = 50;
        
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
                    
                    if (results.length >= MAX_RESULTS) break;
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
                    
                    if (results.length >= MAX_RESULTS) break;
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
                    
                    if (results.length >= MAX_RESULTS) break;
                }
            }
        }
        
        // Sort by score (higher is better)
        results.sort((a, b) => b.score - a.score);
        
        return results;
    }
    
    /**
     * Match text - match complete syllables only (Vietnamese-aware)
     * This prevents "ha" from matching "hai" in "Hải Dương"
     */
    matchText(text, query) {
        // Split into words/syllables
        const words = text.split(' ');
        
        // Check if query matches start of any complete word
        for (const word of words) {
            // Only match if:
            // 1. Word starts with query AND
            // 2. Either word equals query OR next char is space/end (complete syllable match)
            if (word === query) {
                return true; // Exact match
            }
            if (word.startsWith(query)) {
                // Check if this is a complete syllable match
                // In Vietnamese, each syllable is separated by space
                // So "ha" should match "ha noi" but not "hai duong"
                // We need to check if the remaining part after query makes sense
                const remaining = word.substring(query.length);
                
                // If remaining is empty, it's exact match
                if (remaining === '') return true;
                
                // If remaining starts with a vowel, it's likely part of same syllable
                // Vietnamese syllables: consonant + vowel + (optional consonant)
                // So "ha" + "i" = "hai" (one syllable)
                // But "ha" + " " + "noi" = two syllables
                const vowels = ['a', 'e', 'i', 'o', 'u', 'y'];
                if (vowels.includes(remaining[0])) {
                    continue; // Skip this match, it's part of same syllable
                }
                
                // Otherwise it's a valid match (e.g., "han" matches "hanoi")
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Calculate match score
     * Higher score = better match
     */
    calculateScore(text, query) {
        // Exact match at start = highest score
        if (text.startsWith(query)) return 100;
        
        // Contains query = medium score
        if (text.includes(query)) return 50;
        
        // Fuzzy match = low score
        return 20;
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
        
        let html = '<div class="address-dropdown-results">';
        
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
        
        let html = '<div class="address-result-item" role="option" tabindex="-1" data-action="select-result" data-type="' + type + '" ';
        html += 'data-province="' + province.code + '" ';
        
        if (district) {
            html += 'data-district="' + district.code + '" ';
        }
        
        if (ward) {
            html += 'data-ward="' + ward.code + '" ';
        }
        
        html += '>';
        
        // Icon - same for all levels
        html += '<span class="result-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="m11.54 22.351.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clip-rule="evenodd" /></svg></span>';
        
        // Main text
        html += '<div class="result-content">';
        
        if (type === 'province') {
            html += '<div class="result-main">' + this.highlightMatch(province.name, this.searchQuery) + '</div>';
        } else if (type === 'district') {
            html += '<div class="result-main">' + this.highlightMatch(district.name, this.searchQuery) + '</div>';
            html += '<div class="result-sub">' + province.name + '</div>';
        } else {
            html += '<div class="result-main">' + this.highlightMatch(ward.name, this.searchQuery) + '</div>';
            html += '<div class="result-sub">' + district.name + ', ' + province.name + '</div>';
        }
        
        html += '</div>';
        
        // Arrow indicator
        if (type !== 'ward') {
            html += '<span class="result-arrow" aria-hidden="true">›</span>';
        }
        
        html += '</div>';
        
        return html;
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
     * Select province
     */
    selectProvince(code) {
        // Set flag to prevent closing dropdown
        this.justSelected = true;
        
        this.provinceCode = code;
        this.selectedProvince = this.normalizedData.find(p => p.code === code);
        this.currentLevel = 'district';
        
        // Clear district and ward
        this.districtCode = '';
        this.wardCode = '';
        this.selectedDistrict = null;
        this.selectedWard = null;
        
        // Update UI
        this.updateChipsDisplay();
        this.renderDistricts();
        this.updateFullAddress();
        
        // Hide clear button when showing selected address
        const clearBtn = document.getElementById('addressSearchClear');
        if (clearBtn) {
            clearBtn.classList.add('hidden');
        }
        
        // Reset flags after event loop completes
        setTimeout(() => {
            this.isSelecting = false;
            this.justSelected = false;
        }, 100);
    }
    
    /**
     * Select district
     */
    selectDistrict(code) {
        // Set flag to prevent closing dropdown
        this.justSelected = true;
        
        this.districtCode = code;
        this.selectedDistrict = this.selectedProvince?.districts.find(d => d.code === code);
        this.currentLevel = 'ward';
        
        // Clear ward
        this.wardCode = '';
        this.selectedWard = null;
        
        // Update UI
        this.updateChipsDisplay();
        this.renderWards();
        this.updateFullAddress();
        
        // Hide clear button when showing selected address
        const clearBtn = document.getElementById('addressSearchClear');
        if (clearBtn) {
            clearBtn.classList.add('hidden');
        }
        
        // Reset flags after event loop completes
        setTimeout(() => {
            this.isSelecting = false;
            this.justSelected = false;
        }, 100);
    }
    
    /**
     * Select ward
     */
    selectWard(code) {
        this.wardCode = code;
        this.selectedWard = this.selectedDistrict?.wards.find(w => w.code === code);
        this.currentLevel = 'complete';
        
        // Update UI
        this.updateChipsDisplay();
        this.closeDropdown();
        this.showStreetInput();
        this.updateFullAddress();
        
        // Focus street input
        const streetInput = document.getElementById('streetInput');
        if (streetInput) {
            setTimeout(() => streetInput.focus(), 200);
        }
        
        // Reset flag after a tick
        setTimeout(() => {
            this.isSelecting = false;
        }, 0);
    }
    
    /**
     * Render provinces list
     */
    renderProvinces() {
        const content = document.getElementById('addressDropdownContent');
        if (!content) return;
        
        let html = '<div class="address-dropdown-header">Chọn Tỉnh/Thành phố</div>';
        html += '<div class="address-dropdown-list" role="listbox">';
        
        this.normalizedData.forEach(province => {
            html += '<div class="address-list-item" role="option" tabindex="-1" data-action="select-province" data-code="' + province.code + '">';
            html += '<span class="item-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="m11.54 22.351.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clip-rule="evenodd" /></svg></span>';
            html += '<span class="item-text">' + province.name + '</span>';
            html += '<span class="item-arrow" aria-hidden="true">›</span>';
            html += '</div>';
        });
        
        html += '</div>';
        
        content.innerHTML = html;
    }
    
    /**
     * Render districts list
     */
    renderDistricts() {
        if (!this.selectedProvince) return;
        
        const content = document.getElementById('addressDropdownContent');
        if (!content) return;
        
        let html = '<div class="address-dropdown-header">Chọn Quận/Huyện</div>';
        html += '<div class="address-dropdown-list" role="listbox">';
        
        this.selectedProvince.districts.forEach(district => {
            html += '<div class="address-list-item" role="option" tabindex="-1" data-action="select-district" data-code="' + district.code + '">';
            html += '<span class="item-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="m11.54 22.351.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clip-rule="evenodd" /></svg></span>';
            html += '<span class="item-text">' + district.name + '</span>';
            html += '<span class="item-arrow" aria-hidden="true">›</span>';
            html += '</div>';
        });
        
        html += '</div>';
        
        content.innerHTML = html;
        
        this.openDropdown();
    }
    
    /**
     * Render wards list
     */
    renderWards() {
        if (!this.selectedDistrict) return;
        
        const content = document.getElementById('addressDropdownContent');
        if (!content) return;
        
        let html = '<div class="address-dropdown-header">Chọn Phường/Xã</div>';
        html += '<div class="address-dropdown-list" role="listbox">';
        
        this.selectedDistrict.wards.forEach(ward => {
            html += '<div class="address-list-item" role="option" tabindex="-1" data-action="select-ward" data-code="' + ward.code + '">';
            html += '<span class="item-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="m11.54 22.351.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clip-rule="evenodd" /></svg></span>';
            html += '<span class="item-text">' + ward.name + '</span>';
            html += '</div>';
        });
        
        html += '</div>';
        
        content.innerHTML = html;
        
        this.openDropdown();
    }
    
    /**
     * Update chips display
     */
    updateChipsDisplay() {
        const chipsContainer = document.getElementById('addressChips');
        if (!chipsContainer) return;
        
        let html = '';
        
        // Province chip
        if (this.selectedProvince) {
            const shortName = this.selectedProvince.name.replace('Tỉnh ', '').replace('Thành phố ', 'TP ');
            html += '<div class="address-chip" data-level="province">';
            html += '<span class="chip-text">' + shortName + '</span>';
            html += '<button class="chip-remove" data-action="remove-chip" data-level="province" aria-label="Xóa ' + shortName + '">';
            html += '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" /></svg>';
            html += '</button>';
            html += '</div>';
        }
        
        // District chip
        if (this.selectedDistrict) {
            const shortName = this.selectedDistrict.name
                .replace('Quận ', 'Q.')
                .replace('Huyện ', 'H.')
                .replace('Thành phố ', 'TP ')
                .replace('Thị xã ', 'TX ');
            html += '<div class="address-chip" data-level="district">';
            html += '<span class="chip-text">' + shortName + '</span>';
            html += '<button class="chip-remove" data-action="remove-chip" data-level="district" aria-label="Xóa ' + shortName + '">';
            html += '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" /></svg>';
            html += '</button>';
            html += '</div>';
        }
        
        // Ward chip
        if (this.selectedWard) {
            const shortName = this.selectedWard.name
                .replace('Phường ', 'P.')
                .replace('Xã ', 'X.')
                .replace('Thị trấn ', 'TT ');
            html += '<div class="address-chip" data-level="ward">';
            html += '<span class="chip-text">' + shortName + '</span>';
            html += '<button class="chip-remove" data-action="remove-chip" data-level="ward" aria-label="Xóa ' + shortName + '">';
            html += '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" /></svg>';
            html += '</button>';
            html += '</div>';
        }
        
        chipsContainer.innerHTML = html;
        
        // Update placeholder
        const searchInput = document.getElementById('addressSearchInput');
        if (searchInput) {
            if (this.selectedWard) {
                searchInput.placeholder = '';
                searchInput.style.display = 'none';
            } else if (this.selectedDistrict) {
                searchInput.placeholder = '🔍 Tìm phường/xã...';
                searchInput.style.display = 'block';
            } else if (this.selectedProvince) {
                searchInput.placeholder = '🔍 Tìm quận/huyện...';
                searchInput.style.display = 'block';
            } else {
                searchInput.placeholder = '🔍 Tìm tỉnh/thành phố...';
                searchInput.style.display = 'block';
            }
        }
    }
    
    /**
     * Navigate to a specific level
     */
    goToLevel(level) {
        if (level === 'province') {
            this.districtCode = '';
            this.wardCode = '';
            this.selectedDistrict = null;
            this.selectedWard = null;
            this.currentLevel = 'district';
            this.renderDistricts();
        } else if (level === 'district') {
            this.wardCode = '';
            this.selectedWard = null;
            this.currentLevel = 'ward';
            this.renderWards();
        }
        
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
        
        if (dropdown) {
            dropdown.classList.remove('hidden');
            this.isDropdownOpen = true;
        }
        
        if (searchInput) {
            searchInput.setAttribute('aria-expanded', 'true');
        }
    }
    
    /**
     * Close dropdown
     */
    closeDropdown() {
        const dropdown = document.getElementById('addressDropdown');
        const searchInput = document.getElementById('addressSearchInput');
        
        if (dropdown) {
            dropdown.classList.add('hidden');
            this.isDropdownOpen = false;
        }
        
        if (searchInput) {
            searchInput.setAttribute('aria-expanded', 'false');
        }
        
        this.focusedIndex = -1;
    }
    
    /**
     * Clear search
     */
    clearSearch() {
        const searchInput = document.getElementById('addressSearchInput');
        const clearBtn = document.getElementById('addressSearchClear');
        
        if (searchInput) {
            // If we have selected address, keep it and just clear search part
            if (searchInput.getAttribute('data-display-mode') === 'true') {
                const baseAddress = this.getSelectedAddressText();
                searchInput.value = baseAddress;
                this.searchQuery = '';
                searchInput.focus();
                setTimeout(() => {
                    searchInput.setSelectionRange(baseAddress.length, baseAddress.length);
                }, 0);
            } else {
                searchInput.value = '';
                this.searchQuery = '';
                searchInput.focus();
            }
        }
        
        if (clearBtn) {
            clearBtn.classList.add('hidden');
        }
        
        // Show appropriate list based on current level
        if (this.currentLevel === 'province') {
            this.renderProvinces();
        } else if (this.currentLevel === 'district') {
            this.renderDistricts();
        } else if (this.currentLevel === 'ward') {
            this.renderWards();
        }
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

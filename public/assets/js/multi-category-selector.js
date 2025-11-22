/**
 * Multi-Category Selector Component - Redesigned
 * Simple and effective multi-select with Tailwind CSS
 */

class MultiCategorySelector {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            placeholder: options.placeholder || 'Chọn danh mục...',
            searchPlaceholder: options.searchPlaceholder || 'Tìm kiếm...',
            onChange: options.onChange || (() => {}),
            onReady: options.onReady || (() => {}),
            ...options
        };
        
        this.categories = [];
        this.selectedIds = new Set();
        this.isOpen = false;
        this.isReady = false;
        
        this.init();
    }
    
    init() {
        if (!this.container) {
            console.error('Container not found');
            return;
        }
        
        this.render();
        this.attachEventListeners();
        this.loadCategories();
    }
    
    render() {
        this.container.innerHTML = `
            <div class="relative">
                <!-- Info Text -->
                <div class="mb-2 flex items-center justify-between">
                    <span class="text-xs text-gray-500">Click để chọn/bỏ chọn danh mục</span>
                    <span class="text-xs font-semibold text-purple-600" id="selectedCountTop">Đã chọn: 0</span>
                </div>
                
                <!-- Selected Tags + Trigger Button -->
                <div class="min-h-[42px] w-full px-3 py-2 border border-gray-300 rounded-lg bg-white cursor-pointer hover:border-purple-400 focus-within:border-purple-500 transition-all" id="selectorTrigger">
                    <div class="flex items-center justify-between gap-2">
                        <div class="flex-1 flex flex-wrap gap-1.5" id="tagsWrapper">
                            <span class="text-sm text-gray-400" id="placeholderText">${this.options.placeholder}</span>
                        </div>
                        <svg class="w-5 h-5 text-gray-400 flex-shrink-0 transition-transform" id="dropdownIcon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>
                
                <!-- Dropdown Menu -->
                <div class="hidden fixed bg-white border border-gray-200 rounded-lg shadow-xl z-[9999]" id="dropdownMenu">
                    <!-- Search -->
                    <div class="p-3 border-b border-gray-200">
                        <div class="relative">
                            <svg class="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input type="text" id="categorySearch" placeholder="${this.options.searchPlaceholder}" 
                                class="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none transition-colors" />
                        </div>
                    </div>
                    
                    <!-- Quick Actions -->
                    <div class="flex gap-2 p-2 border-b border-gray-200">
                        <button type="button" class="flex-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors" id="selectAllBtn">
                            Chọn tất cả
                        </button>
                        <button type="button" class="flex-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors" id="clearAllBtn">
                            Xóa tất cả
                        </button>
                    </div>
                    
                    <!-- Categories List (2 columns) -->
                    <div class="overflow-y-auto" id="categoriesList" style="max-height: 280px;">
                        <div class="flex items-center justify-center py-8 text-gray-400">
                            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                        </div>
                    </div>
                    
                    <!-- Footer -->
                    <div class="p-2 border-t border-gray-200 bg-gray-50">
                        <span class="text-xs font-semibold text-purple-600" id="selectedCount">Đã chọn: 0</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    attachEventListeners() {
        // Toggle dropdown
        const trigger = this.container.querySelector('#selectorTrigger');
        trigger?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });
        
        // Search
        const searchInput = this.container.querySelector('#categorySearch');
        searchInput?.addEventListener('input', (e) => {
            this.filterCategories(e.target.value);
        });
        
        // Quick actions
        this.container.querySelector('#selectAllBtn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectAll();
        });
        this.container.querySelector('#clearAllBtn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.clearAll();
        });
        
        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target)) {
                this.closeDropdown();
            }
        });
    }
    
    async loadCategories() {
        try {
            const response = await fetch(`${CONFIG.API_URL}?action=getAllCategories&timestamp=${Date.now()}`);
            const data = await response.json();
            
            if (data.success) {
                this.categories = data.categories || [];
                this.renderCategories();
                
                // Mark as ready and call onReady callback
                if (!this.isReady) {
                    this.isReady = true;
                    this.options.onReady();
                }
            }
        } catch (error) {
            console.error('Error loading categories:', error);
            this.showError('Không thể tải danh mục');
        }
    }
    
    renderCategories(filteredCategories = null) {
        const list = this.container.querySelector('#categoriesList');
        const categoriesToRender = filteredCategories || this.categories;
        
        if (categoriesToRender.length === 0) {
            list.innerHTML = '<div class="py-8 text-center text-sm text-gray-400">Không tìm thấy danh mục</div>';
            return;
        }
        
        // Render in 2 columns grid
        list.innerHTML = `
            <div class="grid grid-cols-2 gap-0">
                ${categoriesToRender.map(cat => {
                    const isSelected = this.selectedIds.has(cat.id);
                    const isPrimary = isSelected && Array.from(this.selectedIds)[0] === cat.id;
                    return `
                    <div class="flex items-center gap-2 px-3 py-2.5 hover:bg-purple-50 transition-all border-b border-r border-gray-100 ${isSelected ? 'bg-purple-50' : ''}">
                        <label class="flex items-center gap-2 flex-1 cursor-pointer">
                            <input type="checkbox" 
                                class="w-4 h-4 text-purple-600 border-2 border-gray-300 rounded focus:ring-0 cursor-pointer flex-shrink-0" 
                                value="${cat.id}"
                                ${isSelected ? 'checked' : ''}
                                onchange="window.categorySelector.toggleCategory(${cat.id})">
                            ${cat.color ? `<span class="w-2 h-2 rounded-full flex-shrink-0" style="background-color: ${cat.color}"></span>` : `<span class="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0"></span>`}
                            <span class="flex-1 text-xs font-medium ${isSelected ? 'text-purple-700 font-semibold' : 'text-gray-700'} truncate">${this.escapeHtml(cat.name)}</span>
                        </label>
                        ${isSelected ? `
                            <button type="button" 
                                class="px-2 py-1 text-[10px] font-semibold rounded transition-all flex-shrink-0 ${
                                    isPrimary 
                                        ? 'bg-yellow-100 text-yellow-700 border border-yellow-300 cursor-default' 
                                        : 'bg-white text-purple-600 border border-purple-300 hover:bg-purple-50'
                                }"
                                ${!isPrimary ? `onclick="event.stopPropagation(); window.categorySelector.setPrimary(${cat.id})"` : ''}
                                title="${isPrimary ? 'Danh mục chính' : 'Đặt làm chính'}">
                                ${isPrimary ? '⭐ Chính' : 'Set Primary'}
                            </button>
                        ` : ''}
                    </div>
                `;
                }).join('')}
            </div>
        `;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    filterCategories(searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        if (!term) {
            this.renderCategories();
            return;
        }
        
        const filtered = this.categories.filter(cat => 
            cat.name.toLowerCase().includes(term)
        );
        this.renderCategories(filtered);
    }
    
    toggleCategory(categoryId) {
        if (this.selectedIds.has(categoryId)) {
            this.selectedIds.delete(categoryId);
        } else {
            this.selectedIds.add(categoryId);
        }
        
        this.updateSelectedTags();
        this.updateSelectedCount();
        this.renderCategories(); // Re-render to show/hide Set Primary buttons
        this.options.onChange(Array.from(this.selectedIds));
    }
    
    updateSelectedTags() {
        const tagsWrapper = this.container.querySelector('#tagsWrapper');
        const placeholderText = this.container.querySelector('#placeholderText');
        
        if (this.selectedIds.size === 0) {
            tagsWrapper.innerHTML = `<span class="text-sm text-gray-400" id="placeholderText">${this.options.placeholder}</span>`;
            return;
        }
        
        // Get selected categories in the order of selectedIds Set
        const selectedIdsArray = Array.from(this.selectedIds);
        const selectedCategories = selectedIdsArray
            .map(id => this.categories.find(cat => cat.id === id))
            .filter(cat => cat !== undefined);
        
        tagsWrapper.innerHTML = selectedCategories.map((cat, index) => `
            <span class="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 ${
                index === 0 
                    ? 'bg-purple-100 text-purple-700 border border-purple-300' 
                    : 'bg-gray-50 text-gray-700 border border-gray-200 hover:border-purple-300 cursor-pointer'
            } rounded-full text-xs font-medium hover:shadow-sm transition-all" ${index !== 0 ? `onclick="event.stopPropagation(); window.categorySelector.setPrimary(${cat.id})" title="Click để đặt làm danh mục chính"` : 'title="Danh mục chính"'}>
                ${index === 0 ? '<span class="text-yellow-500">⭐</span>' : '<span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span>'}
                <span class="max-w-[100px] truncate">${this.escapeHtml(cat.name)}</span>
                <button type="button" class="w-4 h-4 flex items-center justify-center rounded-full hover:bg-black/10 transition-colors" onclick="event.stopPropagation(); window.categorySelector.removeCategory(${cat.id})" title="Xóa">
                    <svg class="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </span>
        `).join('');
    }
    
    setPrimary(categoryId) {
        // Move the selected category to the front (making it primary)
        const idsArray = Array.from(this.selectedIds);
        const index = idsArray.indexOf(categoryId);
        
        if (index > -1) {
            // Remove from current position and add to front
            idsArray.splice(index, 1);
            idsArray.unshift(categoryId);
            
            // Update selectedIds Set with new order
            this.selectedIds = new Set(idsArray);
            
            // Update UI
            this.updateSelectedTags();
            this.renderCategories();
            this.options.onChange(Array.from(this.selectedIds));
        }
    }
    
    removeCategory(categoryId) {
        this.selectedIds.delete(categoryId);
        this.updateSelectedTags();
        this.updateSelectedCount();
        this.renderCategories(); // Re-render to update checkboxes
        this.options.onChange(Array.from(this.selectedIds));
    }
    
    updateSelectedCount() {
        const countEl = this.container.querySelector('#selectedCount');
        const countTopEl = this.container.querySelector('#selectedCountTop');
        
        if (countEl) {
            countEl.textContent = `Đã chọn: ${this.selectedIds.size}`;
        }
        
        if (countTopEl) {
            countTopEl.textContent = `Đã chọn: ${this.selectedIds.size}`;
            
            // Highlight if categories selected
            if (this.selectedIds.size > 0) {
                countTopEl.classList.remove('text-purple-600');
                countTopEl.classList.add('text-green-600');
            } else {
                countTopEl.classList.remove('text-green-600');
                countTopEl.classList.add('text-purple-600');
            }
        }
    }
    
    selectAll() {
        this.categories.forEach(cat => this.selectedIds.add(cat.id));
        this.updateSelectedTags();
        this.updateSelectedCount();
        this.renderCategories();
        this.options.onChange(Array.from(this.selectedIds));
    }
    
    clearAll() {
        this.selectedIds.clear();
        this.updateSelectedTags();
        this.updateSelectedCount();
        this.renderCategories();
        this.options.onChange(Array.from(this.selectedIds));
    }
    
    toggleDropdown() {
        const dropdown = this.container.querySelector('#dropdownMenu');
        const icon = this.container.querySelector('#dropdownIcon');
        const trigger = this.container.querySelector('#selectorTrigger');
        
        if (this.isOpen) {
            this.closeDropdown();
        } else {
            // Calculate position
            const rect = trigger.getBoundingClientRect();
            const dropdownHeight = 400; // Approximate height
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            
            // Position dropdown
            dropdown.style.left = `${rect.left}px`;
            dropdown.style.width = `${rect.width}px`;
            
            // Check if there's enough space below, otherwise show above
            if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
                dropdown.style.bottom = `${window.innerHeight - rect.top + 8}px`;
                dropdown.style.top = 'auto';
            } else {
                dropdown.style.top = `${rect.bottom + 8}px`;
                dropdown.style.bottom = 'auto';
            }
            
            dropdown.classList.remove('hidden');
            icon.style.transform = 'rotate(180deg)';
            this.isOpen = true;
            
            // Focus search
            setTimeout(() => {
                this.container.querySelector('#categorySearch')?.focus();
            }, 100);
        }
    }
    
    closeDropdown() {
        const dropdown = this.container.querySelector('#dropdownMenu');
        const icon = this.container.querySelector('#dropdownIcon');
        
        dropdown.classList.add('hidden');
        icon.style.transform = 'rotate(0deg)';
        this.isOpen = false;
        
        // Clear search
        const searchInput = this.container.querySelector('#categorySearch');
        if (searchInput) {
            searchInput.value = '';
            this.filterCategories('');
        }
    }
    
    // Public methods
    getSelectedIds() {
        return Array.from(this.selectedIds);
    }
    
    setSelectedIds(ids) {
        this.selectedIds = new Set(ids);
        this.updateSelectedTags();
        this.updateSelectedCount();
        if (this.categories.length > 0) {
            this.renderCategories();
        }
    }
    
    reset() {
        this.clearAll();
    }
    
    showError(message) {
        const list = this.container.querySelector('#categoriesList');
        list.innerHTML = `<div class="py-8 text-center text-sm text-red-500">${message}</div>`;
    }
}

// Export for use in other scripts
window.MultiCategorySelector = MultiCategorySelector;

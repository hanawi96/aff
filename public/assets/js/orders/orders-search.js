/**
 * Orders Search Module - Server-Side Search
 * Handles full database search via searchOrders API
 * 
 * Dependencies:
 * - CONFIG.API_URL from config.js
 * - allOrdersData, filteredOrdersData (global from orders.js)
 * - renderOrdersTable() from orders-table.js
 * - updateStats() from orders-stats.js
 * - showLoading(), hideLoading() from orders-ui-states.js
 * - showToast() from toast-manager.js (optional)
 */

// ============================================
// SEARCH STATE
// ============================================
let searchMode = 'full'; // 'quick' | 'full' - DEFAULT: 'full' (search entire database)
let serverSearchCache = new Map(); // Cache server search results
let serverSearchDebounceTimer = null;
const SERVER_SEARCH_DEBOUNCE = 300; // ms
const SERVER_SEARCH_CACHE_TTL = 60000; // 1 minute

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize search mode toggle UI
 * Call this on page load
 */
function initSearchModeToggle() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) {
        console.warn('⚠️ searchInput not found, skipping search mode toggle');
        return;
    }
    
    // Check if toggle already exists
    if (document.getElementById('searchModeToggle')) {
        console.log('✅ Search mode toggle already initialized');
        return;
    }
    
    // Create toggle UI
    const searchContainer = searchInput.closest('.relative.flex-1') || searchInput.parentElement;
    const parentContainer = searchContainer?.parentElement;
    
    if (!parentContainer) {
        console.warn('⚠️ Could not find parent container for toggle');
        return;
    }
    
    // Insert toggle after search input container (default: checked = full search mode)
    const toggleHtml = `
        <div class="flex items-center gap-2 mt-2 px-1" id="searchModeToggleContainer">
            <label class="inline-flex items-center cursor-pointer select-none">
                <input type="checkbox" id="searchModeToggle" class="sr-only peer" checked>
                <div class="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                <span class="ml-3 text-sm font-medium text-gray-700">
                    <span id="searchModeLabel">Tìm toàn bộ (Server)</span>
                </span>
            </label>
            <div class="relative group">
                <svg class="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <div class="hidden group-hover:block absolute left-0 top-6 z-50 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg">
                    <strong>Tìm toàn bộ:</strong> Tìm trong tất cả đơn hàng từ trước đến nay (mặc định)<br>
                    <strong>Tìm nhanh:</strong> Tìm chỉ trong 1000 đơn gần nhất (nhanh hơn, không cần Internet)
                </div>
            </div>
        </div>
    `;
    
    const toggleDiv = document.createElement('div');
    toggleDiv.innerHTML = toggleHtml;
    const toggleElement = toggleDiv.firstElementChild;
    
    // Insert after search container
    searchContainer.after(toggleElement);
    
    // Attach event listener
    const toggle = document.getElementById('searchModeToggle');
    const label = document.getElementById('searchModeLabel');
    
    toggle.addEventListener('change', (e) => {
        searchMode = e.target.checked ? 'full' : 'quick';
        label.textContent = searchMode === 'full' 
            ? 'Tìm toàn bộ (Server)' 
            : 'Tìm nhanh (1000 đơn gần nhất)';
        
        // Re-trigger search with current term
        const currentTerm = searchInput.value.trim();
        if (currentTerm) {
            handleSearchInput(currentTerm);
        }
        
        // Clear result info if exists
        clearSearchResultInfo();
        
        console.log(`🔍 Search mode changed to: ${searchMode}`);
    });
    
    console.log('✅ Search mode toggle initialized');
}

/**
 * Handle search input - router between quick and full search
 * @param {string} searchTerm - Search term from input
 */
function handleSearchInput(searchTerm) {
    if (searchMode === 'quick') {
        // Use existing local search (filterOrdersData)
        if (typeof filterOrdersData === 'function') {
            filterOrdersData();
        }
    } else {
        // Use server search with debounce
        performServerSearch(searchTerm);
    }
}

// ============================================
// SERVER SEARCH
// ============================================

/**
 * Perform server-side search with debounce and cache
 * @param {string} searchTerm - Search term
 */
function performServerSearch(searchTerm) {
    // Clear previous timer
    if (serverSearchDebounceTimer) {
        clearTimeout(serverSearchDebounceTimer);
    }
    
    // Validate minimum length
    if (searchTerm.length < 2) {
        showSearchHint('Nhập ít nhất 2 ký tự để tìm kiếm');
        clearSearchResultInfo();
        // Show all orders (no filter)
        filteredOrdersData = allOrdersData;
        if (typeof renderOrdersTable === 'function') {
            renderOrdersTable();
        }
        if (typeof updateStats === 'function') {
            updateStats();
        }
        return;
    }
    
    // Check cache first
    const cacheKey = `search_${searchTerm.toLowerCase()}`;
    const cached = serverSearchCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < SERVER_SEARCH_CACHE_TTL)) {
        console.log('✅ Using cached search results');
        displayServerSearchResults(cached.data);
        return;
    }
    
    // Debounce: wait 300ms before API call
    serverSearchDebounceTimer = setTimeout(async () => {
        try {
            showSearchLoading();
            
            const url = `${CONFIG.API_URL}?action=searchOrders&q=${encodeURIComponent(searchTerm)}&limit=100`;
            const response = await fetch(url);
            const data = await response.json();
            
            hideSearchLoading();
            
            if (data.success) {
                // Cache results
                serverSearchCache.set(cacheKey, {
                    data: data,
                    timestamp: Date.now()
                });
                
                // Clear old cache entries (keep last 20)
                if (serverSearchCache.size > 20) {
                    const firstKey = serverSearchCache.keys().next().value;
                    serverSearchCache.delete(firstKey);
                }
                
                displayServerSearchResults(data);
                
                // Log query time
                if (data.queryTime) {
                    console.log(`🔍 Server search: ${data.queryTime}ms, found ${data.returned} results`);
                }
            } else {
                hideSearchLoading();
                showSearchError(data.error || 'Không thể tìm kiếm');
                
                // Fallback to local search on error
                if (data.code === 'DATABASE_ERROR' || data.code === 'INVALID_SEARCH_TERM') {
                    console.warn(`⚠️ Server search error (${data.code}), falling back to local`);
                    fallbackToLocalSearch();
                }
            }
            
        } catch (error) {
            console.error('❌ Server search error:', error);
            hideSearchLoading();
            showSearchError('Lỗi kết nối, đang chuyển về tìm nhanh...');
            
            // Fallback to local search
            setTimeout(() => {
                fallbackToLocalSearch();
            }, 1000);
        }
    }, SERVER_SEARCH_DEBOUNCE);
}

/**
 * Display server search results
 * @param {object} data - Response from searchOrders API
 */
function displayServerSearchResults(data) {
    // Set filteredOrdersData to search results
    filteredOrdersData = data.orders || [];
    
    // Render table with results
    if (typeof renderOrdersTable === 'function') {
        renderOrdersTable();
    }
    
    // Update stats
    if (typeof updateStats === 'function') {
        updateStats();
    }
    
    // Show result info badge
    showSearchResultInfo(data);
}

/**
 * Show search result info badge
 * @param {object} data - Search response data
 */
function showSearchResultInfo(data) {
    clearSearchResultInfo();
    
    const info = document.createElement('div');
    info.id = 'searchResultInfo';
    info.className = 'mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm';
    info.innerHTML = `
        <svg class="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span class="text-blue-700 font-medium">
            Tìm thấy <strong>${data.returned}</strong> đơn hàng
            ${data.hasMore ? ' <span class="text-blue-600">(có thể còn nhiều hơn)</span>' : ''}
        </span>
        ${data.queryTime ? `<span class="text-blue-600 text-xs ml-1">(${data.queryTime}ms)</span>` : ''}
    `;
    
    const toggleContainer = document.getElementById('searchModeToggleContainer');
    if (toggleContainer) {
        toggleContainer.after(info);
    }
}

/**
 * Clear search result info badge
 */
function clearSearchResultInfo() {
    const existing = document.getElementById('searchResultInfo');
    if (existing) {
        existing.remove();
    }
}

/**
 * Fallback to local search when server search fails
 */
function fallbackToLocalSearch() {
    searchMode = 'quick';
    const toggle = document.getElementById('searchModeToggle');
    const label = document.getElementById('searchModeLabel');
    
    if (toggle) toggle.checked = false;
    if (label) label.textContent = 'Tìm nhanh (1000 đơn gần nhất)';
    
    // Trigger local search
    if (typeof filterOrdersData === 'function') {
        filterOrdersData();
    }
}

// ============================================
// UI HELPER FUNCTIONS
// ============================================

/**
 * Show loading state during search
 */
function showSearchLoading() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.classList.add('animate-pulse');
        searchInput.disabled = true;
    }
    
    if (typeof showLoading === 'function') {
        showLoading();
    }
}

/**
 * Hide loading state
 */
function hideSearchLoading() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.classList.remove('animate-pulse');
        searchInput.disabled = false;
    }
    
    if (typeof hideLoading === 'function') {
        hideLoading();
    }
}

/**
 * Show search hint message
 * @param {string} message - Hint message
 */
function showSearchHint(message) {
    if (typeof showToast === 'function') {
        showToast(message, 'info');
    } else {
        console.log(`💡 ${message}`);
    }
}

/**
 * Show search error message
 * @param {string} message - Error message
 */
function showSearchError(message) {
    if (typeof showToast === 'function') {
        showToast(message, 'error');
    } else {
        console.error(`❌ ${message}`);
    }
}

/**
 * Get current search mode
 * @returns {string} 'quick' or 'full'
 */
function getSearchMode() {
    return searchMode;
}

/**
 * Clear server search cache
 */
function clearServerSearchCache() {
    serverSearchCache.clear();
    console.log('🗑️ Server search cache cleared');
}

// ============================================
// EXPORT TO GLOBAL SCOPE
// ============================================
if (typeof window !== 'undefined') {
    window.searchMode = searchMode;
    window.initSearchModeToggle = initSearchModeToggle;
    window.handleSearchInput = handleSearchInput;
    window.performServerSearch = performServerSearch;
    window.getSearchMode = getSearchMode;
    window.clearServerSearchCache = clearServerSearchCache;
    window.clearSearchResultInfo = clearSearchResultInfo;
}

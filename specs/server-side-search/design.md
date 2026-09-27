# Design: Server-Side Search API - Tìm kiếm Toàn bộ Đơn hàng

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Admin Frontend                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Search Input Box                                     │   │
│  │  [🔍 Tìm kiếm...]  [Toggle: Nhanh ⇄ Toàn bộ]        │   │
│  └──────────────────────────────────────────────────────┘   │
│         │                                  │                 │
│         │ Mode: Quick                      │ Mode: Full      │
│         ▼                                  ▼                 │
│  ┌─────────────────┐             ┌──────────────────────┐   │
│  │ Local Search    │             │ Server Search        │   │
│  │ (1000 orders)   │             │ (debounce + cache)   │   │
│  └─────────────────┘             └──────────────────────┘   │
│                                            │                 │
└────────────────────────────────────────────┼─────────────────┘
                                             │ HTTP GET
                                             ▼
                    ┌─────────────────────────────────────────┐
                    │   Cloudflare Workers API                │
                    │                                         │
                    │   GET /?action=searchOrders&q=xxx       │
                    │                                         │
                    │   ┌─────────────────────────────────┐   │
                    │   │  searchOrders()                 │   │
                    │   │  - Validate input              │   │
                    │   │  - Build SQL query             │   │
                    │   │  - Execute on D1               │   │
                    │   │  - Return results              │   │
                    │   └─────────────────────────────────┘   │
                    └─────────────────┬───────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────────────┐
                    │   Cloudflare D1 (SQLite)                │
                    │                                         │
                    │   SELECT orders.*, ctv.commission_rate  │
                    │   FROM orders                           │
                    │   LEFT JOIN ctv ...                     │
                    │   WHERE LOWER(order_id) LIKE ?          │
                    │      OR LOWER(customer_phone) LIKE ?    │
                    │      OR ...                             │
                    │   ORDER BY created_at_unix DESC         │
                    │   LIMIT ?                               │
                    └─────────────────────────────────────────┘
```

## Database Design

### Indexes Required

```sql
-- Index 1: order_id (already exists as unique)
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_id ON orders(order_id);

-- Index 2: customer_phone for search
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);

-- Index 3: customer_name for search
CREATE INDEX IF NOT EXISTS idx_orders_customer_name ON orders(LOWER(customer_name));

-- Index 4: created_at_unix for sorting (already exists)
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at_unix DESC);

-- Optional: Composite index for phone + date
CREATE INDEX IF NOT EXISTS idx_orders_phone_date 
ON orders(customer_phone, created_at_unix DESC);
```

**Note:** SQLite không hỗ trợ index cho `LIKE '%pattern%'` (leading wildcard), nhưng có index vẫn giúp cho các trường hợp:
- Exact match: `order_id = 'DH179...'`
- Prefix search: `customer_name LIKE 'Nguyen%'`
- Sort optimization: `created_at_unix DESC`

### Query Performance Analysis

**Current:** getRecentOrders với LIMIT 1000
- Scan: ~1000 rows
- Time: ~50-100ms (có index created_at_unix)

**New:** searchOrders với LIKE conditions
- Worst case: Full table scan nếu không match index
- Expected: 100-300ms với dataset < 100k orders
- Mitigation: LIMIT 100, có thể tăng lên 500 max

## API Design

### Endpoint: `searchOrders`

**Request:**
```
GET /?action=searchOrders&q=DH179&limit=100&offset=0
```

**Query Parameters:**

| Parameter | Type | Required | Default | Validation | Description |
|-----------|------|----------|---------|------------|-------------|
| `q` | string | Yes | - | min 2 chars, max 100 chars | Search term |
| `limit` | integer | No | 100 | 1-500 | Number of results |
| `offset` | integer | No | 0 | >= 0 | Pagination offset |

**Response (Success):**
```json
{
  "success": true,
  "orders": [
    {
      "id": 12345,
      "order_id": "DH1790165492631",
      "customer_name": "Nguyễn Văn A",
      "customer_phone": "0123456789",
      "address": "123 Đường ABC, Quận 1, TP.HCM",
      "products": "[...]",
      "total_amount": 500000,
      "status": "delivered",
      "created_at_unix": 1234567890,
      "ctv_commission_rate": 0.12,
      "...": "... (all fields from getRecentOrders)"
    }
  ],
  "total": 1234,
  "returned": 100,
  "hasMore": true,
  "searchTerm": "DH179",
  "searchMode": "server"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Search term must be at least 2 characters",
  "code": "INVALID_SEARCH_TERM"
}
```

**Error Codes:**

| Code | HTTP Status | Description | Action |
|------|-------------|-------------|--------|
| `INVALID_SEARCH_TERM` | 400 | Search term < 2 chars hoặc > 100 chars | Prompt user to enter valid term |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests | Retry after delay |
| `DATABASE_ERROR` | 500 | D1 query failed | Log error, show generic message |

## Backend Implementation

### File: `src/services/orders/order-queries.js`

**Function: `searchOrders`**

```javascript
/**
 * Search orders across all database records
 * @param {string} query - Search term (min 2 chars)
 * @param {number} limit - Max results (default 100, max 500)
 * @param {number} offset - Pagination offset (default 0)
 * @param {object} env - Worker environment
 * @param {object} corsHeaders - CORS headers
 * @returns {Response} JSON response with matching orders
 */
export async function searchOrders(query, limit = 100, offset = 0, env, corsHeaders) {
    try {
        // 1. Validate input
        const searchTerm = String(query || '').trim();
        
        if (searchTerm.length < 2) {
            return jsonResponse({
                success: false,
                error: 'Search term must be at least 2 characters',
                code: 'INVALID_SEARCH_TERM'
            }, 400, corsHeaders);
        }
        
        if (searchTerm.length > 100) {
            return jsonResponse({
                success: false,
                error: 'Search term too long (max 100 characters)',
                code: 'INVALID_SEARCH_TERM'
            }, 400, corsHeaders);
        }
        
        // 2. Sanitize and prepare search pattern
        const sanitized = searchTerm.toLowerCase();
        const pattern = `%${sanitized}%`;
        
        // 3. Parse and validate limit/offset
        const parsedLimit = Math.min(Math.max(parseInt(limit) || 100, 1), 500);
        const parsedOffset = Math.max(parseInt(offset) || 0, 0);
        
        // 4. Build SQL query
        // Same structure as getRecentOrders for consistency
        const sql = `
            SELECT
                orders.*,
                ctv.commission_rate as ctv_commission_rate,
                COALESCE(
                    (SELECT SUM(oi.product_cost * oi.quantity) 
                     FROM order_items oi 
                     WHERE oi.order_id = orders.id),
                    0
                ) as product_cost,
                (CASE WHEN COALESCE(orders.manual_invoice_exported, 0) = 1 THEN 1 ELSE 0 END)
                + (SELECT COUNT(DISTINCT eh.id) 
                   FROM export_history eh
                   WHERE eh.type='invoice' 
                     AND eh.status='downloaded'
                     AND EXISTS (SELECT 1 FROM json_each(eh.order_ids) WHERE value = orders.id)
                  ) AS invoice_exported_count,
                (SELECT MAX(eh.downloaded_at)
                 FROM export_history eh
                 WHERE eh.type='invoice' 
                   AND eh.status='downloaded'
                   AND EXISTS (SELECT 1 FROM json_each(eh.order_ids) WHERE value = orders.id)
                ) AS last_invoice_downloaded_at,
                (SELECT eh2.id FROM export_history eh2
                    WHERE eh2.type='invoice' AND eh2.status='downloaded'
                      AND EXISTS (SELECT 1 FROM json_each(eh2.order_ids) WHERE value = orders.id)
                    ORDER BY eh2.downloaded_at DESC LIMIT 1) AS last_invoice_export_id,
                (SELECT eh2.file_name FROM export_history eh2
                    WHERE eh2.type='invoice' AND eh2.status='downloaded'
                      AND EXISTS (SELECT 1 FROM json_each(eh2.order_ids) WHERE value = orders.id)
                    ORDER BY eh2.downloaded_at DESC LIMIT 1) AS last_invoice_export_file_name,
                COALESCE(orders.invoice_exported_at, 0) AS invoice_exported_at
            FROM orders
            LEFT JOIN ctv ON orders.referral_code = ctv.referral_code
            WHERE 
                LOWER(orders.order_id) LIKE ?
                OR LOWER(orders.customer_phone) LIKE ?
                OR LOWER(orders.customer_name) LIKE ?
                OR LOWER(orders.address) LIKE ?
                OR LOWER(orders.notes) LIKE ?
            ORDER BY orders.created_at_unix DESC
            LIMIT ? OFFSET ?
        `;
        
        // 5. Execute query with timing
        const startTime = Date.now();
        const { results: orders } = await env.DB.prepare(sql)
            .bind(pattern, pattern, pattern, pattern, pattern, parsedLimit, parsedOffset)
            .all();
        const queryTime = Date.now() - startTime;
        
        // 6. Log slow queries for monitoring
        if (queryTime > 500) {
            console.warn(`⚠️ Slow search query: ${queryTime}ms for term "${searchTerm}"`);
        }
        
        // 7. Calculate pagination info
        const returned = orders.length;
        const hasMore = returned === parsedLimit;
        
        // 8. Return response
        return jsonResponse({
            success: true,
            orders: orders,
            total: returned,
            returned: returned,
            hasMore: hasMore,
            searchTerm: searchTerm,
            searchMode: 'server',
            queryTime: queryTime
        }, 200, corsHeaders);
        
    } catch (error) {
        console.error('❌ Error searching orders:', error);
        return jsonResponse({
            success: false,
            error: error.message || 'Failed to search orders',
            code: 'DATABASE_ERROR'
        }, 500, corsHeaders);
    }
}
```

### File: `src/handlers/get-handler.js`

**Add routing:**

```javascript
import { searchOrders } from '../services/orders/order-queries.js';

// ... existing code ...

case 'searchOrders':
    const searchQuery = url.searchParams.get('q') || '';
    const searchLimit = parseInt(url.searchParams.get('limit')) || 100;
    const searchOffset = parseInt(url.searchParams.get('offset')) || 0;
    return await searchOrders(searchQuery, searchLimit, searchOffset, env, corsHeaders);
```

## Frontend Implementation

### File: `public/assets/js/orders/orders-search.js` (NEW)

**Purpose:** Quản lý server-side search logic riêng biệt

```javascript
/**
 * Orders Search Module - Server-Side Search
 * Handles full database search via API
 */

// Search state
let searchMode = 'quick'; // 'quick' | 'full'
let serverSearchCache = new Map(); // Cache server search results
let serverSearchDebounceTimer = null;
const SERVER_SEARCH_DEBOUNCE = 300; // ms
const SERVER_SEARCH_CACHE_TTL = 60000; // 1 minute

/**
 * Initialize search mode toggle
 */
function initSearchModeToggle() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    
    // Create toggle UI
    const toggleHtml = `
        <div class="flex items-center gap-2 mt-2">
            <label class="inline-flex items-center cursor-pointer">
                <input type="checkbox" id="searchModeToggle" class="sr-only peer">
                <div class="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                <span class="ml-2 text-sm font-medium text-gray-700">
                    <span id="searchModeLabel">Tìm nhanh (1000 đơn)</span>
                </span>
            </label>
        </div>
    `;
    
    const searchContainer = searchInput.closest('.search-container') || searchInput.parentElement;
    const toggleContainer = document.createElement('div');
    toggleContainer.innerHTML = toggleHtml;
    searchContainer.appendChild(toggleContainer.firstElementChild);
    
    // Event listener
    const toggle = document.getElementById('searchModeToggle');
    const label = document.getElementById('searchModeLabel');
    
    toggle.addEventListener('change', (e) => {
        searchMode = e.target.checked ? 'full' : 'quick';
        label.textContent = searchMode === 'full' 
            ? 'Tìm toàn bộ (Server)' 
            : 'Tìm nhanh (1000 đơn)';
        
        // Re-trigger search with current term
        const currentTerm = searchInput.value.trim();
        if (currentTerm) {
            handleSearch(currentTerm);
        }
    });
}

/**
 * Handle search with mode detection
 */
function handleSearch(searchTerm) {
    if (searchMode === 'quick') {
        // Use existing local search
        if (typeof filterOrdersData === 'function') {
            filterOrdersData();
        }
    } else {
        // Use server search with debounce
        performServerSearch(searchTerm);
    }
}

/**
 * Perform server-side search with debounce and cache
 */
function performServerSearch(searchTerm) {
    // Clear previous timer
    if (serverSearchDebounceTimer) {
        clearTimeout(serverSearchDebounceTimer);
    }
    
    // Validate minimum length
    if (searchTerm.length < 2) {
        showSearchHint('Nhập ít nhất 2 ký tự để tìm kiếm');
        return;
    }
    
    // Check cache first
    const cacheKey = `search_${searchTerm}`;
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
                
                // Log query time if available
                if (data.queryTime) {
                    console.log(`🔍 Server search: ${data.queryTime}ms`);
                }
            } else {
                showSearchError(data.error || 'Không thể tìm kiếm');
                
                // Fallback to local search
                if (data.code === 'DATABASE_ERROR') {
                    console.warn('⚠️ Server search failed, falling back to local');
                    searchMode = 'quick';
                    document.getElementById('searchModeToggle').checked = false;
                    document.getElementById('searchModeLabel').textContent = 'Tìm nhanh (1000 đơn)';
                    if (typeof filterOrdersData === 'function') {
                        filterOrdersData();
                    }
                }
            }
            
        } catch (error) {
            console.error('❌ Server search error:', error);
            hideSearchLoading();
            showSearchError('Lỗi kết nối, đang chuyển về tìm nhanh...');
            
            // Fallback to local search
            setTimeout(() => {
                searchMode = 'quick';
                document.getElementById('searchModeToggle').checked = false;
                document.getElementById('searchModeLabel').textContent = 'Tìm nhanh (1000 đơn)';
                if (typeof filterOrdersData === 'function') {
                    filterOrdersData();
                }
            }, 1000);
        }
    }, SERVER_SEARCH_DEBOUNCE);
}

/**
 * Display server search results
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
    
    // Show result info
    showSearchResultInfo(data);
}

/**
 * Show search result info badge
 */
function showSearchResultInfo(data) {
    const existing = document.getElementById('searchResultInfo');
    if (existing) existing.remove();
    
    const info = document.createElement('div');
    info.id = 'searchResultInfo';
    info.className = 'mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm';
    info.innerHTML = `
        <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span class="text-blue-700 font-medium">
            Tìm thấy <strong>${data.returned}</strong> đơn hàng
            ${data.hasMore ? ' (có thể còn nhiều hơn)' : ''}
        </span>
        ${data.queryTime ? `<span class="text-blue-600 text-xs">(${data.queryTime}ms)</span>` : ''}
    `;
    
    const searchContainer = document.getElementById('searchInput')?.parentElement;
    if (searchContainer) {
        searchContainer.appendChild(info);
    }
}

/**
 * UI Helper Functions
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

function showSearchHint(message) {
    if (typeof showToast === 'function') {
        showToast(message, 'info');
    }
}

function showSearchError(message) {
    if (typeof showToast === 'function') {
        showToast(message, 'error');
    }
}

/**
 * Export functions
 */
if (typeof window !== 'undefined') {
    window.initSearchModeToggle = initSearchModeToggle;
    window.handleSearch = handleSearch;
    window.performServerSearch = performServerSearch;
}
```

### File: `public/assets/js/orders/orders-filters.js` (MODIFY)

**Integration with new search module:**

```javascript
// Existing filterOrdersData function - add mode check at the beginning
function filterOrdersData() {
    // NEW: Check if server search mode is active
    if (typeof searchMode !== 'undefined' && searchMode === 'full') {
        const searchInput = document.getElementById('searchInput');
        if (searchInput && searchInput.value.trim()) {
            // Let handleSearch take care of server search
            return;
        }
    }
    
    // Existing local search logic continues...
    const searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
    // ... rest of existing code ...
}
```

### File: `public/admin/index.html` (MODIFY)

**Add script tag:**

```html
<!-- Existing scripts -->
<script src="/assets/js/orders/orders-data-loader.js"></script>
<script src="/assets/js/orders/orders-filters.js"></script>

<!-- NEW: Server-side search -->
<script src="/assets/js/orders/orders-search.js"></script>

<script>
    // Initialize on page load
    document.addEventListener('DOMContentLoaded', () => {
        // ... existing initialization ...
        
        // NEW: Initialize search mode toggle
        if (typeof initSearchModeToggle === 'function') {
            initSearchModeToggle();
        }
        
        // Attach search handler
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const term = e.target.value.trim();
                if (typeof handleSearch === 'function') {
                    handleSearch(term);
                }
            });
        }
    });
</script>
```

## Testing Strategy

### Unit Tests

**Backend:**
1. Test `searchOrders` với valid inputs
2. Test validation: query < 2 chars, query > 100 chars
3. Test empty results
4. Test pagination (limit, offset)
5. Test special characters in search term
6. Test SQL injection attempts

**Frontend:**
1. Test toggle switch functionality
2. Test debounce behavior
3. Test cache hit/miss
4. Test fallback to local search on error
5. Test UI state changes (loading, error, results)

### Integration Tests

1. End-to-end search flow: input → API → render results
2. Test with real D1 database (local dev environment)
3. Test performance with 10k, 50k, 100k orders
4. Test concurrent search requests
5. Test network failure scenarios

### Performance Tests

**Benchmark queries:**
```sql
-- Test 1: Exact match order_id (should be fastest)
EXPLAIN QUERY PLAN
SELECT * FROM orders WHERE LOWER(order_id) LIKE '%dh179%';

-- Test 2: Phone number search
EXPLAIN QUERY PLAN
SELECT * FROM orders WHERE LOWER(customer_phone) LIKE '%0123%';

-- Test 3: Name search
EXPLAIN QUERY PLAN
SELECT * FROM orders WHERE LOWER(customer_name) LIKE '%nguyen%';

-- Test 4: Full search (worst case)
EXPLAIN QUERY PLAN
SELECT * FROM orders WHERE 
    LOWER(order_id) LIKE '%xyz%' OR
    LOWER(customer_phone) LIKE '%xyz%' OR
    LOWER(customer_name) LIKE '%xyz%' OR
    LOWER(address) LIKE '%xyz%' OR
    LOWER(notes) LIKE '%xyz%'
ORDER BY created_at_unix DESC
LIMIT 100;
```

**Expected results:**
- With 10k orders: < 100ms
- With 50k orders: < 300ms
- With 100k orders: < 500ms

## Deployment Plan

### Phase 1: Backend Deployment
1. Add indexes to D1 database (migrations)
2. Deploy `searchOrders` function to Cloudflare Workers
3. Test API endpoint with curl/Postman
4. Monitor logs for errors

### Phase 2: Frontend Deployment
1. Add `orders-search.js` file
2. Modify `orders-filters.js` for integration
3. Update `admin/index.html` with new script
4. Test toggle and search functionality
5. Deploy to staging environment

### Phase 3: Monitoring
1. Monitor API request count
2. Track query performance (queryTime)
3. Monitor error rate
4. Collect user feedback

### Rollback Plan
If issues occur:
1. Remove toggle UI (hide feature)
2. Revert to local search only
3. Fix issues in separate branch
4. Re-deploy when stable

## Security Considerations

### SQL Injection Prevention
- ✅ Use parameterized queries (`.bind()`)
- ✅ Never concatenate user input into SQL
- ✅ Validate input length and characters

### XSS Prevention
- ✅ Sanitize output with `escapeHtml()`
- ✅ Use textContent instead of innerHTML for user data
- ✅ Validate JSON response structure

### Rate Limiting (Optional for Phase 1)
- Can implement in Cloudflare Workers
- Track requests per IP in KV storage
- Return 429 if exceeded

## Monitoring and Alerts

### Metrics to Track
1. **Search API Usage:**
   - Requests per hour/day
   - Success rate
   - Error rate by type

2. **Performance:**
   - Query time (p50, p95, p99)
   - Slow query count (> 500ms)
   - Cache hit rate

3. **User Behavior:**
   - Toggle usage rate
   - Average search term length
   - Most searched terms (anonymized)

### Alerts
- Error rate > 5% → Notify on Telegram
- Query time p95 > 1000ms → Investigate
- Daily request count > 10,000 → Review usage

## Future Enhancements (Phase 2)

1. **Full-Text Search (FTS5):**
   ```sql
   CREATE VIRTUAL TABLE orders_fts USING fts5(
       order_id, customer_name, customer_phone, address, notes
   );
   ```

2. **Advanced Filters:**
   - Date range picker
   - Status filter
   - Amount range
   - CTV filter

3. **Search Analytics:**
   - Track popular searches
   - Suggest related searches
   - Autocomplete

4. **Export Search Results:**
   - Download filtered orders as Excel
   - Email search results

5. **Saved Searches:**
   - Save frequent searches
   - Quick access to saved searches

## Documentation

### For Developers
- API documentation in `docs/api/search-orders.md`
- Architecture decisions in `docs/decisions/server-side-search.md`
- Performance benchmarks in `docs/performance/search-benchmarks.md`

### For Users
- User guide: "Cách tìm kiếm đơn hàng cũ"
- Video tutorial (optional)
- FAQ section in admin UI

## Success Criteria

✅ **Must Have:**
- Tìm được 100% đơn hàng trong database
- API response < 500ms (p95)
- Zero breaking changes to existing functionality
- Works on mobile and desktop

✅ **Should Have:**
- Cache hit rate > 30%
- Error rate < 1%
- Users can easily understand 2 search modes

✅ **Nice to Have:**
- Query time metrics dashboard
- Search analytics
- Keyboard shortcuts for toggle

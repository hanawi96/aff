/**
 * Orders Data Loader
 * Extracted from orders.js
 * 
 * Dependencies:
 * - allOrdersData, filteredOrdersData, packagingConfig, currentOrderProducts (global)
 * - showLoading(), hideLoading(), showError() from orders-ui-states.js
 * - applySorting() from orders-sorting.js
 * - updateDateSortIcon(), updateAmountSortIcon() from orders-sorting.js
 * - updateStats() from orders-stats.js
 * - renderOrdersTable() from orders-table.js
 * - updateOrderStatus() from orders-status.js
 * - showToast() from toast-manager.js
 * - escapeHtml() from orders-utils.js
 * - CONFIG.API_URL from config.js
 */

// ============================================
// DATA LOADING
// ============================================

// Load packaging config from database
async function loadPackagingConfig() {
    try {
        // Get all packaging items from category_id = 5 (Đóng gói)
        const response = await fetch(`${CONFIG.API_URL}?action=getPackagingConfig&timestamp=${Date.now()}`);
        const data = await response.json();

        if (data.success && data.config) {
            // Load all config items (including shipping fees)
            packagingConfig = data.config;
            console.log('📦 Loaded packaging config:', packagingConfig.length, 'items');
        }
    } catch (error) {
        console.error('❌ Error loading packaging config:', error);
    }
}

// Calculate packaging cost based on selected items and quantity
function calculatePackagingCost() {
    if (!packagingConfig || packagingConfig.length === 0) {
        console.warn('⚠️ Packaging config not loaded yet');
        return 0;
    }

    // Sum only packaging items (category_id = 5), exclude shipping fees
    const totalPackagingCost = packagingConfig
        .filter(item => item.category_id === 5)
        .reduce((sum, item) => {
            return sum + (item.item_cost || 0);
        }, 0);

    return totalPackagingCost;
}

// ============================================
// ORDERS CACHE (Stale-While-Revalidate qua IndexedDB)
// ============================================
// Mục tiêu: mở trang lần sau hiển thị NGAY danh sách đã lưu (không chờ mạng),
// rồi tải dữ liệu mới ở nền và chỉ vẽ lại khi dữ liệu thực sự thay đổi.
const ORDERS_CACHE_DB = 'ctv_admin_cache';
const ORDERS_CACHE_STORE = 'kv';
const ORDERS_CACHE_KEY = 'recentOrders_v2';

function _openOrdersCacheDB() {
    return new Promise((resolve, reject) => {
        try {
            const req = indexedDB.open(ORDERS_CACHE_DB, 1);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(ORDERS_CACHE_STORE)) {
                    db.createObjectStore(ORDERS_CACHE_STORE);
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        } catch (e) {
            reject(e);
        }
    });
}

async function _readOrdersCache() {
    try {
        const db = await _openOrdersCacheDB();
        return await new Promise((resolve) => {
            const tx = db.transaction(ORDERS_CACHE_STORE, 'readonly');
            const req = tx.objectStore(ORDERS_CACHE_STORE).get(ORDERS_CACHE_KEY);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });
    } catch (e) {
        return null;
    }
}

async function _writeOrdersCache(orders) {
    try {
        const db = await _openOrdersCacheDB();
        await new Promise((resolve) => {
            const tx = db.transaction(ORDERS_CACHE_STORE, 'readwrite');
            tx.objectStore(ORDERS_CACHE_STORE).put({ savedAt: Date.now(), orders }, ORDERS_CACHE_KEY);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        });
    } catch (e) {
        /* ignore quota / private mode */
    }
}

/**
 * Chữ ký nhẹ của danh sách đơn — chỉ băm các trường ảnh hưởng hiển thị
 * (trạng thái, giá trị, ưu tiên, thời gian gửi, độ dài products/notes).
 * Dùng để bỏ qua re-render khi dữ liệu mới giống hệt cache.
 */
function _ordersSignature(list) {
    if (!Array.isArray(list)) return 0;
    const sorted = list.slice().sort((a, b) => Number(a.id) - Number(b.id));
    let h = 5381 + sorted.length;
    for (const o of sorted) {
        const s = `${o.id}|${o.status || ''}|${o.total_amount || 0}|${o.is_priority || 0}|${o.shipped_at_unix || 0}|${o.customer_source || ''}|${(o.products && o.products.length) || 0}|${(o.notes && o.notes.length) || 0}`;
        for (let i = 0; i < s.length; i++) {
            h = (((h << 5) + h) + s.charCodeAt(i)) | 0;
        }
    }
    return h;
}

/** Dựng search index ở lúc rảnh để lần tìm kiếm đầu tiên vẫn tức thì. */
function _scheduleSearchIndexPrebuild() {
    const build = () => {
        if (typeof buildSearchIndex === 'function'
            && (!searchIndexCache || searchIndexCache.length !== allOrdersData.length)) {
            buildSearchIndex();
        }
    };
    if ('requestIdleCallback' in window) {
        requestIdleCallback(build, { timeout: 4000 });
    } else {
        setTimeout(build, 1500);
    }
}

/** Vẽ bảng + thống kê từ allOrdersData hiện tại (dùng chung cho pha cache và pha mạng). */
function _renderOrdersFromCurrentData() {
    if (typeof resetSendLaterUrgentBannerCache === 'function') resetSendLaterUrgentBannerCache();
    // D1: KHÔNG build search index ngay (parse products của ~1000 đơn rất nặng,
    // chặn first paint). Chỉ đánh dấu cache cũ; filterOrdersData tự build khi cần
    // (tìm kiếm / lọc "Có lưu ý"), ngoài ra prebuild ở idle để search vẫn tức thì.
    if (typeof invalidateSearchCache === 'function') invalidateSearchCache();
    // Áp dụng bộ lọc theo DOM (trạng thái mặc định: chưa gửi, thanh toán, CTV, ngày…)
    filterOrdersData();
    updateDateSortIcon();
    updateAmountSortIcon();
    if (typeof updateExportPriorityButton === 'function') {
        updateExportPriorityButton();
    }
    _scheduleSearchIndexPrebuild();
}

/** Gắn/cập nhật 1 đơn trong allOrdersData (đầu danh sách nếu mới). */
function mergeOrderIntoLocalList(order) {
    if (!order || order.id == null) return false;
    const id = Number(order.id);
    if (!Number.isFinite(id)) return false;
    if (!Array.isArray(allOrdersData)) allOrdersData = [];
    const idx = allOrdersData.findIndex((o) => Number(o.id) === id);
    if (idx >= 0) {
        allOrdersData[idx] = { ...allOrdersData[idx], ...order };
    } else {
        allOrdersData.unshift(order);
    }
    return true;
}

/**
 * Sau tạo/sửa đơn: hiện đơn ngay, revalidate nền không skeleton.
 * @param {{ order?: object, orderDbId?: number }} result
 */
async function refreshOrdersListAfterMutation(result) {
    if (typeof invalidateCategory21Cache === 'function') invalidateCategory21Cache();
    if (typeof resetTheTenBePanelCache === 'function') resetTheTenBePanelCache();
    if (typeof resetSendLaterUrgentBannerCache === 'function') resetSendLaterUrgentBannerCache();

    let merged = false;
    if (result?.order) {
        merged = mergeOrderIntoLocalList(result.order);
    } else if (result?.orderDbId) {
        try {
            const res = await fetch(
                `${CONFIG.API_URL}?action=getOrderById&id=${Number(result.orderDbId)}&timestamp=${Date.now()}`
            );
            const data = await res.json();
            if (data.success && data.order) {
                merged = mergeOrderIntoLocalList(data.order);
            }
        } catch (e) {
            console.warn('refreshOrdersListAfterMutation: getOrderById failed', e);
        }
    }

    if (merged) {
        if (typeof invalidateSearchCache === 'function') invalidateSearchCache();
        hideLoading();
        _renderOrdersFromCurrentData();
    }

    if (typeof loadProductsAndCategories === 'function') {
        void loadProductsAndCategories();
    }
    void loadOrdersData({ skipCache: true, silent: true, skipRender: true });
}

// Load orders data from API (Stale-While-Revalidate)
// options.skipCache: true — bỏ pha cache (dùng sau tạo/sửa đơn để tránh nháy bảng 2 lần)
// options.silent: true — không hiện skeleton, giữ bảng hiện tại khi revalidate
// options.skipRender: true — chỉ cập nhật allOrdersData + cache, không vẽ lại bảng
async function loadOrdersData(options = {}) {
    const skipCache = options?.skipCache === true;
    const silent = options?.silent === true;
    const skipRender = options?.skipRender === true;

    // ---- PHA 1: hiển thị ngay từ cache (nếu có) ----
    let renderedFromCache = false;
    if (!skipCache) {
        try {
            const cached = await _readOrdersCache();
            if (cached && Array.isArray(cached.orders) && cached.orders.length > 0) {
                allOrdersData = cached.orders;
                _renderOrdersFromCurrentData();
                hideLoading();
                renderedFromCache = true;
            }
        } catch (e) {
            /* bỏ qua lỗi cache, rơi xuống tải mạng bình thường */
        }
    }

    // ---- PHA 2: revalidate — luôn tải dữ liệu mới ----
    try {
        const hasVisibleTable = silent && Array.isArray(allOrdersData) && allOrdersData.length > 0;
        if (!renderedFromCache && !hasVisibleTable) {
            showLoading();
        } else if (hasVisibleTable) {
            hideLoading();
        }

        const response = await fetch(`${CONFIG.API_URL}?action=getRecentOrders&limit=1000&timestamp=${Date.now()}`);

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();

        if (data.success) {
            const fresh = data.orders || [];
            const changed = _ordersSignature(fresh) !== _ordersSignature(allOrdersData);
            allOrdersData = fresh;

            if (!skipRender && changed) {
                _renderOrdersFromCurrentData();
            }
            hideLoading();
            void _writeOrdersCache(fresh);
        } else {
            throw new Error(data.error || 'Failed to load data');
        }

    } catch (error) {
        console.error('Error loading orders data:', error);
        hideLoading();
        if (renderedFromCache) {
            // Đã có dữ liệu cũ trên màn hình — giữ nguyên, chỉ báo nhẹ.
            if (typeof showToast === 'function') {
                showToast('Đang hiển thị dữ liệu đã lưu (chưa kết nối được máy chủ)', 'warning');
            }
        } else {
            showError('Không thể tải dữ liệu. Vui lòng thử lại sau.');
        }
    }
}

// Refresh data
function refreshData() {
    showToast('Đang tải lại dữ liệu...', 'info');
    loadOrdersData();
}

// ============================================
// SPX FORMAT
// ============================================

// Copy SPX format
let copySPXInProgress = false; // Prevent multiple simultaneous calls

/**
 * Modal cảnh báo thiếu cân/size trước khi copy SPX
 */
function showCopySpXMissingSizeModal(missingProductNames, onConfirm) {
    const modalId = 'copySpxMissingSizeModal';
    document.getElementById(modalId)?.remove();

    const overlay = document.createElement('div');
    overlay.id = modalId;
    overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[200] p-4';

    const listItems = missingProductNames.slice(0, 12).map((n) =>
        `<li class="text-sm text-gray-800">${escapeHtml(n)}</li>`
    ).join('');
    const moreHint = missingProductNames.length > 12
        ? `<p class="text-xs text-gray-500 mt-2">… và ${missingProductNames.length - 12} sản phẩm khác</p>`
        : '';

    overlay.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-amber-200 overflow-hidden" role="dialog" aria-modal="true">
            <div class="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4">
                <h3 class="text-lg font-bold text-white flex items-center gap-2">
                    <svg class="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Thiếu cân nặng / size
                </h3>
            </div>
            <div class="p-5">
                <p class="text-sm text-gray-700 mb-3">Các sản phẩm sau chưa có cân hoặc size. In đơn (SPX) thường cần đủ thông tin.</p>
                <ul class="list-disc pl-5 max-h-40 overflow-y-auto space-y-1 mb-1">${listItems}</ul>
                ${moreHint}
                <p class="text-sm font-medium text-gray-900 mt-4">Bạn vẫn muốn copy format SPX?</p>
                <div class="flex flex-wrap gap-2 justify-end mt-5">
                    <button type="button" class="copy-spx-miss-cancel px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium">Hủy</button>
                    <button type="button" class="copy-spx-miss-ok px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium">Có, copy tiếp</button>
                </div>
            </div>
        </div>
    `;

    const close = () => overlay.remove();

    overlay.querySelector('.copy-spx-miss-cancel').addEventListener('click', close);
    overlay.querySelector('.copy-spx-miss-ok').addEventListener('click', () => {
        close();
        onConfirm();
    });
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });

    document.body.appendChild(overlay);
}

async function copySPXFormat(orderId) {
    if (copySPXInProgress) {
        showToast('Đang xử lý, vui lòng đợi...', 'warning');
        return;
    }

    const order = allOrdersData.find(o => o.id === orderId);
    if (!order) {
        showToast('Không tìm thấy đơn hàng', 'error');
        return;
    }

    const missingNames = getOrderProductsMissingSizeWeight(order);
    if (missingNames.length > 0) {
        showCopySpXMissingSizeModal(missingNames, () => {
            void copySPXFormatExecute(orderId);
        });
        return;
    }

    await copySPXFormatExecute(orderId);
}

async function copySPXFormatExecute(orderId) {
    copySPXInProgress = true;

    try {
        const order = allOrdersData.find(o => o.id === orderId);
        if (!order) {
            showToast('Không tìm thấy đơn hàng', 'error');
            return;
        }

        // Parse products（商品行格式见 orders-utils：formatSPXProductBracketLine）
        let productsText = '';
        if (order.products) {
            try {
                let products = [];
                // Try parse JSON
                try {
                    products = JSON.parse(order.products);
                } catch (e) {
                    // If not JSON, parse text format
                    const lines = order.products.split(/[,\n]/).map(line => line.trim()).filter(line => line);
                    products = lines.map(line => {
                        const match = line.match(/^(.+?)\s*[xX×]\s*(\d+)$/);
                        if (match) {
                            return { name: match[1].trim(), quantity: parseInt(match[2]) };
                        }
                        return { name: line, quantity: 1 };
                    });
                }

                const orderNotesTrim =
                    order.notes && String(order.notes).trim() ? String(order.notes).trim() : '';

                const productBracketLines = products.map((product) => {
                    const name = typeof product === 'string' ? product : (product.name || 'Sản phẩm');
                    const quantity = typeof product === 'object' && product.quantity ? product.quantity : 1;
                    const size = typeof product === 'object' && product.size ? product.size : null;
                    const weight = typeof product === 'object' && product.weight ? product.weight : null;
                    const notes = typeof product === 'object' && product.notes ? product.notes : null;
                    const sizeOrWeight = size || weight;

                    return formatSPXProductBracketLine(name, sizeOrWeight, quantity, notes);
                });

                productsText = buildSPXProductColumnText(productBracketLines, orderNotesTrim);

            } catch (e) {
                // Fallback to raw text
                productsText = order.products;
            }
        }

        // Đơn "Chờ gửi lại": gắn tiền tố [GỬI LẠI] ở đầu cột SP (tính trước khi auto đổi sang "Đã gửi hàng")
        if (productsText) {
            productsText = getSPXReshipNamePrefix(order) + productsText;
        }

        // Format: Họ và tên\nSố điện thoại\nĐịa chỉ cụ thể\nDanh sách sản phẩm
        let spxFormat = `${order.customer_name || 'N/A'}
${order.customer_phone || 'N/A'}
${order.address || 'N/A'}`;

        if (productsText) {
            spxFormat += '\n' + productsText;
        }

        // Copy to clipboard
        await navigator.clipboard.writeText(spxFormat);
        showToast('Đã copy format SPX', 'success');

        // Batch update: status + priority (render only once at the end)
        const currentStatus = order.status || 'pending';
        const needsStatusUpdate = currentStatus !== 'shipped' && currentStatus !== 'in_transit' && currentStatus !== 'delivered' && currentStatus !== 'failed';
        const needsPriorityRemoval = order.is_priority === 1;

        // Update status (skip render)
        if (needsStatusUpdate) {
            await updateOrderStatus(orderId, 'shipped', order.order_id, true, true); // silent + skipRender
        }

        // Remove priority (skip render)
        if (needsPriorityRemoval) {
            await toggleOrderPriority(orderId, 1, true, true); // silent + skipRender
        }

        // Render once after all updates — refilter để đồng bộ với bộ lọc trạng thái đang bật
        if (needsStatusUpdate || needsPriorityRemoval) {
            filterOrdersData(true);
        }
    } catch (err) {
        console.error('Failed to copy:', err);
        showToast('Lỗi khi copy', 'error');
    } finally {
        copySPXInProgress = false;
    }
}

// ============================================
// ORDER NOTES
// ============================================

// Show add/edit order notes modal
function showAddOrderNotesModal(orderId, orderCode) {
    const order = allOrdersData.find(o => o.id === orderId);
    if (!order) return;

    const currentNotes = order.notes || '';

    const modal = document.createElement('div');
    modal.id = 'orderNotesModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <!-- Header -->
            <div class="bg-gradient-to-br from-amber-600 to-orange-600 px-6 py-4 rounded-t-2xl">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                            <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </div>
                        <div>
                            <h3 class="text-lg font-bold text-white">Ghi chú đơn hàng</h3>
                            <p class="text-sm text-white/80">${escapeHtml(orderCode)}</p>
                        </div>
                    </div>
                    <button onclick="this.closest('.fixed').remove()" class="text-white/80 hover:text-white">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Content -->
            <div class="p-6">
                <label class="block text-sm font-medium text-gray-700 mb-2">Ghi chú</label>
                <textarea id="orderNotesInput" rows="5" placeholder="Nhập ghi chú cho đơn hàng..." 
                    class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none">${escapeHtml(currentNotes)}</textarea>
                <p class="text-xs text-gray-500 mt-2">💡 Ghi chú này sẽ hiển thị trong cột sản phẩm</p>
            </div>

            <!-- Footer -->
            <div class="px-6 py-4 bg-gray-50 rounded-b-2xl flex items-center justify-end gap-3 border-t border-gray-200">
                <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all font-medium">
                    Hủy
                </button>
                <button onclick="saveOrderNotes(${orderId}, '${escapeHtml(orderCode)}')" class="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
                    Lưu ghi chú
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    setTimeout(() => document.getElementById('orderNotesInput')?.focus(), 100);
}

// Save order notes
async function saveOrderNotes(orderId, orderCode) {
    const notesInput = document.getElementById('orderNotesInput');
    const notes = notesInput?.value.trim() || '';

    try {
        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'updateOrderNotes',
                orderId: orderId,
                notes: notes
            })
        });

        const data = await response.json();

        if (data.success) {
            // Close modal first
            const modal = document.getElementById('orderNotesModal');
            if (modal) modal.remove();

            // Update local data
            const orderIndex = allOrdersData.findIndex(o => o.id === orderId);
            if (orderIndex !== -1) {
                allOrdersData[orderIndex].notes = notes;
            }

            const filteredIndex = filteredOrdersData.findIndex(o => o.id === orderId);
            if (filteredIndex !== -1) {
                filteredOrdersData[filteredIndex].notes = notes;
            }

            // Re-render table and show success message
            renderOrdersTable();
            showToast('Đã lưu ghi chú', 'success');
        } else {
            throw new Error(data.error || 'Không thể lưu ghi chú');
        }
    } catch (error) {
        console.error('Error saving notes:', error);
        showToast('Không thể lưu ghi chú: ' + error.message, 'error');
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

function syncOrdersSearchClearButton() {
    const inp = document.getElementById('searchInput');
    const btn = document.getElementById('searchInputClearBtn');
    if (!inp || !btn) return;
    const has = (inp.value && inp.value.trim().length > 0);
    btn.classList.toggle('hidden', !has);
    btn.setAttribute('aria-hidden', has ? 'false' : 'true');
}

// Setup event listeners
function setupEventListeners() {
    // Create debounced search function (150ms for faster response)
    const debouncedSearch = debounce(filterOrdersData, 150);

    // Use event delegation on document to ensure events work even if elements are re-rendered
    document.addEventListener('input', function (e) {
        if (e.target.id === 'searchInput') {
            syncOrdersSearchClearButton();
            debouncedSearch();
        }
    });

    document.addEventListener('click', function (e) {
        if (!e.target.closest('#searchInputClearBtn')) return;
        e.preventDefault();
        const inp = document.getElementById('searchInput');
        if (!inp) return;
        inp.value = '';
        syncOrdersSearchClearButton();
        try {
            filterOrdersData();
        } catch (err) {
            console.error('❌ Error in filterOrdersData() after clear search:', err);
        }
        inp.focus();
    });

    document.addEventListener('change', function (e) {
        if (e.target.id === 'statusFilter') {
            try {
                filterOrdersData();
            } catch (error) {
                console.error('❌ Error in filterOrdersData():', error);
            }
        } else if (e.target.id === 'dateFilter') {
            try {
                filterOrdersData();
            } catch (error) {
                console.error('❌ Error in filterOrdersData():', error);
            }
        }
    });

    syncOrdersSearchClearButton();
}

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
        const response = await fetch(`${CONFIG.API_URL}?action=getPackagingConfig&timestamp=${Date.now()}`);
        const data = await response.json();

        if (data.success && data.config) {
            packagingConfig = data.config;
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

    // Get default items (is_default = 1)
    const defaultItems = packagingConfig.filter(item => item.is_default === 1);

    // Create a map of item costs
    const packagingPrices = {};
    defaultItems.forEach(item => {
        packagingPrices[item.item_name] = item.item_cost || 0;
    });

    // Calculate total products in cart (use currentOrderProducts, not window.cart)
    const totalProducts = currentOrderProducts.reduce((sum, item) => sum + (item.quantity || 1), 0);

    // Per-product items removed: red_string, labor_cost (already in product cost_price)
    // No per-product packaging cost anymore

    // Per-order items (fixed per order): bag_zip, bag_red, box_shipping, thank_card, paper_print, bang_dinh
    const perOrderCost =
        (packagingPrices.bag_zip || 0) +
        (packagingPrices.bag_red || 0) +
        (packagingPrices.box_shipping || 0) +
        (packagingPrices.thank_card || 0) +
        (packagingPrices.paper_print || 0) +
        (packagingPrices.bang_dinh || 0);

    const total = perOrderCost;

    return total;
}

// Load orders data from API
async function loadOrdersData() {
    try {
        showLoading();

        const response = await fetch(`${CONFIG.API_URL}?action=getRecentOrders&limit=1000&timestamp=${Date.now()}`);

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();

        if (data.success) {
            allOrdersData = data.orders || [];
            filteredOrdersData = [...allOrdersData];

            // Build search index for fast searching
            buildSearchIndex();

            // Apply default sorting (newest first)
            applySorting();
            updateDateSortIcon();
            updateAmountSortIcon();

            updateStats();
            renderOrdersTable();
            hideLoading();
        } else {
            throw new Error(data.error || 'Failed to load data');
        }

    } catch (error) {
        console.error('Error loading orders data:', error);
        hideLoading();
        showError('Không thể tải dữ liệu. Vui lòng thử lại sau.');
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

async function copySPXFormat(orderId) {
    // Prevent multiple simultaneous calls
    if (copySPXInProgress) {
        showToast('Đang xử lý, vui lòng đợi...', 'warning');
        return;
    }

    copySPXInProgress = true;

    try {
        const order = allOrdersData.find(o => o.id === orderId);
        if (!order) {
            showToast('Không tìm thấy đơn hàng', 'error');
            return;
        }

        // Helper function to format product name with size/weight
        // Logic: Only "cm" suffix = size tay, everything else = cân nặng (kg)
        function formatProductNameWithSize(name, size) {
            if (!size) return name;
            
            const sizeStr = size.toString().toLowerCase().trim();
            
            // Check if size contains 'cm' - for bracelet size
            if (sizeStr.includes('cm')) {
                const cmValue = sizeStr.replace(/[^0-9.]/g, '');
                return `${name} cho size tay ${cmValue}cm`;
            }
            
            // Everything else is weight (kg) - including numbers without suffix
            const kgValue = sizeStr.replace(/[^0-9.]/g, '');
            if (kgValue) {
                return `${name} cho bé ${kgValue}kg`;
            }
            
            // If no number found, return as is
            return name;
        }

        // Parse products
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

                // Format each product
                const productLines = products.map((product, index) => {
                    const name = typeof product === 'string' ? product : (product.name || 'Sản phẩm');
                    const quantity = typeof product === 'object' && product.quantity ? product.quantity : 1;
                    const size = typeof product === 'object' && product.size ? product.size : null;
                    const weight = typeof product === 'object' && product.weight ? product.weight : null;
                    const notes = typeof product === 'object' && product.notes ? product.notes : null;

                    // Determine which field to use for formatting
                    // Priority: size > weight
                    let sizeOrWeight = size || weight;
                    
                    // Format product name with size/weight (like Excel export)
                    const formattedName = formatProductNameWithSize(name, sizeOrWeight);

                    // Build product line
                    let line = formattedName;
                    line += ` - Số lượng: ${quantity}`;

                    // Add notes if exists
                    if (notes) {
                        line += ` - Lưu ý: ${notes}`;
                    }

                    // Wrap in brackets
                    return `[${line}]`;
                });

                // Join products with " ----- " separator (on same line)
                productsText = productLines.join(' ----- ');

                // Add order notes if exists and has multiple products
                if (products.length >= 2 && order.notes && order.notes.trim()) {
                    productsText += ` ----- Lưu ý tổng: ${order.notes.trim()}`;
                }
            } catch (e) {
                // Fallback to raw text
                productsText = order.products;
            }
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

        // Render once after all updates
        if (needsStatusUpdate || needsPriorityRemoval) {
            applySorting();
            renderOrdersTable();
        }
    } catch (err) {
        console.error('Failed to copy:', err);
        showToast('Lỗi khi copy', 'error');
    } finally {
        // Always release the lock
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

// Setup event listeners
function setupEventListeners() {
    // Create debounced search function (150ms for faster response)
    const debouncedSearch = debounce(filterOrdersData, 150);

    // Use event delegation on document to ensure events work even if elements are re-rendered
    document.addEventListener('input', function (e) {
        if (e.target.id === 'searchInput') {
            debouncedSearch();
        }
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
}

// Best Selling Products Quick Add
// Display top 6 best selling products for quick order creation

let bestSellingProducts = [];

// Load best selling products
async function loadBestSellingProducts() {
    try {
        const response = await fetch(`${CONFIG.API_URL}?action=getAllProducts&timestamp=${Date.now()}`);
        const data = await response.json();
        
        if (data.success) {
            // Sort by purchases (descending) and take top 6
            bestSellingProducts = (data.products || [])
                .filter(p => p.is_active !== 0 && (p.purchases || 0) > 0)
                .sort((a, b) => (b.purchases || 0) - (a.purchases || 0))
                .slice(0, 6);
            
            console.log('🔥 Loaded top 6 best selling products:', bestSellingProducts);
        }
    } catch (error) {
        console.error('❌ Error loading best selling products:', error);
    }
}

// Render best selling products box
function renderBestSellingProductsBox() {
    if (bestSellingProducts.length === 0) {
        return `
            <div class="bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-200 rounded-xl p-4 mb-4">
                <div class="flex items-center gap-2 mb-3">
                    <div class="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                        <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                    </div>
                    <h3 class="font-bold text-gray-900">🔥 Sản phẩm bán chạy</h3>
                    <span class="ml-auto text-xs text-gray-500">Chọn nhanh</span>
                </div>
                <p class="text-sm text-gray-500 text-center py-4">Chưa có sản phẩm bán chạy</p>
            </div>
        `;
    }

    return `
        <div class="bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-200 rounded-xl p-4 mb-4">
            <!-- Header -->
            <div class="flex items-center gap-2 mb-3">
                <div class="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center shadow-lg">
                    <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                </div>
                <h3 class="font-bold text-gray-900">🔥 Sản phẩm bán chạy</h3>
                <span class="ml-auto text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-semibold">Top 6</span>
            </div>

            <!-- Products Grid: 3 rows x 2 columns -->
            <div class="grid grid-cols-2 gap-2">
                ${bestSellingProducts.map(product => createQuickProductCard(product)).join('')}
            </div>
        </div>
    `;
}

// Create quick product card
function createQuickProductCard(product) {
    const price = formatCurrency(product.price || 0);
    const purchases = product.purchases || 0;
    const safeName = escapeHtml(product.name).replace(/'/g, '&#39;');
    
    return `
        <div class="bg-white border-2 border-orange-200 rounded-lg p-3 hover:border-orange-400 hover:shadow-md transition-all cursor-pointer group"
             onclick="quickAddProduct(${product.id}, '${safeName}', ${product.price || 0}, ${product.cost_price || 0})">
            <!-- Product Info -->
            <div class="flex items-start gap-2 mb-2">
                <div class="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-400 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    ${product.name.charAt(0).toUpperCase()}
                </div>
                <div class="flex-1 min-w-0">
                    <h4 class="text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-orange-600 transition-colors" title="${escapeHtml(product.name)}">
                        ${escapeHtml(product.name)}
                    </h4>
                </div>
            </div>

            <!-- Price & Sales -->
            <div class="flex items-center justify-between mb-2">
                <span class="text-base font-bold text-green-600">${price}</span>
                <span class="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">
                    🔥 ${purchases}
                </span>
            </div>

            <!-- Quick Actions -->
            <div class="flex items-center gap-1">
                <!-- Quantity Input -->
                <div class="flex items-center border border-gray-300 rounded-md overflow-hidden flex-1">
                    <button onclick="event.stopPropagation(); decrementQuickQty(${product.id})" 
                            class="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm">
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M20 12H4" />
                        </svg>
                    </button>
                    <input type="number" 
                           id="quick-qty-${product.id}" 
                           value="1" 
                           min="1" 
                           onclick="event.stopPropagation()"
                           class="w-full text-center text-sm font-semibold border-0 focus:ring-0 py-1 px-1" 
                           style="max-width: 40px;">
                    <button onclick="event.stopPropagation(); incrementQuickQty(${product.id})" 
                            class="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm">
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 4v16m8-8H4" />
                        </svg>
                    </button>
                </div>

                <!-- Add Button -->
                <button onclick="event.stopPropagation(); quickAddProductWithQty(${product.id}, '${safeName}', ${product.price || 0}, ${product.cost_price || 0})"
                        class="px-3 py-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-md text-xs font-semibold shadow-sm transition-all flex items-center gap-1">
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                    Thêm
                </button>
            </div>
        </div>
    `;
}

// Increment quantity
function incrementQuickQty(productId) {
    const input = document.getElementById(`quick-qty-${productId}`);
    if (input) {
        input.value = parseInt(input.value || 1) + 1;
    }
}

// Decrement quantity
function decrementQuickQty(productId) {
    const input = document.getElementById(`quick-qty-${productId}`);
    if (input) {
        const currentVal = parseInt(input.value || 1);
        if (currentVal > 1) {
            input.value = currentVal - 1;
        }
    }
}

// Quick add product with default quantity 1
function quickAddProduct(productId, productName, price, costPrice) {
    quickAddProductWithQty(productId, productName, price, costPrice);
}

// Quick add product with custom quantity
function quickAddProductWithQty(productId, productName, price, costPrice) {
    const qtyInput = document.getElementById(`quick-qty-${productId}`);
    const quantity = qtyInput ? parseInt(qtyInput.value || 1) : 1;
    
    // Find product in best selling list
    const product = bestSellingProducts.find(p => p.id === productId);
    if (!product) {
        console.error('Product not found:', productId);
        return;
    }

    // Create product object for cart
    const productToAdd = {
        id: product.id,
        name: product.name,
        price: product.price || 0,
        cost_price: product.cost_price || 0,
        quantity: quantity,
        size: null,
        notes: null
    };

    // Add to cart (assuming there's a global function)
    if (typeof addProductToCart === 'function') {
        addProductToCart(productToAdd);
        showToast(`Đã thêm ${quantity}x ${product.name}`, 'success');
        
        // Reset quantity to 1
        if (qtyInput) {
            qtyInput.value = 1;
        }
    } else if (typeof window.addToOrderCart === 'function') {
        window.addToOrderCart(productToAdd);
        showToast(`Đã thêm ${quantity}x ${product.name}`, 'success');
        
        // Reset quantity to 1
        if (qtyInput) {
            qtyInput.value = 1;
        }
    } else {
        console.error('❌ Cart function not found. Please implement addProductToCart() or window.addToOrderCart()');
        showToast('Chức năng thêm sản phẩm chưa được kết nối', 'error');
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Load best selling products when page loads
    loadBestSellingProducts();
});

// Export functions for use in other files
window.loadBestSellingProducts = loadBestSellingProducts;
window.renderBestSellingProductsBox = renderBestSellingProductsBox;

/**
 * Orders Product Inline Quick-Edit
 *
 * Cho phép sửa nhanh tên / số lượng / size / giá của 1 sản phẩm trong đơn
 * ngay trên danh sách (không cần mở modal), theo mô hình Optimistic UI:
 *   1. Cập nhật UI + allOrdersData/filteredOrdersData ngay lập tức
 *   2. Gọi API nền (updateOrderProducts)
 *   3. Nếu API lỗi -> rollback UI + data về giá trị cũ, báo toast lỗi
 *
 * Dependencies (đã có sẵn trong bundle):
 * - allOrdersData, filteredOrdersData (global, từ orders-constants.js)
 * - updateOrderData() từ orders-constants.js
 * - escapeHtml(), formatCurrency(), parsePrice(), formatVnMoneyInput(),
 *   normalizeOrderItemSizeClient(), formatWeightSize() từ orders-utils.js
 * - showToast() từ toast-manager.js
 * - CONFIG.API_URL từ config.js
 * - _shouldFreeship(), _getCustomerShippingFee() từ orders-edit-modals.js
 */

// ============================================
// STYLES (tiêm 1 lần, tránh phải sửa pipeline CSS riêng)
// ============================================

(function injectInlineEditStyles() {
    if (document.getElementById('inline-edit-styles')) return;
    const style = document.createElement('style');
    style.id = 'inline-edit-styles';
    style.textContent = `
        .inline-edit-input {
            border: 1.5px solid #3b82f6;
            border-radius: 4px;
            padding: 1px 5px;
            font: inherit;
            font-size: inherit;
            font-weight: inherit;
            color: inherit;
            background: #fff;
            outline: none;
            box-shadow: 0 0 0 2px rgba(59,130,246,0.15);
            max-width: 100%;
        }
        .inline-edit-input--qty {
            width: 3.2em;
            text-align: center;
            padding: 1px 3px;
        }
        .inline-edit-input--price {
            width: 6.5em;
            text-align: right;
        }
        [data-inline-field] {
            transition: background-color 0.15s ease;
        }
        [data-inline-editing="1"] {
            background: transparent !important;
        }
    `;
    document.head.appendChild(style);
})();

// ============================================
// STATE
// ============================================

/** Field đang được edit tại 1 thời điểm (tránh mở nhiều input cùng lúc gây rối) */
let inlineEditActiveKey = null;

/** Debounce lưu theo từng dòng sản phẩm (orderId_index) để tránh spam API khi gõ nhanh */
const inlineEditSaveTimers = {};

/** Version counter theo dòng sản phẩm — chặn race condition khi gõ/lưu liên tiếp */
const inlineEditVersions = {};

// ============================================
// HELPERS
// ============================================

function inlineEditRowKey(orderId, index) {
    return `${orderId}_${index}`;
}

function inlineEditGetOrder(orderId) {
    return (typeof allOrdersData !== 'undefined' && Array.isArray(allOrdersData))
        ? allOrdersData.find(o => Number(o.id) === Number(orderId))
        : null;
}

/** Parse mảng products (JSON hoặc text) từ order.products */
function inlineEditParseProducts(order) {
    let products = [];
    try {
        products = JSON.parse(order.products);
    } catch (e) {
        const lines = String(order.products || '').split(/[,\n]/).map(l => l.trim()).filter(Boolean);
        products = lines.map(line => {
            const m = line.match(/^(.+?)\s*[xX×]\s*(\d+)$/);
            return m ? { name: m[1].trim(), quantity: parseInt(m[2], 10) } : { name: line, quantity: 1 };
        });
    }
    if (!Array.isArray(products)) products = [];
    return products;
}

function inlineEditNormalizeProduct(product) {
    if (typeof product === 'string') {
        const m = product.match(/^(.+?)\s*[xX×]\s*(\d+)$/);
        return m ? { name: m[1].trim(), quantity: parseInt(m[2], 10) } : { name: product, quantity: 1 };
    }
    if (!product || typeof product !== 'object') return { name: '', quantity: 1 };
    return product;
}

// ============================================
// ENTER EDIT MODE (click vào field)
// ============================================

/**
 * @param {HTMLElement} displayEl - span/element đang hiển thị giá trị
 * @param {number} orderId
 * @param {number} index - vị trí sản phẩm trong mảng products
 * @param {'name'|'quantity'|'size'|'price'} field
 */
function inlineEditStart(displayEl, orderId, index, field) {
    if (!displayEl || displayEl.dataset.editing === '1') return;

    // Đóng field khác đang mở (nếu có) trước khi mở field mới
    if (inlineEditActiveKey && inlineEditActiveKey !== `${orderId}_${index}_${field}`) {
        const prevEl = document.querySelector('[data-inline-editing="1"]');
        if (prevEl && typeof prevEl._inlineEditCommit === 'function') {
            prevEl._inlineEditCommit();
        }
    }

    const order = inlineEditGetOrder(orderId);
    if (!order) { showToast('Không tìm thấy đơn hàng', 'error'); return; }

    const products = inlineEditParseProducts(order);
    if (index < 0 || index >= products.length) { showToast('Không tìm thấy sản phẩm', 'error'); return; }
    const product = inlineEditNormalizeProduct(products[index]);

    let currentValue = '';
    let inputType = 'text';
    let inputClass = 'inline-edit-input';
    if (field === 'name') {
        currentValue = product.name || '';
    } else if (field === 'quantity') {
        currentValue = String(parseInt(product.quantity, 10) || 1);
        inputType = 'text';
        inputClass += ' inline-edit-input--qty';
    } else if (field === 'size') {
        currentValue = product.size || product.weight || '';
    } else if (field === 'price') {
        const priceNum = parsePrice(product.price) * (parseInt(product.quantity, 10) || 1);
        currentValue = priceNum > 0 ? formatVnIntegerString(priceNum) : '';
        inputClass += ' inline-edit-input--price';
    }

    const rect = displayEl.getBoundingClientRect();
    const minWidth = Math.max(rect.width, field === 'name' ? 80 : 36);

    const input = document.createElement('input');
    input.type = inputType;
    input.value = currentValue;
    input.className = inputClass;
    input.style.minWidth = minWidth + 'px';
    if (field === 'quantity') {
        input.inputMode = 'numeric';
        input.autocomplete = 'off';
    } else if (field === 'price') {
        input.inputMode = 'numeric';
        input.autocomplete = 'off';
        input.placeholder = '0';
    } else if (field === 'size') {
        input.placeholder = 'VD: Size M, 5kg...';
    } else if (field === 'name') {
        input.placeholder = 'Tên sản phẩm';
    }

    displayEl.dataset.editing = '1';
    displayEl.setAttribute('data-inline-editing', '1');
    const originalContent = displayEl.innerHTML;
    displayEl.innerHTML = '';
    displayEl.appendChild(input);

    input.focus();
    if (input.setSelectionRange) {
        const len = input.value.length;
        try { input.setSelectionRange(len, len); } catch (e) { /* ignore */ }
    } else {
        input.select();
    }

    inlineEditActiveKey = `${orderId}_${index}_${field}`;

    let committed = false;
    let cancelled = false;

    const restoreDisplay = () => {
        displayEl.removeAttribute('data-inline-editing');
        delete displayEl.dataset.editing;
        delete displayEl._inlineEditCommit;
        if (inlineEditActiveKey === `${orderId}_${index}_${field}`) inlineEditActiveKey = null;
    };

    const commit = () => {
        if (committed || cancelled) return;
        committed = true;
        const rawValue = input.value;
        restoreDisplay();
        inlineEditApply(orderId, index, field, rawValue, originalContent, displayEl);
    };

    const cancel = () => {
        if (committed || cancelled) return;
        cancelled = true;
        restoreDisplay();
        displayEl.innerHTML = originalContent;
    };

    displayEl._inlineEditCommit = commit;

    if (field === 'price') {
        input.addEventListener('input', () => formatVnMoneyInput(input));
    } else if (field === 'quantity') {
        input.addEventListener('input', () => {
            const digits = input.value.replace(/\D/g, '');
            input.value = digits;
        });
    }

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
        }
    });

    input.addEventListener('blur', () => {
        // Nhường 1 tick cho trường hợp blur do click nút khác gây ra thao tác riêng
        setTimeout(commit, 0);
    });
}

// ============================================
// APPLY CHANGE — Optimistic UI + API nền
// ============================================

function inlineEditApply(orderId, index, field, rawValue, originalContent, displayEl) {
    const order = inlineEditGetOrder(orderId);
    if (!order) { displayEl.innerHTML = originalContent; return; }

    const products = inlineEditParseProducts(order);
    if (index < 0 || index >= products.length) { displayEl.innerHTML = originalContent; return; }

    const oldProductsSnapshot = JSON.stringify(products);
    const product = inlineEditNormalizeProduct(products[index]);
    const oldQuantity = parseInt(product.quantity, 10) || 1;

    let changed = false;

    if (field === 'name') {
        const newName = rawValue.trim();
        if (!newName) { displayEl.innerHTML = originalContent; return; }
        if (newName !== (product.name || '')) {
            product.name = newName;
            changed = true;
        }
    } else if (field === 'quantity') {
        let newQty = parseInt(rawValue, 10);
        if (!Number.isFinite(newQty) || newQty < 1) newQty = 1;
        if (newQty > 9999) newQty = 9999;
        if (newQty !== oldQuantity) {
            product.quantity = newQty;
            changed = true;
        }
    } else if (field === 'size') {
        const newSizeRaw = rawValue.trim();
        const newSizeNorm = normalizeOrderItemSizeClient(newSizeRaw || null) || '';
        const oldSizeNorm = normalizeOrderItemSizeClient(product.size || product.weight || null) || '';
        if (newSizeNorm !== oldSizeNorm) {
            if (newSizeNorm) {
                product.size = newSizeNorm;
                delete product.weight;
            } else {
                delete product.size;
                delete product.weight;
            }
            changed = true;
        }
    } else if (field === 'price') {
        const totalPrice = parsePrice(rawValue);
        const qty = parseInt(product.quantity, 10) || 1;
        const newUnitPrice = totalPrice > 0 ? totalPrice / qty : 0;
        const oldUnitPrice = parsePrice(product.price);
        if (Math.round(newUnitPrice) !== Math.round(oldUnitPrice)) {
            if (newUnitPrice > 0) {
                product.price = newUnitPrice;
            } else {
                delete product.price;
            }
            changed = true;
        }
    }

    if (!changed) {
        displayEl.innerHTML = originalContent;
        return;
    }

    products[index] = product;

    // ---- 1. OPTIMISTIC: cập nhật DOM ngay ----
    inlineEditRenderField(displayEl, field, product);
    inlineEditUpdateSiblingFields(orderId, index, product);

    // ---- 2. Cập nhật local data ngay (allOrdersData / filteredOrdersData) ----
    const updatedProductsJson = JSON.stringify(products);
    const currentShippingFee = order.shipping_fee || 0;
    const shouldFreeship = (typeof _shouldFreeship === 'function') ? _shouldFreeship(products) : false;
    const newShippingFee = shouldFreeship ? 0
        : (currentShippingFee === 0 && typeof _getCustomerShippingFee === 'function' ? _getCustomerShippingFee() : currentShippingFee);

    updateOrderData(orderId, { products: updatedProductsJson, shipping_fee: newShippingFee });
    inlineEditUpdateRowTotalIfVisible(orderId);

    // ---- 3. Debounce + version guard rồi gọi API nền ----
    const rowKey = inlineEditRowKey(orderId, index);
    inlineEditVersions[rowKey] = (inlineEditVersions[rowKey] || 0) + 1;
    const myVersion = inlineEditVersions[rowKey];

    if (inlineEditSaveTimers[rowKey]) {
        clearTimeout(inlineEditSaveTimers[rowKey]);
    }

    inlineEditSaveTimers[rowKey] = setTimeout(() => {
        delete inlineEditSaveTimers[rowKey];
        inlineEditPersist(orderId, myVersion, rowKey, updatedProductsJson, newShippingFee, oldProductsSnapshot, currentShippingFee, displayEl, field, product);
    }, 450);
}

/** Render lại nội dung field vừa sửa (không đụng phần còn lại của item) */
function inlineEditRenderField(displayEl, field, product) {
    if (field === 'name') {
        displayEl.innerHTML = escapeHtml(product.name || '');
        displayEl.title = product.name || '';
    } else if (field === 'quantity') {
        displayEl.textContent = '×' + (parseInt(product.quantity, 10) || 1);
    } else if (field === 'size') {
        const sizeVal = product.size || product.weight || '';
        displayEl.innerHTML = sizeVal ? escapeHtml(formatWeightSize(sizeVal)) : '<span class="font-medium">Chưa có</span>';
    } else if (field === 'price') {
        const qty = parseInt(product.quantity, 10) || 1;
        const priceNum = parsePrice(product.price) * qty;
        displayEl.innerHTML = priceNum > 0 ? escapeHtml(formatCurrency(priceNum)) : '<span class="text-gray-400">Chưa có</span>';
    }
}

/**
 * Khi sửa quantity thì giá tổng dòng cũng đổi (vì giá lưu là đơn giá x SL) —
 * cần render lại field price hiển thị của cùng dòng sản phẩm nếu có trên DOM.
 */
function inlineEditUpdateSiblingFields(orderId, index, product) {
    const priceEl = document.querySelector(`[data-inline-field="price"][data-order-id="${orderId}"][data-index="${index}"]`);
    if (priceEl && priceEl.dataset.editing !== '1') {
        inlineEditRenderField(priceEl, 'price', product);
    }
}

/** Cập nhật tổng tiền đơn hàng hiển thị trên bảng (nếu có ô riêng cho tổng tiền đơn) */
function inlineEditUpdateRowTotalIfVisible(orderId) {
    if (typeof recalcOrderTotalsClientSide === 'function') {
        try { recalcOrderTotalsClientSide(orderId); } catch (e) { /* best-effort, không chặn flow chính */ }
    }
}

// ============================================
// PERSIST — gọi API nền, rollback nếu lỗi
// ============================================

async function inlineEditPersist(orderId, myVersion, rowKey, productsJson, shippingFee, oldProductsSnapshot, oldShippingFee, displayEl, field, product) {
    // Nếu đã có thay đổi mới hơn (version khác) thì bỏ request này, request mới nhất sẽ lo việc lưu
    if (inlineEditVersions[rowKey] !== myVersion) return;

    try {
        const response = await fetch(`${CONFIG.API_URL}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'updateOrderProducts',
                orderId: orderId,
                products: productsJson,
                shipping_fee: shippingFee
            })
        });
        const data = await response.json();

        if (!data.success) throw new Error(data.error || 'Không thể cập nhật');

        // Nếu vẫn là request mới nhất, đồng bộ số liệu server trả về (total_amount, commission, ...)
        if (inlineEditVersions[rowKey] === myVersion) {
            const updates = {};
            if (data.total_amount !== undefined) updates.total_amount = data.total_amount;
            if (data.shipping_fee !== undefined) updates.shipping_fee = data.shipping_fee;
            if (data.product_cost !== undefined) updates.product_cost = data.product_cost;
            if (data.commission !== undefined) updates.commission = data.commission;
            if (Object.keys(updates).length > 0) {
                updateOrderData(orderId, updates);
                inlineEditUpdateRowTotalIfVisible(orderId);
            }
        }
    } catch (error) {
        console.error('Lỗi lưu sản phẩm (inline edit):', error);

        // Chỉ rollback nếu chưa có thay đổi mới hơn đè lên (tránh mất dữ liệu người dùng vừa gõ tiếp)
        if (inlineEditVersions[rowKey] === myVersion) {
            updateOrderData(orderId, { products: oldProductsSnapshot, shipping_fee: oldShippingFee });
            if (typeof renderOrdersTable === 'function') renderOrdersTable({ skipRowAnimation: true });
        }

        showToast('Không thể lưu thay đổi, đã hoàn tác: ' + error.message, 'error');
    }
}

// ============================================
// GLOBAL: đóng input đang mở khi click ra ngoài
// ============================================

document.addEventListener('click', (e) => {
    const openEl = document.querySelector('[data-inline-editing="1"]');
    if (!openEl) return;
    if (openEl.contains(e.target)) return;
    if (typeof openEl._inlineEditCommit === 'function') {
        openEl._inlineEditCommit();
    }
}, true);

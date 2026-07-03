// ============================================
// ORDER DUPLICATION & FULL EDIT SEED
// ============================================

function parseOrderProductsFromOrderField(order) {
    try {
        const products = JSON.parse(order.products);
        if (!Array.isArray(products)) throw new Error('not array');
        return products;
    } catch (e) {
        const lines = order.products.split(/[,\n]/).map(line => line.trim()).filter(line => line);
        return lines.map(line => {
            const match = line.match(/^(.+?)\s*[xX×]\s*(\d+)$/);
            if (match) {
                return { name: match[1].trim(), quantity: parseInt(match[2], 10) };
            }
            return { name: line, quantity: 1 };
        });
    }
}

function buildLocalProductIdMapByNames(productNames) {
    const productIdMap = {};
    if (productNames.length > 0 && typeof allProductsList !== 'undefined' && allProductsList.length > 0) {
        allProductsList.forEach(p => {
            if (p.name && productNames.includes(p.name)) {
                productIdMap[p.name] = p.id;
            }
        });
    }
    return productIdMap;
}

function applyProductPricingAndIds(products, productIdMap) {
    return products.map(product => {
        const cleanProduct = { ...product };
        if (cleanProduct.price !== undefined && cleanProduct.price !== null) {
            cleanProduct.price = parsePrice(cleanProduct.price);
        }
        if (cleanProduct.cost_price !== undefined && cleanProduct.cost_price !== null) {
            cleanProduct.cost_price = parsePrice(cleanProduct.cost_price);
        }
        if (!cleanProduct.product_id && cleanProduct.name && productIdMap[cleanProduct.name]) {
            cleanProduct.product_id = productIdMap[cleanProduct.name];
        }
        return cleanProduct;
    });
}

async function fetchRemoteProductIdsIntoMap(productNames, productIdMap) {
    const missingNames = productNames.filter(n => !productIdMap[n]);
    if (missingNames.length === 0) return;
    try {
        const response = await fetch(`${CONFIG.API_URL}?action=getProductsByNames&names=${encodeURIComponent(JSON.stringify(missingNames))}`);
        const data = await response.json();
        if (data.success && data.products) {
            data.products.forEach(p => { productIdMap[p.name] = p.id; });
        }
    } catch (e) {
        console.warn('Could not lookup product IDs:', e);
    }
}

/** Chỉ cache local — không await mạng; dùng để mở modal sửa đơn ngay. */
function parseOrderProductsForModalSync(order) {
    const raw = parseOrderProductsFromOrderField(order);
    const productNames = raw.map(p => p.name).filter(Boolean);
    const productIdMap = buildLocalProductIdMapByNames(productNames);
    return applyProductPricingAndIds(raw, productIdMap);
}

/**
 * Parse products JSON (or legacy text) and enrich with product_id from API.
 */
async function parseOrderProductsForModal(order) {
    const raw = parseOrderProductsFromOrderField(order);
    const productNames = raw.map(p => p.name).filter(Boolean);
    const productIdMap = buildLocalProductIdMapByNames(productNames);
    await fetchRemoteProductIdsIntoMap(productNames, productIdMap);
    return applyProductPricingAndIds(raw, productIdMap);
}

/**
 * @param {'duplicate'|'edit'} mode
 * @param {{ deferRemoteProductLookup?: boolean }} [opts] — edit: true = không chờ API getProductsByNames (mở modal tức thì)
 */
async function ensureOrderFullForEdit(order) {
    if (!order) return order;
    if (Object.prototype.hasOwnProperty.call(order, 'street_address')) return order;
    try {
        const r = await fetch(`${CONFIG.API_URL}?action=getOrderById&id=${encodeURIComponent(order.id)}&timestamp=${Date.now()}`);
        const d = await r.json();
        if (d?.success && d.order) {
            Object.assign(order, d.order);
            if (typeof updateOrderData === 'function') {
                updateOrderData(order.id, d.order);
            }
        }
    } catch (_) { /* giữ dữ liệu list */ }
    return order;
}

async function buildOrderModalSeed(order, mode, opts = {}) {
    const products = opts.deferRemoteProductLookup
        ? parseOrderProductsForModalSync(order)
        : await parseOrderProductsForModal(order);
    const base = {
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        address: order.address,
        province_id: order.province_id,
        province_name: order.province_name,
        district_id: order.district_id,
        district_name: order.district_name,
        ward_id: order.ward_id,
        ward_name: order.ward_name,
        street_address: order.street_address,
        payment_method: order.payment_method,
        shipping_fee: order.shipping_fee || 0,
        shipping_cost: order.shipping_cost || 0,
        products
    };

    if (mode === 'duplicate') {
        return {
            ...base,
            referral_code: '',
            is_priority: false,
            notes: '',
            status: 'pending',
            discount_code: '',
            discount_amount: 0,
            discount_id: '',
            deposit_amount: 0,
            customer_source: order.customer_source || order.customerSource || ''
        };
    }

    let discountId = '';
    const dc = (order.discount_code || '').trim();
    if (dc && Array.isArray(allDiscountsList)) {
        const upper = dc.toUpperCase();
        const d = allDiscountsList.find(x =>
            String(x.code || x.discount_code || '').toUpperCase() === upper
        );
        if (d) discountId = String(d.id);
    }

    return {
        ...base,
        referral_code: order.referral_code || '',
        is_priority: Number(order.is_priority) === 1,
        notes: order.notes || '',
        status: order.status || 'pending',
        planned_send_at_unix: order.planned_send_at_unix ?? null,
        discount_code: order.discount_code || '',
        discount_amount: order.discount_amount || 0,
        discount_id: discountId || (order.discount_id != null && order.discount_id !== ''
            ? String(order.discount_id)
            : ''),
        deposit_amount: getOrderDepositAmount(order),
        customer_source: order.customer_source || '',
        order_display_id: order.order_id || ''
    };
}

/**
 * Duplicate an existing order (CTV / ưu tiên / ghi chú / giảm giá không sao chép)
 */
async function duplicateOrder(orderId) {
    const order = allOrdersData.find(o => o.id === orderId);
    if (!order) {
        showToast('Không tìm thấy đơn hàng', 'error');
        return;
    }
    showAddOrderModal(await buildOrderModalSeed(order, 'duplicate'));
}

/**
 * Mở cùng form với thêm đơn, đủ trường để sửa toàn bộ đơn đã có.
 */
async function editFullOrder(orderId) {
    const order = allOrdersData.find(o => o.id === orderId);
    if (!order) {
        showToast('Không tìm thấy đơn hàng', 'error');
        return;
    }
    await ensureOrderFullForEdit(order);
    // Không chặn UI: discount + lookup product_id từ xa chạy song song / sau khi modal đã hiện
    if (allDiscountsList.length === 0 && typeof loadActiveDiscounts === 'function') {
        void loadActiveDiscounts();
    }
    const seed = await buildOrderModalSeed(order, 'edit', { deferRemoteProductLookup: true });
    showAddOrderModal(seed, { mode: 'edit', editOrderDbId: order.id });

    const orderIdStr = String(order.id);
    void parseOrderProductsForModal(order).then((enriched) => {
        const modal = document.getElementById('addOrderModal');
        const hid = document.getElementById('orderFormEditDbId');
        if (!modal || !hid || String(hid.value).trim() !== orderIdStr) return;
        currentOrderProducts = enriched;
        if (typeof renderOrderProducts === 'function') renderOrderProducts();
        if (typeof updateOrderSummary === 'function') updateOrderSummary();
    }).catch((err) => console.warn('Deferred product enrich:', err));
}

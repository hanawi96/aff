import { normalizeOrderItemSize } from '../../utils/order-item-size.js';

/**
 * Tính toán đầy đủ giá trị lưu DB + dòng order_items (dùng chung create / update đơn).
 */
export async function computeOrderSnapshot(data, env) {
    const totalAmount = data.total || data.totalAmount || 0;
    const totalAmountNumber = typeof totalAmount === 'string'
        ? parseInt(String(totalAmount).replace(/[^\d]/g, ''), 10) || 0
        : totalAmount;

    let validReferralCode = null;
    let finalCommission = 0;
    let finalCommissionRate = 0;
    let ctvPhone = null;

    const refCode = (data.referral_code || data.referralCode || '').trim();
    if (refCode) {
        const ctvData = await env.DB.prepare(`
            SELECT referral_code, commission_rate, phone, status
            FROM ctv
            WHERE referral_code = ? OR custom_slug = ?
            LIMIT 1
        `).bind(refCode, refCode).first();

        const isStatusValid = ctvData?.status === 'Mới' || ctvData?.status === 'Đang hoạt động';
        if (ctvData && isStatusValid) {
            validReferralCode = ctvData.referral_code;
            ctvPhone = ctvData.phone || null;
            finalCommissionRate = ctvData.commission_rate || 0.12;
            const shippingFee = data.shipping_fee || data.shippingFee || 0;
            const revenue = totalAmountNumber - shippingFee;
            finalCommission = Math.round(revenue * finalCommissionRate);
        }
    }

    const itemsNeedingLookup = data.cart.filter(item => !item.cost_price && item.name);
    const productLookupMap = {};

    if (itemsNeedingLookup.length > 0) {
        try {
            const productNames = itemsNeedingLookup.map(item => item.name);
            const productIds = itemsNeedingLookup.map(item => item.id || item.product_id).filter(Boolean);
            const namePlaceholders = productNames.map(() => '?').join(',');
            const idPlaceholders = productIds.length > 0 ? productIds.map(() => '?').join(',') : '';

            let query = `SELECT id, name, cost_price FROM products WHERE name IN (${namePlaceholders})`;
            const bindings = [...productNames];
            if (productIds.length > 0) {
                query += ` OR id IN (${idPlaceholders})`;
                bindings.push(...productIds);
            }
            const { results: products } = await env.DB.prepare(query).bind(...bindings).all();
            products.forEach(product => {
                productLookupMap[product.name] = product;
                if (product.id) productLookupMap[product.id] = product;
            });
        } catch (error) {
            console.error('Error batch fetching products:', error);
        }
    }

    const shippingFee = data.shippingFee || data.shipping_fee || 0;
    const shippingCost = data.shippingCost || data.shipping_cost || 0;

    const packagingCacheKey = 'packaging_config_v1';
    let packagingConfig;
    try {
        if (env.KV) {
            const cached = await env.KV.get(packagingCacheKey, 'json');
            if (cached) packagingConfig = cached;
        }
    } catch (_) { /* ignore */ }

    if (!packagingConfig) {
        const { results } = await env.DB.prepare(`
            SELECT item_name, item_cost, display_name
            FROM cost_config
            WHERE category_id = 5 AND is_default = 1
            ORDER BY item_name ASC
        `).all();
        packagingConfig = results;
        if (env.KV) {
            try {
                await env.KV.put(packagingCacheKey, JSON.stringify(packagingConfig), { expirationTtl: 3600 });
            } catch (_) { /* ignore */ }
        }
    }

    const totalProducts = data.cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const totalPackagingCost = packagingConfig.reduce((sum, item) => sum + (item.item_cost || 0), 0);
    const perOrderItems = {};
    packagingConfig.forEach(item => {
        perOrderItems[item.item_name] = {
            cost: item.item_cost || 0,
            name: item.display_name || item.item_name
        };
    });
    const packagingDetails = {
        per_order: perOrderItems,
        total_products: totalProducts,
        per_order_cost: totalPackagingCost,
        total_cost: totalPackagingCost
    };

    const taxCacheKey = 'tax_rate_v1';
    let currentTaxRate = null;
    try {
        if (env.KV) {
            const cached = await env.KV.get(taxCacheKey);
            if (cached) currentTaxRate = parseFloat(cached);
        }
    } catch (_) { /* ignore */ }

    if (!currentTaxRate) {
        const taxRateConfig = await env.DB.prepare(`
            SELECT item_cost as tax_rate FROM cost_config WHERE item_name = 'tax_rate' LIMIT 1
        `).first();
        const rawRate = taxRateConfig?.tax_rate || 1.5;
        currentTaxRate = rawRate > 1 ? rawRate / 100 : rawRate;
        if (env.KV) {
            try {
                await env.KV.put(taxCacheKey, currentTaxRate.toString(), { expirationTtl: 3600 });
            } catch (_) { /* ignore */ }
        }
    }

    const revenue = totalAmountNumber;
    const taxAmount = Math.round(revenue * currentTaxRate);

    const discountCode = data.discountCode || data.discount_code || null;
    const discountAmount = data.discountAmount || data.discount_amount || 0;
    const discountId = data.discountId || data.discount_id || null;
    const isPriority = data.is_priority || 0;

    const itemsData = [];
    for (const item of data.cart) {
        const productName = item.name || 'Unknown';
        const quantity = item.quantity || 1;
        const productPrice = item.price || 0;
        const size = item.size || null;
        const weight = item.weight || null;
        const notes = item.notes || null;

        let productId = item.id || item.product_id || null;
        let costPrice = item.cost_price || 0;

        if (!productId || !costPrice) {
            const product = productLookupMap[productName] || productLookupMap[productId];
            if (product) {
                productId = productId || product.id;
                costPrice = costPrice || product.cost_price || 0;
            }
        }

        itemsData.push({
            productId,
            productName,
            productPrice,
            costPrice,
            quantity,
            sizeValue: normalizeOrderItemSize(size ?? weight),
            notes
        });
    }

    return {
        totalAmountNumber,
        productsJson: JSON.stringify(data.cart),
        shippingFee,
        shippingCost,
        validReferralCode,
        finalCommission,
        finalCommissionRate,
        ctvPhone,
        totalPackagingCost,
        packagingDetails,
        taxAmount,
        currentTaxRate,
        discountCode,
        discountAmount,
        discountId,
        isPriority,
        itemsData
    };
}

/**
 * Ghi lại toàn bộ dòng order_items (sau DELETE hoặc khi tạo đơn mới).
 */
export async function insertOrderLineItems(env, orderDbId, itemsData, orderDateMs) {
    if (!itemsData.length) return;
    const orderTimestamp = new Date(orderDateMs).getTime();
    const placeholders = itemsData.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const bindings = [];
    itemsData.forEach(item => {
        bindings.push(
            orderDbId,
            item.productId,
            item.productName,
            item.productPrice,
            item.costPrice,
            item.quantity,
            item.sizeValue,
            item.notes,
            orderDateMs,
            orderTimestamp
        );
    });
    await env.DB.prepare(`
        INSERT INTO order_items (
            order_id, product_id, product_name, product_price, product_cost,
            quantity, size, notes, created_at, created_at_unix
        ) VALUES ${placeholders}
    `).bind(...bindings).run();
}

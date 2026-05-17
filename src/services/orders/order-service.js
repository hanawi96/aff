import { jsonResponse } from '../../utils/response.js';
import { sendOrderNotification } from '../notifications/telegram-service.js';
import { computeOrderSnapshot, insertOrderLineItems } from './order-persist-helpers.js';

// Create new order - Main order creation function
export async function createOrder(data, env, corsHeaders) {
    try {
        if (!data.orderId) {
            return jsonResponse({ success: false, error: 'Thiếu mã đơn hàng' }, 400, corsHeaders);
        }
        if (!data.customer || !data.customer.name || !data.customer.phone) {
            return jsonResponse({ success: false, error: 'Thiếu thông tin khách hàng' }, 400, corsHeaders);
        }
        if (!data.cart || data.cart.length === 0) {
            return jsonResponse({ success: false, error: 'Giỏ hàng trống' }, 400, corsHeaders);
        }

        const snap = await computeOrderSnapshot(data, env);
        const orderDate = data.orderDate || new Date().getTime();
        const orderTimestamp = new Date(orderDate).getTime();

        const rawPlanned = data.planned_send_at_unix ?? data.plannedSendAtUnix;
        let plannedSendAtUnix = null;
        if (rawPlanned != null && rawPlanned !== '') {
            const n = Number(rawPlanned);
            if (Number.isFinite(n)) plannedSendAtUnix = Math.round(n);
        }
        const incomingStatus = String(data.status || 'pending').toLowerCase().trim();
        if (incomingStatus === 'send_later' && !plannedSendAtUnix) {
            return jsonResponse({ success: false, error: 'Đơn gửi sau cần chọn ngày giờ dự kiến gửi' }, 400, corsHeaders);
        }

        const result = await env.DB.prepare(`
            INSERT INTO orders (
                order_id, customer_name, customer_phone,
                address, products, total_amount, payment_method,
                status, referral_code, commission, commission_rate, ctv_phone, notes,
                shipping_fee, shipping_cost, packaging_cost, packaging_details,
                tax_amount, tax_rate, created_at_unix,
                province_id, province_name, district_id, district_name,
                ward_id, ward_name, street_address,
                discount_code, discount_amount, is_priority,
                planned_send_at_unix
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            data.orderId,
            data.customer.name,
            data.customer.phone,
            data.customer.address || data.address || '',
            snap.productsJson,
            snap.totalAmountNumber,
            data.paymentMethod || 'cod',
            data.status || 'pending',
            snap.validReferralCode,
            snap.finalCommission,
            snap.finalCommissionRate,
            snap.ctvPhone || null,
            data.notes || null,
            snap.shippingFee,
            snap.shippingCost,
            snap.totalPackagingCost,
            JSON.stringify(snap.packagingDetails),
            snap.taxAmount,
            snap.currentTaxRate,
            orderTimestamp,
            data.province_id || null,
            data.province_name || null,
            data.district_id || null,
            data.district_name || null,
            data.ward_id || null,
            data.ward_name || null,
            data.street_address || null,
            snap.discountCode,
            snap.discountAmount,
            snap.isPriority,
            incomingStatus === 'send_later' ? plannedSendAtUnix : null
        ).run();

        if (!result.success) {
            throw new Error('Failed to insert order into database');
        }

        const insertedOrderId = result.meta.last_row_id;

        try {
            await insertOrderLineItems(env, insertedOrderId, snap.itemsData, orderDate);
        } catch (itemsError) {
            console.error('Error inserting order items:', itemsError);
        }

        const discountCode = snap.discountCode;
        const discountId = snap.discountId;
        const discountAmount = snap.discountAmount;
        const totalAmountNumber = snap.totalAmountNumber;

        // 1.6. Insert into discount_usage if discount was applied
        if (discountCode && discountId) {
            try {
                // totalAmountNumber = productTotal + shippingFee - discountAmount (what customer pays)
                // We save totalAmountNumber as order_amount (final amount customer pays)
                
                await env.DB.prepare(`
                    INSERT INTO discount_usage (
                        discount_id, discount_code, order_id, 
                        customer_name, customer_phone,
                        order_amount, discount_amount, used_at_unix
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(
                    discountId,
                    discountCode,
                    data.orderId,
                    data.customer.name,
                    data.customer.phone,
                    totalAmountNumber, // Total amount AFTER discount (what customer actually pays)
                    discountAmount || 0,
                    orderDate // Unix timestamp (milliseconds) - same as order date
                ).run();
                console.log(`Inserted discount usage: ${discountCode} - Order Amount: ${totalAmountNumber}, Discount: ${discountAmount}`);
            } catch (discountError) {
                console.error('⚠️ Error inserting discount usage:', discountError);
                // Don't fail the order creation
            }
        }

        // 2. Gửi thông báo Telegram (async, không chờ)
        // Fire-and-forget: Không chờ response để tăng tốc độ tạo đơn
        const telegramPromise = sendOrderNotification({
            orderId: data.orderId,
            orderDate: data.orderDate || new Date().getTime(),
            customer: {
                name: data.customer.name,
                phone: data.customer.phone,
                address: data.customer.address || '',
                notes: data.customer.notes || ''
            },
            cart: data.cart,
            total: data.total || `${totalAmountNumber.toLocaleString('vi-VN')}đ`,
            paymentMethod: data.paymentMethod || 'cod',
            referralCode: snap.validReferralCode || '',
            referralCommission: snap.finalCommission || 0,
            referralPartner: data.referralPartner || ''
        }, env);

        // Use waitUntil to ensure notification completes in background
        if (env.ctx && env.ctx.waitUntil) {
            env.ctx.waitUntil(telegramPromise);
        }

        // Lưu vào Google Sheets (fire-and-forget)
        const googleScriptUrl = env.GOOGLE_APPS_SCRIPT_URL;
        if (googleScriptUrl) {
            const sheetsData = {
                orderId: data.orderId,
                orderDate: data.orderDate || new Date().getTime(),
                customer: {
                    name: data.customer.name,
                    phone: data.customer.phone,
                    address: data.customer.address || '',
                    notes: data.customer.notes || ''
                },
                cart: data.cart,
                total: data.total || `${totalAmountNumber.toLocaleString('vi-VN')}đ`,
                paymentMethod: data.paymentMethod || 'cod',
                referralCode: snap.validReferralCode || '',
                referralCommission: snap.finalCommission || 0,
                referralPartner: data.referralPartner || '',
                telegramNotification: env.SECRET_KEY || 'VDT_SECRET_2025_ANHIEN'
            };
            const sheetsPromise = fetch(googleScriptUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sheetsData)
            }).then(async r => {
                if (r.ok) console.log('✅ Saved order to Google Sheets:', data.orderId);
                else console.warn('⚠️ Failed to save to Google Sheets:', r.status, await r.text());
            }).catch(err => console.error('⚠️ Google Sheets error:', err));
            if (env.ctx?.waitUntil) env.ctx.waitUntil(sheetsPromise);
        }

        return jsonResponse({
            success: true,
            message: 'Đơn hàng đã được tạo thành công',
            orderId: data.orderId,
            commission: snap.finalCommission,
            timestamp: new Date().getTime() // UTC timestamp
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error creating order:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

/**
 * Cập nhật toàn bộ đơn (cùng logic tính toán với tạo đơn) — một request, đồng bộ orders + order_items.
 */
export async function updateOrderFull(data, env, corsHeaders) {
    try {
        const orderDbId = data.orderDbId ?? data.dbOrderId ?? data.id;
        if (!orderDbId) {
            return jsonResponse({ success: false, error: 'Thiếu orderDbId' }, 400, corsHeaders);
        }
        if (!data.customer?.name || !data.customer?.phone) {
            return jsonResponse({ success: false, error: 'Thiếu thông tin khách hàng' }, 400, corsHeaders);
        }
        if (!data.cart || data.cart.length === 0) {
            return jsonResponse({ success: false, error: 'Giỏ hàng trống' }, 400, corsHeaders);
        }

        const existing = await env.DB.prepare(
            `SELECT id, order_id, created_at_unix FROM orders WHERE id = ?`
        ).bind(orderDbId).first();

        if (!existing) {
            return jsonResponse({ success: false, error: 'Không tìm thấy đơn hàng' }, 404, corsHeaders);
        }

        const payload = { ...data, orderId: existing.order_id };
        const snap = await computeOrderSnapshot(payload, env);
        const orderDateMs = data.orderDate != null
            ? data.orderDate
            : (existing.created_at_unix || Date.now());

        const rawPlanned = data.planned_send_at_unix ?? data.plannedSendAtUnix;
        let plannedSendAtUnix = null;
        if (rawPlanned != null && rawPlanned !== '') {
            const n = Number(rawPlanned);
            if (Number.isFinite(n)) plannedSendAtUnix = Math.round(n);
        }
        const incomingStatus = String(data.status || 'pending').toLowerCase().trim();
        if (incomingStatus === 'send_later' && !plannedSendAtUnix) {
            return jsonResponse({ success: false, error: 'Đơn gửi sau cần chọn ngày giờ dự kiến gửi' }, 400, corsHeaders);
        }
        const finalPlanned = incomingStatus === 'send_later' ? plannedSendAtUnix : null;

        await env.DB.prepare(`
            UPDATE orders SET
                customer_name = ?, customer_phone = ?,
                address = ?, products = ?, total_amount = ?, payment_method = ?,
                status = ?, referral_code = ?, commission = ?, commission_rate = ?, ctv_phone = ?, notes = ?,
                shipping_fee = ?, shipping_cost = ?, packaging_cost = ?, packaging_details = ?,
                tax_amount = ?, tax_rate = ?,
                province_id = ?, province_name = ?, district_id = ?, district_name = ?,
                ward_id = ?, ward_name = ?, street_address = ?,
                discount_code = ?, discount_amount = ?, is_priority = ?,
                planned_send_at_unix = ?
            WHERE id = ?
        `).bind(
            data.customer.name,
            data.customer.phone,
            data.customer.address || data.address || '',
            snap.productsJson,
            snap.totalAmountNumber,
            data.paymentMethod || 'cod',
            data.status || 'pending',
            snap.validReferralCode,
            snap.finalCommission,
            snap.finalCommissionRate,
            snap.ctvPhone || null,
            data.notes || null,
            snap.shippingFee,
            snap.shippingCost,
            snap.totalPackagingCost,
            JSON.stringify(snap.packagingDetails),
            snap.taxAmount,
            snap.currentTaxRate,
            data.province_id || null,
            data.province_name || null,
            data.district_id || null,
            data.district_name || null,
            data.ward_id || null,
            data.ward_name || null,
            data.street_address || null,
            snap.discountCode,
            snap.discountAmount,
            snap.isPriority,
            finalPlanned,
            orderDbId
        ).run();

        await env.DB.prepare(`DELETE FROM order_items WHERE order_id = ?`).bind(orderDbId).run();
        await insertOrderLineItems(env, orderDbId, snap.itemsData, orderDateMs);

        try {
            await env.DB.prepare(`DELETE FROM discount_usage WHERE order_id = ?`).bind(existing.order_id).run();
        } catch (_) { /* ignore */ }

        if (snap.discountCode && snap.discountId) {
            try {
                await env.DB.prepare(`
                    INSERT INTO discount_usage (
                        discount_id, discount_code, order_id,
                        customer_name, customer_phone,
                        order_amount, discount_amount, used_at_unix
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(
                    snap.discountId,
                    snap.discountCode,
                    existing.order_id,
                    data.customer.name,
                    data.customer.phone,
                    snap.totalAmountNumber,
                    snap.discountAmount || 0,
                    orderDateMs
                ).run();
            } catch (discountError) {
                console.error('Error inserting discount usage (update):', discountError);
            }
        }

        return jsonResponse({
            success: true,
            message: 'Đã cập nhật đơn hàng',
            orderId: existing.order_id,
            commission: snap.finalCommission
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error updating order:', error);
        return jsonResponse({ success: false, error: error.message }, 500, corsHeaders);
    }
}

/** Mã giảm thủ công trùng với mobile admin (`m.html` M_MANUAL_DISCOUNT_CODE). */
/** Đồng bộ với `m.html`: `M_MANUAL_DISCOUNT_CODE` và legacy `GG_TH\u1ee6_C\u00d4NG`. */
const MANUAL_DISCOUNT_CODES = new Set(['GG_THU_CONG', 'GG_THỦ_CÔNG']);

function isManualDiscountCode(code) {
    const c = String(code || '').trim();
    return !c || MANUAL_DISCOUNT_CODES.has(c);
}

/**
 * Sao chép đơn theo `orders.id` (admin mobile): giỏ từ `order_items` (fallback `orders.products`),
 * giữ tổng tiền / ship / giảm giá / thuế / đóng gói / HH như đơn gốc; không gửi Telegram / Sheets.
 */
export async function duplicateOrderByDbId(data, env, corsHeaders) {
    try {
        const rawId = data.sourceOrderDbId ?? data.sourceOrderId ?? data.orderDbId;
        const sourceOrderDbId = Number(rawId);
        if (!Number.isFinite(sourceOrderDbId) || sourceOrderDbId <= 0) {
            return jsonResponse({ success: false, error: 'Thiếu hoặc không hợp lệ sourceOrderDbId (id số trong bảng orders)' }, 400, corsHeaders);
        }

        const src = await env.DB.prepare(`SELECT * FROM orders WHERE id = ?`).bind(sourceOrderDbId).first();
        if (!src) {
            return jsonResponse({ success: false, error: 'Không tìm thấy đơn hàng nguồn' }, 404, corsHeaders);
        }

        const { results: itemRows } = await env.DB.prepare(`
            SELECT
                oi.product_id,
                oi.product_name,
                oi.product_price,
                oi.product_cost,
                oi.quantity,
                oi.size,
                oi.notes,
                p.image_url AS product_image_url
            FROM order_items oi
            LEFT JOIN products p ON p.id = oi.product_id
            WHERE oi.order_id = ?
            ORDER BY oi.id ASC
        `).bind(sourceOrderDbId).all();

        /** @type {Array<Record<string, unknown>>} */
        let cart = [];
        if (itemRows && itemRows.length > 0) {
            cart = itemRows.map((row) => {
                const pid = row.product_id != null ? Number(row.product_id) : null;
                const qty = Math.max(1, Math.floor(Number(row.quantity)) || 1);
                return {
                    product_id: Number.isFinite(pid) ? pid : null,
                    id: Number.isFinite(pid) ? pid : null,
                    name: String(row.product_name || 'Unknown').trim() || 'Unknown',
                    price: Number(row.product_price) || 0,
                    cost_price: Number(row.product_cost) || 0,
                    image_url: String(row.product_image_url || '').trim(),
                    quantity: qty,
                    size: row.size != null && String(row.size).trim() !== '' ? String(row.size).trim() : null,
                    notes: row.notes != null && String(row.notes).trim() !== '' ? String(row.notes).trim() : null
                };
            });
        } else if (src.products) {
            try {
                const prods = JSON.parse(src.products);
                if (Array.isArray(prods)) {
                    for (const p of prods) {
                        const pid = p.product_id ?? p.id ?? null;
                        const nPid = pid != null ? Number(pid) : null;
                        cart.push({
                            product_id: Number.isFinite(nPid) ? nPid : null,
                            id: Number.isFinite(nPid) ? nPid : null,
                            name: String(p.name || 'Unknown').trim() || 'Unknown',
                            price: Number(p.price) || 0,
                            cost_price: Number(p.cost_price ?? p.costPrice) || 0,
                            image_url: String(p.image_url || '').trim(),
                            quantity: Math.max(1, Math.floor(Number(p.quantity)) || 1),
                            size: p.size != null && String(p.size).trim() !== '' ? String(p.size).trim() : null,
                            notes: p.notes != null && String(p.notes).trim() !== '' ? String(p.notes).trim() : null
                        });
                    }
                }
            } catch (_) {
                /* fall through */
            }
        }

        if (!cart.length) {
            return jsonResponse({ success: false, error: 'Đơn nguồn không có sản phẩm (order_items và products đều trống)' }, 400, corsHeaders);
        }

        const dcRaw = String(src.discount_code || '').trim();
        let resolvedDiscountId = null;
        if (dcRaw && !isManualDiscountCode(dcRaw)) {
            const dr = await env.DB.prepare(`SELECT id FROM discounts WHERE code = ? LIMIT 1`).bind(dcRaw).first();
            resolvedDiscountId = dr?.id != null ? Number(dr.id) : null;
        }

        const rawSt = String(src.status || 'pending').toLowerCase().trim();
        let outStatus = 'pending';
        let plannedSendAtUnix = null;
        if (rawSt === 'send_later') {
            const p = Number(src.planned_send_at_unix);
            if (Number.isFinite(p)) {
                outStatus = 'send_later';
                plannedSendAtUnix = Math.round(p);
            }
        }

        const orderDate = Date.now();
        const newOrderId = `DH${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const shF = Math.max(0, Math.round(Number(src.shipping_fee) || 0));
        const shC = Math.max(0, Math.round(Number(src.shipping_cost) || 0));
        const totalAmt = Math.max(0, Math.round(Number(src.total_amount) || 0));

        const orderData = {
            orderId: newOrderId,
            orderDate,
            customer: {
                name: String(src.customer_name || '').trim() || 'Khách hàng',
                phone: String(src.customer_phone || '').trim(),
                address: String(src.address || '').trim()
            },
            address: String(src.address || '').trim(),
            cart,
            total: totalAmt,
            totalAmount: totalAmt,
            paymentMethod: src.payment_method || 'cod',
            status: outStatus,
            planned_send_at_unix: plannedSendAtUnix,
            referralCode: String(src.referral_code || '').trim(),
            referral_code: String(src.referral_code || '').trim(),
            notes: src.notes != null && String(src.notes).trim() !== '' ? String(src.notes).trim() : null,
            shippingFee: shF,
            shipping_fee: shF,
            shippingCost: shC,
            shipping_cost: shC,
            discountCode: dcRaw || null,
            discount_code: dcRaw || null,
            discountAmount: Math.max(0, Math.round(Number(src.discount_amount) || 0)),
            discount_amount: Math.max(0, Math.round(Number(src.discount_amount) || 0)),
            discountId: resolvedDiscountId,
            discount_id: resolvedDiscountId,
            province_id: src.province_id || null,
            province_name: src.province_name || null,
            district_id: src.district_id || null,
            district_name: src.district_name || null,
            ward_id: src.ward_id || null,
            ward_name: src.ward_name || null,
            street_address: src.street_address != null && String(src.street_address).trim() !== '' ? String(src.street_address).trim() : null,
            is_priority: src.is_priority,
            isPriority: src.is_priority
        };

        if (!orderData.customer.phone) {
            return jsonResponse({ success: false, error: 'Đơn nguồn thiếu số điện thoại khách' }, 400, corsHeaders);
        }

        const snap = await computeOrderSnapshot(orderData, env);

        snap.totalAmountNumber = totalAmt;
        snap.shippingFee = shF;
        snap.shippingCost = shC;
        snap.discountCode = dcRaw || null;
        snap.discountAmount = Math.max(0, Math.round(Number(src.discount_amount) || 0));
        snap.discountId = isManualDiscountCode(dcRaw) ? null : resolvedDiscountId;
        snap.productsJson = JSON.stringify(cart);

        if (String(src.referral_code || '').trim()) {
            snap.validReferralCode = String(src.referral_code).trim();
            snap.ctvPhone = src.ctv_phone != null ? String(src.ctv_phone).trim() || null : snap.ctvPhone || null;
            snap.finalCommission = Math.round(Number(src.commission) || 0);
            snap.finalCommissionRate = Number(src.commission_rate) || 0;
        }

        try {
            if (src.packaging_details) {
                const pd = typeof src.packaging_details === 'string'
                    ? JSON.parse(src.packaging_details)
                    : src.packaging_details;
                if (pd && typeof pd === 'object') snap.packagingDetails = pd;
            }
        } catch (_) {
            /* giữ snap.packagingDetails từ compute */
        }
        snap.totalPackagingCost = Math.round(Number(src.packaging_cost) || 0) || snap.totalPackagingCost;
        snap.taxAmount = Math.round(Number(src.tax_amount) || 0) || snap.taxAmount;
        if (src.tax_rate != null && src.tax_rate !== '') {
            const tr = Number(src.tax_rate);
            if (Number.isFinite(tr)) snap.currentTaxRate = tr;
        }

        const orderTimestamp = new Date(orderDate).getTime();
        const finalPlanned = outStatus === 'send_later' ? plannedSendAtUnix : null;

        const result = await env.DB.prepare(`
            INSERT INTO orders (
                order_id, customer_name, customer_phone,
                address, products, total_amount, payment_method,
                status, referral_code, commission, commission_rate, ctv_phone, notes,
                shipping_fee, shipping_cost, packaging_cost, packaging_details,
                tax_amount, tax_rate, created_at_unix,
                province_id, province_name, district_id, district_name,
                ward_id, ward_name, street_address,
                discount_code, discount_amount, is_priority,
                planned_send_at_unix
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            newOrderId,
            orderData.customer.name,
            orderData.customer.phone,
            orderData.customer.address || orderData.address || '',
            snap.productsJson,
            snap.totalAmountNumber,
            orderData.paymentMethod || 'cod',
            outStatus,
            snap.validReferralCode,
            snap.finalCommission,
            snap.finalCommissionRate,
            snap.ctvPhone || null,
            orderData.notes || null,
            snap.shippingFee,
            snap.shippingCost,
            snap.totalPackagingCost,
            JSON.stringify(snap.packagingDetails),
            snap.taxAmount,
            snap.currentTaxRate,
            orderTimestamp,
            orderData.province_id || null,
            orderData.province_name || null,
            orderData.district_id || null,
            orderData.district_name || null,
            orderData.ward_id || null,
            orderData.ward_name || null,
            orderData.street_address || null,
            snap.discountCode,
            snap.discountAmount,
            snap.isPriority,
            finalPlanned
        ).run();

        if (!result.success) {
            throw new Error('Failed to insert duplicated order');
        }

        const insertedOrderId = result.meta.last_row_id;

        try {
            await insertOrderLineItems(env, insertedOrderId, snap.itemsData, orderDate);
        } catch (itemsError) {
            console.error('duplicateOrderByDbId: order_items insert failed', itemsError);
            try {
                await env.DB.prepare(`DELETE FROM orders WHERE id = ?`).bind(insertedOrderId).run();
            } catch (delErr) {
                console.error('duplicateOrderByDbId: rollback delete failed', delErr);
            }
            throw itemsError;
        }

        const discountCode = snap.discountCode;
        const discountId = snap.discountId;
        const discountAmount = snap.discountAmount;
        const totalAmountNumber = snap.totalAmountNumber;

        if (discountCode && discountId) {
            try {
                await env.DB.prepare(`
                    INSERT INTO discount_usage (
                        discount_id, discount_code, order_id,
                        customer_name, customer_phone,
                        order_amount, discount_amount, used_at_unix
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(
                    discountId,
                    discountCode,
                    newOrderId,
                    orderData.customer.name,
                    orderData.customer.phone,
                    totalAmountNumber,
                    discountAmount || 0,
                    orderDate
                ).run();
            } catch (discountError) {
                console.error('duplicateOrderByDbId: discount_usage insert', discountError);
            }
        }

        console.log(`duplicateOrderByDbId: ${sourceOrderDbId} -> ${insertedOrderId} (${newOrderId})`);

        /** Cùng shape với `getRecentOrders` để mobile gắn vào `allOrders` và mở sửa ngay (không cần tải lại cả danh sách). */
        const orderRow = await env.DB.prepare(`
            SELECT
                orders.*,
                ctv.commission_rate AS ctv_commission_rate,
                COALESCE(
                    (SELECT SUM(product_cost * quantity)
                     FROM order_items
                     WHERE order_items.order_id = orders.id),
                    0
                ) AS product_cost
            FROM orders
            LEFT JOIN ctv ON orders.referral_code = ctv.referral_code
            WHERE orders.id = ?
        `).bind(insertedOrderId).first();

        return jsonResponse({
            success: true,
            message: 'Đã sao chép đơn hàng',
            orderDbId: insertedOrderId,
            orderId: newOrderId,
            order: orderRow || null
        }, 200, corsHeaders);
    } catch (error) {
        console.error('duplicateOrderByDbId:', error);
        return jsonResponse({ success: false, error: error.message || String(error) }, 500, corsHeaders);
    }
}

// Update order notes
export async function updateOrderNotes(data, env, corsHeaders) {
    try {
        if (!data.orderId) {
            return jsonResponse({
                success: false,
                error: 'Thiếu orderId'
            }, 400, corsHeaders);
        }

        // Update notes in database
        await env.DB.prepare(`
            UPDATE orders 
            SET notes = ?
            WHERE id = ?
        `).bind(data.notes || null, data.orderId).run();

        console.log('✅ Updated notes for order:', data.orderId);

        return jsonResponse({
            success: true,
            message: 'Đã cập nhật ghi chú'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error updating order notes:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Update customer info
export async function updateCustomerInfo(data, env, corsHeaders) {
    try {
        if (!data.orderId) {
            return jsonResponse({
                success: false,
                error: 'Thiếu orderId'
            }, 400, corsHeaders);
        }

        const customerName = String(data.customerName || '').trim() || 'Khách hàng';
        let phone = String(data.customerPhone || '').replace(/\s/g, '');
        if (phone.startsWith('+84')) phone = '0' + phone.slice(3);
        else if (phone.startsWith('84') && phone.length >= 10) phone = '0' + phone.slice(2);

        if (!phone) {
            return jsonResponse({
                success: false,
                error: 'Thiếu số điện thoại'
            }, 400, corsHeaders);
        }

        const phoneRegex = /^0\d{9}$/;
        if (!phoneRegex.test(phone)) {
            return jsonResponse({
                success: false,
                error: 'Số điện thoại không hợp lệ'
            }, 400, corsHeaders);
        }

        // Update in database
        const result = await env.DB.prepare(`
            UPDATE orders 
            SET customer_name = ?, customer_phone = ?
            WHERE id = ?
        `).bind(customerName, phone, data.orderId).run();

        if (result.meta && result.meta.changes === 0) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy đơn hàng'
            }, 404, corsHeaders);
        }

        console.log('✅ Updated customer info in database:', data.orderId);

        return jsonResponse({
            success: true,
            message: 'Đã cập nhật thông tin khách hàng'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error updating customer info:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Update address
export async function updateAddress(data, env, corsHeaders) {
    try {
        if (!data.orderId || !data.address) {
            return jsonResponse({
                success: false,
                error: 'Thiếu orderId hoặc address'
            }, 400, corsHeaders);
        }

        // Validate address length
        if (data.address.length < 10) {
            return jsonResponse({
                success: false,
                error: 'Địa chỉ quá ngắn'
            }, 400, corsHeaders);
        }

        // Update in database with all address fields
        const result = await env.DB.prepare(`
            UPDATE orders 
            SET address = ?,
                province_id = ?,
                province_name = ?,
                district_id = ?,
                district_name = ?,
                ward_id = ?,
                ward_name = ?,
                street_address = ?
            WHERE id = ?
        `).bind(
            data.address,
            data.province_id || null,
            data.province_name || null,
            data.district_id || null,
            data.district_name || null,
            data.ward_id || null,
            data.ward_name || null,
            data.street_address || null,
            data.orderId
        ).run();

        if (result.meta && result.meta.changes === 0) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy đơn hàng'
            }, 404, corsHeaders);
        }

        console.log('✅ Updated address in database:', data.orderId);

        return jsonResponse({
            success: true,
            message: 'Đã cập nhật địa chỉ'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error updating address:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Update amount
export async function updateAmount(data, env, corsHeaders) {
    try {
        if (!data.orderId || data.totalAmount === undefined) {
            return jsonResponse({
                success: false,
                error: 'Thiếu orderId hoặc totalAmount'
            }, 400, corsHeaders);
        }

        // Validate amount
        if (data.totalAmount <= 0) {
            return jsonResponse({
                success: false,
                error: 'Giá trị đơn hàng phải lớn hơn 0'
            }, 400, corsHeaders);
        }

        if (data.totalAmount > 1000000000) {
            return jsonResponse({
                success: false,
                error: 'Giá trị đơn hàng quá lớn'
            }, 400, corsHeaders);
        }

        // Update both total_amount and commission
        // When user manually edits order value, we update the orders table directly
        const result = await env.DB.prepare(`
            UPDATE orders 
            SET total_amount = ?,
                commission = ?
            WHERE id = ?
        `).bind(data.totalAmount, data.commission || 0, data.orderId).run();

        if (result.meta && result.meta.changes === 0) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy đơn hàng'
            }, 404, corsHeaders);
        }

        console.log('✅ Updated commission in database:', data.orderId);

        return jsonResponse({
            success: true,
            message: 'Đã cập nhật giá trị đơn hàng'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error updating amount:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Update payment method
export async function updatePaymentMethod(data, env, corsHeaders) {
    try {
        if (!data.orderId || !data.paymentMethod) {
            return jsonResponse({ success: false, error: 'Thiếu orderId hoặc paymentMethod' }, 400, corsHeaders);
        }

        const allowed = ['cod', 'bank'];
        if (!allowed.includes(data.paymentMethod)) {
            return jsonResponse({ success: false, error: 'Hình thức thanh toán không hợp lệ' }, 400, corsHeaders);
        }

        const result = await env.DB.prepare(`
            UPDATE orders SET payment_method = ? WHERE id = ?
        `).bind(data.paymentMethod, data.orderId).run();

        if (result.meta && result.meta.changes === 0) {
            return jsonResponse({ success: false, error: 'Không tìm thấy đơn hàng' }, 404, corsHeaders);
        }

        return jsonResponse({ success: true, message: 'Đã cập nhật hình thức thanh toán' }, 200, corsHeaders);

    } catch (error) {
        console.error('Error updating payment method:', error);
        return jsonResponse({ success: false, error: error.message }, 500, corsHeaders);
    }
}

// Delete order
export async function deleteOrder(data, env, corsHeaders) {
    try {
        if (!data.orderId) {
            return jsonResponse({
                success: false,
                error: 'Thiếu orderId'
            }, 400, corsHeaders);
        }

        // Delete from database
        const result = await env.DB.prepare(`
            DELETE FROM orders 
            WHERE id = ?
        `).bind(data.orderId).run();

        // Check if deletion was successful
        // Note: Turso may not always return meta.changes, so we check if it exists
        if (result.meta && result.meta.changes === 0) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy đơn hàng'
            }, 404, corsHeaders);
        }

        console.log('✅ Deleted order from database:', data.orderId);

        return jsonResponse({
            success: true,
            message: 'Đã xóa đơn hàng'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error deleting order:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Update order status
export async function updateOrderStatus(data, env, corsHeaders) {
    try {
        if (!data.orderId || !data.status) {
            return jsonResponse({
                success: false,
                error: 'Thiếu orderId hoặc status'
            }, 400, corsHeaders);
        }

        // Validate status (send_later chỉ đặt qua tạo/sửa đơn đầy đủ, không qua API này)
        const validStatuses = ['pending', 'processing', 'shipped', 'in_transit', 'delivered', 'failed', 'cancelled'];
        if (!validStatuses.includes(data.status)) {
            return jsonResponse({
                success: false,
                error: 'Trạng thái không hợp lệ'
            }, 400, corsHeaders);
        }

        const nowMs = Date.now();
        // Từ chờ xử lý / đang xử lý / gửi sau → shipped: luôn ghi mốc gửi = now (tránh shipped_at cũ còn sót khi chưa NULL hết).
        // Các lần shipped khác: giữ COALESCE. pending/processing/cancelled: xóa mốc gửi.
        const row = await env.DB.prepare(`
            UPDATE orders
            SET status = ?1,
                shipped_at_unix = CASE
                    WHEN ?1 = 'shipped' AND status IN ('pending', 'processing', 'send_later') THEN ?2
                    WHEN ?1 = 'shipped' THEN COALESCE(shipped_at_unix, ?2)
                    WHEN ?1 IN ('pending', 'processing', 'cancelled') THEN NULL
                    ELSE shipped_at_unix
                END,
                planned_send_at_unix = CASE
                    WHEN status = 'send_later' AND ?1 <> 'send_later' THEN NULL
                    ELSE planned_send_at_unix
                END
            WHERE id = ?3
            RETURNING shipped_at_unix
        `).bind(data.status, nowMs, data.orderId).first();

        if (!row) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy đơn hàng'
            }, 404, corsHeaders);
        }

        console.log('✅ Updated order status in database:', data.orderId, '->', data.status);

        return jsonResponse({
            success: true,
            message: 'Đã cập nhật trạng thái đơn hàng',
            shipped_at_unix: row.shipped_at_unix ?? null
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error updating order status:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// Toggle order priority
export async function toggleOrderPriority(data, env, corsHeaders) {
    try {
        if (!data.orderId) {
            return jsonResponse({
                success: false,
                error: 'Thiếu orderId'
            }, 400, corsHeaders);
        }

        let newPriority;
        
        // Check if isPriority is explicitly provided (for bulk actions)
        if (data.isPriority !== undefined && data.isPriority !== null) {
            // Explicit mode: Use provided value (0 or 1)
            newPriority = data.isPriority;
        } else {
            // Toggle mode: Get current value and flip it
            const order = await env.DB.prepare(`
                SELECT is_priority FROM orders WHERE id = ?
            `).bind(data.orderId).first();

            if (!order) {
                return jsonResponse({
                    success: false,
                    error: 'Không tìm thấy đơn hàng'
                }, 404, corsHeaders);
            }

            newPriority = order.is_priority === 1 ? 0 : 1;
        }

        // Update in database
        const result = await env.DB.prepare(`
            UPDATE orders 
            SET is_priority = ?
            WHERE id = ?
        `).bind(newPriority, data.orderId).run();

        if (result.meta && result.meta.changes === 0) {
            return jsonResponse({
                success: false,
                error: 'Không thể cập nhật'
            }, 500, corsHeaders);
        }

        return jsonResponse({
            success: true,
            isPriority: newPriority,
            message: newPriority === 1 ? 'Đã đánh dấu ưu tiên' : 'Đã bỏ đánh dấu ưu tiên'
        }, 200, corsHeaders);

    } catch (error) {
        console.error('Error toggling order priority:', error);
        return jsonResponse({
            success: false,
            error: error.message
        }, 500, corsHeaders);
    }
}

// ============================================
// END OF ORDER SERVICE
// ============================================

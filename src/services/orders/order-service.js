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

        const result = await env.DB.prepare(`
            INSERT INTO orders (
                order_id, customer_name, customer_phone,
                address, products, total_amount, payment_method,
                status, referral_code, commission, commission_rate, ctv_phone, notes,
                shipping_fee, shipping_cost, packaging_cost, packaging_details,
                tax_amount, tax_rate, created_at_unix,
                province_id, province_name, district_id, district_name,
                ward_id, ward_name, street_address,
                discount_code, discount_amount, is_priority
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            snap.isPriority
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
                console.log(`✅ Inserted discount usage: ${discountCode} - Order Amount: ${totalAmountNumber}, Discount: ${discountAmount}`);
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

        await env.DB.prepare(`
            UPDATE orders SET
                customer_name = ?, customer_phone = ?,
                address = ?, products = ?, total_amount = ?, payment_method = ?,
                status = ?, referral_code = ?, commission = ?, commission_rate = ?, ctv_phone = ?, notes = ?,
                shipping_fee = ?, shipping_cost = ?, packaging_cost = ?, packaging_details = ?,
                tax_amount = ?, tax_rate = ?,
                province_id = ?, province_name = ?, district_id = ?, district_name = ?,
                ward_id = ?, ward_name = ?, street_address = ?,
                discount_code = ?, discount_amount = ?, is_priority = ?
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

        // Validate status
        const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
        if (!validStatuses.includes(data.status)) {
            return jsonResponse({
                success: false,
                error: 'Trạng thái không hợp lệ'
            }, 400, corsHeaders);
        }

        // Update in database
        const result = await env.DB.prepare(`
            UPDATE orders 
            SET status = ?
            WHERE id = ?
        `).bind(data.status, data.orderId).run();

        if (result.meta && result.meta.changes === 0) {
            return jsonResponse({
                success: false,
                error: 'Không tìm thấy đơn hàng'
            }, 404, corsHeaders);
        }

        console.log('✅ Updated order status in database:', data.orderId, '->', data.status);

        return jsonResponse({
            success: true,
            message: 'Đã cập nhật trạng thái đơn hàng'
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

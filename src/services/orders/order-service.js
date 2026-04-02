import { jsonResponse } from '../../utils/response.js';
import { normalizeOrderItemSize } from '../../utils/order-item-size.js';
import { sendOrderNotification } from '../notifications/telegram-service.js';

// Create new order - Main order creation function
export async function createOrder(data, env, corsHeaders) {
    try {
        // Validate dữ liệu đơn hàng
        if (!data.orderId) {
            return jsonResponse({
                success: false,
                error: 'Thiếu mã đơn hàng'
            }, 400, corsHeaders);
        }

        if (!data.customer || !data.customer.name || !data.customer.phone) {
            return jsonResponse({
                success: false,
                error: 'Thiếu thông tin khách hàng'
            }, 400, corsHeaders);
        }

        if (!data.cart || data.cart.length === 0) {
            return jsonResponse({
                success: false,
                error: 'Giỏ hàng trống'
            }, 400, corsHeaders);
        }

        // Tính tổng tiền
        const totalAmount = data.total || data.totalAmount || 0;
        const totalAmountNumber = typeof totalAmount === 'string'
            ? parseInt(totalAmount.replace(/[^\d]/g, ''))
            : totalAmount;

        // Calculate product total (for commission calculation)
        // Commission is calculated on product value ONLY (not including shipping, not including discount)
        const productTotal = data.cart.reduce((sum, item) => {
            const price = item.price || 0;
            const qty = item.quantity || 1;
            return sum + (price * qty);
        }, 0);

        // Validate và lấy thông tin CTV (backend luôn tính để tránh sai lệch từ frontend)
        let validReferralCode = null;
        let finalCommission = 0;
        let finalCommissionRate = 0;
        let ctvPhone = null;

        const refCode = (data.referral_code || data.referralCode || '').trim();
        if (refCode) {
            // Một số luồng có thể gửi referral_code hoặc custom_slug
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
                finalCommissionRate = ctvData.commission_rate || 0.1;

                // Tính hoa hồng: (total_amount - shipping_fee) × commission_rate
                const shippingFee = data.shipping_fee || data.shippingFee || 0;
                const revenue = totalAmountNumber - shippingFee;
                finalCommission = Math.round(revenue * finalCommissionRate);
            }
        }

        // Calculate product cost from cart
        // Batch query all products at once to avoid N+1 query problem
        const itemsNeedingLookup = data.cart.filter(item => !item.cost_price && item.name);
        let productLookupMap = {};
        
        if (itemsNeedingLookup.length > 0) {
            try {
                // Collect all product names and IDs for batch query
                const productNames = itemsNeedingLookup.map(item => item.name);
                const productIds = itemsNeedingLookup.map(item => item.id || item.product_id).filter(Boolean);
                
                // Build dynamic query with placeholders
                const namePlaceholders = productNames.map(() => '?').join(',');
                const idPlaceholders = productIds.length > 0 ? productIds.map(() => '?').join(',') : '';
                
                let query = `SELECT id, name, cost_price FROM products WHERE name IN (${namePlaceholders})`;
                let bindings = [...productNames];
                
                if (productIds.length > 0) {
                    query += ` OR id IN (${idPlaceholders})`;
                    bindings.push(...productIds);
                }
                
                const { results: products } = await env.DB.prepare(query).bind(...bindings).all();
                
                // Create lookup map by both name and id
                products.forEach(product => {
                    productLookupMap[product.name] = product;
                    if (product.id) {
                        productLookupMap[product.id] = product;
                    }
                });
                
                console.log(`✅ Batch fetched ${products.length} products for cost_price lookup`);
            } catch (error) {
                console.error('❌ Error batch fetching products:', error);
            }
        }
        
        // Calculate total product cost
        let productCost = 0;
        for (const item of data.cart) {
            let costPrice = item.cost_price || 0;
            
            // Look up from batch query results if not provided
            if (!costPrice && item.name) {
                const product = productLookupMap[item.name] || productLookupMap[item.id];
                if (product && product.cost_price) {
                    costPrice = product.cost_price;
                    console.log(`✅ Found cost_price for "${item.name}": ${costPrice}`);
                } else {
                    console.warn(`⚠️ No cost_price found for product: "${item.name}"`);
                }
            }
            
            const quantity = item.quantity || 1;
            productCost += costPrice * quantity;
        }

        // Format products thành JSON string
        const productsJson = JSON.stringify(data.cart);

        // Get order timestamp (from frontend or fallback to server time)
        const orderDate = data.orderDate || new Date().getTime();

        // Get shipping info
        const shippingFee = data.shippingFee || 0;
        const shippingCost = data.shippingCost || 0;

        // Calculate packaging cost (snapshot current prices with display names)
        // Get all packaging items from category_id = 5 (Đóng gói)
        // Cache this query as packaging config rarely changes
        const packagingCacheKey = 'packaging_config_v1';
        let packagingConfig;
        
        try {
            // Try to get from cache first (if KV is available)
            if (env.KV) {
                const cached = await env.KV.get(packagingCacheKey, 'json');
                if (cached) {
                    packagingConfig = cached;
                    console.log('✅ Using cached packaging config');
                }
            }
        } catch (e) {
            console.warn('⚠️ KV not available, querying DB');
        }
        
        // If not cached, query from database
        if (!packagingConfig) {
            const { results } = await env.DB.prepare(`
                SELECT item_name, item_cost, display_name 
                FROM cost_config 
                WHERE category_id = 5 AND is_default = 1
                ORDER BY item_name ASC
            `).all();
            packagingConfig = results;
            
            // Cache for 1 hour (if KV is available)
            if (env.KV) {
                try {
                    await env.KV.put(packagingCacheKey, JSON.stringify(packagingConfig), {
                        expirationTtl: 3600
                    });
                } catch (e) {
                    console.warn('⚠️ Could not cache packaging config');
                }
            }
        }
        
        const packagingPrices = {};
        const packagingDisplayNames = {};
        packagingConfig.forEach(item => {
            packagingPrices[item.item_name] = item.item_cost;
            packagingDisplayNames[item.item_name] = item.display_name || item.item_name;
        });
        
        const totalProducts = data.cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
        
        // Calculate total packaging cost (sum all items in category)
        const totalPackagingCost = Object.values(packagingPrices).reduce((sum, cost) => sum + cost, 0);
        
        // Build per_order object dynamically from all packaging items
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

        // Get current tax rate from cost_config (stored in item_cost)
        // Cache this as tax rate rarely changes
        const taxCacheKey = 'tax_rate_v1';
        let currentTaxRate = null; // Start with null to force query if no cache
        
        try {
            // Try to get from cache first (if KV is available)
            if (env.KV) {
                const cached = await env.KV.get(taxCacheKey);
                if (cached) {
                    currentTaxRate = parseFloat(cached);
                    console.log('✅ Using cached tax rate:', currentTaxRate);
                }
            }
        } catch (e) {
            console.warn('⚠️ KV not available for tax rate');
        }
        
        // If not cached, query from database
        if (!currentTaxRate) {
            const taxRateConfig = await env.DB.prepare(`
                SELECT item_cost as tax_rate FROM cost_config WHERE item_name = 'tax_rate' LIMIT 1
            `).first();
            // Convert percentage to decimal (5 -> 0.05, 1.5 -> 0.015)
            const rawRate = taxRateConfig?.tax_rate || 1.5;
            currentTaxRate = rawRate > 1 ? rawRate / 100 : rawRate;
            
            // Cache for 1 hour (if KV is available)
            if (env.KV) {
                try {
                    await env.KV.put(taxCacheKey, currentTaxRate.toString(), {
                        expirationTtl: 3600
                    });
                } catch (e) {
                    console.warn('⚠️ Could not cache tax rate');
                }
            }
        }
        
        // Calculate tax amount (revenue * tax_rate)
        // IMPORTANT: totalAmountNumber already includes productTotal + shippingFee - discountAmount
        // So we use it directly as revenue, no need to add shippingFee again
        const revenue = totalAmountNumber;
        const taxAmount = Math.round(revenue * currentTaxRate);

        // Get discount data (support both camelCase and snake_case)
        const discountCode = data.discountCode || data.discount_code || null;
        const discountAmount = data.discountAmount || data.discount_amount || 0;
        const discountId = data.discountId || data.discount_id || null;
        const isPriority = data.is_priority || 0;

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
            productsJson,
            totalAmountNumber,
            data.paymentMethod || 'cod',
            data.status || 'pending',
            validReferralCode,
            finalCommission,
            finalCommissionRate,
            ctvPhone || null,
            data.notes || null,
            shippingFee,
            shippingCost,
            totalPackagingCost,
            JSON.stringify(packagingDetails),
            taxAmount,
            currentTaxRate,
            orderTimestamp,
            data.province_id || null,
            data.province_name || null,
            data.district_id || null,
            data.district_name || null,
            data.ward_id || null,
            data.ward_name || null,
            data.street_address || null,
            discountCode,
            discountAmount,
            isPriority
        ).run();

        if (!result.success) {
            throw new Error('Failed to insert order into database');
        }

        const insertedOrderId = result.meta.last_row_id;
        console.log('✅ Saved order to database:', data.orderId, 'ID:', insertedOrderId);

        // 1.5. Insert order items into order_items table
        // Use batch insert for better performance
        try {
            const orderTimestamp = new Date(orderDate).getTime();
            
            // Prepare all items data first
            const itemsData = [];
            for (const item of data.cart) {
                const productName = item.name || 'Unknown';
                const quantity = item.quantity || 1;
                const productPrice = item.price || 0;
                const weight = item.weight || null;
                const size = item.size || null;
                const notes = item.notes || null;

                // Get product_id and cost_price
                let productId = item.id || item.product_id || null;
                let costPrice = item.cost_price || 0;

                // Look up from batch query results (already fetched earlier)
                if (!productId || !costPrice) {
                    const product = productLookupMap[productName] || productLookupMap[productId];
                    if (product) {
                        productId = productId || product.id;
                        costPrice = costPrice || product.cost_price || 0;
                    } else {
                        console.warn(`⚠️ Could not find product: ${productName}`);
                    }
                }

                // Merge weight and size into single size column (placeholder "chưa có" → NULL)
                const sizeValue = normalizeOrderItemSize(size ?? weight);

                itemsData.push({
                    productId,
                    productName,
                    productPrice,
                    costPrice,
                    quantity,
                    sizeValue,
                    notes
                });
            }

            // Batch insert all items in one query
            if (itemsData.length > 0) {
                const placeholders = itemsData.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
                const bindings = [];
                
                itemsData.forEach(item => {
                    bindings.push(
                        insertedOrderId,
                        item.productId,
                        item.productName,
                        item.productPrice,
                        item.costPrice,
                        item.quantity,
                        item.sizeValue,
                        item.notes,
                        orderDate,
                        orderTimestamp
                    );
                });

                await env.DB.prepare(`
                    INSERT INTO order_items (
                        order_id, product_id, product_name, product_price, product_cost,
                        quantity, size, notes, created_at, created_at_unix
                    ) VALUES ${placeholders}
                `).bind(...bindings).run();
                
                console.log(`✅ Batch inserted ${itemsData.length} items into order_items`);
            }
        } catch (itemsError) {
            console.error('⚠️ Error inserting order items:', itemsError);
            // Don't fail the order creation, just log the error
        }

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
            referralCode: validReferralCode || '',
            referralCommission: finalCommission || 0,
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
                referralCode: validReferralCode || '',
                referralCommission: finalCommission || 0,
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
            commission: finalCommission,
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
        if (!data.orderId || !data.customerName || !data.customerPhone) {
            return jsonResponse({
                success: false,
                error: 'Thiếu orderId, customerName hoặc customerPhone'
            }, 400, corsHeaders);
        }

        // Validate phone format
        const phoneRegex = /^0\d{9}$/;
        if (!phoneRegex.test(data.customerPhone)) {
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
        `).bind(data.customerName, data.customerPhone, data.orderId).run();

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

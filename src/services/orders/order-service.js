import { jsonResponse } from '../../utils/response.js';

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

        // Validate và lấy thông tin CTV
        let validReferralCode = null;
        let finalCommission = 0;
        let finalCommissionRate = 0;
        let ctvPhone = null;

        if (data.referralCode && data.referralCode.trim() !== '') {
            // Kiểm tra xem referral code có tồn tại không
            const ctvData = await env.DB.prepare(`
                SELECT referral_code, commission_rate, phone FROM ctv WHERE referral_code = ?
            `).bind(data.referralCode.trim()).first();

            if (ctvData) {
                validReferralCode = ctvData.referral_code;
                ctvPhone = ctvData.phone;
                finalCommissionRate = ctvData.commission_rate || 0.1;
                // Commission calculated on product value ONLY (not including shipping, not including discount)
                finalCommission = Math.round(productTotal * finalCommissionRate);
                console.log(`💰 Commission calculated:`, {
                    referralCode: validReferralCode,
                    productValue: productTotal,
                    rate: finalCommissionRate,
                    commission: finalCommission
                });
            } else {
                console.warn('⚠️ Referral code không tồn tại:', data.referralCode);
            }
        }

        // Calculate product cost from cart
        let productCost = 0;
        for (const item of data.cart) {
            let costPrice = item.cost_price || 0;
            
            // Nếu không có cost_price, tự động tra cứu từ database
            if (!costPrice && item.name) {
                try {
                    // Tìm sản phẩm theo tên (hoặc ID nếu có)
                    const productQuery = await env.DB.prepare(`
                        SELECT cost_price FROM products 
                        WHERE name = ? OR id = ?
                        LIMIT 1
                    `).bind(item.name, item.id || item.name).first();
                    
                    if (productQuery && productQuery.cost_price) {
                        costPrice = productQuery.cost_price;
                        console.log(`✅ Auto-fetched cost_price for "${item.name}": ${costPrice}`);
                    } else {
                        console.warn(`⚠️ No cost_price found for product: "${item.name}"`);
                    }
                } catch (error) {
                    console.error(`❌ Error fetching cost_price for "${item.name}":`, error);
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

        // Calculate packaging cost (snapshot current prices)
        const { results: packagingConfig } = await env.DB.prepare(`
            SELECT item_name, item_cost FROM cost_config WHERE is_default = 1
        `).all();
        
        const packagingPrices = {};
        packagingConfig.forEach(item => {
            packagingPrices[item.item_name] = item.item_cost;
        });
        
        const totalProducts = data.cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
        
        // Calculate packaging cost
        // Per-product items (multiply by total products): red_string, labor_cost
        // Per-order items (fixed per order): bag_zip, bag_red, box_shipping, thank_card, paper_print
        const perProductCost = 
            ((packagingPrices.red_string || 0) * totalProducts) +
            ((packagingPrices.labor_cost || 0) * totalProducts);
        
        const perOrderCost = 
            (packagingPrices.bag_zip || 0) + 
            (packagingPrices.bag_red || 0) +
            (packagingPrices.box_shipping || 0) + 
            (packagingPrices.thank_card || 0) + 
            (packagingPrices.paper_print || 0);
        
        const totalPackagingCost = perProductCost + perOrderCost;
        
        const packagingDetails = {
            per_product: {
                red_string: packagingPrices.red_string || 0,
                labor_cost: packagingPrices.labor_cost || 0
            },
            per_order: {
                bag_zip: packagingPrices.bag_zip || 0,
                bag_red: packagingPrices.bag_red || 0,
                box_shipping: packagingPrices.box_shipping || 0,
                thank_card: packagingPrices.thank_card || 0,
                paper_print: packagingPrices.paper_print || 0
            },
            total_products: totalProducts,
            per_product_cost: perProductCost,
            per_order_cost: perOrderCost,
            total_cost: totalPackagingCost
        };

        // Get current tax rate from cost_config (stored in item_cost)
        const taxRateConfig = await env.DB.prepare(`
            SELECT item_cost as tax_rate FROM cost_config WHERE item_name = 'tax_rate' LIMIT 1
        `).first();
        const currentTaxRate = taxRateConfig?.tax_rate || 0.015;
        
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
                order_id, order_date, customer_name, customer_phone, 
                address, products, total_amount, payment_method, 
                status, referral_code, commission, commission_rate, ctv_phone, notes,
                shipping_fee, shipping_cost, packaging_cost, packaging_details,
                tax_amount, tax_rate, created_at_unix,
                province_id, province_name, district_id, district_name,
                ward_id, ward_name, street_address,
                discount_code, discount_amount, is_priority
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            data.orderId,
            orderDate,
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
        try {
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

                // Try to find product in database if not provided
                if (!productId || !costPrice) {
                    try {
                        const productQuery = await env.DB.prepare(`
                            SELECT id, cost_price FROM products 
                            WHERE name = ? OR id = ?
                            LIMIT 1
                        `).bind(productName, productId).first();

                        if (productQuery) {
                            productId = productId || productQuery.id;
                            costPrice = costPrice || productQuery.cost_price || 0;
                        }
                    } catch (e) {
                        console.warn(`Could not find product: ${productName}`);
                    }
                }

                // Calculate totals
                const subtotal = productPrice * quantity;
                const costTotal = costPrice * quantity;
                const itemProfit = subtotal - costTotal;

                // Merge weight and size into single size column
                const sizeValue = size || weight || null;

                // Insert into order_items with unix timestamp
                const orderTimestamp = new Date(orderDate).getTime();
                await env.DB.prepare(`
                    INSERT INTO order_items (
                        order_id, product_id, product_name, product_price, product_cost,
                        quantity, size, notes, created_at, created_at_unix
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(
                    insertedOrderId,
                    productId,
                    productName,
                    productPrice,
                    costPrice,
                    quantity,
                    sizeValue,
                    notes,
                    orderDate,
                    orderTimestamp
                ).run();
            }
            console.log(`✅ Inserted ${data.cart.length} items into order_items`);
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

        // 2. Lưu vào Google Sheets (gọi Google Apps Script)
        try {
            const googleScriptUrl = env.GOOGLE_APPS_SCRIPT_URL;

            if (googleScriptUrl) {
                // Chuẩn bị dữ liệu cho Google Sheets (format giống như order-handler.js)
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
                    // Gửi referralCode từ frontend (không validate) để Google Sheets luôn nhận được
                    referralCode: data.referralCode || '',
                    // Commission đã validate từ database
                    referralCommission: finalCommission || 0,
                    referralPartner: data.referralPartner || '',
                    telegramNotification: env.SECRET_KEY || 'VDT_SECRET_2025_ANHIEN'
                };

                console.log('📤 Sending to Google Sheets:', {
                    orderId: sheetsData.orderId,
                    referralCode: sheetsData.referralCode,
                    referralCommission: sheetsData.referralCommission
                });

                const sheetsResponse = await fetch(googleScriptUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(sheetsData)
                });

                const responseText = await sheetsResponse.text();
                console.log('📥 Google Sheets response:', responseText);

                if (sheetsResponse.ok) {
                    console.log('✅ Saved order to Google Sheets');
                } else {
                    console.warn('⚠️ Failed to save to Google Sheets:', sheetsResponse.status, responseText);
                }
            }
        } catch (sheetsError) {
            console.error('⚠️ Google Sheets error:', sheetsError);
            // Không throw error, vì database đã lưu thành công
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

        if (result.meta.changes === 0) {
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

        // Update in database
        const result = await env.DB.prepare(`
            UPDATE orders 
            SET address = ?
            WHERE id = ?
        `).bind(data.address, data.orderId).run();

        if (result.meta.changes === 0) {
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

        if (result.meta.changes === 0) {
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

        if (result.meta.changes === 0) {
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

        if (result.meta.changes === 0) {
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

        if (result.meta.changes === 0) {
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

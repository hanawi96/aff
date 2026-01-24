// ============================================
// SHOP ORDER SERVICE - Business logic for shop orders
// ============================================

/**
 * Shop Order Service
 * Handles order creation from public shop (no auth required)
 */
export class ShopOrderService {
    /**
     * Create order from shop
     */
    static async createOrder(data, env) {
        // Generate order ID
        const orderId = 'DH' + Date.now();
        const orderDate = Date.now();

        // Calculate totals
        const totalAmount = data.total || data.totalAmount || 0;
        const totalAmountNumber = typeof totalAmount === 'string'
            ? parseInt(totalAmount.replace(/[^\d]/g, ''))
            : totalAmount;
        const shippingFee = data.shippingFee || data.shipping_fee || 0;
        const discountAmount = data.discountAmount || data.discount_amount || 0;

        // Get shipping cost from config
        let shippingCost = 0;
        try {
            const shippingCostConfig = await env.DB.prepare(`
                SELECT item_cost FROM cost_config WHERE item_name = 'default_shipping_cost' LIMIT 1
            `).first();
            shippingCost = shippingCostConfig?.item_cost || 0;
        } catch (error) {
            console.warn('Could not fetch shipping cost:', error);
        }

        // Lookup cost_price for products
        const productLookupMap = await this.lookupProductCosts(data.cart, env);
        
        // Update cart items with cost_price
        data.cart.forEach(item => {
            if ((!item.cost_price || item.cost_price === 0) && item.id) {
                const product = productLookupMap[item.id];
                if (product && product.cost_price) {
                    item.cost_price = product.cost_price;
                }
            }
        });

        // Calculate packaging cost
        const packagingDetails = await this.calculatePackaging(data.cart, env);

        // Calculate tax
        const taxData = await this.calculateTax(totalAmountNumber, env);

        // Format products as JSON
        const productsJson = JSON.stringify(data.cart);

        // Insert order
        const insertResult = await env.DB.prepare(`
            INSERT INTO orders (
                order_id, customer_name, customer_phone, address,
                province_id, province_name, district_id, district_name,
                ward_id, ward_name, street_address,
                products, total_amount, payment_method, status,
                shipping_fee, shipping_cost, notes,
                discount_code, discount_amount,
                created_at_unix, is_priority,
                referral_code, commission, commission_rate, ctv_phone,
                packaging_cost, packaging_details, tax_amount, tax_rate
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            orderId,
            data.customer.name,
            data.customer.phone,
            data.address,
            data.province_id || null,
            data.province_name || null,
            data.district_id || null,
            data.district_name || null,
            data.ward_id || null,
            data.ward_name || null,
            data.street_address || null,
            productsJson,
            totalAmountNumber,
            data.paymentMethod || data.payment_method || 'cod',
            'pending', // Always pending for shop orders
            shippingFee,
            shippingCost,
            data.notes || null,
            data.discountCode || data.discount_code || null,
            discountAmount,
            orderDate,
            0, // is_priority
            null, // referral_code (shop orders don't have CTV)
            0, // commission
            0, // commission_rate
            null, // ctv_phone
            packagingDetails.total_cost,
            JSON.stringify(packagingDetails),
            taxData.amount,
            taxData.rate
        ).run();

        const insertedOrderId = insertResult.meta.last_row_id;

        // Insert order items
        await this.insertOrderItems(insertedOrderId, data.cart, orderDate, env);

        // Record discount usage if applicable
        if (data.discount_id && (data.discountCode || data.discount_code)) {
            await this.recordDiscountUsage(data, orderId, totalAmountNumber, discountAmount, orderDate, env);
        }

        return {
            id: orderId,
            orderDate: orderDate,
            customer: data.customer,
            total: totalAmountNumber,
            status: 'pending'
        };
    }

    /**
     * Lookup product costs from database
     */
    static async lookupProductCosts(cart, env) {
        const itemsNeedingLookup = cart.filter(item => !item.cost_price || item.cost_price === 0);
        const productLookupMap = {};

        if (itemsNeedingLookup.length > 0) {
            const productIds = itemsNeedingLookup.map(item => item.id).filter(Boolean);

            if (productIds.length > 0) {
                const placeholders = productIds.map(() => '?').join(',');
                const query = `SELECT id, name, cost_price FROM products WHERE id IN (${placeholders})`;
                const { results: products } = await env.DB.prepare(query).bind(...productIds).all();

                products.forEach(product => {
                    productLookupMap[product.id] = product;
                });
            }
        }

        return productLookupMap;
    }

    /**
     * Calculate packaging cost
     */
    static async calculatePackaging(cart, env) {
        const packagingCacheKey = 'packaging_config_v1';
        let packagingConfig;

        // Try cache first
        try {
            if (env.KV) {
                const cached = await env.KV.get(packagingCacheKey, 'json');
                if (cached) {
                    packagingConfig = cached;
                }
            }
        } catch (e) {
            console.warn('KV not available');
        }

        // Query DB if not cached
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
                    await env.KV.put(packagingCacheKey, JSON.stringify(packagingConfig), {
                        expirationTtl: 3600
                    });
                } catch (e) {
                    console.warn('Could not cache packaging config');
                }
            }
        }

        const totalProducts = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
        const totalPackagingCost = packagingConfig.reduce((sum, item) => sum + (item.item_cost || 0), 0);

        const perOrderItems = {};
        packagingConfig.forEach(item => {
            perOrderItems[item.item_name] = {
                cost: item.item_cost || 0,
                name: item.display_name || item.item_name
            };
        });

        return {
            per_order: perOrderItems,
            total_products: totalProducts,
            per_order_cost: totalPackagingCost,
            total_cost: totalPackagingCost
        };
    }

    /**
     * Calculate tax
     */
    static async calculateTax(revenue, env) {
        const taxCacheKey = 'tax_rate_v1';
        let currentTaxRate = null;

        // Try cache first
        try {
            if (env.KV) {
                const cached = await env.KV.get(taxCacheKey);
                if (cached) {
                    currentTaxRate = parseFloat(cached);
                }
            }
        } catch (e) {
            console.warn('KV not available for tax rate');
        }

        // Query DB if not cached
        if (!currentTaxRate) {
            const taxRateConfig = await env.DB.prepare(`
                SELECT item_cost as tax_rate FROM cost_config WHERE item_name = 'tax_rate' LIMIT 1
            `).first();
            const rawRate = taxRateConfig?.tax_rate || 1.5;
            currentTaxRate = rawRate > 1 ? rawRate / 100 : rawRate;

            if (env.KV) {
                try {
                    await env.KV.put(taxCacheKey, currentTaxRate.toString(), {
                        expirationTtl: 3600
                    });
                } catch (e) {
                    console.warn('Could not cache tax rate');
                }
            }
        }

        const taxAmount = Math.round(revenue * currentTaxRate);

        return {
            rate: currentTaxRate,
            amount: taxAmount
        };
    }

    /**
     * Insert order items
     */
    static async insertOrderItems(orderId, cart, orderDate, env) {
        if (cart.length === 0) return;

        const placeholders = cart.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        const bindings = [];

        cart.forEach(item => {
            bindings.push(
                orderId,
                item.id || null,
                item.name || 'Unknown',
                item.price || 0,
                item.cost_price || 0,
                item.quantity || 1,
                item.size || null, // Baby weight from cart item
                item.notes || null, // Baby name stored here
                new Date(orderDate).toISOString(),
                orderDate
            );
        });

        await env.DB.prepare(`
            INSERT INTO order_items (
                order_id, product_id, product_name, product_price, product_cost,
                quantity, size, notes, created_at, created_at_unix
            ) VALUES ${placeholders}
        `).bind(...bindings).run();
    }

    /**
     * Record discount usage
     */
    static async recordDiscountUsage(data, orderId, totalAmount, discountAmount, orderDate, env) {
        try {
            await env.DB.prepare(`
                INSERT INTO discount_usage (
                    discount_id, discount_code, order_id,
                    customer_name, customer_phone,
                    order_amount, discount_amount, used_at_unix
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                data.discount_id,
                data.discountCode || data.discount_code,
                orderId,
                data.customer.name,
                data.customer.phone,
                totalAmount,
                discountAmount,
                orderDate
            ).run();
        } catch (error) {
            console.error('Error recording discount usage:', error);
            // Don't fail order creation
        }
    }

    /**
     * Get active products
     */
    static async getProducts(env, category = null) {
        let query = `
            SELECT * FROM products 
            WHERE is_active = 1
        `;

        const bindings = [];

        if (category) {
            query += ` AND category = ?`;
            bindings.push(category);
        }

        query += ` ORDER BY name ASC`;

        const { results } = await env.DB.prepare(query).bind(...bindings).all();
        return results;
    }
}

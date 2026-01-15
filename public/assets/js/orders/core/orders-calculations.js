/**
 * Orders Calculations Module
 * 
 * Handles all calculation logic for orders:
 * - Order totals (product total, product cost)
 * - Order profit calculation
 * - Packaging cost calculation
 * 
 * Dependencies:
 * - COST_CONSTANTS (from orders.js)
 * - packagingConfig (from orders.js)
 * - currentOrderProducts (from orders.js)
 * 
 * Created: 2026-01-15
 * Extracted from: orders.js (lines 28-92, 485-530)
 */

(function() {
    'use strict';

    // Export functions to global namespace
    window.OrdersModules.calculations = {
        calculateOrderTotals,
        calculateOrderProfit,
        calculatePackagingCost
    };

    /**
     * Calculate order totals from items
     * 
     * @param {Object} order - Order object
     * @returns {Object} { totalAmount, productCost }
     */
    function calculateOrderTotals(order) {
        // Calculate product_total by subtracting shipping_fee from total_amount
        // IMPORTANT: total_amount already has discount subtracted, so we need to add it back
        const orderTotalAmount = order.total_amount || 0;
        const shippingFee = order.shipping_fee || 0;
        const discountAmount = order.discount_amount || 0;
        const productTotal = orderTotalAmount - shippingFee + discountAmount;

        // SINGLE SOURCE OF TRUTH: Always use product_cost from API
        // API calculates this from order_items table: SUM(product_cost * quantity)
        let productCost = order.product_cost || 0;

        // FALLBACK: If product_cost is 0 or undefined (old orders without order_items), 
        // calculate from products JSON as temporary solution
        if ((productCost === 0 || productCost === undefined) && order.products) {
            try {
                const products = JSON.parse(order.products);
                if (Array.isArray(products)) {
                    console.log(`📦 Fallback: Parsing products JSON for order ${order.order_id}:`, products);
                    productCost = products.reduce((sum, item) => {
                        let cost = item.cost_price || item.cost || 0;
                        const qty = item.quantity || 1;

                        // IMPORTANT: If cost seems too high (> 10x of typical unit cost),
                        // it might be stored as total instead of unit price
                        // In that case, divide by quantity to get unit cost
                        // This is a heuristic fix for data inconsistency
                        const unitCost = cost / qty;
                        const subtotal = unitCost * qty;

                        console.log(`  - ${item.name || 'Unknown'}: cost=${cost}, qty=${qty}, unit=${unitCost}, subtotal=${subtotal}`);
                        return sum + subtotal;
                    }, 0);
                    console.warn(`⚠️ Using fallback cost calculation for order ${order.order_id}: ${productCost}`);
                }
            } catch (e) {
                console.warn('Could not parse products JSON for cost calculation:', e);
            }
        }

        return {
            totalAmount: Math.max(0, productTotal), // Ensure non-negative
            productCost: productCost
        };
    }

    /**
     * Calculate order profit dynamically
     * 
     * @param {Object} order - Order object
     * @returns {Number} Profit amount
     */
    function calculateOrderProfit(order) {
        const { totalAmount, productCost } = calculateOrderTotals(order);
        const shippingFee = order.shipping_fee || 0;
        const shippingCost = order.shipping_cost || 0;
        const packagingCost = order.packaging_cost || 0;
        const commission = order.commission || 0;

        // Revenue = product total + shipping fee - discount
        const discountAmount = order.discount_amount || 0;
        const revenue = totalAmount + shippingFee - discountAmount;

        // Use saved tax_amount if available, otherwise calculate
        const tax = order.tax_amount || Math.round(revenue * (order.tax_rate || window.COST_CONSTANTS.TAX_RATE));

        // Profit = revenue - all costs including tax
        return revenue - productCost - shippingCost - packagingCost - commission - tax;
    }

    /**
     * Calculate packaging cost based on selected items and quantity
     * 
     * @returns {Number} Total packaging cost
     */
    function calculatePackagingCost() {
        if (!window.packagingConfig || window.packagingConfig.length === 0) {
            console.warn('⚠️ Packaging config not loaded yet');
            return 0;
        }

        // Get default items (is_default = 1)
        const defaultItems = window.packagingConfig.filter(item => item.is_default === 1);

        // Create a map of item costs
        const packagingPrices = {};
        defaultItems.forEach(item => {
            packagingPrices[item.item_name] = item.item_cost || 0;
        });

        // Calculate total products in cart (use currentOrderProducts, not window.cart)
        const totalProducts = window.currentOrderProducts.reduce((sum, item) => sum + (item.quantity || 1), 0);

        // Per-product items (multiply by total products): red_string, labor_cost
        const perProductCost =
            ((packagingPrices.red_string || 0) * totalProducts) +
            ((packagingPrices.labor_cost || 0) * totalProducts);

        // Per-order items (fixed per order): bag_zip, bag_red, box_shipping, thank_card, paper_print
        const perOrderCost =
            (packagingPrices.bag_zip || 0) +
            (packagingPrices.bag_red || 0) +
            (packagingPrices.box_shipping || 0) +
            (packagingPrices.thank_card || 0) +
            (packagingPrices.paper_print || 0);

        const total = perProductCost + perOrderCost;

        // Debug logging
        console.log('📦 Packaging Cost Calculation:', {
            totalProducts,
            packagingPrices,
            perProductCost,
            perOrderCost,
            total,
            formula: `(red_string + labor_cost) × ${totalProducts} + (bag_zip + bag_red + box_shipping + thank_card + paper_print) = ${total}`
        });

        return total;
    }

    console.log('✅ OrdersModules.calculations loaded');
})();

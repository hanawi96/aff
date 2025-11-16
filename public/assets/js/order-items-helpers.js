// Helper functions for order_items calculations
// These replace the removed columns: subtotal, cost_total, profit

/**
 * Calculate item subtotal (revenue from this item)
 * @param {Object} item - Order item object
 * @returns {number} Subtotal amount
 */
function calculateItemSubtotal(item) {
    const price = item.product_price || 0;
    const quantity = item.quantity || 1;
    return price * quantity;
}

/**
 * Calculate item cost total
 * @param {Object} item - Order item object
 * @returns {number} Total cost amount
 */
function calculateItemCostTotal(item) {
    const cost = item.product_cost || 0;
    const quantity = item.quantity || 1;
    return cost * quantity;
}

/**
 * Calculate item gross profit (before order-level costs)
 * Note: This is NOT the final profit. Final profit must subtract:
 * - Shipping cost
 * - Packaging cost
 * - Tax
 * - Commission
 * 
 * @param {Object} item - Order item object
 * @returns {number} Gross profit amount
 */
function calculateItemGrossProfit(item) {
    return calculateItemSubtotal(item) - calculateItemCostTotal(item);
}

/**
 * Calculate total gross profit for all items in an order
 * @param {Array} items - Array of order items
 * @returns {number} Total gross profit
 */
function calculateOrderItemsGrossProfit(items) {
    if (!Array.isArray(items) || items.length === 0) return 0;
    
    return items.reduce((sum, item) => {
        return sum + calculateItemGrossProfit(item);
    }, 0);
}

/**
 * Calculate order net profit (final profit after all costs)
 * @param {Object} order - Order object with items array
 * @param {Object} constants - Cost constants (TAX_RATE)
 * @returns {Object} Profit breakdown
 * NOTE: Packaging cost should come from order.packaging_cost (from database)
 */
function calculateOrderNetProfit(order, constants) {
    const revenue = order.total_amount || 0;
    const itemsGrossProfit = calculateOrderItemsGrossProfit(order.items || []);
    const productCost = revenue - itemsGrossProfit; // Reverse calculate
    
    const shippingCost = order.shipping_cost || 0;
    const packagingCost = order.packaging_cost || 0; // From database
    const tax = constants.calculateTax ? constants.calculateTax(revenue) : Math.round(revenue * (constants.TAX_RATE || 0));
    const commission = order.commission || 0;
    
    const netProfit = revenue - productCost - shippingCost - packagingCost - tax - commission;
    
    return {
        revenue,
        productCost,
        itemsGrossProfit,
        shippingCost,
        packagingCost,
        tax,
        commission,
        netProfit,
        profitMargin: revenue > 0 ? (netProfit / revenue * 100) : 0
    };
}

/**
 * Format item for display with calculated values
 * @param {Object} item - Order item object
 * @returns {Object} Item with calculated fields
 */
function formatItemWithCalculations(item) {
    return {
        ...item,
        subtotal: calculateItemSubtotal(item),
        cost_total: calculateItemCostTotal(item),
        gross_profit: calculateItemGrossProfit(item)
    };
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateItemSubtotal,
        calculateItemCostTotal,
        calculateItemGrossProfit,
        calculateOrderItemsGrossProfit,
        calculateOrderNetProfit,
        formatItemWithCalculations
    };
}

/**
 * Orders Constants Module
 * Extracted from orders.js
 * 
 * Contains:
 * - COST_CONSTANTS object (tax rate, tax calculation)
 * - loadCurrentTaxRate() - Load tax rate from API
 * - calculateOrderTotals() - Calculate order totals from items
 * - calculateOrderProfit() - Calculate order profit dynamically
 * - updateOrderData() - Update order data in both arrays
 * 
 * Dependencies:
 * - CONFIG.API_URL (from config.js)
 * - allOrdersData, filteredOrdersData (global variables, defined in orders-data.js)
 * 
 * Used by:
 * - Most other orders modules
 */

// ============================================
// COST CONSTANTS
// ============================================

// Cost constants
const COST_CONSTANTS = {
    TAX_RATE: 0.015,           // Thuế mặc định 1.5% (sẽ được cập nhật từ API)

    // Calculate tax based on revenue (including shipping)
    calculateTax(revenue) {
        return Math.round(revenue * this.TAX_RATE);
    }
};

// ============================================
// TAX RATE LOADING
// ============================================

// Load current tax rate from API
async function loadCurrentTaxRate() {
    try {
        const response = await fetch(`${CONFIG.API_URL}?action=getCurrentTaxRate&timestamp=${Date.now()}`);
        const data = await response.json();
        if (data.success && data.taxRate) {
            COST_CONSTANTS.TAX_RATE = data.taxRate;
            console.log(`✅ Tax rate loaded: ${(data.taxRate * 100).toFixed(1)}%`);
        }
    } catch (error) {
        console.warn('⚠️ Could not load tax rate, using default 1.5%');
    }
}


// ============================================
// ORDER CALCULATIONS
// ============================================

// Helper function to calculate order totals from items
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

// Helper function to calculate order profit dynamically
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
    const tax = order.tax_amount || Math.round(revenue * (order.tax_rate || COST_CONSTANTS.TAX_RATE));

    // Profit = revenue - all costs including tax
    return revenue - productCost - shippingCost - packagingCost - commission - tax;
}

// ============================================
// ORDER DATA UPDATE HELPER
// ============================================

// Helper function to update order data in both allOrdersData and filteredOrdersData
function updateOrderData(orderId, updates) {
    // Update in allOrdersData
    const orderIndex = allOrdersData.findIndex(o => o.id === orderId);
    if (orderIndex !== -1) {
        Object.assign(allOrdersData[orderIndex], updates);
    }

    // Update in filteredOrdersData
    const filteredIndex = filteredOrdersData.findIndex(o => o.id === orderId);
    if (filteredIndex !== -1) {
        Object.assign(filteredOrdersData[filteredIndex], updates);
    }
}

console.log('✅ orders-constants.js loaded');

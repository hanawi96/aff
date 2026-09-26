/**
 * Script để test xem khi update invoice_exported_at có làm thay đổi product_cost không
 */

// Giả lập order data như trong allOrdersData
const testOrder = {
    id: 2405,
    order_id: 'DH1790165492631',
    total_amount: 388000,
    shipping_fee: 0,
    shipping_cost: 16000,
    discount_amount: 20000,
    product_cost: 207500, // Giá trị đúng từ order_items
    products: '[{"name":"Vòng sole 3ly mix thẻ tên hình ngựa","quantity":1,"price":349000,"cost_price":177500,"product_id":167,"size":"6kg","notes":"Thẻ tròn Tuấn Phong"},{"name":"Vòng trơn cổ điển dây đỏ","quantity":1,"price":59000,"cost_price":30000,"product_id":55,"size":"6kg"}]'
};

// Copy hàm calculateOrderTotals từ orders-constants.js
function calculateOrderTotals(order) {
    const orderTotalAmount = order.total_amount || 0;
    const shippingFee = order.shipping_fee || 0;
    const discountAmount = order.discount_amount || 0;
    const productTotal = orderTotalAmount - shippingFee + discountAmount;

    let productCost = order.product_cost || 0;

    // FALLBACK
    if ((productCost === 0 || productCost === undefined) && order.products) {
        try {
            const products = JSON.parse(order.products);
            if (Array.isArray(products)) {
                productCost = products.reduce((sum, item) => {
                    let cost = item.cost_price || item.cost || 0;
                    const qty = item.quantity || 1;
                    const unitCost = cost / qty;
                    const subtotal = unitCost * qty;
                    return sum + subtotal;
                }, 0);
            }
        } catch (e) {
            // Silently handle parse errors
        }
    }

    return {
        totalAmount: Math.max(0, productTotal),
        productCost: productCost
    };
}

function calculateOrderProfit(order) {
    const { totalAmount, productCost } = calculateOrderTotals(order);
    const shippingCost = order.shipping_cost || 0;
    const revenue = totalAmount;
    return revenue - productCost - shippingCost;
}

console.log('🔍 TEST: Kiểm tra tác động của việc update invoice_exported_at\n');

console.log('📊 Trước khi update:');
console.log('   product_cost:', testOrder.product_cost);
const profitBefore = calculateOrderProfit(testOrder);
console.log('   Lợi nhuận:', profitBefore);

console.log('\n📝 Giả lập updateOrderData() - chỉ update 2 trường:');
Object.assign(testOrder, {
    invoice_exported_at: Date.now(),
    manual_invoice_exported: 1
});

console.log('\n📊 Sau khi update:');
console.log('   product_cost:', testOrder.product_cost);
const profitAfter = calculateOrderProfit(testOrder);
console.log('   Lợi nhuận:', profitAfter);

console.log('\n✅ KẾT LUẬN:');
if (profitBefore === profitAfter) {
    console.log('   ✓ Lợi nhuận KHÔNG thay đổi');
    console.log('   ✓ Hàm calculateOrderTotals() hoạt động đúng');
    console.log('   ➡️  Vấn đề có thể nằm ở nơi khác');
} else {
    console.log('   ✗ Lợi nhuận BỊ THAY ĐỔI!');
    console.log(`   ✗ Từ ${profitBefore} → ${profitAfter}`);
    console.log(`   ✗ Chênh lệch: ${profitAfter - profitBefore}`);
}

// Test thêm: Nếu product_cost bị xóa
console.log('\n🧪 TEST 2: Nếu product_cost bị xóa (undefined):');
delete testOrder.product_cost;
console.log('   product_cost:', testOrder.product_cost);
const profitWithoutCost = calculateOrderProfit(testOrder);
console.log('   Lợi nhuận:', profitWithoutCost);
console.log('   ➡️  Fallback tính từ JSON:', profitWithoutCost === profitAfter ? 'ĐÚNG' : 'SAI');

// Test Copy SPX Format Logic

// Helper function (same as in orders.js)
function formatProductNameWithSize(name, size) {
    if (!size) return name;
    
    const sizeStr = size.toString().toLowerCase().trim();
    
    // Check if size contains 'kg' - for baby/child products
    if (sizeStr.includes('kg')) {
        const kgValue = sizeStr.replace(/[^0-9.]/g, '');
        return `${name} cho bé ${kgValue}kg`;
    }
    
    // Check if size contains 'cm' - for bracelet size
    if (sizeStr.includes('cm')) {
        const cmValue = sizeStr.replace(/[^0-9.]/g, '');
        return `${name} cho size tay ${cmValue}cm`;
    }
    
    // If size is just a number without unit, don't guess - return as is
    return name;
}

// Mock order data
const mockOrder = {
    id: 1,
    order_id: 'VDT001',
    customer_name: 'Nguyễn Văn A',
    customer_phone: '0909123456',
    address: '123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    products: JSON.stringify([
        { name: 'Mix bạc 3ly + Charm rắn + Chuông + Thẻ tên co giãn', size: '5kg', quantity: 1, notes: 'Gói kỹ' },
        { name: 'Vòng tay bạc', size: '14cm', quantity: 2 },
        { name: 'Charm trái tim', weight: '3kg', quantity: 1 } // Test fallback to weight
    ]),
    notes: 'Giao giờ hành chính'
};

console.log('🧪 Testing Copy SPX Format Logic\n');
console.log('='.repeat(80));

// Parse products
let products = JSON.parse(mockOrder.products);

console.log('\n📦 Products formatting:\n');

products.forEach((product, index) => {
    const name = product.name || 'Sản phẩm';
    const quantity = product.quantity || 1;
    const size = product.size || product.weight || null;
    const notes = product.notes || null;

    console.log(`${index + 1}. Original name: "${name}"`);
    console.log(`   Size/Weight: ${size || 'N/A'}`);
    
    // Format product name with size
    const formattedName = formatProductNameWithSize(name, size);
    console.log(`   Formatted name: "${formattedName}"`);
    
    // Build product line
    let line = formattedName;
    line += ` - Số lượng: ${quantity}`;
    if (notes) {
        line += ` - Lưu ý: ${notes}`;
    }
    
    const finalLine = `[${line}]`;
    console.log(`   Final output: ${finalLine}`);
    console.log('');
});

// Build full SPX format
const productLines = products.map(product => {
    const name = product.name || 'Sản phẩm';
    const quantity = product.quantity || 1;
    const size = product.size || product.weight || null;
    const notes = product.notes || null;

    const formattedName = formatProductNameWithSize(name, size);
    let line = formattedName;
    line += ` - Số lượng: ${quantity}`;
    if (notes) {
        line += ` - Lưu ý: ${notes}`;
    }
    return `[${line}]`;
});

const productsText = productLines.join(' ----- ');
const fullText = productsText + (mockOrder.notes ? ` ----- Lưu ý tổng: ${mockOrder.notes}` : '');

console.log('='.repeat(80));
console.log('\n📋 Final SPX Format Output:\n');
console.log(mockOrder.customer_name);
console.log(mockOrder.customer_phone);
console.log(mockOrder.address);
console.log(fullText);
console.log('\n' + '='.repeat(80));
console.log('✅ Test completed!\n');

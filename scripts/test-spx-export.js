// Test SPX Export Logic

// Mock data - sample orders
const mockOrders = [
    {
        id: 1,
        order_id: 'VDT001',
        customer_name: 'Nguyễn Văn A',
        customer_phone: '0909123456',
        address: '123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
        products: JSON.stringify([
            { name: 'Mix bạc 3ly + Charm rắn + Chuông + Thẻ tên co giãn', size: '5kg', quantity: 1, price: 359000 },
            { name: 'Vòng tay bạc', size: '14cm', quantity: 2, price: 150000 }
        ]),
        total_amount: 659000,
        notes: 'Giao giờ hành chính'
    },
    {
        id: 2,
        order_id: 'VDT002',
        customer_name: 'Trần Thị B',
        customer_phone: '0908888888',
        address: '456 Lê Lợi, Quận 3, TP. Hồ Chí Minh',
        products: JSON.stringify([
            { name: 'Dây chuyền vàng', size: '16cm', quantity: 1, price: 500000 }
        ]),
        total_amount: 500000,
        notes: ''
    },
    {
        id: 3,
        order_id: 'VDT003',
        customer_name: 'Lê Văn C',
        customer_phone: '0907777777',
        address: '789 Trần Hưng Đạo, Hà Nội',
        products: JSON.stringify([
            { name: 'Charm trái tim', size: '3.5kg', quantity: 1, price: 200000 }
        ]),
        total_amount: 200000,
        notes: 'Gọi trước khi giao'
    },
    {
        id: 4,
        order_id: 'VDT004',
        customer_name: 'Phạm Thị D',
        customer_phone: '0906666666',
        address: 'Đà Nẵng',
        products: JSON.stringify([
            { name: 'Vòng tay charm', quantity: 1, price: 180000 } // No size
        ]),
        total_amount: 180000,
        notes: ''
    },
    {
        id: 5,
        order_id: 'VDT005',
        customer_name: 'Hoàng Văn E',
        customer_phone: '0905555555',
        address: 'Hà Nội',
        products: JSON.stringify([
            { name: 'Vòng tay bạc', size: '15', quantity: 1, price: 200000 } // Number without unit - should NOT guess
        ]),
        total_amount: 200000,
        notes: ''
    }
];

// Parse address function (copy from spx-export.js)
function parseAddress(address) {
    if (!address) {
        return {
            province: '',
            district: '',
            ward: '',
            detail: ''
        };
    }

    const parts = address.split(',').map(p => p.trim());
    
    if (parts.length >= 4) {
        return {
            province: parts[parts.length - 1],
            district: parts[parts.length - 2],
            ward: parts[parts.length - 3],
            detail: parts.slice(0, parts.length - 3).join(', ')
        };
    } else if (parts.length === 3) {
        return {
            province: parts[2],
            district: parts[1],
            ward: '',
            detail: parts[0]
        };
    } else if (parts.length === 2) {
        return {
            province: parts[1],
            district: '',
            ward: '',
            detail: parts[0]
        };
    } else {
        return {
            province: '',
            district: '',
            ward: '',
            detail: address
        };
    }
}

// Format product name with size/weight
function formatProductName(name, size) {
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
    
    // If size is just a number without unit
    // Default to kg (weight for baby products) since most products are for babies
    if (/^\d+(\.\d+)?$/.test(sizeStr)) {
        return `${name} cho bé ${sizeStr}kg`;
    }
    
    // Unknown format - return as is
    return name;
}

// Parse products function
function parseProducts(productsJson) {
    if (!productsJson) return [];
    
    try {
        const products = typeof productsJson === 'string' ? JSON.parse(productsJson) : productsJson;
        if (Array.isArray(products)) {
            return products.map(p => ({
                name: formatProductName(p.name || p.product_name || '', p.size || p.weight || ''),
                quantity: p.quantity || 1,
                price: p.price || p.unit_price || 0
            }));
        }
    } catch (e) {
        console.warn('Could not parse products:', e);
    }
    
    return [];
}

// Test
console.log('🧪 Testing SPX Export Logic\n');
console.log('=' .repeat(80));

mockOrders.forEach((order, index) => {
    console.log(`\n📦 Order ${index + 1}: ${order.order_id}`);
    console.log('-'.repeat(80));
    
    const address = parseAddress(order.address);
    console.log('📍 Address parsing:');
    console.log('   Original:', order.address);
    console.log('   Province:', address.province);
    console.log('   District:', address.district);
    console.log('   Ward:', address.ward);
    console.log('   Detail:', address.detail);
    
    const products = parseProducts(order.products);
    console.log('\n📋 Products parsing:');
    console.log('   Count:', products.length);
    products.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.name} - Qty: ${p.quantity} - Price: ${p.price.toLocaleString()}đ`);
    });
    
    if (products.length === 0) {
        console.log('   ⚠️  No products - will create single row');
    } else {
        console.log(`   ✅ Will create ${products.length} rows for this order`);
    }
});

console.log('\n' + '='.repeat(80));
console.log('✅ Test completed!\n');

// Calculate total rows
const totalRows = mockOrders.reduce((sum, order) => {
    const products = parseProducts(order.products);
    return sum + Math.max(1, products.length);
}, 0);

console.log(`📊 Summary:`);
console.log(`   - Total orders: ${mockOrders.length}`);
console.log(`   - Total rows in Excel: ${totalRows}`);
console.log(`   - Expected filename format: SPX_DonHang_YYYYMMDD_${mockOrders.length}don.xlsx`);

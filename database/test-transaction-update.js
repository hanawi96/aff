// Test updateFlashSaleProducts API (Transaction-based)
import 'dotenv/config';

const API_BASE = process.env.API_URL || 'http://localhost:8787';

async function testTransactionUpdate() {
    console.log('🧪 Testing updateFlashSaleProducts API (Transaction-based)...\n');
    
    try {
        const flashSaleId = 6; // Your flash sale ID
        
        // Sample products data
        const products = [
            {
                product_id: 34,
                flash_price: 210000,
                original_price: 300000,
                stock_limit: 29,
                max_per_customer: null
            },
            {
                product_id: 35,
                flash_price: 100000,
                original_price: 145000,
                stock_limit: 30,
                max_per_customer: null
            },
            {
                product_id: 65,
                flash_price: 110000,
                original_price: 160000,
                stock_limit: 30,
                max_per_customer: null
            }
        ];
        
        console.log(`📤 Updating flash sale ${flashSaleId} with ${products.length} products in transaction...`);
        console.log('Products:', JSON.stringify(products, null, 2));
        
        const response = await fetch(`${API_BASE}/api?action=updateFlashSaleProducts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                flashSaleId: flashSaleId,
                products: products
            })
        });
        
        console.log(`\n📥 Response status: ${response.status} ${response.statusText}`);
        
        const data = await response.json();
        console.log('📦 Response data:', JSON.stringify(data, null, 2));
        
        if (data.success) {
            console.log(`\n✅ SUCCESS!`);
            console.log(`   Deleted: ${data.deletedCount} products`);
            console.log(`   Added: ${data.addedCount} products`);
            console.log(`   Message: ${data.message}`);
        } else {
            console.log(`\n❌ FAILED: ${data.error}`);
        }
        
    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Run test
testTransactionUpdate();

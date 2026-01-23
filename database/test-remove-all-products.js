// Test removeAllProductsFromFlashSale API
import 'dotenv/config';

const API_BASE = process.env.API_URL || 'http://localhost:8787';

async function testRemoveAllProducts() {
    console.log('🧪 Testing removeAllProductsFromFlashSale API...\n');
    
    try {
        // Test with a flash sale ID (replace with actual ID)
        const flashSaleId = 1; // Change this to your test flash sale ID
        
        console.log(`📤 Sending request to remove all products from flash sale ${flashSaleId}...`);
        
        const response = await fetch(`${API_BASE}/api?action=removeAllProductsFromFlashSale`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                flashSaleId: flashSaleId
            })
        });
        
        console.log(`📥 Response status: ${response.status} ${response.statusText}`);
        
        const data = await response.json();
        console.log('📦 Response data:', JSON.stringify(data, null, 2));
        
        if (data.success) {
            console.log(`\n✅ SUCCESS: Deleted ${data.deletedCount} products`);
        } else {
            console.log(`\n❌ FAILED: ${data.error}`);
        }
        
    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
    }
}

// Run test
testRemoveAllProducts();

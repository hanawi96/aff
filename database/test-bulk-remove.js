// Test script để kiểm tra bulk remove featured products

const API_URL = 'http://127.0.0.1:8787';

async function testBulkRemove() {
    try {
        console.log('🧪 Testing bulk remove featured products...');
        
        // Test 1: Get current featured products
        console.log('\n1️⃣ Getting current featured products...');
        const response = await fetch(`${API_URL}?action=getFeaturedProductsForAdmin`);
        const data = await response.json();
        
        if (data.success && data.featured_products && data.featured_products.length > 0) {
            console.log(`📦 Found ${data.featured_products.length} featured products`);
            
            // Take first 2 products for testing
            const testProducts = data.featured_products.slice(0, 2).map(p => p.id);
            console.log('🧪 Testing bulk remove with product IDs:', testProducts);
            
            if (testProducts.length === 0) {
                console.log('⚠️ No featured products to test with');
                return;
            }
            
            // Test 2: Bulk remove
            console.log('\n2️⃣ Testing removeMultipleFeaturedProducts...');
            const removeResponse = await fetch(`${API_URL}?action=removeMultipleFeaturedProducts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ product_ids: testProducts })
            });
            
            const removeData = await removeResponse.json();
            console.log('📤 Bulk remove result:', removeData);
            
            if (removeData.success) {
                console.log('🎉 Bulk remove works perfectly!');
                console.log(`✅ Removed ${removeData.removed_count} products`);
                if (removeData.skipped_count > 0) {
                    console.log(`⚠️ Skipped ${removeData.skipped_count} products`);
                }
                
                // Test 3: Verify removal
                console.log('\n3️⃣ Verifying removal...');
                const verifyResponse = await fetch(`${API_URL}?action=getFeaturedProductsForAdmin`);
                const verifyData = await verifyResponse.json();
                
                if (verifyData.success) {
                    console.log(`📊 Featured products after removal: ${verifyData.featured_products.length}`);
                    console.log('✅ Verification complete');
                } else {
                    console.log('❌ Verification failed:', verifyData.error);
                }
            } else {
                console.log('❌ Bulk remove failed:', removeData.error);
            }
        } else {
            console.log('❌ No featured products found or API error:', data);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run test
testBulkRemove();
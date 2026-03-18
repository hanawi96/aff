// Test reorder API
const API_URL = 'http://127.0.0.1:8787';

async function testReorderAPI() {
    console.log('🧪 Testing reorder API...');
    
    try {
        // Test data
        const testData = {
            product_orders: [
                { product_id: 1, display_order: 1 },
                { product_id: 2, display_order: 2 },
                { product_id: 3, display_order: 3 }
            ]
        };
        
        console.log('📡 Sending request:', testData);
        
        const response = await fetch(`${API_URL}?action=reorderFeaturedProducts`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer test-token`
            },
            body: JSON.stringify(testData)
        });
        
        console.log('📊 Response status:', response.status);
        
        const data = await response.json();
        console.log('📋 Response data:', data);
        
        if (data.success) {
            console.log('✅ API test successful!');
        } else {
            console.log('❌ API test failed:', data.error);
        }
        
    } catch (error) {
        console.error('❌ Test error:', error.message);
    }
}

// Run test if this file is executed directly
if (require.main === module) {
    testReorderAPI();
}

module.exports = { testReorderAPI };
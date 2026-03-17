// Test script để kiểm tra featured columns
// Sử dụng fetch để test API

const API_URL = 'http://127.0.0.1:8787';

async function testFeaturedColumns() {
    try {
        console.log('🧪 Testing featured columns...');
        
        // Test 1: Get all products to see if featured columns exist
        console.log('\n1️⃣ Testing getAllProducts...');
        const response = await fetch(`${API_URL}?action=getAllProducts`);
        const data = await response.json();
        
        if (data.success && data.products && data.products.length > 0) {
            const firstProduct = data.products[0];
            console.log('📦 First product structure:', Object.keys(firstProduct));
            
            // Check if featured columns exist
            const hasIsFeatured = 'is_featured' in firstProduct;
            const hasFeaturedOrder = 'featured_order' in firstProduct;
            const hasFeaturedAt = 'featured_at_unix' in firstProduct;
            
            console.log('✅ Featured columns check:');
            console.log('   is_featured:', hasIsFeatured);
            console.log('   featured_order:', hasFeaturedOrder);
            console.log('   featured_at_unix:', hasFeaturedAt);
            
            if (hasIsFeatured && hasFeaturedOrder && hasFeaturedAt) {
                console.log('🎉 All featured columns are available!');
                
                // Test 2: Try to add a product to featured
                console.log('\n2️⃣ Testing addFeaturedProduct...');
                
                // Find a non-featured product
                const nonFeaturedProduct = data.products.find(p => !p.is_featured);
                if (!nonFeaturedProduct) {
                    console.log('⚠️ All products are already featured, testing multi-add with featured products...');
                    
                    // Test 3: Try multi-add with some products
                    console.log('\n3️⃣ Testing addMultipleFeaturedProducts...');
                    const testProducts = data.products.filter(p => !p.is_featured).slice(0, 3).map(p => p.id);
                    console.log('🧪 Testing with non-featured product IDs:', testProducts);
                    
                    if (testProducts.length === 0) {
                        console.log('⚠️ No non-featured products available for testing');
                        return;
                    }
                    
                    const multiResponse = await fetch(`${API_URL}?action=addMultipleFeaturedProducts`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ product_ids: testProducts })
                    });
                    
                    const multiData = await multiResponse.json();
                    console.log('📤 Multi-add result:', multiData);
                    
                    if (multiData.success) {
                        console.log('🎉 Multi-add works perfectly!');
                    } else {
                        console.log('❌ Multi-add failed:', multiData.error);
                    }
                    return;
                }
                
                const productId = nonFeaturedProduct.id;
                
                const addResponse = await fetch(`${API_URL}?action=addFeaturedProduct`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ product_id: productId })
                });
                
                const addData = await addResponse.json();
                console.log('📤 Add featured result:', addData);
                
                if (addData.success) {
                    console.log('✅ Single add works!');
                    
                    // Test 3: Try multi-add
                    console.log('\n3️⃣ Testing addMultipleFeaturedProducts...');
                    const otherProducts = data.products.filter(p => !p.is_featured).slice(0, 3).map(p => p.id);
                    console.log('🧪 Testing with non-featured product IDs:', otherProducts);
                    
                    if (otherProducts.length === 0) {
                        console.log('⚠️ No non-featured products available for testing');
                        return;
                    }
                    
                    const multiResponse = await fetch(`${API_URL}?action=addMultipleFeaturedProducts`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ product_ids: otherProducts })
                    });
                    
                    const multiData = await multiResponse.json();
                    console.log('📤 Multi-add result:', multiData);
                    
                    if (multiData.success) {
                        console.log('🎉 Multi-add works perfectly!');
                    } else {
                        console.log('❌ Multi-add failed:', multiData.error);
                    }
                } else {
                    console.log('❌ Single add failed:', addData.error);
                }
            } else {
                console.log('❌ Missing featured columns. Need to run migration.');
            }
        } else {
            console.log('❌ No products found or API error:', data);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run test
testFeaturedColumns();
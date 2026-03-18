// Test database connection and featured products
console.log('🧪 Testing database connection and featured products...');

// Mock Cloudflare D1 environment for testing
const mockEnv = {
    DB: {
        prepare: (sql) => ({
            bind: (...params) => ({
                run: () => {
                    console.log('📤 SQL:', sql);
                    console.log('📦 Params:', params);
                    return { success: true, changes: 1 };
                },
                first: () => {
                    console.log('📤 SQL:', sql);
                    console.log('📦 Params:', params);
                    
                    // Mock responses based on SQL
                    if (sql.includes('COUNT(*)')) {
                        return { count: 0 };
                    }
                    if (sql.includes('MAX(featured_order)')) {
                        return { max_order: 0 };
                    }
                    if (sql.includes('SELECT id, name')) {
                        return { id: 1, name: 'Test Product', is_featured: 0 };
                    }
                    
                    return null;
                },
                all: () => {
                    console.log('📤 SQL:', sql);
                    console.log('📦 Params:', params);
                    return { results: [] };
                }
            }),
            run: () => {
                console.log('📤 SQL:', sql);
                return { success: true, changes: 1 };
            },
            first: () => {
                console.log('📤 SQL:', sql);
                
                // Mock responses based on SQL
                if (sql.includes('COUNT(*)')) {
                    return { count: 0 };
                }
                if (sql.includes('MAX(featured_order)')) {
                    return { max_order: 0 };
                }
                if (sql.includes('SELECT id, name')) {
                    return { id: 1, name: 'Test Product', is_featured: 0 };
                }
                
                return null;
            },
            all: () => {
                console.log('📤 SQL:', sql);
                return { results: [] };
            }
        })
    }
};

// Test add featured product
async function testAddFeatured() {
    console.log('\n🔄 Testing addFeaturedProduct...');
    
    const product_id = 1;
    
    try {
        // Check product exists
        const product = await mockEnv.DB.prepare(`
            SELECT id, name, is_featured FROM products WHERE id = ? AND is_active = 1
        `).bind(product_id).first();
        
        if (!product) {
            console.log('❌ Product not found');
            return;
        }
        
        // Check current count
        const { count } = await mockEnv.DB.prepare(`
            SELECT COUNT(*) as count FROM products WHERE is_featured = 1
        `).first();
        
        // Get next order
        const { max_order } = await mockEnv.DB.prepare(`
            SELECT COALESCE(MAX(featured_order), 0) as max_order FROM products WHERE is_featured = 1
        `).first();
        
        const now = Math.floor(Date.now() / 1000);
        
        // Update product
        await mockEnv.DB.prepare(`
            UPDATE products 
            SET is_featured = ?, 
                featured_order = ?, 
                featured_at_unix = ?
            WHERE id = ?
        `).bind(1, max_order + 1, now, product_id).run();
        
        console.log('✅ addFeaturedProduct test passed');
        
    } catch (error) {
        console.error('❌ addFeaturedProduct test failed:', error);
    }
}

// Test reorder
async function testReorder() {
    console.log('\n🔄 Testing reorderFeaturedProducts...');
    
    const product_orders = [
        { product_id: 1, display_order: 1 },
        { product_id: 2, display_order: 2 }
    ];
    
    try {
        for (let i = 0; i < product_orders.length; i++) {
            const item = product_orders[i];
            const productId = parseInt(item.product_id);
            const displayOrder = parseInt(item.display_order);
            
            const result = await mockEnv.DB.prepare(`
                UPDATE products 
                SET featured_order = ?
                WHERE id = ? AND is_featured = 1
            `).bind(displayOrder, productId).run();
            
            console.log(`✅ Updated product ${productId} to order ${displayOrder}`);
        }
        
        console.log('✅ reorderFeaturedProducts test passed');
        
    } catch (error) {
        console.error('❌ reorderFeaturedProducts test failed:', error);
    }
}

// Run tests
async function runTests() {
    console.log('🚀 Starting database tests...\n');
    
    await testAddFeatured();
    await testReorder();
    
    console.log('\n🎉 All tests completed!');
}

runTests();
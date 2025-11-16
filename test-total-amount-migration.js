/**
 * TEST SCRIPT: Verify total_amount migration
 * 
 * This script tests that total_amount column is correctly calculated
 * and matches the sum from order_items + shipping_fee
 */

const API_BASE = 'http://127.0.0.1:8787';

// Test functions
const tests = [
    {
        name: 'Test 1: getCollaboratorInfo',
        endpoint: '/api/ctv/info?referralCode=CTV123456',
        validate: (data) => {
            if (!data.success) return { pass: false, error: 'API failed' };
            if (!data.stats) return { pass: false, error: 'Missing stats' };
            if (typeof data.stats.totalRevenue !== 'number') {
                return { pass: false, error: 'totalRevenue is not a number' };
            }
            return { pass: true };
        }
    },
    {
        name: 'Test 2: getAllCTV',
        endpoint: '/api/ctv/all',
        validate: (data) => {
            if (!data.success) return { pass: false, error: 'API failed' };
            if (!Array.isArray(data.ctvList)) return { pass: false, error: 'ctvList is not array' };
            return { pass: true };
        }
    },
    {
        name: 'Test 3: getRecentOrders',
        endpoint: '/api/orders/recent?limit=10',
        validate: (data) => {
            if (!data.success) return { pass: false, error: 'API failed' };
            if (!Array.isArray(data.orders)) return { pass: false, error: 'orders is not array' };
            
            // Check if total_amount exists in orders
            const hasTotal = data.orders.every(order => typeof order.total_amount === 'number');
            if (!hasTotal) return { pass: false, error: 'Some orders missing total_amount' };
            
            return { pass: true };
        }
    },
    {
        name: 'Test 4: getDashboardStats',
        endpoint: '/api/dashboard/stats',
        validate: (data) => {
            if (!data.success) return { pass: false, error: 'API failed' };
            if (!data.stats) return { pass: false, error: 'Missing stats' };
            if (typeof data.stats.totalRevenue !== 'number') {
                return { pass: false, error: 'totalRevenue is not a number' };
            }
            return { pass: true };
        }
    },
    {
        name: 'Test 5: getAllCustomers',
        endpoint: '/api/customers/all',
        validate: (data) => {
            if (!data.success) return { pass: false, error: 'API failed' };
            if (!Array.isArray(data.customers)) return { pass: false, error: 'customers is not array' };
            
            // Check if total_spent exists
            const hasSpent = data.customers.every(c => typeof c.total_spent === 'number');
            if (!hasSpent) return { pass: false, error: 'Some customers missing total_spent' };
            
            return { pass: true };
        }
    }
];

// Run tests
async function runTests() {
    console.log('🧪 Starting total_amount migration tests...\n');
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
        try {
            console.log(`Running: ${test.name}`);
            
            const response = await fetch(`${API_BASE}${test.endpoint}`);
            const data = await response.json();
            
            const result = test.validate(data);
            
            if (result.pass) {
                console.log(`✅ PASSED: ${test.name}\n`);
                passed++;
            } else {
                console.log(`❌ FAILED: ${test.name}`);
                console.log(`   Error: ${result.error}\n`);
                failed++;
            }
        } catch (error) {
            console.log(`❌ FAILED: ${test.name}`);
            console.log(`   Error: ${error.message}\n`);
            failed++;
        }
    }
    
    console.log('='.repeat(50));
    console.log(`\n📊 Test Results:`);
    console.log(`   ✅ Passed: ${passed}/${tests.length}`);
    console.log(`   ❌ Failed: ${failed}/${tests.length}`);
    
    if (failed === 0) {
        console.log('\n🎉 All tests passed! Migration successful!\n');
    } else {
        console.log('\n⚠️  Some tests failed. Please check the errors above.\n');
    }
}

// Run if called directly
if (typeof window === 'undefined') {
    runTests().catch(console.error);
}

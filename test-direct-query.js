/**
 * Test Direct Database Query
 * Kiểm tra trực tiếp database để tìm nguyên nhân
 */

import { createClient } from '@libsql/client';

const client = createClient({
  url: 'libsql://vdt-yendev96.aws-ap-northeast-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjgzNjk1NjEsImlkIjoiYmUyMWFlNjItYjNjYi00MjVjLTkwYTQtNjc3NzczN2I0YjU3IiwicmlkIjoiNDk5MWI3YTgtYjQwYi00NTY1LWJhM2ItZjI3ZDM2NTkwY2UzIn0.L2xPFAjyo1A_8UZ0uAaNX-EnFTexiUTCEOS1qA3jpu4uEsTRPiDlnv0KVAbJr1K4zVr2DDkbAK3SiURzdnahCg',
});

async function testPhoneSearch() {
    try {
        const testPhones = ['0901234504', '0901234567', '0386190596'];
        
        for (const phone of testPhones) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`📞 Testing phone: ${phone}`);
            console.log('='.repeat(60));
            
            // Test 1: Check if it's a CTV
            console.log('\n1️⃣ Checking CTV table...');
            const ctvResult = await client.execute({
                sql: 'SELECT referral_code, full_name, phone FROM ctv WHERE phone = ? OR phone = ? OR phone = ?',
                args: [phone, '0' + phone, phone.replace(/^0/, '')]
            });
            
            if (ctvResult.rows.length > 0) {
                console.log('✅ Found in CTV table:');
                console.log('   Referral Code:', ctvResult.rows[0].referral_code);
                console.log('   Name:', ctvResult.rows[0].full_name);
                console.log('   Phone:', ctvResult.rows[0].phone);
            } else {
                console.log('❌ Not found in CTV table');
            }
            
            // Test 2: Check orders
            console.log('\n2️⃣ Checking orders table...');
            const ordersResult = await client.execute({
                sql: 'SELECT order_id, customer_name, customer_phone, total_amount FROM orders WHERE customer_phone LIKE ? LIMIT 5',
                args: [`%${phone}%`]
            });
            
            if (ordersResult.rows.length > 0) {
                console.log(`✅ Found ${ordersResult.rows.length} orders:`);
                ordersResult.rows.forEach((order, i) => {
                    console.log(`   ${i+1}. ${order.order_id} - ${order.customer_name} - ${order.customer_phone} - ${order.total_amount}đ`);
                });
            } else {
                console.log('❌ No orders found');
            }
            
            // Test 3: Check exact match
            console.log('\n3️⃣ Checking exact phone match...');
            const exactResult = await client.execute({
                sql: 'SELECT order_id, customer_phone FROM orders WHERE customer_phone = ? LIMIT 1',
                args: [phone]
            });
            
            if (exactResult.rows.length > 0) {
                console.log('✅ Exact match found:', exactResult.rows[0].customer_phone);
            } else {
                console.log('❌ No exact match');
            }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ Test complete!');
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        client.close();
    }
}

testPhoneSearch();

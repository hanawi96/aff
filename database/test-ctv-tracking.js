// Script test chức năng CTV tracking
import { createClient } from '@libsql/client';

const client = createClient({
  url: 'libsql://vdt-yendev96.aws-ap-northeast-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjgzNjk1NjEsImlkIjoiYmUyMWFlNjItYjNjYi00MjVjLTkwYTQtNjc3NzczN2I0YjU3IiwicmlkIjoiNDk5MWI3YTgtYjQwYi00NTY1LWJhM2ItZjI3ZDM2NTkwY2UzIn0.L2xPFAjyo1A_8UZ0uAaNX-EnFTexiUTCEOS1qA3jpu4uEsTRPiDlnv0KVAbJr1K4zVr2DDkbAK3SiURzdnahCg',
});

async function testCTVTracking() {
  try {
    console.log('🧪 Test CTV Tracking System\n');
    console.log('='.repeat(80));

    // Test 1: Lấy 1 CTV để test
    console.log('\n📋 Test 1: Lấy CTV mẫu');
    console.log('-'.repeat(80));
    const ctv = await client.execute(`
      SELECT referral_code, custom_slug, full_name, phone, commission_rate, status
      FROM ctv 
      WHERE status = 'Mới'
      LIMIT 1
    `);
    
    if (ctv.rows.length === 0) {
      console.log('❌ Không có CTV nào trong database');
      return;
    }
    
    const testCTV = ctv.rows[0];
    console.log('✅ CTV Test:', {
      code: testCTV.referral_code,
      slug: testCTV.custom_slug,
      name: testCTV.full_name,
      phone: testCTV.phone,
      rate: `${(testCTV.commission_rate * 100).toFixed(1)}%`
    });

    // Test 2: Tính hoa hồng mẫu
    console.log('\n💰 Test 2: Tính hoa hồng');
    console.log('-'.repeat(80));
    const totalAmount = 500000;
    const shippingFee = 30000;
    const revenue = totalAmount - shippingFee;
    const commission = Math.round(revenue * testCTV.commission_rate);
    
    console.log('Tổng đơn hàng:', totalAmount.toLocaleString('vi-VN') + 'đ');
    console.log('Phí ship:', shippingFee.toLocaleString('vi-VN') + 'đ');
    console.log('Doanh thu:', revenue.toLocaleString('vi-VN') + 'đ');
    console.log('Tỷ lệ hoa hồng:', `${(testCTV.commission_rate * 100).toFixed(1)}%`);
    console.log('✅ Hoa hồng:', commission.toLocaleString('vi-VN') + 'đ');

    // Test 3: Kiểm tra validate referral code
    console.log('\n🔍 Test 3: Validate Referral Code');
    console.log('-'.repeat(80));
    
    // Test với referral_code
    const validateByCode = await client.execute(`
      SELECT referral_code, custom_slug, full_name, phone, commission_rate, status
      FROM ctv 
      WHERE referral_code = ? OR custom_slug = ?
    `, [testCTV.referral_code, testCTV.referral_code]);
    
    if (validateByCode.rows.length > 0) {
      console.log('✅ Validate bằng referral_code:', testCTV.referral_code);
    } else {
      console.log('❌ Không tìm thấy CTV với code:', testCTV.referral_code);
    }
    
    // Test với custom_slug (nếu có)
    if (testCTV.custom_slug) {
      const validateBySlug = await client.execute(`
        SELECT referral_code, custom_slug, full_name, phone, commission_rate, status
        FROM ctv 
        WHERE referral_code = ? OR custom_slug = ?
      `, [testCTV.custom_slug, testCTV.custom_slug]);
      
      if (validateBySlug.rows.length > 0) {
        console.log('✅ Validate bằng custom_slug:', testCTV.custom_slug);
      } else {
        console.log('❌ Không tìm thấy CTV với slug:', testCTV.custom_slug);
      }
    } else {
      console.log('ℹ️ CTV chưa có custom_slug');
    }

    // Test 4: Kiểm tra đơn hàng có CTV
    console.log('\n📦 Test 4: Kiểm tra đơn hàng có CTV');
    console.log('-'.repeat(80));
    const ordersWithCTV = await client.execute(`
      SELECT 
        order_id,
        customer_name,
        total_amount,
        shipping_fee,
        referral_code,
        commission,
        commission_rate,
        ctv_phone,
        created_at_unix
      FROM orders
      WHERE referral_code IS NOT NULL AND referral_code != ''
      ORDER BY created_at_unix DESC
      LIMIT 5
    `);
    
    if (ordersWithCTV.rows.length > 0) {
      console.log(`✅ Tìm thấy ${ordersWithCTV.rows.length} đơn hàng có CTV:\n`);
      ordersWithCTV.rows.forEach((order, index) => {
        console.log(`Đơn #${index + 1}:`, {
          orderId: order.order_id,
          customer: order.customer_name,
          total: order.total_amount.toLocaleString('vi-VN') + 'đ',
          shipping: order.shipping_fee.toLocaleString('vi-VN') + 'đ',
          ctvCode: order.referral_code,
          commission: order.commission.toLocaleString('vi-VN') + 'đ',
          rate: `${(order.commission_rate * 100).toFixed(1)}%`
        });
      });
    } else {
      console.log('ℹ️ Chưa có đơn hàng nào từ CTV');
    }

    // Test 5: Thống kê tổng quan
    console.log('\n📊 Test 5: Thống kê tổng quan');
    console.log('-'.repeat(80));
    const stats = await client.execute(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(DISTINCT referral_code) as unique_ctvs,
        SUM(total_amount) as total_revenue,
        SUM(commission) as total_commission
      FROM orders
      WHERE referral_code IS NOT NULL AND referral_code != ''
    `);
    
    const statsData = stats.rows[0];
    console.log('Tổng đơn hàng có CTV:', statsData.total_orders);
    console.log('Số CTV có đơn:', statsData.unique_ctvs);
    console.log('Tổng doanh thu:', (statsData.total_revenue || 0).toLocaleString('vi-VN') + 'đ');
    console.log('Tổng hoa hồng:', (statsData.total_commission || 0).toLocaleString('vi-VN') + 'đ');

    // Test 6: Link test
    console.log('\n🔗 Test 6: Link để test');
    console.log('-'.repeat(80));
    console.log('Link test với referral code:');
    console.log(`  http://localhost:5500/shop/?ref=${testCTV.referral_code}`);
    console.log(`  http://localhost:5500/shop/cart.html?ref=${testCTV.referral_code}`);
    
    if (testCTV.custom_slug) {
      console.log('\nLink test với custom slug:');
      console.log(`  http://localhost:5500/shop/?ref=${testCTV.custom_slug}`);
    }

    console.log('\n✅ Hoàn thành test!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    console.error(error);
  } finally {
    client.close();
  }
}

testCTVTracking();

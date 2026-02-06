// Script để kiểm tra cấu trúc và dữ liệu bảng CTV
import { createClient } from '@libsql/client';

const client = createClient({
  url: 'libsql://vdt-yendev96.aws-ap-northeast-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjgzNjk1NjEsImlkIjoiYmUyMWFlNjItYjNjYi00MjVjLTkwYTQtNjc3NzczN2I0YjU3IiwicmlkIjoiNDk5MWI3YTgtYjQwYi00NTY1LWJhM2ItZjI3ZDM2NTkwY2UzIn0.L2xPFAjyo1A_8UZ0uAaNX-EnFTexiUTCEOS1qA3jpu4uEsTRPiDlnv0KVAbJr1K4zVr2DDkbAK3SiURzdnahCg',
});

async function checkCTVTable() {
  try {
    console.log('🔍 Kiểm tra cấu trúc bảng CTV...\n');

    // 1. Lấy schema của bảng ctv
    console.log('📋 SCHEMA CỦA BẢNG CTV:');
    console.log('='.repeat(80));
    const schema = await client.execute(`
      PRAGMA table_info(ctv)
    `);
    
    console.table(schema.rows);

    // 2. Đếm tổng số CTV
    console.log('\n📊 THỐNG KÊ:');
    console.log('='.repeat(80));
    const count = await client.execute(`
      SELECT COUNT(*) as total FROM ctv
    `);
    console.log(`Tổng số CTV: ${count.rows[0].total}`);

    // 3. Lấy 5 CTV mẫu
    console.log('\n👥 MẪU DỮ LIỆU (5 CTV đầu tiên):');
    console.log('='.repeat(80));
    const samples = await client.execute(`
      SELECT * FROM ctv LIMIT 5
    `);
    
    if (samples.rows.length > 0) {
      samples.rows.forEach((row, index) => {
        console.log(`\n--- CTV #${index + 1} ---`);
        Object.entries(row).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
      });
    } else {
      console.log('Chưa có dữ liệu CTV nào');
    }

    // 4. Kiểm tra các referral_code hiện có
    console.log('\n🔗 REFERRAL CODES:');
    console.log('='.repeat(80));
    const codes = await client.execute(`
      SELECT referral_code, full_name, phone, status, commission_rate, created_at_unix 
      FROM ctv 
      ORDER BY created_at_unix DESC
      LIMIT 10
    `);
    
    if (codes.rows.length > 0) {
      console.table(codes.rows);
    } else {
      console.log('Chưa có referral code nào');
    }

    // 5. Kiểm tra CTV có đơn hàng
    console.log('\n📦 CTV CÓ ĐƠN HÀNG:');
    console.log('='.repeat(80));
    const ctvWithOrders = await client.execute(`
      SELECT 
        c.referral_code,
        c.full_name,
        c.phone,
        COUNT(o.id) as total_orders,
        SUM(o.total_amount) as total_revenue,
        SUM(o.commission) as total_commission
      FROM ctv c
      LEFT JOIN orders o ON c.referral_code = o.referral_code
      GROUP BY c.referral_code, c.full_name, c.phone
      HAVING total_orders > 0
      ORDER BY total_orders DESC
      LIMIT 10
    `);
    
    if (ctvWithOrders.rows.length > 0) {
      console.table(ctvWithOrders.rows);
    } else {
      console.log('Chưa có CTV nào có đơn hàng');
    }

    // 6. Kiểm tra các trường quan trọng cho chức năng tracking
    console.log('\n🎯 KIỂM TRA CÁC TRƯỜNG QUAN TRỌNG:');
    console.log('='.repeat(80));
    const importantFields = await client.execute(`
      SELECT 
        COUNT(*) as total,
        COUNT(referral_code) as has_referral_code,
        COUNT(commission_rate) as has_commission_rate,
        COUNT(status) as has_status,
        AVG(commission_rate) as avg_commission_rate
      FROM ctv
    `);
    console.table(importantFields.rows);

    console.log('\n✅ Hoàn thành kiểm tra!');

  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    console.error(error);
  } finally {
    client.close();
  }
}

checkCTVTable();

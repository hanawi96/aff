// Script để kiểm tra schema bảng orders
import { createClient } from '@libsql/client';

const client = createClient({
  url: 'libsql://vdt-yendev96.aws-ap-northeast-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjgzNjk1NjEsImlkIjoiYmUyMWFlNjItYjNjYi00MjVjLTkwYTQtNjc3NzczN2I0YjU3IiwicmlkIjoiNDk5MWI3YTgtYjQwYi00NTY1LWJhM2ItZjI3ZDM2NTkwY2UzIn0.L2xPFAjyo1A_8UZ0uAaNX-EnFTexiUTCEOS1qA3jpu4uEsTRPiDlnv0KVAbJr1K4zVr2DDkbAK3SiURzdnahCg',
});

async function checkOrdersSchema() {
  try {
    console.log('🔍 Kiểm tra schema bảng orders...\n');

    // Lấy schema của bảng orders
    console.log('📋 SCHEMA CỦA BẢNG ORDERS:');
    console.log('='.repeat(80));
    const schema = await client.execute(`
      PRAGMA table_info(orders)
    `);
    
    console.table(schema.rows);

    // Kiểm tra các cột liên quan đến CTV
    console.log('\n🎯 CÁC CỘT LIÊN QUAN ĐÉN CTV:');
    console.log('='.repeat(80));
    const ctvColumns = schema.rows.filter(col => 
      col.name.includes('referral') || 
      col.name.includes('commission') || 
      col.name.includes('ctv')
    );
    
    if (ctvColumns.length > 0) {
      console.table(ctvColumns);
    } else {
      console.log('❌ Chưa có cột nào liên quan đến CTV');
    }

    // Lấy 3 đơn hàng mẫu
    console.log('\n📦 MẪU DỮ LIỆU (3 đơn hàng):');
    console.log('='.repeat(80));
    const samples = await client.execute(`
      SELECT * FROM orders LIMIT 3
    `);
    
    if (samples.rows.length > 0) {
      samples.rows.forEach((row, index) => {
        console.log(`\n--- Đơn hàng #${index + 1} ---`);
        Object.entries(row).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
      });
    } else {
      console.log('Chưa có đơn hàng nào');
    }

    console.log('\n✅ Hoàn thành kiểm tra!');

  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    console.error(error);
  } finally {
    client.close();
  }
}

checkOrdersSchema();

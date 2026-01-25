const { createClient } = require('@libsql/client');

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || 'libsql://vdt-yendev96.aws-ap-northeast-1.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjgzNjk1NjEsImlkIjoiYmUyMWFlNjItYjNjYi00MjVjLTkwYTQtNjc3NzczN2I0YjU3IiwicmlkIjoiNDk5MWI3YTgtYjQwYi00NTY1LWJhM2ItZjI3ZDM2NTkwY2UzIn0.L2xPFAjyo1A_8UZ0uAaNX-EnFTexiUTCEOS1qA3jpu4uEsTRPiDlnv0KVAbJr1K4zVr2DDkbAK3SiURzdnahCg'
});

async function runMigration060() {
  try {
    console.log('🚀 Starting Migration 060: Add favorites_count to products...');
    
    // Check if column already exists
    const checkColumn = await client.execute(`
      PRAGMA table_info(products);
    `);
    
    const hasColumn = checkColumn.rows.some(row => row[1] === 'favorites_count');
    
    if (hasColumn) {
      console.log('✅ Column favorites_count already exists in products table');
      return;
    }
    
    // Add favorites_count column
    console.log('📝 Adding favorites_count column to products table...');
    await client.execute(`
      ALTER TABLE products ADD COLUMN favorites_count INTEGER DEFAULT 0;
    `);
    
    // Update existing products
    console.log('🔄 Updating existing products with default favorites_count = 0...');
    const updateResult = await client.execute(`
      UPDATE products SET favorites_count = 0 WHERE favorites_count IS NULL;
    `);
    
    console.log(`✅ Updated ${updateResult.rowsAffected} products with default favorites_count`);
    
    // Verify the migration
    console.log('🔍 Verifying migration...');
    const verifyResult = await client.execute(`
      SELECT COUNT(*) as total_products, 
             COUNT(CASE WHEN favorites_count IS NOT NULL THEN 1 END) as products_with_favorites_count
      FROM products;
    `);
    
    const stats = verifyResult.rows[0];
    console.log(`📊 Total products: ${stats[0]}`);
    console.log(`📊 Products with favorites_count: ${stats[1]}`);
    
    if (stats[0] === stats[1]) {
      console.log('✅ Migration 060 completed successfully!');
    } else {
      console.log('❌ Migration verification failed - some products missing favorites_count');
    }
    
  } catch (error) {
    console.error('❌ Migration 060 failed:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Run migration if called directly
if (require.main === module) {
  runMigration060()
    .then(() => {
      console.log('🎉 Migration 060 process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration 060 process failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration060 };
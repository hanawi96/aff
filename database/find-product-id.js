const { createClient } = require('@libsql/client');
require('dotenv').config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function findProductByName(searchTerm) {
  try {
    console.log(`\n🔍 Searching for products containing: "${searchTerm}"\n`);
    console.log('='.repeat(80));
    
    const result = await client.execute({
      sql: `SELECT id, name, price, original_price 
            FROM products 
            WHERE name LIKE ? 
            ORDER BY id`,
      args: [`%${searchTerm}%`]
    });
    
    if (result.rows.length === 0) {
      console.log(`❌ No products found containing "${searchTerm}"`);
      return;
    }
    
    console.log(`✅ Found ${result.rows.length} product(s):\n`);
    
    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. Product ID: ${row.id}`);
      console.log(`   Name: ${row.name}`);
      console.log(`   Price: ${row.price}`);
      if (row.original_price) {
        console.log(`   Original Price: ${row.original_price}`);
      }
      console.log('');
    });
    
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.close();
  }
}

// Search for the product
findProductByName('Vòng ngũ sắc mix 1 hạt dâu');

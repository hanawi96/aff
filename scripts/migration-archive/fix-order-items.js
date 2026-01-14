// Fix order_items import
import { createClient } from '@libsql/client';
import { config } from 'dotenv';

config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

console.log('🔧 Importing order_items...\n');

const orderItems = [
  [450,146,23,'Mix bạc 3ly + Charm rắn + Chuông + Thẻ tên co giãn',359000,215400,1,'5',null,1763726958889,1763726958889],
  [451,147,23,'Mix bạc 3ly + Charm rắn + Chuông + Thẻ tên co giãn',359000,215400,1,'5',null,1763738668149,1763738668149],
  [452,148,23,'Mix bạc 3ly + Charm rắn + Chuông + Thẻ tên co giãn',359000,215400,1,'5',null,1763739210479,1763739210479],
  [453,149,23,'Mix bạc 3ly + Charm rắn + Chuông + Thẻ tên co giãn',359000,215400,1,'5',null,1763739447181,1763739447181],
  [454,150,23,'Mix bạc 3ly + Charm rắn + Chuông + Thẻ tên co giãn',359000,215400,1,'5',null,1763739489115,1763739489115],
  [455,151,10,'Trơn mix 2 bi bạc',79000,39500,1,'4',null,1763739723257,1763739723257],
  [456,152,23,'Mix bạc 3ly + Charm rắn + Chuông + Thẻ tên co giãn',359000,215400,1,'5',null,1763814274861,1763814274861],
  [458,153,null,'Mix bạc 3ly + Charm rắn + Chuông + Thẻ tên co giãn',359000,215400,2,'5',null,1763882032782,1763882032782],
  [459,154,23,'Mix bạc 3ly + Charm rắn + Chuông + Thẻ tên co giãn',359000,215400,1,'4',null,1763885376647,1763885376647],
  [460,155,23,'Mix bạc 3ly + Charm rắn + Chuông + Thẻ tên co giãn',359000,215400,1,'6',null,1763894242974,1763894242974],
  [487,175,23,'Mix bạc 3ly + Charm rắn + Chuông + Thẻ tên co giãn',359000,215400,1,'5',null,1764483732701,1764483732701]
];

async function importOrderItems() {
  let success = 0;
  let errors = 0;

  for (const item of orderItems) {
    try {
      // Remove the last element (updated_at_unix) as table doesn't have it
      const itemData = item.slice(0, -1);
      
      await client.execute({
        sql: `INSERT INTO order_items (id, order_id, product_id, product_name, product_price, product_cost, quantity, size, notes, created_at_unix) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: itemData
      });
      console.log(`✅ Inserted order_item ${item[0]}`);
      success++;
    } catch (error) {
      console.error(`❌ Error inserting order_item ${item[0]}:`, error.message);
      errors++;
    }
  }

  console.log(`\n📊 Summary: ${success} success, ${errors} errors`);
  
  // Verify
  const result = await client.execute('SELECT COUNT(*) as count FROM order_items');
  console.log(`\n✅ Total order_items in database: ${result.rows[0].count}\n`);
}

importOrderItems();

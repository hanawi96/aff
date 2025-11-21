// Script để migrate dữ liệu từ discounts.json sang D1 database
const fs = require('fs');
const path = require('path');

// Đọc file JSON
const discountsJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../public/assets/data/discounts.json'), 'utf8')
);

// Generate SQL INSERT statements
const generateInsertSQL = () => {
  const inserts = discountsJson.map(discount => {
    // Parse expiry date (DD/MM/YYYY -> YYYY-MM-DD)
    const [day, month, year] = discount.expiry.split('/');
    const expiryDate = `${year}-${month}-${day}`;
    
    // Xử lý gift value
    let giftProductId = null;
    let giftProductName = null;
    if (discount.type === 'gift' && discount.value) {
      giftProductId = discount.value.id || null;
      giftProductName = discount.value.name || null;
    }
    
    // Xử lý discount value
    const discountValue = discount.type === 'fixed' ? discount.value : 0;
    
    return `INSERT INTO discounts (
      code, title, description, type, 
      discount_value, gift_product_id, gift_product_name, gift_quantity,
      min_order_amount, min_items, 
      max_uses_per_customer, customer_type,
      combinable_with_other_discounts,
      active, visible, expiry_date
    ) VALUES (
      '${discount.code}',
      '${discount.title.replace(/'/g, "''")}',
      '${discount.description.replace(/'/g, "''")}',
      '${discount.type}',
      ${discountValue},
      ${giftProductId ? `'${giftProductId}'` : 'NULL'},
      ${giftProductName ? `'${giftProductName.replace(/'/g, "''")}'` : 'NULL'},
      1,
      ${discount.minOrder || 0},
      ${discount.minItems || 0},
      1,
      'all',
      0,
      ${discount.active ? 1 : 0},
      ${discount.visible ? 1 : 0},
      '${expiryDate}'
    );`;
  });
  
  return inserts.join('\n\n');
};

// Generate SQL file
const sqlContent = `-- Migration: Import discounts from JSON to D1
-- Generated: ${new Date().toISOString()}

${generateInsertSQL()}
`;

// Write to file
fs.writeFileSync(
  path.join(__dirname, 'migrate_discounts.sql'),
  sqlContent,
  'utf8'
);

console.log('✅ Generated migrate_discounts.sql');
console.log(`📊 Total discounts: ${discountsJson.length}`);
console.log('\n📝 Next steps:');
console.log('1. Run: wrangler d1 execute vdt --file=database/discounts_schema.sql');
console.log('2. Run: wrangler d1 execute vdt --file=database/migrate_discounts.sql');

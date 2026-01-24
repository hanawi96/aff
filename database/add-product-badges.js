const { createClient } = require('@libsql/client');
require('dotenv').config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function addProductBadges() {
    try {
        console.log('Adding badge columns to products table...');
        
        // Check if columns already exist
        const tableInfo = await client.execute({
            sql: 'PRAGMA table_info(products)',
            args: []
        });
        
        const columns = tableInfo.rows.map(row => row.name);
        
        // Add is_handmade column if not exists
        if (!columns.includes('is_handmade')) {
            await client.execute({
                sql: 'ALTER TABLE products ADD COLUMN is_handmade INTEGER DEFAULT 0',
                args: []
            });
            console.log('✓ Added is_handmade column');
        } else {
            console.log('✓ is_handmade column already exists');
        }
        
        // Add is_chemical_free column if not exists
        if (!columns.includes('is_chemical_free')) {
            await client.execute({
                sql: 'ALTER TABLE products ADD COLUMN is_chemical_free INTEGER DEFAULT 0',
                args: []
            });
            console.log('✓ Added is_chemical_free column');
        } else {
            console.log('✓ is_chemical_free column already exists');
        }
        
        console.log('\n✅ Database schema updated successfully!');
        console.log('\nNow you can update products with these badges:');
        console.log('- is_handmade = 1 for "Thủ công 100%" badge');
        console.log('- is_chemical_free = 1 for "Không hóa chất" badge');
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        client.close();
    }
}

addProductBadges();

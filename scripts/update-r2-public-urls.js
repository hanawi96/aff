// Update R2 URLs from private to public
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

const OLD_BASE_URL = 'https://6732e495e6dc332a4d51e0aba6c0408a.r2.cloudflarestorage.com/vdt-image';
const NEW_BASE_URL = 'https://pub-857086f8ce7248b6ab3b37c688164fb1.r2.dev';

async function updateUrls() {
    console.log('🔄 Updating R2 URLs to public endpoint...\n');
    
    try {
        // Get all products with R2 URLs
        const result = await db.execute({
            sql: 'SELECT id, name, image_url FROM products WHERE image_url LIKE ?',
            args: [`%r2.cloudflarestorage.com%`]
        });
        
        console.log(`Found ${result.rows.length} products to update\n`);
        
        let updated = 0;
        
        for (const row of result.rows) {
            const newUrl = row.image_url.replace(OLD_BASE_URL, NEW_BASE_URL);
            
            await db.execute({
                sql: 'UPDATE products SET image_url = ? WHERE id = ?',
                args: [newUrl, row.id]
            });
            
            console.log(`✅ ${row.name}`);
            console.log(`   ${newUrl}\n`);
            updated++;
        }
        
        console.log(`\n✅ Updated ${updated} products successfully!`);
        
        // Verify
        const verify = await db.execute({
            sql: 'SELECT COUNT(*) as count FROM products WHERE image_url LIKE ?',
            args: [`%pub-857086f8ce7248b6ab3b37c688164fb1.r2.dev%`]
        });
        
        console.log(`\n📊 Verification: ${verify.rows[0].count} products now using public R2 URL`);
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

updateUrls();

// Check current image URLs in database
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function checkImageUrls() {
    console.log('🔍 Checking current image URLs in database...\n');
    
    const result = await db.execute('SELECT id, name, image_url FROM products WHERE image_url IS NOT NULL LIMIT 20');
    
    console.log(`Found ${result.rows.length} products with images:\n`);
    
    for (const row of result.rows) {
        const isLocal = row.image_url.startsWith('../');
        const isR2 = row.image_url.includes('r2.cloudflarestorage.com');
        const status = isR2 ? '✅ R2' : isLocal ? '⚠️  Local' : '❓ Other';
        
        console.log(`${status} | ${row.name}`);
        console.log(`     ${row.image_url}\n`);
    }
}

checkImageUrls().catch(console.error);

// Update database with fixed R2 URLs (no spaces)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

const MAPPING_FILE = path.join(__dirname, '../migrations/r2-fix-spaces-mapping.json');

async function updateUrls() {
    console.log('🔄 Updating database with fixed URLs...\n');
    
    const mappings = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8'));
    
    let updated = 0;
    
    for (const map of mappings) {
        await db.execute({
            sql: 'UPDATE products SET image_url = ? WHERE id = ?',
            args: [map.newUrl, map.id]
        });
        
        console.log(`✅ ${map.name}`);
        console.log(`   ${map.newUrl}\n`);
        updated++;
    }
    
    console.log(`\n✅ Updated ${updated} products!`);
}

updateUrls().catch(console.error);

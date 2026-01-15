// Update image URLs in database from local to R2
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Configuration
const MAPPING_FILE = path.join(__dirname, '../migrations/image-url-mapping.json');
const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

// Create Turso client
const db = createClient({
    url: TURSO_URL,
    authToken: TURSO_TOKEN
});

// Load mapping
function loadMapping() {
    if (!fs.existsSync(MAPPING_FILE)) {
        console.error('❌ Mapping file not found:', MAPPING_FILE);
        console.log('💡 Run: node scripts/migrate-images-to-r2.js first');
        process.exit(1);
    }
    
    const content = fs.readFileSync(MAPPING_FILE, 'utf8');
    return JSON.parse(content);
}

// Update product image URLs
async function updateProductUrls(mapping) {
    console.log('🔄 Updating product image URLs...\n');
    
    let updated = 0;
    let notFound = 0;
    
    for (const map of mapping) {
        try {
            // Find products with old URL (check both ./ and ../ patterns)
            const result = await db.execute({
                sql: 'SELECT id, name, image_url FROM products WHERE image_url LIKE ? OR image_url LIKE ?',
                args: [`%${map.relativePath}%`, `%${map.relativePath}%`]
            });
            
            if (result.rows.length > 0) {
                for (const row of result.rows) {
                    // Update to new URL
                    await db.execute({
                        sql: 'UPDATE products SET image_url = ? WHERE id = ?',
                        args: [map.newUrl, row.id]
                    });
                    
                    console.log(`✅ Updated: ${row.name}`);
                    console.log(`   Old: ${row.image_url}`);
                    console.log(`   New: ${map.newUrl}\n`);
                    updated++;
                }
            } else {
                notFound++;
            }
        } catch (error) {
            console.error(`❌ Error updating ${map.relativePath}:`, error.message);
        }
    }
    
    return { updated, notFound };
}

// Verify all product images
async function verifyProductImages() {
    console.log('🔍 Verifying product images...\n');
    
    const result = await db.execute('SELECT id, name, image_url FROM products WHERE image_url IS NOT NULL');
    
    let r2Count = 0;
    let localCount = 0;
    let nullCount = 0;
    
    for (const row of result.rows) {
        if (!row.image_url) {
            nullCount++;
        } else if (row.image_url.includes('r2.cloudflarestorage.com')) {
            r2Count++;
        } else {
            localCount++;
            console.log(`⚠️  Still local: ${row.name} - ${row.image_url}`);
        }
    }
    
    console.log('\n📊 Summary:');
    console.log(`   - R2 URLs: ${r2Count}`);
    console.log(`   - Local URLs: ${localCount}`);
    console.log(`   - Null: ${nullCount}`);
    console.log(`   - Total: ${result.rows.length}`);
    
    return { r2Count, localCount, nullCount };
}

// Main function
async function main() {
    console.log('🚀 Starting database URL update...\n');
    
    // Check environment variables
    if (!TURSO_URL || !TURSO_TOKEN) {
        console.error('❌ Missing environment variables:');
        console.error('   - TURSO_DATABASE_URL');
        console.error('   - TURSO_AUTH_TOKEN');
        process.exit(1);
    }
    
    // Load mapping
    const mapping = loadMapping();
    console.log(`📂 Loaded ${mapping.length} URL mappings\n`);
    
    // Update URLs
    const { updated, notFound } = await updateProductUrls(mapping);
    
    console.log('\n✅ Update complete!');
    console.log(`   - Updated: ${updated} products`);
    console.log(`   - Not found: ${notFound} mappings\n`);
    
    // Verify
    await verifyProductImages();
    
    console.log('\n🎉 Done!');
}

main().catch(console.error);

import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = join(__dirname, '..', '.env');
const envContent = readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length) {
        envVars[key.trim()] = valueParts.join('=').trim();
    }
});

const TURSO_DATABASE_URL = envVars.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = envVars.TURSO_AUTH_TOKEN;

if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
    console.error('❌ Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env file');
    process.exit(1);
}

const client = createClient({
    url: TURSO_DATABASE_URL,
    authToken: TURSO_AUTH_TOKEN,
});

async function checkDiscounts() {
    try {
        console.log('🔍 Checking discount IDs in database...\n');

        // Get all discount IDs
        const result = await client.execute(`
            SELECT id, code, title, expiry_date 
            FROM discounts 
            ORDER BY id DESC 
            LIMIT 30
        `);

        console.log('📊 All discount IDs in database:');
        console.log('─'.repeat(80));
        
        result.rows.forEach(row => {
            console.log(`ID: ${row.id.toString().padEnd(5)} | Code: ${row.code.padEnd(15)} | Title: ${row.title.substring(0, 30).padEnd(30)} | Expiry: ${row.expiry_date}`);
        });

        console.log('─'.repeat(80));
        console.log(`\nTotal discounts: ${result.rows.length}`);

        // Check specific IDs
        const testIds = [28, 16, 15, 14, 13, 12, 11, 10, 9];
        console.log(`\n🔎 Checking if these IDs exist: ${testIds.join(', ')}`);
        
        for (const id of testIds) {
            const checkResult = await client.execute(`
                SELECT id, code FROM discounts WHERE id = ?
            `, [id]);
            
            if (checkResult.rows.length > 0) {
                console.log(`  ✅ ID ${id} exists: ${checkResult.rows[0].code}`);
            } else {
                console.log(`  ❌ ID ${id} NOT FOUND`);
            }
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        client.close();
    }
}

checkDiscounts();

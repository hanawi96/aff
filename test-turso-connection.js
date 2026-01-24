// Test Turso Connection
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

// Load .env file
dotenv.config();

const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

console.log('🔍 Testing Turso Connection...\n');
console.log('Database URL:', TURSO_DATABASE_URL);
console.log('Auth Token:', TURSO_AUTH_TOKEN ? `${TURSO_AUTH_TOKEN.substring(0, 20)}...` : 'NOT FOUND');
console.log('');

if (!TURSO_AUTH_TOKEN) {
    console.error('❌ TURSO_AUTH_TOKEN not found in .env file!');
    process.exit(1);
}

try {
    const client = createClient({
        url: TURSO_DATABASE_URL,
        authToken: TURSO_AUTH_TOKEN,
    });

    console.log('📡 Connecting to Turso...');
    
    const result = await client.execute('SELECT COUNT(*) as count FROM products');
    
    console.log('✅ Connection successful!');
    console.log('📊 Products count:', result.rows[0].count);
    console.log('');
    console.log('🎉 Turso connection is working!');
    
} catch (error) {
    console.error('❌ Connection failed!');
    console.error('Error:', error.message);
    console.error('');
    console.error('💡 Possible solutions:');
    console.error('1. Check if TURSO_AUTH_TOKEN is correct');
    console.error('2. Generate new token: turso db tokens create vdt-yendev96');
    console.error('3. Update .env and .dev.vars files');
}

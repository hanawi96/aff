import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function checkSchema() {
    try {
        const result = await client.execute('PRAGMA table_info(ctv)');
        console.log('CTV Table Schema:');
        console.log(JSON.stringify(result.rows, null, 2));
        
        const hasCreatedAt = result.rows.some(row => row.name === 'created_at');
        const hasCreatedAtUnix = result.rows.some(row => row.name === 'created_at_unix');
        
        console.log('\nColumn Status:');
        console.log('  created_at:', hasCreatedAt ? '✅ EXISTS' : '❌ MISSING');
        console.log('  created_at_unix:', hasCreatedAtUnix ? '✅ EXISTS' : '❌ MISSING');
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        client.close();
    }
}

checkSchema();

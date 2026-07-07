// Verify backup_history table
import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
    intMode: 'number'
});

async function verify() {
    console.log('🔍 Verifying backup_history table...\n');
    
    try {
        // Check table exists
        const tables = await client.execute(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='backup_history'
        `);
        console.log('✅ Table exists:', tables.rows.length > 0);
        
        // Check indexes
        const indexes = await client.execute(`
            SELECT name FROM sqlite_master 
            WHERE type='index' AND tbl_name='backup_history'
        `);
        console.log(`✅ Indexes created: ${indexes.rows.length}`);
        indexes.rows.forEach(idx => console.log(`   - ${idx.name}`));
        
        // Count records
        const count = await client.execute(`
            SELECT COUNT(*) as count FROM backup_history
        `);
        console.log(`\n📊 Current records: ${count.rows[0].count}`);
        
        // Test insert
        console.log('\n🧪 Testing insert...');
        const now = Date.now();
        await client.execute({
            sql: `INSERT INTO backup_history 
                  (created_at, file_name, file_path, file_size, tables_count, rows_count, status, notes)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
                now,
                'test_backup.sql',
                'backups/test.sql',
                1024,
                24,
                1000,
                'completed',
                'Test migration record'
            ]
        });
        console.log('✅ Insert successful');
        
        // Query test record
        const testRecord = await client.execute({
            sql: `SELECT * FROM backup_history WHERE file_name = ?`,
            args: ['test_backup.sql']
        });
        console.log('✅ Query successful');
        console.log('\n📄 Test record:');
        console.log(testRecord.rows[0]);
        
        // Delete test record
        await client.execute({
            sql: `DELETE FROM backup_history WHERE file_name = ?`,
            args: ['test_backup.sql']
        });
        console.log('\n✅ Test cleanup successful');
        
        console.log('\n🎉 All verifications passed!');
        console.log('\n✅ READY TO DEPLOY!');
        console.log('   Run: npm run deploy');
        
    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        process.exit(1);
    }
}

verify().then(() => process.exit(0));

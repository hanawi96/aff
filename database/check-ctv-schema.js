// Check CTV table schema
import { createClient } from '@libsql/client';

async function checkSchema() {
    const client = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
    });

    try {
        console.log('🔍 Checking CTV table schema...\n');

        const result = await client.execute('PRAGMA table_info(ctv)');
        
        console.log('📋 CTV Table Columns:');
        console.log('─'.repeat(60));
        result.rows.forEach(col => {
            console.log(`${col.name.padEnd(25)} ${col.type.padEnd(15)} ${col.notnull ? 'NOT NULL' : ''} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
        });
        console.log('─'.repeat(60));
        console.log(`\nTotal columns: ${result.rows.length}`);

        // Check if custom_slug exists
        const hasCustomSlug = result.rows.some(col => col.name === 'custom_slug');
        const hasSlugUpdated = result.rows.some(col => col.name === 'slug_updated_at_unix');
        const hasSlugCount = result.rows.some(col => col.name === 'slug_change_count');

        console.log('\n✅ Migration Status:');
        console.log(`   custom_slug: ${hasCustomSlug ? '✓' : '✗'}`);
        console.log(`   slug_updated_at_unix: ${hasSlugUpdated ? '✓' : '✗'}`);
        console.log(`   slug_change_count: ${hasSlugCount ? '✓' : '✗'}`);

        if (hasCustomSlug && hasSlugUpdated && hasSlugCount) {
            console.log('\n🎉 Migration 053 completed successfully!');
        } else {
            console.log('\n⚠️  Migration incomplete. Missing columns.');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        client.close();
    }
}

checkSchema();

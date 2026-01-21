// Complete migration 053: Add remaining columns
import { createClient } from '@libsql/client';

async function completeMigration() {
    const client = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
    });

    try {
        console.log('🚀 Completing migration 053...\n');

        // Check current schema
        const currentSchema = await client.execute('PRAGMA table_info(ctv)');
        const columns = currentSchema.rows.map(col => col.name);
        
        console.log('Current columns:', columns.join(', '));
        console.log('');

        // Add custom_slug if not exists (without UNIQUE constraint)
        if (!columns.includes('custom_slug')) {
            console.log('Adding custom_slug column...');
            await client.execute('ALTER TABLE ctv ADD COLUMN custom_slug TEXT');
            console.log('✅ Added custom_slug');
        } else {
            console.log('✓ custom_slug already exists');
        }

        // Add slug_updated_at_unix if not exists
        if (!columns.includes('slug_updated_at_unix')) {
            console.log('Adding slug_updated_at_unix column...');
            await client.execute('ALTER TABLE ctv ADD COLUMN slug_updated_at_unix INTEGER');
            console.log('✅ Added slug_updated_at_unix');
        } else {
            console.log('✓ slug_updated_at_unix already exists');
        }

        // slug_change_count should already exist
        if (!columns.includes('slug_change_count')) {
            console.log('Adding slug_change_count column...');
            await client.execute('ALTER TABLE ctv ADD COLUMN slug_change_count INTEGER DEFAULT 0');
            console.log('✅ Added slug_change_count');
        } else {
            console.log('✓ slug_change_count already exists');
        }

        // Create unique index for custom_slug
        console.log('\nCreating unique index...');
        try {
            await client.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_ctv_custom_slug ON ctv(custom_slug)');
            console.log('✅ Created unique index idx_ctv_custom_slug');
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('✓ Unique index already exists');
            } else {
                throw error;
            }
        }

        // Verify final schema
        console.log('\n📋 Final schema verification:');
        const finalSchema = await client.execute('PRAGMA table_info(ctv)');
        const finalColumns = finalSchema.rows.map(col => col.name);
        
        const hasCustomSlug = finalColumns.includes('custom_slug');
        const hasSlugUpdated = finalColumns.includes('slug_updated_at_unix');
        const hasSlugCount = finalColumns.includes('slug_change_count');

        console.log(`   custom_slug: ${hasCustomSlug ? '✓' : '✗'}`);
        console.log(`   slug_updated_at_unix: ${hasSlugUpdated ? '✓' : '✗'}`);
        console.log(`   slug_change_count: ${hasSlugCount ? '✓' : '✗'}`);

        if (hasCustomSlug && hasSlugUpdated && hasSlugCount) {
            console.log('\n🎉 Migration 053 completed successfully!');
        } else {
            console.log('\n⚠️  Migration incomplete.');
        }

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.close();
    }
}

completeMigration();

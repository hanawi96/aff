/**
 * Cleanup Script for Address Learning Database
 * Removes old, unused keywords to keep database clean
 * 
 * Run: node scripts/clean-orphaned-keywords.js
 */

import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function cleanupOldKeywords() {
    console.log('🧹 Starting cleanup of old keywords...\n');

    try {
        // 1. Find keywords with low confidence and not used recently
        const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
        
        console.log('📊 Analyzing keywords...');
        
        const oldKeywords = await db.execute({
            sql: `
                SELECT keywords, district_id, ward_name, match_count, last_used_at
                FROM address_learning
                WHERE match_count = 1 AND last_used_at < ?
                ORDER BY last_used_at ASC
            `,
            args: [thirtyDaysAgo]
        });

        console.log(`Found ${oldKeywords.rows.length} old keywords (confidence=1, not used in 30 days)\n`);

        if (oldKeywords.rows.length === 0) {
            console.log('✅ No cleanup needed!');
            return;
        }

        // Show sample
        console.log('Sample keywords to delete:');
        oldKeywords.rows.slice(0, 5).forEach((row, i) => {
            const lastUsed = new Date(row.last_used_at * 1000).toLocaleDateString('vi-VN');
            console.log(`  ${i + 1}. "${row.keywords}" → ${row.ward_name} (last used: ${lastUsed})`);
        });

        if (oldKeywords.rows.length > 5) {
            console.log(`  ... and ${oldKeywords.rows.length - 5} more\n`);
        }

        // Ask for confirmation
        console.log(`\n⚠️  This will delete ${oldKeywords.rows.length} keywords.`);
        console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

        await new Promise(resolve => setTimeout(resolve, 5000));

        // Delete old keywords
        const result = await db.execute({
            sql: `
                DELETE FROM address_learning
                WHERE match_count = 1 AND last_used_at < ?
            `,
            args: [thirtyDaysAgo]
        });

        console.log(`✅ Deleted ${result.rowsAffected} old keywords\n`);

        // 2. Show statistics after cleanup
        const stats = await db.execute(`
            SELECT 
                COUNT(*) as total_mappings,
                COUNT(DISTINCT district_id) as districts_covered,
                SUM(match_count) as total_matches,
                MAX(match_count) as max_confidence,
                AVG(match_count) as avg_confidence
            FROM address_learning
        `);

        console.log('📊 Database statistics after cleanup:');
        console.log(`  Total mappings: ${stats.rows[0].total_mappings}`);
        console.log(`  Districts covered: ${stats.rows[0].districts_covered}`);
        console.log(`  Total matches: ${stats.rows[0].total_matches}`);
        console.log(`  Max confidence: ${stats.rows[0].max_confidence}`);
        console.log(`  Avg confidence: ${stats.rows[0].avg_confidence.toFixed(2)}`);

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        process.exit(1);
    }
}

// Run cleanup
cleanupOldKeywords()
    .then(() => {
        console.log('\n✅ Cleanup completed successfully!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Cleanup failed:', error);
        process.exit(1);
    });

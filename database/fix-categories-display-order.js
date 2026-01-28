// Fix display_order for all categories
// Run: node database/fix-categories-display-order.js

import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function fixDisplayOrder() {
    try {
        console.log('🔧 Fixing display_order for categories...\n');

        // Get all active categories ordered by name
        const { rows: categories } = await db.execute(`
            SELECT id, name, display_order
            FROM categories
            WHERE is_active = 1
            ORDER BY name ASC
        `);

        console.log(`📋 Found ${categories.length} active categories\n`);

        if (categories.length === 0) {
            console.log('❌ No categories found');
            return;
        }

        // Update display_order sequentially
        console.log('🔄 Updating display_order...\n');
        
        for (let i = 0; i < categories.length; i++) {
            const category = categories[i];
            const newOrder = i;
            
            console.log(`  ${i + 1}. ${category.name} (ID: ${category.id})`);
            console.log(`     Old order: ${category.display_order} → New order: ${newOrder}`);
            
            await db.execute({
                sql: `UPDATE categories SET display_order = ? WHERE id = ?`,
                args: [newOrder, category.id]
            });
        }

        console.log('\n✅ Display order fixed successfully!\n');

        // Verify
        console.log('🔍 Verifying...\n');
        const { rows: verifyCategories } = await db.execute(`
            SELECT id, name, display_order
            FROM categories
            WHERE is_active = 1
            ORDER BY display_order ASC, name ASC
        `);

        console.log('Final order:');
        verifyCategories.forEach((cat, i) => {
            console.log(`  ${i + 1}. [${cat.display_order}] ${cat.name} (ID: ${cat.id})`);
        });

        console.log('\n✅ Done!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        db.close();
    }
}

fixDisplayOrder();

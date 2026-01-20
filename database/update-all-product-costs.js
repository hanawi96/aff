#!/usr/bin/env node

/**
 * Update All Product Costs
 * Run this script after changing material prices to recalculate all product costs
 * 
 * Usage: node database/update-all-product-costs.js
 */

import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
    intMode: 'number',
});

async function updateAllProductCosts() {
    console.log('🔄 Updating all product costs based on current material prices...\n');

    try {
        // Get all products with materials
        const productsWithMaterials = await client.execute(`
            SELECT DISTINCT p.id, p.name, p.cost_price as old_cost
            FROM products p
            JOIN product_materials pm ON p.id = pm.product_id
            WHERE p.is_active = 1
        `);

        if (productsWithMaterials.rows.length === 0) {
            console.log('⚠️  No products with materials found.');
            return;
        }

        console.log(`📦 Found ${productsWithMaterials.rows.length} products with materials\n`);

        let updatedCount = 0;
        let totalOldCost = 0;
        let totalNewCost = 0;

        for (const product of productsWithMaterials.rows) {
            // Calculate new cost
            const costResult = await client.execute({
                sql: `
                    SELECT COALESCE(SUM(pm.quantity * cc.item_cost), 0) as new_cost
                    FROM product_materials pm
                    JOIN cost_config cc ON pm.material_name = cc.item_name
                    WHERE pm.product_id = ?
                `,
                args: [product.id]
            });

            const newCost = costResult.rows[0].new_cost;
            const oldCost = product.old_cost || 0;

            // Update product
            await client.execute({
                sql: `
                    UPDATE products 
                    SET cost_price = ?, updated_at_unix = strftime('%s', 'now')
                    WHERE id = ?
                `,
                args: [newCost, product.id]
            });

            const diff = newCost - oldCost;
            const diffPercent = oldCost > 0 ? ((diff / oldCost) * 100).toFixed(1) : 0;
            const diffSymbol = diff > 0 ? '📈' : diff < 0 ? '📉' : '➡️';

            console.log(`${diffSymbol} ${product.name}`);
            console.log(`   Old: ${oldCost.toLocaleString('vi-VN')}đ → New: ${newCost.toLocaleString('vi-VN')}đ (${diff > 0 ? '+' : ''}${diff.toLocaleString('vi-VN')}đ, ${diff > 0 ? '+' : ''}${diffPercent}%)\n`);

            updatedCount++;
            totalOldCost += oldCost;
            totalNewCost += newCost;
        }

        const totalDiff = totalNewCost - totalOldCost;
        const totalDiffPercent = totalOldCost > 0 ? ((totalDiff / totalOldCost) * 100).toFixed(1) : 0;

        console.log('─'.repeat(80));
        console.log('📊 Summary:');
        console.log(`   Products updated: ${updatedCount}`);
        console.log(`   Total old cost: ${totalOldCost.toLocaleString('vi-VN')}đ`);
        console.log(`   Total new cost: ${totalNewCost.toLocaleString('vi-VN')}đ`);
        console.log(`   Total difference: ${totalDiff > 0 ? '+' : ''}${totalDiff.toLocaleString('vi-VN')}đ (${totalDiff > 0 ? '+' : ''}${totalDiffPercent}%)`);
        console.log('─'.repeat(80));

        console.log('\n🎉 All product costs updated successfully!');

    } catch (error) {
        console.error('❌ Error updating costs:', error.message);
        throw error;
    }
}

// Run update
updateAllProductCosts()
    .then(() => {
        console.log('\n✅ Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    });

#!/usr/bin/env node

/**
 * Seed Sample Materials and Product Formulas
 * This script adds example materials and formulas for testing
 * 
 * Usage: node database/seed-sample-materials.js
 */

import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
    intMode: 'number',
});

async function seedSampleData() {
    console.log('🌱 Seeding sample materials and formulas...\n');

    try {
        // Get a few sample products
        const products = await client.execute(`
            SELECT id, name FROM products 
            WHERE is_active = 1 
            LIMIT 5
        `);

        if (products.rows.length === 0) {
            console.log('⚠️  No products found. Please add products first.');
            return;
        }

        console.log(`📦 Found ${products.rows.length} products to add formulas\n`);

        // Example formulas for different product types
        const sampleFormulas = [
            {
                // Vòng 7 bi bạc
                keywords: ['7 bi', '7bi', 'sole 7'],
                materials: [
                    { name: 'bi_bac_s999', quantity: 7, unit: 'viên' },
                    { name: 'day_tron', quantity: 0.5, unit: 'mét' },
                ]
            },
            {
                // Vòng 9 bi bạc
                keywords: ['9 bi', '9bi', 'sole 9'],
                materials: [
                    { name: 'bi_bac_s999', quantity: 9, unit: 'viên' },
                    { name: 'day_tron', quantity: 0.5, unit: 'mét' },
                ]
            },
            {
                // Vòng mix hổ phách
                keywords: ['hổ phách', 'ho phach', 'mix'],
                materials: [
                    { name: 'bi_bac_s999', quantity: 5, unit: 'viên' },
                    { name: 'ho_phach_vang', quantity: 2, unit: 'viên' },
                    { name: 'day_ngu_sac', quantity: 0.5, unit: 'mét' },
                ]
            },
            {
                // Vòng charm rồng
                keywords: ['charm rồng', 'charm rong', 'rồng'],
                materials: [
                    { name: 'bi_bac_s999', quantity: 7, unit: 'viên' },
                    { name: 'charm_rong', quantity: 1, unit: 'cái' },
                    { name: 'day_tron', quantity: 0.5, unit: 'mét' },
                ]
            },
            {
                // Vòng đá đỏ
                keywords: ['đá đỏ', 'da do'],
                materials: [
                    { name: 'da_do', quantity: 7, unit: 'viên' },
                    { name: 'day_tron', quantity: 0.5, unit: 'mét' },
                ]
            },
        ];

        let addedCount = 0;

        for (const product of products.rows) {
            const productName = product.name.toLowerCase();
            
            // Find matching formula
            let matchedFormula = null;
            for (const formula of sampleFormulas) {
                if (formula.keywords.some(keyword => productName.includes(keyword))) {
                    matchedFormula = formula;
                    break;
                }
            }

            if (matchedFormula) {
                console.log(`📝 Adding formula for: ${product.name}`);
                
                // Check if formula already exists
                const existing = await client.execute({
                    sql: 'SELECT COUNT(*) as count FROM product_materials WHERE product_id = ?',
                    args: [product.id]
                });

                if (existing.rows[0].count > 0) {
                    console.log(`   ⚠️  Formula already exists, skipping\n`);
                    continue;
                }

                // Add materials
                for (const material of matchedFormula.materials) {
                    await client.execute({
                        sql: `INSERT INTO product_materials (product_id, material_name, quantity, unit) 
                              VALUES (?, ?, ?, ?)`,
                        args: [product.id, material.name, material.quantity, material.unit]
                    });
                    console.log(`   ✅ Added: ${material.quantity} ${material.unit} ${material.name}`);
                }

                // Get updated cost_price
                const updated = await client.execute({
                    sql: 'SELECT cost_price FROM products WHERE id = ?',
                    args: [product.id]
                });

                console.log(`   💰 New cost_price: ${updated.rows[0].cost_price.toLocaleString('vi-VN')}đ\n`);
                addedCount++;
            } else {
                console.log(`⏭️  No matching formula for: ${product.name}\n`);
            }
        }

        console.log(`\n🎉 Seeding completed!`);
        console.log(`   - Added formulas for ${addedCount} products`);
        console.log(`   - Skipped ${products.rows.length - addedCount} products\n`);

        // Show summary
        const summary = await client.execute(`
            SELECT 
                p.name,
                p.cost_price,
                COUNT(pm.id) as material_count
            FROM products p
            LEFT JOIN product_materials pm ON p.id = pm.product_id
            WHERE pm.id IS NOT NULL
            GROUP BY p.id
            LIMIT 10
        `);

        if (summary.rows.length > 0) {
            console.log('📊 Products with formulas:');
            console.log('─'.repeat(80));
            for (const row of summary.rows) {
                console.log(`   ${row.name.padEnd(50)} | ${row.material_count} materials | ${row.cost_price.toLocaleString('vi-VN')}đ`);
            }
            console.log('─'.repeat(80));
        }

    } catch (error) {
        console.error('❌ Error seeding data:', error.message);
        throw error;
    }
}

// Run seeding
seedSampleData()
    .then(() => {
        console.log('\n✅ Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    });

// Script to check categories structure for silver badge implementation
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function checkCategories() {
    try {
        console.log('📊 Checking categories table schema...\n');
        
        // First, check table schema
        const schemaResult = await client.execute(`
            PRAGMA table_info(categories)
        `);
        
        console.log('📋 Categories table columns:');
        schemaResult.rows.forEach(col => {
            console.log(`   - ${col.name} (${col.type})`);
        });
        
        console.log('\n📊 Fetching all categories from database...\n');
        
        const result = await client.execute(`
            SELECT *
            FROM categories
            ORDER BY display_order, name
        `);
        
        console.log('✅ Found', result.rows.length, 'categories\n');
        console.log('='.repeat(80));
        
        // Display all categories
        console.log('\n📁 ALL CATEGORIES:');
        console.log('-'.repeat(80));
        result.rows.forEach(cat => {
            const active = cat.is_active === 1 ? '✅' : '❌';
            console.log(`${active} ID: ${cat.id.toString().padEnd(4)} | Name: ${cat.name.padEnd(40)} | Order: ${cat.display_order || 'N/A'}`);
        });
        
        // Find categories to EXCLUDE from silver badge
        console.log('\n\n🔍 SEARCHING FOR EXCLUSION CATEGORIES:');
        console.log('-'.repeat(80));
        
        const exclusionKeywords = ['sản phẩm bán kèm', 'vòng hổ phách', 'vòng mix bồ đề', 'hổ phách', 'bồ đề'];
        const excludedCategories = [];
        
        result.rows.forEach(cat => {
            const nameLower = cat.name.toLowerCase();
            
            for (const keyword of exclusionKeywords) {
                if (nameLower.includes(keyword)) {
                    excludedCategories.push(cat);
                    console.log(`❌ EXCLUDE: ID ${cat.id} - "${cat.name}" (matches: "${keyword}")`);
                    break;
                }
            }
        });
        
        console.log('\n\n✨ CATEGORIES THAT WILL SHOW "BẠC THẬT" BADGE:');
        console.log('-'.repeat(80));
        
        const includedCategories = result.rows.filter(cat => 
            !excludedCategories.find(exc => exc.id === cat.id)
        );
        
        includedCategories.forEach(cat => {
            console.log(`✅ INCLUDE: ID ${cat.id.toString().padEnd(4)} | "${cat.name}"`);
        });
        
        // Generate code snippet
        console.log('\n\n💻 CODE SNIPPET FOR IMPLEMENTATION:');
        console.log('='.repeat(80));
        console.log('\n// Category IDs to EXCLUDE from silver badge:');
        console.log('const EXCLUDE_SILVER_BADGE_CATEGORIES = [');
        excludedCategories.forEach(cat => {
            console.log(`    ${cat.id}, // ${cat.name}`);
        });
        console.log('];\n');
        
        console.log('// Check if product should show silver badge:');
        console.log('const shouldShowSilverBadge = (product) => {');
        console.log('    if (!product.categories || product.categories.length === 0) return true;');
        console.log('    return !product.categories.some(cat => ');
        console.log('        EXCLUDE_SILVER_BADGE_CATEGORIES.includes(cat.id || cat.category_id)');
        console.log('    );');
        console.log('};');
        
        console.log('\n' + '='.repeat(80));
        console.log('\n✅ Analysis complete!');
        console.log(`📊 Total categories: ${result.rows.length}`);
        console.log(`❌ Excluded: ${excludedCategories.length}`);
        console.log(`✅ Included: ${includedCategories.length}`);
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        client.close();
    }
}

checkCategories();

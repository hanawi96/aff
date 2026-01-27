// Get all categories from Turso database
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function getCategories() {
    try {
        console.log('🔍 Fetching categories from Turso...\n');
        
        const { rows } = await client.execute(`
            SELECT id, name, description, icon, color, display_order, is_active
            FROM categories 
            WHERE is_active = 1
            ORDER BY display_order ASC, name ASC
        `);
        
        console.log('📊 Categories found:', rows.length);
        console.log('\n' + '='.repeat(80));
        console.log('ID\tName');
        console.log('='.repeat(80));
        
        rows.forEach(cat => {
            console.log(`${cat.id}\t${cat.name}`);
        });
        
        console.log('='.repeat(80));
        
        // Find categories that should skip baby weight
        console.log('\n🎯 Categories that should SKIP baby weight selection:');
        console.log('='.repeat(80));
        
        const skipKeywords = ['người lớn', 'bi', 'charm', 'bán kèm', 'hạt dâu tằm'];
        const skipCategories = rows.filter(cat => {
            const name = cat.name.toLowerCase();
            return skipKeywords.some(keyword => name.includes(keyword.toLowerCase()));
        });
        
        if (skipCategories.length > 0) {
            skipCategories.forEach(cat => {
                console.log(`${cat.id}\t${cat.name}`);
            });
            
            console.log('\n📝 Copy this array to baby-weight-modal.js:');
            console.log('='.repeat(80));
            console.log('this.skipCategoryIds = [');
            skipCategories.forEach(cat => {
                console.log(`    ${cat.id},  // ${cat.name}`);
            });
            console.log('];');
        } else {
            console.log('No matching categories found.');
        }
        
        console.log('='.repeat(80));
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.close();
    }
}

getCategories();

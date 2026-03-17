// Migration 064: Add featured columns to products table
const { initTurso } = require('./turso-client.js');

async function runMigration() {
    console.log('🚀 Starting Migration 064: Add featured columns to products...');
    
    const db = initTurso({
        TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
        TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN
    });

    try {
        // Add featured columns to products table
        console.log('📝 Adding is_featured column...');
        await db.exec('ALTER TABLE products ADD COLUMN is_featured INTEGER DEFAULT 0');
        
        console.log('📝 Adding featured_order column...');
        await db.exec('ALTER TABLE products ADD COLUMN featured_order INTEGER DEFAULT NULL');
        
        console.log('📝 Adding featured_at_unix column...');
        await db.exec('ALTER TABLE products ADD COLUMN featured_at_unix INTEGER DEFAULT NULL');
        
        // Create index for better performance
        console.log('📝 Creating index for featured products...');
        await db.exec('CREATE INDEX idx_products_featured ON products(is_featured, featured_order) WHERE is_featured = 1');
        
        // Optional: Migrate data from featured_products table if it exists
        console.log('📝 Checking for existing featured_products data...');
        try {
            const { results: featuredData } = await db.prepare(`
                SELECT fp.product_id, fp.display_order, fp.created_at_unix
                FROM featured_products fp
                INNER JOIN products p ON fp.product_id = p.id
                ORDER BY fp.display_order ASC
            `).all();
            
            if (featuredData.length > 0) {
                console.log(`📝 Migrating ${featuredData.length} featured products...`);
                
                for (const item of featuredData) {
                    await db.prepare(`
                        UPDATE products 
                        SET is_featured = 1, 
                            featured_order = ?, 
                            featured_at_unix = ?
                        WHERE id = ?
                    `).bind(item.display_order, item.created_at_unix, item.product_id).run();
                }
                
                console.log('✅ Data migration completed');
            } else {
                console.log('ℹ️ No existing featured products data found');
            }
        } catch (error) {
            console.log('ℹ️ featured_products table does not exist, skipping data migration');
        }
        
        console.log('✅ Migration 064 completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration 064 failed:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    runMigration()
        .then(() => {
            console.log('🎉 Migration completed!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Migration failed:', error);
            process.exit(1);
        });
}

module.exports = { runMigration };
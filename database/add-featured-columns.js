// Migration: Add featured columns to products table
// Thêm các cột is_featured, featured_order, featured_at_unix vào bảng products

const Database = require('better-sqlite3');

const db = new Database('local.db');

try {
    console.log('🚀 Starting migration: Add featured columns to products table');
    
    // Check if columns already exist
    const tableInfo = db.prepare("PRAGMA table_info(products)").all();
    const columnNames = tableInfo.map(col => col.name);
    
    console.log('📋 Current columns:', columnNames);
    
    // Add is_featured column if not exists
    if (!columnNames.includes('is_featured')) {
        console.log('➕ Adding is_featured column...');
        db.exec(`ALTER TABLE products ADD COLUMN is_featured INTEGER DEFAULT 0`);
        console.log('✅ Added is_featured column');
    } else {
        console.log('⚠️ is_featured column already exists');
    }
    
    // Add featured_order column if not exists
    if (!columnNames.includes('featured_order')) {
        console.log('➕ Adding featured_order column...');
        db.exec(`ALTER TABLE products ADD COLUMN featured_order INTEGER DEFAULT NULL`);
        console.log('✅ Added featured_order column');
    } else {
        console.log('⚠️ featured_order column already exists');
    }
    
    // Add featured_at_unix column if not exists
    if (!columnNames.includes('featured_at_unix')) {
        console.log('➕ Adding featured_at_unix column...');
        db.exec(`ALTER TABLE products ADD COLUMN featured_at_unix INTEGER DEFAULT NULL`);
        console.log('✅ Added featured_at_unix column');
    } else {
        console.log('⚠️ featured_at_unix column already exists');
    }
    
    // Verify the changes
    const updatedTableInfo = db.prepare("PRAGMA table_info(products)").all();
    const updatedColumnNames = updatedTableInfo.map(col => col.name);
    
    console.log('📋 Updated columns:', updatedColumnNames);
    
    // Check if all required columns exist
    const requiredColumns = ['is_featured', 'featured_order', 'featured_at_unix'];
    const missingColumns = requiredColumns.filter(col => !updatedColumnNames.includes(col));
    
    if (missingColumns.length === 0) {
        console.log('🎉 Migration completed successfully!');
        console.log('✅ All featured columns are now available in products table');
    } else {
        console.error('❌ Migration incomplete. Missing columns:', missingColumns);
    }
    
} catch (error) {
    console.error('❌ Migration failed:', error);
} finally {
    db.close();
}
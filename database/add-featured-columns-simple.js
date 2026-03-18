// Simple script to add featured columns to products table
const fs = require('fs');
const path = require('path');

async function addFeaturedColumns() {
    console.log('🔧 Adding featured columns to products table...');
    
    try {
        // Read the SQL file
        const sqlFile = path.join(__dirname, 'add-featured-columns.sql');
        const sql = fs.readFileSync(sqlFile, 'utf8');
        
        console.log('📋 SQL to execute:');
        console.log(sql);
        
        // For now, just show what would be executed
        // In a real scenario, you would execute this against your database
        console.log('✅ SQL prepared. Please run this manually in your database:');
        console.log('1. Connect to your database');
        console.log('2. Execute the SQL above');
        console.log('3. Verify the columns were added');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

addFeaturedColumns();
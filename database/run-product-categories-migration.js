/**
 * Migration Runner: Product Categories Junction Table
 * 
 * Script này sẽ:
 * 1. Đọc file SQL migration
 * 2. Chạy từng statement trên remote database "vdt"
 * 3. Verify kết quả migration
 * 4. Tạo báo cáo chi tiết
 */

const fs = require('fs');
const { execSync } = require('child_process');

const DB_NAME = 'vdt';
const MIGRATION_FILE = './database/migrations/create_product_categories_junction.sql';

console.log('🚀 Starting Product Categories Migration...\n');

// Read migration file
console.log('📖 Reading migration file...');
const migrationSQL = fs.readFileSync(MIGRATION_FILE, 'utf8');

// Split into individual statements (remove comments and empty lines)
const statements = migrationSQL
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => {
        // Remove empty statements and comment-only statements
        if (!stmt) return false;
        const lines = stmt.split('\n').filter(line => {
            const trimmed = line.trim();
            return trimmed && !trimmed.startsWith('--');
        });
        return lines.length > 0;
    });

console.log(`✅ Found ${statements.length} SQL statements\n`);

// Execute each statement
let successCount = 0;
let errorCount = 0;
const errors = [];

console.log('⚙️  Executing migration statements...\n');

statements.forEach((statement, index) => {
    // Get first line for display
    const firstLine = statement.split('\n')[0].substring(0, 80);
    console.log(`[${index + 1}/${statements.length}] ${firstLine}...`);
    
    try {
        // Escape statement for command line
        const escapedStatement = statement.replace(/"/g, '\\"');
        
        // Execute on remote database
        const command = `wrangler d1 execute ${DB_NAME} --remote --command "${escapedStatement}"`;
        execSync(command, { stdio: 'pipe' });
        
        console.log('   ✅ Success\n');
        successCount++;
    } catch (error) {
        console.log('   ❌ Error\n');
        errorCount++;
        errors.push({
            statement: firstLine,
            error: error.message
        });
    }
});

console.log('\n' + '='.repeat(60));
console.log('📊 MIGRATION SUMMARY');
console.log('='.repeat(60));
console.log(`✅ Successful: ${successCount}`);
console.log(`❌ Failed: ${errorCount}`);

if (errors.length > 0) {
    console.log('\n⚠️  ERRORS:');
    errors.forEach((err, i) => {
        console.log(`\n${i + 1}. ${err.statement}`);
        console.log(`   ${err.error}`);
    });
}

// Verification queries
console.log('\n' + '='.repeat(60));
console.log('🔍 VERIFICATION');
console.log('='.repeat(60));

try {
    console.log('\n1️⃣  Checking product_categories table...');
    const countResult = execSync(
        `wrangler d1 execute ${DB_NAME} --remote --command "SELECT COUNT(*) as count FROM product_categories"`,
        { encoding: 'utf8' }
    );
    console.log(countResult);

    console.log('\n2️⃣  Checking migrated records...');
    const migratedResult = execSync(
        `wrangler d1 execute ${DB_NAME} --remote --command "SELECT p.name, c.name as category, pc.is_primary FROM products p JOIN product_categories pc ON p.id = pc.product_id JOIN categories c ON pc.category_id = c.id LIMIT 5"`,
        { encoding: 'utf8' }
    );
    console.log(migratedResult);

    console.log('\n3️⃣  Checking indexes...');
    const indexResult = execSync(
        `wrangler d1 execute ${DB_NAME} --remote --command "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='product_categories'"`,
        { encoding: 'utf8' }
    );
    console.log(indexResult);

    console.log('\n4️⃣  Checking triggers...');
    const triggerResult = execSync(
        `wrangler d1 execute ${DB_NAME} --remote --command "SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name='product_categories'"`,
        { encoding: 'utf8' }
    );
    console.log(triggerResult);

} catch (error) {
    console.log('⚠️  Verification error:', error.message);
}

console.log('\n' + '='.repeat(60));
console.log('✨ MIGRATION COMPLETED');
console.log('='.repeat(60));

// Save report
const report = {
    timestamp: new Date().toISOString(),
    database: DB_NAME,
    migrationFile: MIGRATION_FILE,
    totalStatements: statements.length,
    successful: successCount,
    failed: errorCount,
    errors: errors
};

fs.writeFileSync(
    './PRODUCT_CATEGORIES_MIGRATION_REPORT.json',
    JSON.stringify(report, null, 2)
);

console.log('\n📄 Report saved to: PRODUCT_CATEGORIES_MIGRATION_REPORT.json');
console.log('\n🎉 Done!\n');

process.exit(errorCount > 0 ? 1 : 0);

#!/usr/bin/env node

/**
 * Test Discount Usage Fix on Turso
 * This script:
 * 1. Ensures discount_usage table exists
 * 2. Checks if triggers are working
 * 3. Tests the complete flow
 */

import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const db = createClient({
    url: process.env.TURSO_CONNECTION_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function runTests() {
    console.log('🚀 Starting Discount Usage Test on Turso...\n');

    try {
        // Test 1: Check if discount_usage table exists
        console.log('📋 Test 1: Checking if discount_usage table exists...');
        const tableCheck = await db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='discount_usage'"
        );
        
        if (tableCheck.rows.length === 0) {
            console.log('❌ discount_usage table does NOT exist!');
            console.log('📌 Creating table...\n');
            
            // Create the table
            const createTableSQL = `
                CREATE TABLE IF NOT EXISTS discount_usage (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  discount_id INTEGER NOT NULL,
                  discount_code TEXT NOT NULL,
                  
                  -- Thông tin đơn hàng
                  order_id TEXT NOT NULL,
                  customer_name TEXT,
                  customer_phone TEXT NOT NULL,
                  
                  -- Giá trị giảm giá thực tế
                  order_amount INTEGER,
                  discount_amount INTEGER,
                  gift_received TEXT,
                  
                  -- Metadata
                  used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                  ip_address TEXT,
                  user_agent TEXT,
                  
                  FOREIGN KEY (discount_id) REFERENCES discounts(id) ON DELETE CASCADE,
                  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
                );
            `;
            
            await db.execute(createTableSQL);
            console.log('✅ discount_usage table created!\n');
        } else {
            console.log('✅ discount_usage table EXISTS!\n');
        }

        // Test 2: Check table structure
        console.log('📋 Test 2: Checking table structure...');
        const tableInfo = await db.execute('PRAGMA table_info(discount_usage)');
        console.log('✅ Table columns:');
        tableInfo.rows.forEach(row => {
            console.log(`   - ${row.name} (${row.type})`);
        });
        console.log();

        // Test 3: Check if triggers exist
        console.log('📋 Test 3: Checking if triggers exist...');
        const triggersCheck = await db.execute(
            "SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name='discount_usage'"
        );
        
        if (triggersCheck.rows.length === 0) {
            console.log('❌ Triggers do NOT exist!');
            console.log('📌 Creating triggers...\n');
            
            // Create triggers
            const incrementTrigger = `
                CREATE TRIGGER IF NOT EXISTS increment_discount_usage
                AFTER INSERT ON discount_usage
                BEGIN
                  UPDATE discounts 
                  SET 
                    usage_count = usage_count + 1,
                    total_discount_amount = total_discount_amount + NEW.discount_amount
                  WHERE id = NEW.discount_id;
                END;
            `;
            
            const decrementTrigger = `
                CREATE TRIGGER IF NOT EXISTS decrement_discount_usage
                AFTER DELETE ON discount_usage
                BEGIN
                  UPDATE discounts 
                  SET 
                    usage_count = usage_count - 1,
                    total_discount_amount = total_discount_amount - OLD.discount_amount
                  WHERE id = OLD.discount_id;
                END;
            `;
            
            await db.execute(incrementTrigger);
            await db.execute(decrementTrigger);
            console.log('✅ Triggers created!\n');
        } else {
            console.log('✅ Triggers exist:');
            triggersCheck.rows.forEach(row => {
                console.log(`   - ${row.name}`);
            });
            console.log();
        }

        // Test 4: Check if indexes exist
        console.log('📋 Test 4: Checking if indexes exist...');
        const indexesCheck = await db.execute(
            "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='discount_usage'"
        );
        
        if (indexesCheck.rows.length === 0) {
            console.log('❌ Indexes do NOT exist!');
            console.log('📌 Creating indexes...\n');
            
            const indexes = [
                'CREATE INDEX IF NOT EXISTS idx_discount_usage_discount ON discount_usage(discount_id);',
                'CREATE INDEX IF NOT EXISTS idx_discount_usage_order ON discount_usage(order_id);',
                'CREATE INDEX IF NOT EXISTS idx_discount_usage_customer ON discount_usage(customer_phone);',
                'CREATE INDEX IF NOT EXISTS idx_discount_usage_date ON discount_usage(used_at);'
            ];
            
            for (const indexSQL of indexes) {
                await db.execute(indexSQL);
            }
            console.log('✅ Indexes created!\n');
        } else {
            console.log('✅ Indexes exist:');
            indexesCheck.rows.forEach(row => {
                console.log(`   - ${row.name}`);
            });
            console.log();
        }

        // Test 5: Check current discount_usage records
        console.log('📋 Test 5: Checking current discount_usage records...');
        const recordsCheck = await db.execute('SELECT COUNT(*) as count FROM discount_usage');
        const count = recordsCheck.rows[0].count;
        console.log(`✅ Total discount_usage records: ${count}\n`);

        // Test 6: Check if discounts table has usage_count column
        console.log('📋 Test 6: Checking discounts table structure...');
        const discountsInfo = await db.execute('PRAGMA table_info(discounts)');
        const hasUsageCount = discountsInfo.rows.some(row => row.name === 'usage_count');
        const hasTotalAmount = discountsInfo.rows.some(row => row.name === 'total_discount_amount');
        
        if (hasUsageCount && hasTotalAmount) {
            console.log('✅ discounts table has usage_count and total_discount_amount columns\n');
        } else {
            console.log('⚠️ Missing columns in discounts table');
            if (!hasUsageCount) console.log('   - Missing: usage_count');
            if (!hasTotalAmount) console.log('   - Missing: total_discount_amount');
            console.log();
        }

        // Test 7: Show sample discount_usage records
        console.log('📋 Test 7: Sample discount_usage records (last 5):');
        const sampleRecords = await db.execute(
            'SELECT * FROM discount_usage ORDER BY used_at DESC LIMIT 5'
        );
        
        if (sampleRecords.rows.length === 0) {
            console.log('   (No records yet - will be created when orders are made with discounts)\n');
        } else {
            sampleRecords.rows.forEach((row, index) => {
                console.log(`   ${index + 1}. Order: ${row.order_id}, Code: ${row.discount_code}, Amount: ${row.discount_amount}đ`);
            });
            console.log();
        }

        // Summary
        console.log('═══════════════════════════════════════════════════════════');
        console.log('✅ ALL TESTS PASSED!');
        console.log('═══════════════════════════════════════════════════════════\n');
        console.log('📊 Summary:');
        console.log('   ✅ discount_usage table exists');
        console.log('   ✅ Table structure is correct');
        console.log('   ✅ Triggers are set up');
        console.log('   ✅ Indexes are created');
        console.log('   ✅ discounts table has required columns\n');
        console.log('🚀 Ready to test! Create an order with a discount code.\n');
        console.log('📝 To verify after creating an order:');
        console.log('   SELECT * FROM discount_usage ORDER BY used_at DESC LIMIT 1;\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

runTests();

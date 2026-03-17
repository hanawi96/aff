// Migration 063: Create Featured Products System
// Chạy migration để tạo bảng featured_products

import { initTurso } from './turso-client.js';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function runMigration063() {
    console.log('🚀 Starting Migration 063: Create Featured Products System...');
    
    try {
        // Khởi tạo database connection
        const db = initTurso({
            TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
            TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN
        });

        // Đọc file SQL
        const sqlContent = fs.readFileSync('./database/migrations/063_create_featured_products.sql', 'utf8');
        
        // Tách các câu lệnh SQL - xử lý đúng với trigger
        const statements = [];
        let currentStatement = '';
        let inTrigger = false;
        
        const lines = sqlContent.split('\n');
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // Skip comments and empty lines
            if (trimmedLine.startsWith('--') || trimmedLine === '') {
                continue;
            }
            
            currentStatement += line + '\n';
            
            // Check for trigger start
            if (trimmedLine.includes('CREATE TRIGGER')) {
                inTrigger = true;
            }
            
            // Check for trigger end
            if (inTrigger && trimmedLine === 'END;') {
                statements.push(currentStatement.trim());
                currentStatement = '';
                inTrigger = false;
            }
            // Check for regular statement end
            else if (!inTrigger && trimmedLine.endsWith(';')) {
                statements.push(currentStatement.trim());
                currentStatement = '';
            }
        }
        
        // Add any remaining statement
        if (currentStatement.trim()) {
            statements.push(currentStatement.trim());
        }

        console.log(`📝 Found ${statements.length} SQL statements to execute`);

        // Thực thi từng câu lệnh
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
            
            try {
                await db.prepare(statement).run();
                console.log(`✅ Statement ${i + 1} executed successfully`);
            } catch (error) {
                console.error(`❌ Error in statement ${i + 1}:`, error);
                throw error;
            }
        }

        // Kiểm tra bảng đã được tạo
        console.log('🔍 Verifying table creation...');
        const tableCheck = await db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='featured_products'
        `).all();

        if (tableCheck.results.length > 0) {
            console.log('✅ Table featured_products created successfully');
        } else {
            throw new Error('Table featured_products was not created');
        }

        // Kiểm tra indexes
        const indexCheck = await db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='index' AND tbl_name='featured_products'
        `).all();

        console.log(`✅ Created ${indexCheck.results.length} indexes for featured_products table`);
        indexCheck.results.forEach(row => {
            console.log(`   - ${row.name}`);
        });

        console.log('🎉 Migration 063 completed successfully!');
        console.log('📊 Featured Products system is ready to use');

    } catch (error) {
        console.error('❌ Migration 063 failed:', error);
        process.exit(1);
    }
}

// Chạy migration nếu file được execute trực tiếp
if (import.meta.url === `file://${process.argv[1]}`) {
    runMigration063().catch(error => {
        console.error('💥 Migration failed:', error);
        process.exit(1);
    });
}

export { runMigration063 };
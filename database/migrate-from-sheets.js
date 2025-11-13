/**
 * Script để migrate dữ liệu từ Google Sheets sang Cloudflare D1
 * 
 * Cách chạy:
 * 1. Cài đặt: npm install
 * 2. Cấu hình: Điền thông tin Google Sheets bên dưới
 * 3. Chạy: node database/migrate-from-sheets.js
 */

// ============================================
// CẤU HÌNH - ĐIỀN THÔNG TIN CỦA BẠN
// ============================================

const CONFIG = {
    // Google Apps Script URL
    GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec',
    
    // Cloudflare Worker URL (sau khi deploy)
    WORKER_URL: 'https://ctv-api.yendev96.workers.dev',
    
    // Tên database D1 (phải khớp với wrangler.toml)
    DATABASE_NAME: 'vdt'
};

// ============================================
// MAIN MIGRATION FUNCTION
// ============================================

async function migrateData() {
    console.log('🚀 Bắt đầu migrate dữ liệu từ Google Sheets sang D1...\n');

    try {
        // Bước 1: Lấy dữ liệu CTV từ Google Sheets
        console.log('📊 Bước 1: Lấy dữ liệu CTV từ Google Sheets...');
        const ctvData = await fetchCTVFromSheets();
        console.log(`✅ Đã lấy ${ctvData.length} CTV\n`);

        // Bước 2: Lấy dữ liệu đơn hàng từ Google Sheets
        console.log('📦 Bước 2: Lấy dữ liệu đơn hàng từ Google Sheets...');
        const orderData = await fetchOrdersFromSheets();
        console.log(`✅ Đã lấy ${orderData.length} đơn hàng\n`);

        // Bước 3: Import CTV vào D1
        console.log('💾 Bước 3: Import CTV vào D1...');
        await importCTVToD1(ctvData);
        console.log(`✅ Đã import ${ctvData.length} CTV\n`);

        // Bước 4: Import đơn hàng vào D1
        console.log('💾 Bước 4: Import đơn hàng vào D1...');
        await importOrdersToD1(orderData);
        console.log(`✅ Đã import ${orderData.length} đơn hàng\n`);

        console.log('🎉 HOÀN THÀNH! Dữ liệu đã được migrate thành công!');
        console.log('\n📊 Tổng kết:');
        console.log(`   - CTV: ${ctvData.length}`);
        console.log(`   - Đơn hàng: ${orderData.length}`);

    } catch (error) {
        console.error('❌ Lỗi khi migrate:', error);
        process.exit(1);
    }
}

// ============================================
// FETCH DATA FROM GOOGLE SHEETS
// ============================================

async function fetchCTVFromSheets() {
    try {
        const response = await fetch(`${CONFIG.GOOGLE_SCRIPT_URL}?action=getAllCTV&timestamp=${Date.now()}`);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to fetch CTV data');
        }

        return data.ctvList || [];
    } catch (error) {
        console.error('Error fetching CTV from Sheets:', error);
        throw error;
    }
}

async function fetchOrdersFromSheets() {
    try {
        const response = await fetch(`${CONFIG.GOOGLE_SCRIPT_URL}?action=getRecentOrders&limit=10000&timestamp=${Date.now()}`);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to fetch orders');
        }

        return data.orders || [];
    } catch (error) {
        console.error('Error fetching orders from Sheets:', error);
        throw error;
    }
}

// ============================================
// IMPORT TO D1 USING WRANGLER CLI
// ============================================

async function importCTVToD1(ctvList) {
    const { execSync } = require('child_process');
    const fs = require('fs');

    // Tạo file SQL để import
    let sql = '';
    
    for (const ctv of ctvList) {
        const fullName = escapeSql(ctv.fullName || '');
        const phone = escapeSql(ctv.phone || '');
        const email = escapeSql(ctv.email || '');
        const city = escapeSql(ctv.city || '');
        const age = escapeSql(ctv.age || '');
        const experience = escapeSql(ctv.experience || '');
        const motivation = escapeSql(ctv.motivation || '');
        const referralCode = escapeSql(ctv.referralCode || '');
        const status = escapeSql(ctv.status || 'Mới');
        const timestamp = ctv.timestamp || new Date().toISOString();

        sql += `INSERT OR IGNORE INTO ctv (full_name, phone, email, city, age, experience, motivation, referral_code, status, created_at) VALUES ('${fullName}', '${phone}', '${email}', '${city}', '${age}', '${experience}', '${motivation}', '${referralCode}', '${status}', '${timestamp}');\n`;
    }

    // Lưu vào file tạm
    fs.writeFileSync('database/temp-ctv-import.sql', sql);

    // Execute với wrangler
    try {
        execSync(`wrangler d1 execute ${CONFIG.DATABASE_NAME} --file=database/temp-ctv-import.sql`, {
            stdio: 'inherit'
        });
    } finally {
        // Xóa file tạm
        fs.unlinkSync('database/temp-ctv-import.sql');
    }
}

async function importOrdersToD1(orderList) {
    const { execSync } = require('child_process');
    const fs = require('fs');

    // Tạo file SQL để import
    let sql = '';
    
    for (const order of orderList) {
        const orderId = escapeSql(order.orderId || '');
        const orderDate = escapeSql(order.orderDate || '');
        const customerName = escapeSql(order.customerName || '');
        const customerPhone = escapeSql(order.customerPhone || '');
        const address = escapeSql(order.address || '');
        const products = escapeSql(order.products || '');
        const totalAmount = order.totalAmount || 0;
        const paymentMethod = escapeSql(order.paymentMethod || '');
        const status = escapeSql(order.status || '');
        const referralCode = escapeSql(order.referralCode || '');
        const commission = (totalAmount * 0.1);
        const ctvPhone = escapeSql(order.ctvPhone || '');

        sql += `INSERT OR IGNORE INTO orders (order_id, order_date, customer_name, customer_phone, address, products, total_amount, payment_method, status, referral_code, commission, ctv_phone) VALUES ('${orderId}', '${orderDate}', '${customerName}', '${customerPhone}', '${address}', '${products}', ${totalAmount}, '${paymentMethod}', '${status}', '${referralCode}', ${commission}, '${ctvPhone}');\n`;
    }

    // Lưu vào file tạm
    fs.writeFileSync('database/temp-orders-import.sql', sql);

    // Execute với wrangler
    try {
        execSync(`wrangler d1 execute ${CONFIG.DATABASE_NAME} --file=database/temp-orders-import.sql`, {
            stdio: 'inherit'
        });
    } finally {
        // Xóa file tạm
        fs.unlinkSync('database/temp-orders-import.sql');
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function escapeSql(str) {
    if (!str) return '';
    return str.toString().replace(/'/g, "''");
}

// ============================================
// RUN MIGRATION
// ============================================

migrateData();

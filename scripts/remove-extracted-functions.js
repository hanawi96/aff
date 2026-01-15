#!/usr/bin/env node
/**
 * Script để xóa các hàm đã tách khỏi orders.js
 * Đọc tất cả file trong orders/ và xóa các function tương ứng khỏi orders.js
 */

const fs = require('fs');
const path = require('path');

const ORDERS_DIR = path.join(__dirname, '../public/assets/js/orders');
const ORDERS_JS = path.join(__dirname, '../public/assets/js/orders.js');

/**
 * Trích xuất tên các function từ file
 */
function extractFunctionNames(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const functions = [];
    
    // Tìm function declarations: function functionName(...)
    const pattern1 = /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
    let match;
    while ((match = pattern1.exec(content)) !== null) {
        functions.push(match[1]);
    }
    
    // Tìm async function declarations: async function functionName(...)
    const pattern2 = /async\s+function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
    while ((match = pattern2.exec(content)) !== null) {
        functions.push(match[1]);
    }
    
    return [...new Set(functions)]; // Remove duplicates
}

/**
 * Tìm vị trí function trong orders.js
 */
function findFunctionInOrdersJs(content, funcName) {
    const patterns = [
        new RegExp(`function\\s+${funcName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\([^)]*\\)\\s*\\{`, 'g'),
        new RegExp(`async\\s+function\\s+${funcName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\([^)]*\\)\\s*\\{`, 'g'),
    ];
    
    for (const pattern of patterns) {
        const match = pattern.exec(content);
        if (match) {
            return match.index;
        }
    }
    
    return -1;
}

/**
 * Trích xuất toàn bộ body của function từ vị trí bắt đầu
 */
function extractFunctionBody(content, startPos) {
    let braceCount = 0;
    let inFunction = false;
    let endPos = startPos;
    
    for (let i = startPos; i < content.length; i++) {
        const char = content[i];
        
        if (char === '{') {
            braceCount++;
            inFunction = true;
        } else if (char === '}') {
            braceCount--;
            
            if (inFunction && braceCount === 0) {
                endPos = i + 1;
                break;
            }
        }
    }
    
    return { start: startPos, end: endPos };
}

/**
 * Xóa function khỏi orders.js
 */
function removeFunctionFromOrdersJs(content, funcName) {
    const startPos = findFunctionInOrdersJs(content, funcName);
    
    if (startPos === -1) {
        return { content, removed: false };
    }
    
    // Tìm comment phía trước function (nếu có)
    let commentStart = startPos;
    const linesBefore = content.substring(0, startPos).split('\n');
    
    // Kiểm tra các dòng comment phía trước
    for (let i = linesBefore.length - 1; i >= Math.max(0, linesBefore.length - 10); i--) {
        const line = linesBefore[i].trim();
        if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) {
            commentStart = linesBefore.slice(0, i).join('\n').length + 1;
        } else if (line === '') {
            continue;
        } else {
            break;
        }
    }
    
    // Tìm end của function
    const { end: endPos } = extractFunctionBody(content, startPos);
    
    // Xóa function và comment, giữ lại 1 dòng trống
    const newContent = content.substring(0, commentStart) + '\n' + content.substring(endPos);
    
    return { content: newContent, removed: true };
}

/**
 * Main function
 */
function main() {
    console.log('🔍 Đang quét các file đã tách...');
    
    // Đọc tất cả file trong orders/
    const extractedFunctions = [];
    const files = fs.readdirSync(ORDERS_DIR).filter(f => f.endsWith('.js') && f !== 'orders-main.js');
    
    for (const file of files) {
        const filePath = path.join(ORDERS_DIR, file);
        console.log(`  📄 Đọc ${file}...`);
        
        const functions = extractFunctionNames(filePath);
        extractedFunctions.push(...functions);
        console.log(`     Tìm thấy ${functions.length} functions`);
    }
    
    const uniqueFunctions = [...new Set(extractedFunctions)];
    console.log(`\n✅ Tổng cộng tìm thấy ${uniqueFunctions.length} functions đã tách`);
    console.log(`📝 Danh sách: ${uniqueFunctions.sort().join(', ')}\n`);
    
    // Đọc orders.js
    console.log('📖 Đọc orders.js...');
    let content = fs.readFileSync(ORDERS_JS, 'utf-8');
    const originalLength = content.length;
    
    // Xóa từng function
    let removedCount = 0;
    const notFound = [];
    
    for (const funcName of uniqueFunctions.sort()) {
        process.stdout.write(`  🗑️  Đang xóa ${funcName}... `);
        const result = removeFunctionFromOrdersJs(content, funcName);
        content = result.content;
        
        if (result.removed) {
            removedCount++;
            console.log('✅');
        } else {
            notFound.push(funcName);
            console.log('⚠️  Không tìm thấy');
        }
    }
    
    // Lưu file
    const newLength = content.length;
    const charsRemoved = originalLength - newLength;
    
    console.log(`\n📊 Kết quả:`);
    console.log(`  ✅ Đã xóa: ${removedCount} functions`);
    console.log(`  ⚠️  Không tìm thấy: ${notFound.length} functions`);
    console.log(`  📉 Giảm: ${charsRemoved.toLocaleString()} ký tự`);
    
    if (notFound.length > 0) {
        console.log(`\n⚠️  Các function không tìm thấy:`);
        notFound.forEach(func => console.log(`     - ${func}`));
    }
    
    // Backup và lưu
    const backupPath = ORDERS_JS + '.backup';
    console.log(`\n💾 Tạo backup tại ${path.basename(backupPath)}...`);
    fs.copyFileSync(ORDERS_JS, backupPath);
    
    console.log(`💾 Lưu orders.js mới...`);
    fs.writeFileSync(ORDERS_JS, content, 'utf-8');
    
    console.log('\n✅ Hoàn thành!');
    console.log(`📝 File gốc đã được backup tại: ${backupPath}`);
}

main();

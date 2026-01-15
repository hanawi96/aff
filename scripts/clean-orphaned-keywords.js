#!/usr/bin/env node
/**
 * Script để dọn sạch các từ khóa đơn lẻ (async, function) còn sót lại
 * và giảm dòng trống thừa
 */

const fs = require('fs');
const path = require('path');

const ORDERS_JS = path.join(__dirname, '../public/assets/js/orders.js');

function cleanOrphanedKeywords() {
    console.log('🧹 Cleaning orphaned keywords...');
    
    let content = fs.readFileSync(ORDERS_JS, 'utf-8');
    const originalLength = content.length;
    
    // Remove lines with only 'async' or 'function'
    const lines = content.split('\n');
    const cleanedLines = lines.filter(line => {
        const trimmed = line.trim();
        return trimmed !== 'async' && trimmed !== 'function';
    });
    
    content = cleanedLines.join('\n');
    
    // Reduce multiple empty lines to maximum 2
    content = content.replace(/\n{4,}/g, '\n\n\n');
    
    const newLength = content.length;
    const removed = originalLength - newLength;
    
    console.log(`📊 Results:`);
    console.log(`  ✅ Removed: ${removed} characters`);
    console.log(`  📉 Lines: ${lines.length} → ${cleanedLines.length}`);
    
    // Backup
    const backupPath = ORDERS_JS + '.backup2';
    fs.copyFileSync(ORDERS_JS, backupPath);
    console.log(`💾 Backup created: ${path.basename(backupPath)}`);
    
    // Save
    fs.writeFileSync(ORDERS_JS, content, 'utf-8');
    console.log('✅ File cleaned!');
}

cleanOrphanedKeywords();

/**
 * Script to find all Font Awesome icons in the project
 * Run: node find-fontawesome-icons.js
 */

const fs = require('fs');
const path = require('path');

// Patterns to search for
const patterns = [
    /class=["']([^"']*\b(?:fas|far|fab|fal|fad)\s+fa-[^"']+)["']/g,
    /<i\s+class=["']([^"']*\b(?:fas|far|fab|fal|fad)[^"']*)["'][^>]*>/g,
    /className=["']([^"']*\b(?:fas|far|fab|fal|fad)\s+fa-[^"']+)["']/g,
];

// Directories to search
const searchDirs = [
    'public/shop',
    'public/admin',
    'public/ctv',
];

// Files to exclude
const excludePatterns = [
    /node_modules/,
    /\.git/,
    /\.wrangler/,
    /test-.*\.html$/,
    /\.min\./,
];

const results = [];

function shouldExclude(filePath) {
    return excludePatterns.some(pattern => pattern.test(filePath));
}

function searchFile(filePath) {
    if (shouldExclude(filePath)) return;
    
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
            patterns.forEach(pattern => {
                const matches = line.matchAll(pattern);
                for (const match of matches) {
                    results.push({
                        file: filePath,
                        line: index + 1,
                        content: line.trim(),
                        icon: match[1] || match[0],
                    });
                }
            });
        });
    } catch (err) {
        // Skip files that can't be read
    }
}

function searchDirectory(dir) {
    if (!fs.existsSync(dir)) return;
    
    const items = fs.readdirSync(dir);
    
    items.forEach(item => {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            searchDirectory(fullPath);
        } else if (stat.isFile()) {
            const ext = path.extname(item).toLowerCase();
            if (['.html', '.js', '.jsx', '.ts', '.tsx', '.vue'].includes(ext)) {
                searchFile(fullPath);
            }
        }
    });
}

// Run search
console.log('🔍 Searching for Font Awesome icons...\n');

searchDirs.forEach(dir => {
    console.log(`Scanning: ${dir}`);
    searchDirectory(dir);
});

// Display results
console.log('\n' + '='.repeat(80));
console.log(`Found ${results.length} Font Awesome icon(s)\n`);

if (results.length === 0) {
    console.log('✅ No Font Awesome icons found! All icons have been replaced with SVG.');
} else {
    console.log('❌ Font Awesome icons still exist in the following locations:\n');
    
    // Group by file
    const byFile = {};
    results.forEach(result => {
        if (!byFile[result.file]) {
            byFile[result.file] = [];
        }
        byFile[result.file].push(result);
    });
    
    Object.keys(byFile).sort().forEach(file => {
        console.log(`\n📄 ${file}`);
        byFile[file].forEach(result => {
            console.log(`   Line ${result.line}: ${result.icon}`);
            console.log(`   ${result.content.substring(0, 100)}${result.content.length > 100 ? '...' : ''}`);
        });
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('\n💡 Summary by file:');
    Object.keys(byFile).sort().forEach(file => {
        console.log(`   ${file}: ${byFile[file].length} icon(s)`);
    });
}

console.log('\n' + '='.repeat(80));
console.log('\n✨ Search complete!\n');

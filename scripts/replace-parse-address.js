const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../public/assets/js/orders/orders-smart-paste.js');
const newFuncFile = path.resolve(__dirname, './parse-address-v2.js');

const content = fs.readFileSync(targetFile, 'utf8');
const newFunc = fs.readFileSync(newFuncFile, 'utf8');

const lines = content.split('\n');

// Find the async function parseAddress line
let funcLine = -1;
for (let i = 0; i < lines.length; i++) {
    if (/^\s*async\s+function\s+parseAddress\b/.test(lines[i])) {
        funcLine = i;
        break;
    }
}
if (funcLine === -1) { console.error('parseAddress not found!'); process.exit(1); }

// Walk back to include the JSDoc comment
let startIdx = funcLine;
for (let j = funcLine - 1; j >= Math.max(0, funcLine - 10); j--) {
    var t = lines[j].trim();
    if (t.startsWith('/**') || t.startsWith('*') || t.startsWith('*/') || t.startsWith('//')) {
        startIdx = j;
    } else if (t === '') {
        continue;
    } else {
        break;
    }
}

// Use brace counting from the function line to find its closing brace
let braceDepth = 0;
let endIdx = -1;
for (let i = funcLine; i < lines.length; i++) {
    for (const ch of lines[i]) {
        if (ch === '{') braceDepth++;
        if (ch === '}') braceDepth--;
    }
    if (braceDepth === 0 && i > funcLine) {
        endIdx = i + 1;
        break;
    }
}
if (endIdx === -1) { console.error('Could not find closing brace!'); process.exit(1); }

// Also remove any helper functions BEFORE parseAddress that are part of the old implementation
// (look back for standalone function declarations that are NOT inside another block)
// The old implementation may have global helper functions before the main function.
// Find the block of code between the previous non-parseAddress function and parseAddress.
// For safety, only go back to find comment blocks / blank lines.

console.log('Found old parseAddress: lines', startIdx + 1, '-', endIdx, '(' + (endIdx - startIdx) + ' lines)');

const before = lines.slice(0, startIdx).join('\n');
const after  = lines.slice(endIdx).join('\n');

const newContent = before + '\n' + newFunc + '\n' + after;
fs.writeFileSync(targetFile, newContent, 'utf8');

const newLines = newContent.split('\n').length;
console.log('Done! New file lines:', newLines);

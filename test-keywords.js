// Test keyword extraction algorithm

function normalizeText(text) {
    if (!text) return '';
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .trim();
}

function extractKeywords(streetAddress) {
    if (!streetAddress) return [];
    
    const cleaned = streetAddress
        .replace(/^(số|so|ngõ|ngo|hẻm|hem|đường|duong)\s*\d*/gi, '')
        .replace(/\d+/g, '')
        .trim();
    
    const normalized = normalizeText(cleaned);
    const words = normalized.split(/\s+/).filter(w => w.length >= 3);
    
    if (words.length === 0) return [];
    
    const keywords = new Set();
    
    // Strategy 1: Consecutive 2-word phrases
    for (let i = 0; i < words.length - 1; i++) {
        keywords.add(words[i] + ' ' + words[i + 1]);
    }
    
    // Strategy 2: Consecutive 3-word phrases
    for (let i = 0; i < words.length - 2; i++) {
        keywords.add(words[i] + ' ' + words[i + 1] + ' ' + words[i + 2]);
    }
    
    // Strategy 3: Non-consecutive 2-word combinations
    if (words.length >= 3 && words.length <= 6) {
        for (let i = 0; i < words.length - 1; i++) {
            for (let j = i + 2; j < words.length && j <= i + 3; j++) {
                if (j - i <= 3) {
                    keywords.add(words[i] + ' ' + words[j]);
                }
            }
        }
    }
    
    return Array.from(keywords);
}

// Test cases
console.log('Test 1: "ngõ 2 sau đình hậu dưỡng"');
console.log('Keywords:', extractKeywords('ngõ 2 sau đình hậu dưỡng'));
console.log('');

console.log('Test 2: "hậu dưỡng"');
console.log('Keywords:', extractKeywords('hậu dưỡng'));
console.log('');

console.log('Test 3: "thôn tân dương"');
console.log('Keywords:', extractKeywords('thôn tân dương'));
console.log('');

console.log('Test 4: "83/7 đường liên khu 4,5"');
console.log('Keywords:', extractKeywords('83/7 đường liên khu 4,5'));

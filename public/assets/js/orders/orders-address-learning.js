/**
 * Address Learning Module
 * Client-side functions for address learning feature
 */

// Get API URL from CONFIG
const API_BASE_URL = typeof CONFIG !== 'undefined' ? CONFIG.API_URL : 'https://ctv-api.yendev96.workers.dev';

/**
 * Normalize text (remove diacritics, lowercase)
 */
function normalizeTextForLearning(text) {
    if (!text) return '';
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .trim();
}

/**
 * Extract keywords from street address
 * OPTIMIZED: Only extract locality-related keywords (thôn, xóm, ấp...)
 * Returns 2-3 most important keywords
 */
function extractAddressKeywords(streetAddress) {
    if (!streetAddress) return [];
    
    const normalized = normalizeTextForLearning(streetAddress);
    
    // Step 1: Check for landmarks (sau, gần, đối diện, cạnh...)
    const landmarkPatterns = [
        // Pattern 1: "sau đình hậu dưỡng" → extract "hậu dưỡng"
        { pattern: /\b(sau|gan|doi dien|canh|truoc|ben)\s+(dinh|chua|cho|truong|benh vien|cong ty)\s+([a-z0-9\s]+?)(?=\s+(?:ngo|duong|pho|xa|phuong|huyen|quan|tinh|thanh pho|$))/i, nameIndex: 3 },
        // Pattern 2: "sau hậu dưỡng" → extract "hậu dưỡng"
        { pattern: /\b(sau|gan|doi dien|canh|truoc|ben)\s+([a-z0-9\s]+?)(?=\s+(?:ngo|duong|pho|xa|phuong|huyen|quan|tinh|thanh pho|$))/i, nameIndex: 2 }
    ];
    
    for (const { pattern, nameIndex } of landmarkPatterns) {
        const match = normalized.match(pattern);
        if (match && match[nameIndex]) {
            const landmarkName = match[nameIndex].trim();
            const words = landmarkName.split(/\s+/).filter(w => w.length >= 2);
            
            if (words.length > 0) {
                const keywords = [];
                
                // Full landmark name (max 3 words)
                if (words.length <= 3) {
                    keywords.push(words.join(' '));
                }
                
                // First 2 words
                if (words.length >= 2) {
                    keywords.push(words.slice(0, 2).join(' '));
                }
                
                // Last 2 words (most important for learning)
                if (words.length >= 2) {
                    keywords.push(words.slice(-2).join(' '));
                }
                
                // Single words (if >= 3 chars)
                for (const word of words) {
                    if (word.length >= 3) {
                        keywords.push(word);
                    }
                }
                
                console.log(`✓ Landmark keywords extracted from "${match[0]}": [${keywords.join(', ')}]`);
                return [...new Set(keywords)];
            }
        }
    }
    
    // Step 2: Find locality markers (thôn, xóm, ấp, khóm...)
    const localityMarkers = [
        'thon', 'xom', 'ap', 'khom', 'khu', 'to', 'cum', 'bon', 'lang'
    ];
    
    // Find first occurrence of locality marker
    let localityStart = -1;
    for (const marker of localityMarkers) {
        const regex = new RegExp(`\\b${marker}\\b`);
        const match = normalized.match(regex);
        if (match && (localityStart === -1 || match.index < localityStart)) {
            localityStart = match.index;
        }
    }
    
    // If no locality marker found → SKIP (don't save)
    if (localityStart === -1) {
        console.log('⚠️ No locality marker found, skipping learning');
        return [];
    }
    
    // Step 3: Extract locality portion
    const localityPortion = normalized.substring(localityStart);
    
    // Step 4: Split into words, keep numbers (for "xóm 4", "thôn 5")
    // Filter: length >= 1 (to keep single digit numbers like "4", "5")
    const words = localityPortion.split(/\s+/).filter(w => w.length >= 1);
    const limitedWords = words.slice(0, 5);
    
    if (limitedWords.length === 0) return [];
    
    // Step 5: Create only 2-3 MOST IMPORTANT keywords
    const keywords = [];
    
    // 5.1. Full phrase (if ≤ 4 words)
    if (limitedWords.length <= 4) {
        keywords.push(limitedWords.join(' '));
    }
    
    // 5.2. First 2 words (locality type + number/name)
    if (limitedWords.length >= 2) {
        keywords.push(limitedWords.slice(0, 2).join(' '));
    }
    
    // 5.3. Last 2 words (main locality name)
    if (limitedWords.length >= 2) {
        keywords.push(limitedWords.slice(-2).join(' '));
    }
    
    // 5.4. If has number, create version without number
    const hasNumber = limitedWords.some(w => /\d/.test(w));
    if (hasNumber && limitedWords.length >= 3) {
        const wordsNoNum = limitedWords.filter(w => !/^\d+$/.test(w));
        if (wordsNoNum.length >= 2) {
            keywords.push(wordsNoNum.slice(0, 3).join(' '));
        }
    }
    
    // Remove duplicates
    return [...new Set(keywords)];
}

/**
 * Search learning database for ward prediction
 */
async function searchAddressLearning(keywords, districtId) {
    if (!keywords || keywords.length === 0 || !districtId) {
        return { found: false };
    }
    
    try {
        const keywordsParam = keywords.join(',');
        const response = await fetch(
            `${API_BASE_URL}?action=searchAddressLearning&keywords=${encodeURIComponent(keywordsParam)}&district_id=${districtId}`
        );
        
        if (!response.ok) {
            console.error('Search learning API error:', response.status);
            return { found: false };
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Search learning error:', error);
        return { found: false };
    }
}

/**
 * Learn from new address (save to database)
 */
async function learnFromAddress(streetAddress, districtId, wardId, wardName) {
    if (!streetAddress || !districtId || !wardId || !wardName) {
        return { success: false };
    }
    
    try {
        const response = await fetch(API_BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'learnAddress',
                street_address: streetAddress,
                district_id: districtId,
                ward_id: wardId,
                ward_name: wardName
            })
        });
        
        if (!response.ok) {
            console.error('Learn address API error:', response.status);
            return { success: false };
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Learn address error:', error);
        return { success: false };
    }
}

/**
 * Get learning statistics (for debugging/monitoring)
 */
async function getAddressLearningStats() {
    try {
        const response = await fetch(`${API_BASE_URL}?action=getAddressLearningStats`);
        
        if (!response.ok) {
            return { success: false };
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Get stats error:', error);
        return { success: false };
    }
}

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
 * Enhanced: Creates all meaningful word combinations, not just consecutive
 */
function extractAddressKeywords(streetAddress) {
    if (!streetAddress) return [];
    
    // Remove numbers, common prefixes
    const cleaned = streetAddress
        .replace(/^(số|so|ngõ|ngo|hẻm|hem|đường|duong)\s*\d*/gi, '')
        .replace(/\d+/g, '')
        .trim();
    
    const normalized = normalizeTextForLearning(cleaned);
    const words = normalized.split(/\s+/).filter(w => w.length >= 3);
    
    if (words.length === 0) return [];
    
    const keywords = new Set();
    
    // Strategy 1: Consecutive 2-word phrases (most reliable)
    for (let i = 0; i < words.length - 1; i++) {
        keywords.add(words[i] + ' ' + words[i + 1]);
    }
    
    // Strategy 2: Consecutive 3-word phrases
    for (let i = 0; i < words.length - 2; i++) {
        keywords.add(words[i] + ' ' + words[i + 1] + ' ' + words[i + 2]);
    }
    
    // Strategy 3: Non-consecutive 2-word combinations (NEW!)
    // Example: "sau dinh hau duong" → also create "sau hau", "dinh duong"
    // But limit to avoid too many combinations
    if (words.length >= 3 && words.length <= 6) {
        for (let i = 0; i < words.length - 1; i++) {
            for (let j = i + 2; j < words.length && j <= i + 3; j++) {
                // Skip if distance > 2 (avoid unrelated words)
                if (j - i <= 3) {
                    keywords.add(words[i] + ' ' + words[j]);
                }
            }
        }
    }
    
    return Array.from(keywords);
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

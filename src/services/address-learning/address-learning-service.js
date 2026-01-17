/**
 * Address Learning Service
 * Learns from user's address input to improve auto-fill accuracy
 */

/**
 * Normalize text for keyword matching (remove diacritics, lowercase)
 */
function normalizeText(text) {
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
 * Returns array of meaningful keywords (2-4 word phrases)
 * Enhanced: Creates all meaningful word combinations, not just consecutive
 */
function extractKeywords(streetAddress) {
    if (!streetAddress) return [];
    
    // Remove numbers, common prefixes
    const cleaned = streetAddress
        .replace(/^(số|so|ngõ|ngo|hẻm|hem|đường|duong)\s*\d*/gi, '')
        .replace(/\d+/g, '')
        .trim();
    
    const normalized = normalizeText(cleaned);
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
 * Search for learned address mapping
 */
export async function searchLearning(env, keywords, districtId) {
    if (!keywords || keywords.length === 0 || !districtId) {
        return { found: false };
    }
    
    try {
        // Try each keyword, prefer longer phrases
        const sortedKeywords = keywords.sort((a, b) => b.length - a.length);
        
        for (const keyword of sortedKeywords) {
            const result = await env.DB.prepare(`
                SELECT ward_id, ward_name, match_count, last_used_at
                FROM address_learning
                WHERE keywords = ? AND district_id = ?
                ORDER BY match_count DESC, last_used_at DESC
                LIMIT 1
            `).bind(keyword, districtId).first();
            
            if (result) {
                return {
                    found: true,
                    ward_id: result.ward_id,
                    ward_name: result.ward_name,
                    confidence: result.match_count,
                    last_used: result.last_used_at
                };
            }
        }
        
        return { found: false };
    } catch (error) {
        console.error('Search learning error:', error);
        return { found: false, error: error.message };
    }
}

/**
 * Learn from new address input
 */
export async function learnAddress(env, streetAddress, districtId, wardId, wardName) {
    if (!streetAddress || !districtId || !wardId || !wardName) {
        return { success: false, error: 'Missing required fields' };
    }
    
    try {
        const keywords = extractKeywords(streetAddress);
        
        if (keywords.length === 0) {
            return { success: false, error: 'No keywords extracted' };
        }
        
        const now = Math.floor(Date.now() / 1000);
        const results = [];
        
        // Save each keyword mapping
        for (const keyword of keywords) {
            const result = await env.DB.prepare(`
                INSERT INTO address_learning (keywords, district_id, ward_id, ward_name, match_count, last_used_at, created_at)
                VALUES (?, ?, ?, ?, 1, ?, ?)
                ON CONFLICT(keywords, district_id) DO UPDATE SET
                    match_count = match_count + 1,
                    last_used_at = ?,
                    ward_id = ?,
                    ward_name = ?
            `).bind(keyword, districtId, wardId, wardName, now, now, now, wardId, wardName).run();
            
            results.push({ keyword, success: result.success });
        }
        
        return {
            success: true,
            keywords_saved: keywords.length,
            results
        };
    } catch (error) {
        console.error('Learn address error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get learning statistics
 */
export async function getLearningStats(env) {
    try {
        const stats = await env.DB.prepare(`
            SELECT 
                COUNT(*) as total_mappings,
                COUNT(DISTINCT district_id) as districts_covered,
                SUM(match_count) as total_matches,
                MAX(match_count) as max_confidence
            FROM address_learning
        `).first();
        
        return {
            success: true,
            stats
        };
    } catch (error) {
        console.error('Get stats error:', error);
        return { success: false, error: error.message };
    }
}

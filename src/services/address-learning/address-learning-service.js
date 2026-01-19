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
 * OPTIMIZED: Extract locality-related keywords, or fallback to any meaningful words
 * Returns 2-3 most important keywords
 */
function extractKeywords(streetAddress) {
    if (!streetAddress) return [];
    
    const normalized = normalizeText(streetAddress);
    
    // Step 1: Try to find locality markers (thôn, xóm, ấp, khóm...)
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
    
    let words = [];
    
    // If locality marker found, extract from there
    if (localityStart !== -1) {
        const localityPortion = normalized.substring(localityStart);
        words = localityPortion.split(/\s+/).filter(w => w.length >= 1);
    } else {
        // Fallback: Extract meaningful words from entire address
        // Split and filter out common words and short words
        const commonWords = ['va', 'o', 'tai', 'tren', 'duoi', 'ben', 'canh', 'gan', 'sau', 'truoc', 'doi', 'dien'];
        words = normalized
            .split(/\s+/)
            .filter(w => w.length >= 2 && !commonWords.includes(w));
    }
    
    const limitedWords = words.slice(0, 5);
    
    if (limitedWords.length === 0) return [];
    
    // Step 2: Create keywords
    const keywords = [];
    
    // 2.1. Full phrase (if ≤ 4 words)
    if (limitedWords.length <= 4) {
        keywords.push(limitedWords.join(' '));
    }
    
    // 2.2. First 2 words
    if (limitedWords.length >= 2) {
        keywords.push(limitedWords.slice(0, 2).join(' '));
    }
    
    // 2.3. Last 2 words (most important)
    if (limitedWords.length >= 2) {
        keywords.push(limitedWords.slice(-2).join(' '));
    }
    
    // 2.4. If has number, create version without number
    const hasNumber = limitedWords.some(w => /\d/.test(w));
    if (hasNumber && limitedWords.length >= 3) {
        const wordsNoNum = limitedWords.filter(w => !/^\d+$/.test(w));
        if (wordsNoNum.length >= 2) {
            keywords.push(wordsNoNum.slice(0, 3).join(' '));
        }
    }
    
    // Remove duplicates and empty strings
    return [...new Set(keywords)].filter(k => k.trim().length > 0);
}

/**
 * Calculate Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = [];

    for (let i = 0; i <= len1; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }

    return matrix[len1][len2];
}

/**
 * Calculate similarity score (0-1)
 */
function calculateSimilarity(str1, str2) {
    const distance = levenshteinDistance(str1, str2);
    const maxLen = Math.max(str1.length, str2.length);
    return 1 - (distance / maxLen);
}

/**
 * Search for learned address mapping - TIER 1: Exact Match
 */
export async function searchLearning(env, keywords, districtId) {
    if (!keywords || keywords.length === 0 || !districtId) {
        return { found: false };
    }
    
    try {
        // Sort by length (longest first)
        const sortedKeywords = keywords.sort((a, b) => b.length - a.length);
        
        // TIER 1: Exact Match
        for (const keyword of sortedKeywords) {
            const result = await env.DB.prepare(`
                SELECT ward_id, ward_name, match_count, last_used_at
                FROM address_learning
                WHERE keywords = ? AND district_id = ?
                ORDER BY match_count DESC, last_used_at DESC
                LIMIT 1
            `).bind(keyword, districtId).first();
            
            if (result) {
                console.log(`✅ TIER 1 - Exact match: "${keyword}" → ${result.ward_name}`);
                return {
                    found: true,
                    ward_id: result.ward_id,
                    ward_name: result.ward_name,
                    confidence: result.match_count,
                    last_used: result.last_used_at,
                    match_type: 'exact',
                    matched_keyword: keyword
                };
            }
        }
        
        // TIER 2: Partial Match
        console.log('⚠️ TIER 1 failed, trying TIER 2 - Partial match...');
        return await searchLearningPartial(env, keywords, districtId);
        
    } catch (error) {
        console.error('Search learning error:', error);
        return { found: false, error: error.message };
    }
}

/**
 * TIER 2: Partial Match - Find keywords containing input words
 */
async function searchLearningPartial(env, keywords, districtId) {
    try {
        // Get all keywords in this district (will be reused in TIER 3)
        const allKeywords = await env.DB.prepare(`
            SELECT keywords, ward_id, ward_name, match_count
            FROM address_learning
            WHERE district_id = ?
            ORDER BY match_count DESC
        `).bind(districtId).all();
        
        if (!allKeywords.results || allKeywords.results.length === 0) {
            console.log('⚠️ TIER 2 failed - No keywords in district, trying TIER 3...');
            // Pass empty array to TIER 3 to avoid re-query
            return await searchLearningFuzzy(env, keywords, districtId, []);
        }
        
        let bestMatch = null;
        let bestScore = 0;
        
        for (const inputKeyword of keywords) {
            const inputWords = inputKeyword.split(' ');
            
            for (const dbRow of allKeywords.results) {
                const dbKeyword = dbRow.keywords;
                const dbWords = dbKeyword.split(' ');
                
                // Count matching words
                let matchCount = 0;
                for (const inputWord of inputWords) {
                    if (dbWords.includes(inputWord)) {
                        matchCount++;
                    }
                }
                
                // Calculate score
                const score = matchCount / Math.max(inputWords.length, dbWords.length);
                
                // Bonus from usage history (max +0.2)
                const historyBonus = Math.min(dbRow.match_count * 0.05, 0.2);
                const finalScore = score + historyBonus;
                
                if (finalScore > bestScore && finalScore >= 0.5) {
                    bestScore = finalScore;
                    bestMatch = dbRow;
                }
            }
        }
        
        if (bestMatch) {
            console.log(`✅ TIER 2 - Partial match: score=${bestScore.toFixed(2)} → ${bestMatch.ward_name}`);
            return {
                found: true,
                ward_id: bestMatch.ward_id,
                ward_name: bestMatch.ward_name,
                confidence: bestMatch.match_count,
                match_type: 'partial',
                score: bestScore
            };
        }
        
        // TIER 3: Fuzzy Match - Pass cached data to avoid re-query
        console.log('⚠️ TIER 2 failed, trying TIER 3 - Fuzzy match...');
        return await searchLearningFuzzy(env, keywords, districtId, allKeywords.results);
        
    } catch (error) {
        console.error('Partial match error:', error);
        return { found: false, error: error.message };
    }
}

/**
 * TIER 3: Fuzzy Match - Handle typos using Levenshtein distance
 * @param {Array} cachedKeywords - Optional cached keywords from TIER 2 to avoid re-query
 */
async function searchLearningFuzzy(env, keywords, districtId, cachedKeywords = null) {
    try {
        // Use cached data if available, otherwise query
        let allKeywords = cachedKeywords;
        
        if (!allKeywords || allKeywords.length === 0) {
            const result = await env.DB.prepare(`
                SELECT keywords, ward_id, ward_name, match_count
                FROM address_learning
                WHERE district_id = ?
            `).bind(districtId).all();
            
            allKeywords = result.results || [];
        }
        
        if (allKeywords.length === 0) {
            console.log('❌ TIER 3 failed - No keywords in district');
            return { found: false };
        }
        
        let bestMatch = null;
        let bestScore = 0;
        
        for (const inputKeyword of keywords) {
            for (const dbRow of allKeywords) {
                const dbKeyword = dbRow.keywords;
                
                // Calculate similarity (0-1)
                const similarity = calculateSimilarity(inputKeyword, dbKeyword);
                
                if (similarity > bestScore && similarity >= 0.75) {
                    bestScore = similarity;
                    bestMatch = dbRow;
                }
            }
        }
        
        if (bestMatch) {
            console.log(`✅ TIER 3 - Fuzzy match: similarity=${bestScore.toFixed(2)} → ${bestMatch.ward_name}`);
            return {
                found: true,
                ward_id: bestMatch.ward_id,
                ward_name: bestMatch.ward_name,
                confidence: bestMatch.match_count,
                match_type: 'fuzzy',
                similarity: bestScore
            };
        }
        
        console.log('❌ All tiers failed - No match found');
        return { found: false };
        
    } catch (error) {
        console.error('Fuzzy match error:', error);
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

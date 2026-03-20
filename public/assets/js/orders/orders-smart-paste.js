// Smart Paste - Auto-parse customer information
// Intelligently extracts name, phone, and address from pasted text

// ============================================
// OPTIMIZATION FLAGS (Feature Toggles)
// ============================================
// Control optimization features independently
// Set to false to disable, true to enable
const OPTIMIZATION_FLAGS = {
    NGRAM_LIMIT: true,              // Limit n-gram generation (Priority 1)
    FUZZY_EARLY_EXIT: true,         // Skip weak candidates in fuzzy match (Priority 2)
    LEVENSHTEIN_LENGTH_CHECK: true, // Skip Levenshtein for very different lengths (Priority 2)
    LEARNING_EXPANDED: true,        // Expand keyword extraction for learning DB (Priority 5)
    PROVINCE_FIRST_VALIDATION: true,// Validate district/ward within found province (Priority 3)
    LANDMARK_EXTRACTION: true       // Extract landmarks before parsing (Priority 2)
};

// Metrics tracking
const OPTIMIZATION_METRICS = {
    ngramReduction: 0,
    fuzzySkipped: 0,
    levenshteinSkipped: 0,
    rollbackCount: 0,
    provinceValidationUsed: 0,
    landmarkExtracted: 0
};

/**
 * Generate n-grams from word array
 * Used for parsing addresses without commas
 */
function generateNGrams(words, minN, maxN) {
    const ngrams = [];
    
    for (let n = maxN; n >= minN; n--) { // Start with longer phrases
        for (let i = 0; i <= words.length - n; i++) {
            const ngram = words.slice(i, i + n).join(' ');
            ngrams.push(ngram);
        }
    }
    
    return ngrams;
}

/**
 * Get Vietnam address data from addressSelector
 */
function getVietnamAddressData() {
    if (window.addressSelector && window.addressSelector.data && window.addressSelector.data.length > 0) {
        return window.addressSelector.data;
    }
    
    // Fallback: Try to get from provinceMap
    if (window.addressSelector && window.addressSelector.provinceMap && window.addressSelector.provinceMap.size > 0) {
        return Array.from(window.addressSelector.provinceMap.values());
    }
    
    console.warn('⚠️ Address data not available from addressSelector');
    return [];
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching with typos
 */
function levenshteinDistance(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = [];

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,      // deletion
                matrix[i][j - 1] + 1,      // insertion
                matrix[i - 1][j - 1] + cost // substitution
            );
        }
    }

    return matrix[len1][len2];
}

/**
 * Calculate similarity score based on edit distance
 * IMPROVED: More lenient for Vietnamese names with common typos
 */
function similarityScore(str1, str2) {
    const distance = levenshteinDistance(str1, str2);
    const maxLen = Math.max(str1.length, str2.length);
    const baseSimilarity = 1 - (distance / maxLen);
    
    // IMPROVED: Bonus for common Vietnamese typo patterns
    // Example: "thuy" vs "thụy" → "thuy" vs "thuy" (after removing tones)
    // But user might type "thuy" when they mean "thụy"
    const normalized1 = removeVietnameseTones(str1);
    const normalized2 = removeVietnameseTones(str2);
    
    // Check for common substitutions
    const commonSubstitutions = [
        { pattern: /uy/g, replacement: 'u' },  // "thuy" → "thu" to match "thụy" → "thu"
        { pattern: /y$/g, replacement: '' },   // "y" at end
        { pattern: /c$/g, replacement: 'k' },  // "bính" → "binh" (c/k confusion)
    ];
    
    let bestScore = baseSimilarity;
    
    // Try substitutions on both strings
    for (const sub of commonSubstitutions) {
        const test1 = normalized1.replace(sub.pattern, sub.replacement);
        const test2 = normalized2.replace(sub.pattern, sub.replacement);
        
        if (test1 === test2) {
            // Perfect match after substitution - give high bonus
            bestScore = Math.max(bestScore, 0.95);
        } else {
            // Partial improvement
            const testDistance = levenshteinDistance(test1, test2);
            const testSimilarity = 1 - (testDistance / Math.max(test1.length, test2.length));
            bestScore = Math.max(bestScore, testSimilarity);
        }
    }
    
    return bestScore;
}

/**
 * Remove Vietnamese tones for fuzzy matching
 */
function removeVietnameseTones(str) {
    if (!str) return '';
    return str
        .toLowerCase()        // LOWERCASE FIRST!
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')   // This won't match anymore but keep for safety
        .trim();
}

/**
 * Fuzzy match string with list of options
 * Improved for Vietnamese location names with priority keyword matching
 */
function fuzzyMatch(input, options, threshold = 0.6) {
    const normalizedInput = removeVietnameseTones(input);
    
    // Remove common prefixes for better matching
    const cleanInput = normalizedInput
        .replace(/^(tinh|thanh pho|tp|quan|huyen|phuong|xa|thi tran|tt|thi xa|tx)\s+/i, '')
        .toLowerCase()
        .trim();
    
    let bestMatch = null;
    let bestScore = 0;
    let matchType = '';
    
    // ============================================
    // OPTIMIZATION: Track skipped candidates
    // ============================================
    let skippedCount = 0;
    
    for (const option of options) {
        // ============================================
        // OPTIMIZATION: Early skip for weak candidates
        // ============================================
        if (OPTIMIZATION_FLAGS.FUZZY_EARLY_EXIT && bestScore >= 0.95) {
            // Quick length check (if length diff > 5, unlikely to match)
            const lengthDiff = Math.abs(input.length - option.Name.length);
            if (lengthDiff > 5) {
                skippedCount++;
                continue; // Skip this option
            }
        }
        
        const normalizedOption = removeVietnameseTones(option.Name);
        const cleanOption = normalizedOption
            .replace(/^(tinh|thanh pho|tp|quan|huyen|phuong|xa|thi tran|tt|thi xa|tx)\s+/i, '')
            .toLowerCase()
            .trim();
        
        let score = 0;
        let type = '';
        
        // 1. Exact match (highest priority)
        if (normalizedOption === normalizedInput || cleanOption === cleanInput) {
            // console.log(`      [EXACT] ${option.Name}: 1.00`);
            return { match: option, score: 1.0, confidence: 'high' };
        }
        
        // 2. Contains match - BOTH DIRECTIONS with priority
        // Check if input contains option (user typed more than needed)
        if (normalizedInput.includes(cleanOption) && cleanOption.length >= 4) {
            score = 0.9;
            type = 'input-contains-option';
            // console.log(`      [CONTAINS-1] ${option.Name}: ${score.toFixed(2)} (${type})`);
        }
        // Check if option contains input (user typed less)
        else if (cleanOption.includes(cleanInput) && cleanInput.length >= 4) {
            score = 0.85;
            type = 'option-contains-input';
            
            // IMPORTANT: Check word order for partial matches
            // Example: "Tân Vĩnh" should match "Tân Vĩnh Hiệp" (0.85) better than "Vĩnh Tân" (0.85 → 0.80)
            const inputWords = cleanInput.split(/\s+/).filter(w => w.length > 0);
            const optionWords = cleanOption.split(/\s+/).filter(w => w.length > 0);
            
            if (inputWords.length >= 2) {
                // Check if input words appear in same order in option
                let lastIndex = -1;
                let isSequential = true;
                
                for (const iw of inputWords) {
                    let found = false;
                    for (let j = lastIndex + 1; j < optionWords.length; j++) {
                        if (optionWords[j] === iw || optionWords[j].includes(iw) || iw.includes(optionWords[j])) {
                            lastIndex = j;
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        isSequential = false;
                        break;
                    }
                }
                
                // If words are NOT in sequential order, reduce score
                if (!isSequential) {
                    score = 0.80; // Penalty for reversed/mixed order
                    type = 'option-contains-input-reversed';
                }
            }
            // console.log(`      [CONTAINS-2] ${option.Name}: ${score.toFixed(2)} (${type})`);
        }
        // Full normalized contains
        else if (normalizedOption.includes(normalizedInput) || normalizedInput.includes(normalizedOption)) {
            score = 0.8;
            type = 'contains-full';
            // console.log(`      [CONTAINS-3] ${option.Name}: ${score.toFixed(2)} (${type})`);
        }
        
        // 3. Word-by-word matching with ALL words must match
        if (score === 0) {
            const inputWords = cleanInput.split(/\s+/).filter(w => w.length > 0);
            const optionWords = cleanOption.split(/\s+/).filter(w => w.length > 0);
            
            let matchCount = 0;
            const matchedIndices = []; // Track which option word indices matched
            
            for (const iw of inputWords) {
                for (let j = 0; j < optionWords.length; j++) {
                    const ow = optionWords[j];
                    if (iw === ow || ow.includes(iw) || iw.includes(ow)) {
                        matchCount++;
                        matchedIndices.push(j);
                        break;
                    }
                }
            }
            
            if (matchCount > 0) {
                // Higher score if ALL input words matched
                if (matchCount === inputWords.length) {
                    // Check if words are in same order (sequential indices)
                    let isSequential = true;
                    for (let i = 1; i < matchedIndices.length; i++) {
                        if (matchedIndices[i] <= matchedIndices[i - 1]) {
                            isSequential = false;
                            break;
                        }
                    }
                    
                    // BONUS: Same order gets higher score
                    if (isSequential) {
                        score = 0.98; // Higher than reversed order
                        type = `word-match-sequential-${matchCount}`;
                        // console.log(`      [WORD-SEQ] ${option.Name}: ${score.toFixed(2)} (indices: ${matchedIndices.join(',')})`);
                    } else {
                        score = 0.80; // Reversed or mixed order - LOWER than contains match (0.85)
                        type = `word-match-all-${matchCount}`;
                        // console.log(`      [WORD-REV] ${option.Name}: ${score.toFixed(2)} (indices: ${matchedIndices.join(',')})`);
                    }
                } else {
                    score = (matchCount / Math.max(inputWords.length, optionWords.length)) * 0.7;
                    type = `word-match-${matchCount}/${inputWords.length}`;
                    // console.log(`      [WORD-PARTIAL] ${option.Name}: ${score.toFixed(2)} (${type})`);
                }
            }
        }
        
        // 4. Fuzzy matching with edit distance (for typos)
        if (score < 0.7) {
            // ============================================
            // OPTIMIZATION: Skip Levenshtein for very different lengths
            // ============================================
            const lengthDiff = Math.abs(cleanInput.length - cleanOption.length);
            
            // If length difference > 5, edit distance will be high anyway
            // Skip expensive calculation
            if (OPTIMIZATION_FLAGS.LEVENSHTEIN_LENGTH_CHECK && lengthDiff > 5) {
                // Skip Levenshtein calculation
                OPTIMIZATION_METRICS.levenshteinSkipped++;
            } else {
                const similarity = similarityScore(cleanInput, cleanOption);
                if (similarity > 0.6) {
                    const editScore = similarity * 0.85;
                    if (editScore > score) {
                        score = editScore;
                        type = 'edit-distance';
                    }
                }
            }
        }
        
        // Update best match
        if (score > bestScore) {
            bestScore = score;
            bestMatch = option;
            matchType = type;
        }
    }
    
    // ============================================
    // OPTIMIZATION: Log skipped candidates
    // ============================================
    if (OPTIMIZATION_FLAGS.FUZZY_EARLY_EXIT && skippedCount > 0) {
        OPTIMIZATION_METRICS.fuzzySkipped += skippedCount;
        // console.log(`  ⚡ Fuzzy: Skipped ${skippedCount}/${options.length} weak candidates`);
    }
    
    if (bestScore >= threshold) {
        const confidence = bestScore >= 0.85 ? 'high' : bestScore >= 0.65 ? 'medium' : 'low';
        return { match: bestMatch, score: bestScore, confidence };
    }
    
    return null;
}

/**
 * Extract street names from address (for learning DB)
 * Example: "135/17/43 Nguyễn Hữu Cảnh" → ["nguyễn", "hữu", "cảnh"]
 */
function extractStreetNames(text) {
    const keywords = [];
    
    // Pattern: Vietnamese name (2-4 words, capitalized)
    // Example: "Nguyễn Hữu Cảnh", "Lê Lợi", "Trần Hưng Đạo"
    const namePattern = /\b([A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ][a-zàáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]+\s+){1,3}[A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ][a-zàáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]+/g;
    
    const matches = text.match(namePattern);
    if (matches) {
        for (const match of matches) {
            // Split into words and normalize
            const words = match.split(/\s+/)
                .map(w => removeVietnameseTones(w).toLowerCase())
                .filter(w => w.length >= 3); // Skip short words
            
            keywords.push(...words);
        }
    }
    
    return keywords;
}

/**
 * Extract street numbers from address (for learning DB)
 * Example: "135/17/43" → ["135/17/43"]
 */
function extractStreetNumbers(text) {
    const keywords = [];
    
    // Pattern: House number (123, 123/45, 123/45/67)
    const numberPattern = /\b\d+(?:\/\d+){0,2}\b/g;
    
    const matches = text.match(numberPattern);
    if (matches) {
        keywords.push(...matches);
    }
    
    return keywords;
}

/**
 * Extract landmark from address
 * Separates landmark phrases (sau chợ, gần ngã tư, etc.) from main address
 * Returns: { street, landmark, cleanAddress }
 */
function extractLandmark(addressText) {
    if (!OPTIMIZATION_FLAGS.LANDMARK_EXTRACTION) {
        return {
            street: addressText,
            landmark: null,
            cleanAddress: addressText
        };
    }
    
    // Landmark keywords (position + place types)
    const LANDMARK_KEYWORDS = [
        // Position keywords - Use word boundary patterns
        'sau chợ', 'sau cho', 'sau trường', 'sau truong', 'sau bệnh viện', 'sau benh vien',
        'sau cầu', 'sau cau', 'sau cống', 'sau cong', 'sau đình', 'sau dinh',
        'trước chợ', 'truoc cho', 'trước trường', 'truoc truong',
        'gần chợ', 'gan cho', 'gần trường', 'gan truong', 'gần bệnh viện', 'gan benh vien',
        'cạnh chợ', 'canh cho', 'đối diện chợ', 'doi dien cho',
        
        // Extension keywords
        'nối dài', 'noi dai', 'kéo dài', 'keo dai',
        
        // Place types (common landmarks) - Full phrases only
        'ngã tư', 'nga tu', 'ngã ba', 'nga ba',
        'công viên', 'cong vien', 'siêu thị', 'sieu thi',
        'chung cư', 'chung cu', 'khu dân cư', 'khu dan cu', 'kdc'
    ];
    
    // Normalize for searching
    const normalized = removeVietnameseTones(addressText).toLowerCase();
    
    // Find first landmark keyword
    let landmarkStart = -1;
    let landmarkKeyword = null;
    
    for (const keyword of LANDMARK_KEYWORDS) {
        // Use word boundary regex to avoid false matches
        // Example: "sau chợ" should match "sau chợ" but NOT "phường sau"
        const keywordNormalized = removeVietnameseTones(keyword).toLowerCase();
        
        // Build regex with word boundary at start
        // For multi-word keywords, use flexible spacing
        const regexPattern = '\\b' + keywordNormalized.replace(/\s+/g, '\\s+');
        const regex = new RegExp(regexPattern, 'i');
        const match = normalized.match(regex);
        
        if (match) {
            const matchIndex = match.index;
            
            // CRITICAL FIX: Check if landmark keyword comes BEFORE location keywords
            // If landmark is AFTER location keywords (xã, phường, quận, tỉnh), it's likely a false positive
            // Example: "phường 14 gò vấp" → "gò" should NOT be treated as landmark
            const beforeLandmark = normalized.substring(0, matchIndex);
            const hasLocationKeywordBefore = /\b(xa|phuong|quan|huyen|thi xa|thanh pho|tinh)\b/i.test(beforeLandmark);
            
            if (hasLocationKeywordBefore) {
                // Skip this match - it's likely part of a location name, not a landmark
                console.log(`  ⚠️ Skipping landmark after location keyword: "${keyword}"`);
                continue;
            }
            
            // CRITICAL FIX 2: Validate landmark context
            // Check if this is really a landmark or just part of a name
            const afterKeyword = normalized.substring(matchIndex + keywordNormalized.length).trim();
            
            // If there are location keywords AFTER this, it's likely part of address structure
            const hasLocationAfter = /\b(xa|phuong|quan|huyen|thi xa|thanh pho|tinh)\b/i.test(afterKeyword);
            
            if (hasLocationAfter) {
                // This is likely part of address structure, not a landmark
                console.log(`  ⚠️ Skipping landmark before location keyword: "${keyword}"`);
                continue;
            }
            
            if (landmarkStart === -1 || matchIndex < landmarkStart) {
                landmarkStart = matchIndex;
                landmarkKeyword = keyword;
            }
        }
    }
    
    if (landmarkStart === -1) {
        // No landmark found
        return {
            street: addressText,
            landmark: null,
            cleanAddress: addressText
        };
    }// Find where landmark ends
    let landmarkEnd = addressText.length;
    
    // Strategy 1: Look for comma after landmark
    const afterLandmark = addressText.substring(landmarkStart);
    const commaMatch = afterLandmark.match(/[,，]/);
    if (commaMatch) {
        landmarkEnd = landmarkStart + commaMatch.index;
    } else {
        // Strategy 2: Landmark is typically 2-4 words
        // Extract 2-4 words after landmark keyword, then check if remaining looks like location
        const afterLandmarkNormalized = normalized.substring(landmarkStart);
        const words = afterLandmarkNormalized.split(/\s+/);
        
        // Try 2, 3, 4 words for landmark
        for (const wordCount of [2, 3, 4]) {
            if (words.length > wordCount) {
                // Get potential landmark (e.g., "sau dinh hau duong")
                const potentialLandmark = words.slice(0, wordCount).join(' ');
                
                // Get remaining text after potential landmark
                const remainingText = words.slice(wordCount).join(' ');
                
                // Check if remaining text looks like a location (contains common district/province names)
                // Common patterns: "dong anh", "ha noi", "quan 1", "phuong 14"
                const hasLocationPattern = 
                    /\b(quan|huyen|phuong|xa|tinh|thanh pho|tp)\b/.test(remainingText) || // Has location keyword
                    /\b(ha noi|ho chi minh|hcm|da nang|hai phong|can tho)\b/.test(remainingText) || // Major cities
                    /\b[a-z]+\s+(anh|binh|dong|tay|nam|bac|trung)\b/.test(remainingText); // Common district patterns
                
                if (hasLocationPattern) {
                    // This looks like a location - landmark ends here
                    landmarkEnd = landmarkStart + potentialLandmark.length;
                    break;
                }
            }
        }
        
        // If still no match, default to 3 words
        if (landmarkEnd === addressText.length && words.length > 3) {
            const defaultLandmark = words.slice(0, 3).join(' ');
            landmarkEnd = landmarkStart + defaultLandmark.length;
        }
    }
    
    // Extract parts
    let street = addressText.substring(0, landmarkStart).trim();
    const landmark = addressText.substring(landmarkStart, landmarkEnd).trim();
    let remaining = addressText.substring(landmarkEnd).trim();
    
    // Remove leading comma from remaining
    remaining = remaining.replace(/^[,，]\s*/, '');
    
    // SMART FIX: If street is empty, extract text between landmark phrase and next separator
    // Example: "Công ty formosa - kỳ liên" → street should be "formosa", not empty
    let finalStreet = street;
    if (!street && landmark) {
        // Look for separator after landmark in remaining text
        // Example: "formosa - kỳ liên" → take "formosa"
        const separatorMatch = remaining.match(/[\-,，]/);
        if (separatorMatch) {
            // Take text before first separator
            finalStreet = remaining.substring(0, separatorMatch.index).trim();
            // Update remaining to exclude the extracted street
            remaining = remaining.substring(separatorMatch.index + 1).trim();
        } else {
            // No separator - check if remaining has multiple words
            const words = remaining.split(/\s+/);
            if (words.length > 2) {
                // Take first 1-2 words as street (company/building name)
                finalStreet = words.slice(0, 2).join(' ');
                remaining = words.slice(2).join(' ');
            } else {
                // Use all remaining as street
                finalStreet = remaining;
                remaining = '';
            }
        }
    }
    
    // SMART: Add commas to remaining if it doesn't have any
    // This helps parsing when address has no commas: "đông anh hà nội" → "đông anh, hà nội"
    if (remaining && !remaining.includes(',')) {
        // CRITICAL: If remaining has dashes, convert them to commas first
        // Example: "kỳ liên - kỳ anh - hà tĩnh" → "kỳ liên, kỳ anh, hà tĩnh"
        if (remaining.includes('-')) {
            remaining = remaining.replace(/\s*-\s*/g, ', ');
        } else {
            const remainingNormalized = removeVietnameseTones(remaining).toLowerCase();
            
            // Try to detect location names (district/province) and add commas between them
            // Common patterns:
            // - "dong anh ha noi" → "dong anh, ha nội" (2 words + 2 words)
            // - "quan 10 ho chi minh" → "quan 10, ho chi minh" (keyword + name)
            
            // Strategy 1: Look for major city names
            const majorCities = ['ha noi', 'ho chi minh', 'hcm', 'da nang', 'hai phong', 'can tho', 'bien hoa', 'vung tau', 'nha trang', 'hue'];
            
            for (const city of majorCities) {
                const cityIndex = remainingNormalized.indexOf(city);
                if (cityIndex > 0) {
                    // Found city name - add comma before it
                    const beforeCity = remaining.substring(0, cityIndex).trim();
                    const cityPart = remaining.substring(cityIndex).trim();
                    remaining = beforeCity + ', ' + cityPart;
                    break;
                }
            }
            
            // Strategy 2: If still no comma and has 4+ words, split at midpoint
            if (!remaining.includes(',') && remaining.split(/\s+/).length >= 4) {
                const words = remaining.split(/\s+/);
                const midPoint = Math.floor(words.length / 2);
                remaining = words.slice(0, midPoint).join(' ') + ', ' + words.slice(midPoint).join(' ');
            }
        }
    }
    
    // Reconstruct without landmark
    const cleanAddress = (finalStreet ? finalStreet + ', ' : '') + remaining;
    
    return {
        street: finalStreet,
        landmark,
        cleanAddress
    };
}

/**
 * Extract phone number from text
 */
function extractPhoneNumber(text) {
    // Vietnamese phone patterns: 09x, 08x, 07x, 03x, 05x (10 digits)
    const phoneRegex = /(?:0|\+84)([3|5|7|8|9])\d{8}/g;
    const matches = text.match(phoneRegex);
    
    if (matches && matches.length > 0) {
        // Normalize to 10 digits starting with 0
        let phone = matches[0].replace(/\+84/, '0').replace(/\s/g, '');
        return {
            phone: phone,
            confidence: 'high',
            original: matches[0]
        };
    }
    
    return null;
}

/**
 * Extract customer name from text
 * Usually the last line or a short text without numbers
 */
function extractCustomerName(lines, phoneInfo) {
    // Remove lines that contain phone or address keywords
    const addressKeywords = [
        'phường', 'xã', 'quận', 'huyện', 'thành phố', 'tỉnh', 'tp', 
        'đường', 'phố', 'thôn', 'thon', 'xa', 'xom', 'xóm', 'ấp', 'ap', 
        'khu', 'số', 'so', 'đống', 'dong', 'ngõ', 'ngo', 'hem', 'hẻm',
        'khóm', 'khom', 'thị trấn', 'thi tran', 'tt', 'thị xã', 'thi xa', 'tx',
        'tầng', 'tang', 'tòa', 'toa', 'lầu', 'lau' // Building/floor keywords
    ];
    
    // IMPROVED: Common Vietnamese place names (cities, districts, provinces)
    // These indicate the line is an address, not a name
    const placeNames = [
        // Major cities
        'ha noi', 'ho chi minh', 'hcm', 'sai gon', 'da nang', 'hai phong', 'can tho',
        'bien hoa', 'vung tau', 'nha trang', 'hue', 'phan thiet', 'da lat', 'quy nhon',
        'vinh', 'hai duong', 'nam dinh', 'thai nguyen', 'bac ninh', 'long xuyen',
        
        // Common districts/areas
        'tan binh', 'tan phu', 'binh thanh', 'go vap', 'thu duc', 'binh tan',
        'phu nhuan', 'quan 1', 'quan 2', 'quan 3', 'quan 4', 'quan 5',
        'dong anh', 'gia lam', 'long bien', 'cau giay', 'ha dong', 'thanh xuan',
        'me linh', 'soc son', 'ba dinh', 'hoan kiem', 'tay ho',
        
        // Common wards/communes
        'phu hoa', 'phu hoai', 'tan thanh', 'binh hung', 'binh tri',
        'an phu', 'an khanh', 'thao dien', 'cat lai', 'thu thiem',
        'phuoc long', 'phuoc hoa', 'tan phuoc', 'tan quy', 'tan son',
        
        // Provinces
        'binh duong', 'dong nai', 'ba ria', 'vung tau', 'long an', 'tien giang',
        'ben tre', 'tra vinh', 'vinh long', 'an giang', 'kien giang', 'ca mau',
        'bac lieu', 'soc trang', 'hau giang', 'can tho', 'dong thap',
        'lam dong', 'binh phuoc', 'tay ninh', 'binh thuan', 'ninh thuan',
        'khanh hoa', 'phu yen', 'binh dinh', 'quang ngai', 'quang nam',
        'quang tri', 'quang binh', 'ha tinh', 'nghe an', 'thanh hoa',
        'ninh binh', 'nam dinh', 'thai binh', 'hai duong', 'hung yen',
        'bac giang', 'bac kan', 'cao bang', 'ha giang', 'lang son',
        'lao cai', 'yen bai', 'tuyen quang', 'phu tho', 'vinh phuc',
        'thai nguyen', 'son la', 'dien bien', 'lai chau', 'hoa binh',
        'dak lak', 'dak nong', 'gia lai', 'kon tum'
    ];
    
    console.log('🔍 Extracting name from', lines.length, 'lines:', lines);
    
    const candidateLines = lines.filter(line => {
        const lower = line.toLowerCase();
        const normalized = removeVietnameseTones(lower);
        
        // Skip if contains phone
        if (phoneInfo && line.includes(phoneInfo.phone)) {
            console.log(`  ✗ Skip (has phone): "${line}"`);
            return false;
        }
        
        // Skip if contains district abbreviations (Q1, Q2, P1, P2, etc.)
        if (/\b[qp]\d+\b/i.test(line)) {
            console.log(`  ✗ Skip (has district abbreviation): "${line}"`);
            return false;
        }
        
        // Skip if contains address keywords
        if (addressKeywords.some(kw => normalized.includes(kw))) {
            console.log(`  ✗ Skip (has address keyword): "${line}"`);
            return false;
        }
        
        // IMPROVED: Skip if contains place names
        if (placeNames.some(place => normalized.includes(place))) {
            console.log(`  ✗ Skip (has place name): "${line}"`);
            return false;
        }
        
        // IMPROVED: Skip if starts with house number pattern
        // Pattern: "123 Street Name" or "123/45 Street Name"
        if (/^\d+[\/\-]?\d*\s+[a-zA-ZÀ-ỹ]/.test(line)) {
            console.log(`  ✗ Skip (starts with house number): "${line}"`);
            return false;
        }
        
        // Skip if too long (likely address)
        if (line.length > 50) {
            console.log(`  ✗ Skip (too long): "${line}"`);
            return false;
        }
        
        // IMPROVED: Skip if contains too many numbers OR has slash/dash in numbers
        // "59 phan huy ich" has 2 digits but "59/1" would have slash
        const numberCount = (line.match(/\d/g) || []).length;
        const hasNumberSlash = /\d+[\/\-]\d+/.test(line);
        
        if (numberCount > 2 || hasNumberSlash) {
            console.log(`  ✗ Skip (too many numbers or has number slash): "${line}"`);
            return false;
        }
        
        console.log(`  ✓ Candidate: "${line}"`);
        return true;
    });
    
    if (candidateLines.length === 0) {
        console.log('  ❌ No name candidates found');
        return null;
    }
    
    // Prefer last line (common pattern)
    const lastLine = candidateLines[candidateLines.length - 1].trim();
    
    // Validate name (2-50 chars, mostly letters)
    if (lastLine.length >= 2 && lastLine.length <= 50) {
        const letterCount = (lastLine.match(/[a-zA-ZÀ-ỹ]/g) || []).length;
        if (letterCount / lastLine.length > 0.7) {
            console.log(`  ✅ Name extracted: "${lastLine}"`);
            return {
                name: lastLine,
                confidence: candidateLines.length === 1 ? 'high' : 'medium'
            };
        }
    }
    
    console.log('  ❌ No valid name found');
    return null;
}

/**
 * Parse address and match with Vietnam address database
 * Enhanced to handle addresses WITHOUT commas and with typos
 * PRIORITY: Longer phrases (2-3 words) over single words
 */
async function parseAddress(addressText) {
    const result = {
        street: '',
        ward: null,
        district: null,
        province: null,
        confidence: 'low',
        suggestions: [],
        warnings: []  // For validation warnings
    };
    
    const vietnamAddressData = getVietnamAddressData();
    
    console.log('🔍 Parsing address:', addressText);
    
    if (!addressText) {
        console.warn('⚠️ No address text provided');
        return result;
    }
    
    if (vietnamAddressData.length === 0) {
        console.error('❌ No address data available!');
        return result;
    }
    
    console.log('📊 Address data:', vietnamAddressData.length, 'provinces loaded');
    
    // ============================================
    // LAYER 0: PRE-NORMALIZATION (NEW - Safe)
    // ============================================
    // Normalize patterns BEFORE processing
    // Rule: Only handle 100% clear patterns, don't guess
    let processedAddress = addressText;
    
    console.log('🔧 Layer 0: Pre-normalization...');
    
    // Step 1: Normalize abbreviations with space (P. 22 → P.22)
    // Pattern: "P.\s+\d+" → "P.\d+" (remove space between abbreviation and number)
    // Safe: Only affects clear patterns like "P. 22", "Q. 8", "F. 17"
    processedAddress = processedAddress.replace(/\b([PQFpqf])\.(\s+)(\d{1,2})\b/g, '$1.$3');
    
    // Step 2: Normalize abbreviations with space and word (Q. B/Thạnh → Q.B/Thạnh)
    // Pattern: "Q.\s+\w+" → "Q.\w+"
    // Safe: Only affects patterns with Q./q. followed by space and word
    processedAddress = processedAddress.replace(/\b([Qq])\.(\s+)(\w+)/g, '$1.$3');
    
    // Step 3: CRITICAL FIX - Normalize "p.Name" → "Phường Name" (expand immediately)
    // This prevents "p." from being split as separate part
    // Pattern: "p.Phú Lợi" → "Phường Phú Lợi"
    // IMPORTANT: Match both "p." and "P." with optional space
    processedAddress = processedAddress.replace(/\b([Pp])\.(\s*)([A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ][a-zàáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]+)/g, 'Phường $3');
    
    // Step 4: Normalize "q.Name" → "Quận Name" (expand immediately)
    // Pattern: "q.Tân Bình" → "Quận Tân Bình"
    processedAddress = processedAddress.replace(/\b([Qq])\.(\s*)([A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ][a-zàáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]+)/g, 'Quận $3');
    
    if (processedAddress !== addressText) {
        console.log('  ✓ Normalized:', addressText, '→', processedAddress);
    } else {
        console.log('  ⏭️ No normalization needed');
    }
    
    addressText = processedAddress;
    
    // ============================================
    // LAYER 0.5: LANDMARK EXTRACTION (NEW - Safe)
    // ============================================
    // Extract landmarks BEFORE parsing to avoid interference
    // Example: "123 Nguyễn Văn Linh nối dài, Q8" → street="123 Nguyễn Văn Linh", landmark="nối dài"
    
    let landmarkInfo = null;
    
    if (OPTIMIZATION_FLAGS.LANDMARK_EXTRACTION) {
        console.log('🔧 Layer 0.5: Landmark extraction...');
        landmarkInfo = extractLandmark(addressText);
        
        if (landmarkInfo.landmark) {
            console.log('  🏷️ Landmark detected:', landmarkInfo.landmark);
            console.log('  📍 Street portion:', landmarkInfo.street);
            console.log('  🧹 Clean address:', landmarkInfo.cleanAddress);
            
            // Use clean address for parsing
            addressText = landmarkInfo.cleanAddress;
            OPTIMIZATION_METRICS.landmarkExtracted++;
        } else {
            console.log('  ⏭️ No landmark detected');
        }
    }
    
    // ============================================
    // LAYER 1: DISTRICT DICTIONARY (ENHANCED)
    // ============================================
    // Expand special district abbreviations and common patterns
    // Rule: Only apply when context is clear (has street number, not conflicting province)
    
    console.log('🔧 Layer 1: District dictionary & common patterns...');
    
    // District abbreviation dictionary for major cities
    const districtAbbreviations = {
        // TP.HCM districts
        'b/thạnh': { full: 'Quận Bình Thạnh', province: 'TP.HCM', aliases: ['b.thạnh', 'bthạnh', 'b/thanh', 'b.thanh', 'bthanh', 'bình thạnh', 'binh thanh'] },
        'b/tân': { full: 'Quận Bình Tân', province: 'TP.HCM', aliases: ['b.tân', 'btân', 'b/tan', 'b.tan', 'btan', 'bình tân', 'binh tan'] },
        'g/vấp': { full: 'Quận Gò Vấp', province: 'TP.HCM', aliases: ['g.vấp', 'gvấp', 'g/vap', 'g.vap', 'gvap', 'gò vấp', 'go vap'] },
        't/đức': { full: 'Thành phố Thủ Đức', province: 'TP.HCM', aliases: ['t.đức', 'tđức', 't/duc', 't.duc', 'tduc', 'thủ đức', 'thu duc'] },
        'p/nhuận': { full: 'Quận Phú Nhuận', province: 'TP.HCM', aliases: ['p.nhuận', 'pnhuận', 'p/nhuan', 'p.nhuan', 'pnhuan', 'phú nhuận', 'phu nhuan'] },
        't/bình': { full: 'Quận Tân Bình', province: 'TP.HCM', aliases: ['t.bình', 'tbình', 't/binh', 't.binh', 'tbinh', 'tân bình', 'tan binh'] },
        't/phú': { full: 'Quận Tân Phú', province: 'TP.HCM', aliases: ['t.phú', 'tphú', 't/phu', 't.phu', 'tphu', 'tân phú', 'tan phu'] },
        'b/chánh': { full: 'Huyện Bình Chánh', province: 'TP.HCM', aliases: ['b.chánh', 'bchánh', 'b/chanh', 'b.chanh', 'bchanh', 'bình chánh', 'binh chanh'] },
        'h/môn': { full: 'Huyện Hóc Môn', province: 'TP.HCM', aliases: ['h.môn', 'hmôn', 'h/mon', 'h.mon', 'hmon', 'hóc môn', 'hoc mon'] },
        'n/bè': { full: 'Huyện Nhà Bè', province: 'TP.HCM', aliases: ['n.bè', 'nbè', 'n/be', 'n.be', 'nbe', 'nhà bè', 'nha be'] },
        'c/giờ': { full: 'Huyện Cần Giờ', province: 'TP.HCM', aliases: ['c.giờ', 'cgiờ', 'c/gio', 'c.gio', 'cgio', 'cần giờ', 'can gio'] },
        'c/chi': { full: 'Huyện Củ Chi', province: 'TP.HCM', aliases: ['c.chi', 'cchi', 'củ chi', 'cu chi'] },
        
        // CRITICAL: Add full name entries for better matching
        'bình chánh': { full: 'Huyện Bình Chánh', province: 'TP.HCM', aliases: ['binh chanh', 'h.bình chánh', 'h binh chanh'] },
        'bình thạnh': { full: 'Quận Bình Thạnh', province: 'TP.HCM', aliases: ['binh thanh', 'q.bình thạnh', 'q binh thanh'] },
        'bình tân': { full: 'Quận Bình Tân', province: 'TP.HCM', aliases: ['binh tan', 'q.bình tân', 'q binh tan'] },
        
        // Bình Dương districts
        'tdm': { full: 'Thành phố Thủ Dầu Một', province: 'Bình Dương', aliases: ['tp tdm', 'tp.tdm', 'tptdm', 'thủ dầu một', 'thu dau mot'] },
        'dĩ an': { full: 'Thành phố Dĩ An', province: 'Bình Dương', aliases: ['di an', 'tp dĩ an', 'tp di an', 'tp.da', 'da'] },
        'thuận an': { full: 'Thành phố Thuận An', province: 'Bình Dương', aliases: ['thuan an', 'tp thuận an', 'tp thuan an', 'tp.ta', 'ta'] },
        'bắc tân uyên': { full: 'Huyện Bắc Tân Uyên', province: 'Bình Dương', aliases: ['bac tan uyen', 'h.bắc tân uyên', 'h bac tan uyen', 'btu'] },
        'bến cát': { full: 'Thị xã Bến Cát', province: 'Bình Dương', aliases: ['ben cat', 'tx bến cát', 'tx ben cat', 'bc'] },
        'tân uyên': { full: 'Thị xã Tân Uyên', province: 'Bình Dương', aliases: ['tan uyen', 'tx tân uyên', 'tx tan uyen', 'tu'] },
        'phú giáo': { full: 'Huyện Phú Giáo', province: 'Bình Dương', aliases: ['phu giao', 'h.phú giáo', 'h phu giao'] },
        'dầu tiếng': { full: 'Huyện Dầu Tiếng', province: 'Bình Dương', aliases: ['dau tieng', 'h.dầu tiếng', 'h dau tieng'] },
        'bàu bàng': { full: 'Huyện Bàu Bàng', province: 'Bình Dương', aliases: ['bau bang', 'h.bàu bàng', 'h bau bang'] },
        
        // Đồng Nai districts
        'biên hòa': { full: 'Thành phố Biên Hòa', province: 'Đồng Nai', aliases: ['bien hoa', 'tp biên hòa', 'tp bien hoa', 'bh'] },
        'long khánh': { full: 'Thành phố Long Khánh', province: 'Đồng Nai', aliases: ['long khanh', 'tp long khánh', 'tp long khanh', 'lk'] },
        'nhơn trạch': { full: 'Huyện Nhơn Trạch', province: 'Đồng Nai', aliases: ['nhon trach', 'h.nhơn trạch', 'h nhon trach', 'nt'] },
        'trảng bom': { full: 'Huyện Trảng Bom', province: 'Đồng Nai', aliases: ['trang bom', 'h.trảng bom', 'h trang bom', 'tb'] },
        'long thành': { full: 'Huyện Long Thành', province: 'Đồng Nai', aliases: ['long thanh', 'h.long thành', 'h long thanh', 'lt'] },
        
        // Long An districts
        'tân an': { full: 'Thành phố Tân An', province: 'Long An', aliases: ['tan an', 'tp tân an', 'tp tan an', 'ta'] },
        'cần giuộc': { full: 'Huyện Cần Giuộc', province: 'Long An', aliases: ['can giuoc', 'h.cần giuộc', 'h can giuoc', 'cg'] },
        'bến lức': { full: 'Huyện Bến Lức', province: 'Long An', aliases: ['ben luc', 'h.bến lức', 'h ben luc', 'bl'] },
        'đức hòa': { full: 'Huyện Đức Hòa', province: 'Long An', aliases: ['duc hoa', 'h.đức hòa', 'h duc hoa', 'dh'] },
        'thủ thừa': { full: 'Huyện Thủ Thừa', province: 'Long An', aliases: ['thu thua', 'h.thủ thừa', 'h thu thua', 'tt'] },
        
        // Hà Nội districts
        'hoàn kiếm': { full: 'Quận Hoàn Kiếm', province: 'Hà Nội', aliases: ['hoan kiem', 'q.hoàn kiếm', 'q hoan kiem', 'hk'] },
        'cầu giấy': { full: 'Quận Cầu Giấy', province: 'Hà Nội', aliases: ['cau giay', 'q.cầu giấy', 'q cau giay', 'cg'] },
        'thanh xuân': { full: 'Quận Thanh Xuân', province: 'Hà Nội', aliases: ['thanh xuan', 'q.thanh xuân', 'q thanh xuan', 'tx'] },
        'hà đông': { full: 'Quận Hà Đông', province: 'Hà Nội', aliases: ['ha dong', 'q.hà đông', 'q ha dong', 'hd'] },
        'long biên': { full: 'Quận Long Biên', province: 'Hà Nội', aliases: ['long bien', 'q.long biên', 'q long bien', 'lb'] },
        'đống đa': { full: 'Quận Đống Đa', province: 'Hà Nội', aliases: ['dong da', 'q.đống đa', 'q dong da', 'dd'] },
        'hai bà trưng': { full: 'Quận Hai Bà Trưng', province: 'Hà Nội', aliases: ['hai ba trung', 'q.hai bà trưng', 'q hai ba trung', 'hbt'] },
        'ba đình': { full: 'Quận Ba Đình', province: 'Hà Nội', aliases: ['ba dinh', 'q.ba đình', 'q ba dinh', 'bd'] },
        'tây hồ': { full: 'Quận Tây Hồ', province: 'Hà Nội', aliases: ['tay ho', 'q.tây hồ', 'q tay ho', 'th'] },
        'gia lâm': { full: 'Huyện Gia Lâm', province: 'Hà Nội', aliases: ['gia lam', 'h.gia lâm', 'h gia lam', 'gl'] },
        'đông anh': { full: 'Huyện Đông Anh', province: 'Hà Nội', aliases: ['dong anh', 'h.đông anh', 'h dong anh', 'da'] },
        'mê linh': { full: 'Huyện Mê Linh', province: 'Hà Nội', aliases: ['me linh', 'h.mê linh', 'h me linh', 'ml'] },
        'sóc sơn': { full: 'Huyện Sóc Sơn', province: 'Hà Nội', aliases: ['soc son', 'h.sóc sơn', 'h soc son', 'ss'] },
        
        // Đà Nẵng districts
        'hải châu': { full: 'Quận Hải Châu', province: 'Đà Nẵng', aliases: ['hai chau', 'q.hải châu', 'q hai chau', 'hc'] },
        'thanh khê': { full: 'Quận Thanh Khê', province: 'Đà Nẵng', aliases: ['thanh khe', 'q.thanh khê', 'q thanh khe', 'tk'] },
        'sơn trà': { full: 'Quận Sơn Trà', province: 'Đà Nẵng', aliases: ['son tra', 'q.sơn trà', 'q son tra', 'st'] },
        'ngũ hành sơn': { full: 'Quận Ngũ Hành Sơn', province: 'Đà Nẵng', aliases: ['ngu hanh son', 'q.ngũ hành sơn', 'q ngu hanh son', 'nhs'] },
        'liên chiểu': { full: 'Quận Liên Chiểu', province: 'Đà Nẵng', aliases: ['lien chieu', 'q.liên chiểu', 'q lien chieu', 'lc'] },
        'cẩm lệ': { full: 'Quận Cẩm Lệ', province: 'Đà Nẵng', aliases: ['cam le', 'q.cẩm lệ', 'q cam le', 'cl'] },
        'hòa vang': { full: 'Huyện Hòa Vang', province: 'Đà Nẵng', aliases: ['hoa vang', 'h.hòa vang', 'h hoa vang', 'hv'] }
    };
    
    // ENHANCEMENT: Common district patterns (Q1-Q12 for TP.HCM)
    // Pattern: "Q1", "Q.1", "q1", "q.1" → "Quận 1"
    // CRITICAL: Use negative lookbehind to avoid matching "Ấp3" as "P3"
    const commonDistrictPatterns = [
        // TP.HCM districts (Quận 1-12)
        { pattern: /\bq\.?([1-9]|1[0-2])\b/gi, template: 'Quận $1', province: 'TP.HCM' },
        // TP.HCM wards (P1-P30, F1-F30)
        // CRITICAL: Negative lookbehind (?<!Ấ) to avoid "Ấp3" → "ẤPhường 3"
        // Match: "P3", "p.3", "F17" but NOT "Ấp3"
        { pattern: /(?<!Ấ)(?<!ấ)\b[pf]\.?([1-9]|[12][0-9]|30)\b/gi, template: 'Phường $1', province: 'TP.HCM' }
    ];
    
    // Check if we should apply dictionary (context-based)
    // IMPROVED: Expand street number pattern to include "789 Street Name"
    // Simplified: Use \w instead of full character class
    const hasStreetNumber = /\d+\/\d+|\d+\s+đường|đường\s+\d+|số\s+\d+|^\d+\s+\w/i.test(processedAddress);
    const hasConflictingProvince = /hà nội|hà nam|bắc ninh|bắc giang|đà nẵng|huế|cần thơ/i.test(processedAddress);
    
    console.log(`  🔍 Dictionary check: hasStreetNumber=${hasStreetNumber}, hasConflictingProvince=${hasConflictingProvince}`);
    console.log(`  📝 processedAddress: "${processedAddress}"`);
    
    let dictionaryApplied = false;
    let provinceHint = null;
    
    // CRITICAL: Check dictionary FIRST (before checking hasStreetNumber)
    // This allows us to recognize "Bình Chánh" even without street number
    const normalizedForDict = removeVietnameseTones(processedAddress).toLowerCase();
    console.log(`  📝 Normalized for dict: "${normalizedForDict}"`);
    
    // Context-aware guard:
    // Detect explicit province mentions in user text so we don't force
    // ambiguous district aliases to a wrong province (e.g. "Bình Thạnh" -> TP.HCM)
    // when the address already mentions another province.
    const explicitProvincesInText = new Set();
    for (const province of vietnamAddressData) {
        if (!province || !province.Name) continue;
        
        const normalizedProvinceName = removeVietnameseTones(province.Name)
            .toLowerCase()
            .replace(/^(tinh|thanh pho|tp)\s+/, '')
            .trim();
        
        if (!normalizedProvinceName) continue;
        
        // Match full province token by word boundaries to avoid false positives.
        const provinceRegex = new RegExp(`\\b${normalizedProvinceName}\\b`, 'i');
        if (provinceRegex.test(normalizedForDict)) {
            explicitProvincesInText.add(province.Name);
        }
    }
    
    // Known ambiguous district aliases that appear in multiple provinces.
    // These should not be auto-forced to a fixed province when text
    // already contains another explicit province hint.
    const ambiguousDistrictAliases = new Set([
        'binh thanh',
        'tan binh',
        'phu nhuan',
        'tan phu',
        'thanh pho'
    ]);
    
    // CRITICAL: Sort dictionary entries by pattern length (longest first)
    // This ensures "Bắc Tân Uyên" is checked BEFORE "Tân Uyên"
    const sortedDistrictEntries = Object.entries(districtAbbreviations).sort((a, b) => {
        // Get longest pattern from each entry (main abbr + aliases)
        const aPatterns = [a[0], ...a[1].aliases];
        const bPatterns = [b[0], ...b[1].aliases];
        const aMaxLen = Math.max(...aPatterns.map(p => p.length));
        const bMaxLen = Math.max(...bPatterns.map(p => p.length));
        return bMaxLen - aMaxLen; // Descending order (longest first)
    });
    
    // Step 1: Check district abbreviations (B/Thạnh, G/Vấp, etc.) AND full names
    for (const [abbr, info] of sortedDistrictEntries) {
        // Check main abbreviation and all aliases
        const allPatterns = [abbr, ...info.aliases];
        
        // CRITICAL: Sort patterns by length (longest first) within each entry
        // This ensures "bắc tân uyên" is checked BEFORE "tân uyên" in aliases
        allPatterns.sort((a, b) => b.length - a.length);
        
        for (const pattern of allPatterns) {
            // CRITICAL FIX: Normalize pattern to match normalizedForDict (no tones)
            const normalizedPattern = removeVietnameseTones(pattern).toLowerCase();
            
            // Skip ambiguous forced mappings when explicit province context conflicts.
            if (ambiguousDistrictAliases.has(normalizedPattern) && explicitProvincesInText.size > 0) {
                const mappedProvince = provinceHintMapName(info.province);
                const hasSameProvince = Array.from(explicitProvincesInText).some(p => {
                    return removeVietnameseTones(p).toLowerCase() === removeVietnameseTones(mappedProvince).toLowerCase();
                });
                
                if (!hasSameProvince) {
                    console.log(`  ⏭️ Skip ambiguous dictionary pattern "${pattern}" due to explicit province context mismatch`);
                    continue;
                }
            }
            
            // SMART CONTEXT CHECK: If pattern is ambiguous (like "tt"), check what comes after
            // "tt easup" → "thị trấn Ea Súp" (NOT "Huyện Thủ Thừa")
            // "tt" alone or "tt," → "Huyện Thủ Thừa" (OK to expand)
            const isAmbiguousPattern = ['tt', 'tx', 'tp', 'tn', 'hue'].includes(normalizedPattern);
            
            // Use word boundary to avoid false matches
            const regex = new RegExp(`\\b${normalizedPattern.replace(/\//g, '\\/')}\\b`, 'gi');
            
            if (regex.test(normalizedForDict)) {
                // CONTEXT-AWARE MATCHING: Check if pattern is followed by another word
                if (isAmbiguousPattern) {
                    // Check if "tt" is followed by a word (not comma, not end of string)
                    const contextRegex = new RegExp(`\\b${normalizedPattern}\\s+([a-z]+)`, 'i');
                    const contextMatch = normalizedForDict.match(contextRegex);
                    
                    if (contextMatch) {
                        const nextWord = contextMatch[1];
                        // If next word is NOT part of the district name, skip this pattern
                        // Example: "tt easup" → nextWord="easup", not part of "Thủ Thừa"
                        const districtWords = removeVietnameseTones(info.full).toLowerCase().split(/\s+/);
                        const isPartOfDistrict = districtWords.some(w => w.includes(nextWord) || nextWord.includes(w));
                        
                        if (!isPartOfDistrict) {
                            console.log(`  ⏭️ Skip ambiguous pattern "${pattern}": followed by "${nextWord}" (not part of "${info.full}")`);
                            continue; // Skip this pattern, it's likely "thị trấn" not district name
                        }
                    }
                }
                
                console.log(`  ✓ Pattern "${pattern}" matched in normalized text`);
                
                // Found match - replace in original text (preserve Vietnamese tones)
                // CRITICAL FIX: Match both with and without tones in original text
                // Example: "Bình Chánh" or "Binh Chanh" or "bình chánh"
                
                const firstChar = pattern[0];
                const restPattern = pattern.slice(2); // Skip first char and separator (e.g., "chánh" from "b/chánh")
                
                // Build flexible regex that matches both toned and non-toned versions
                const buildFlexiblePattern = (text) => {
                    // Map of Vietnamese characters to their variants (with/without tones)
                    const charMap = {
                        'a': '[aàáảãạăắằẳẵặâấầẩẫậ]',
                        'e': '[eèéẻẽẹêếềểễệ]',
                        'i': '[iìíỉĩị]',
                        'o': '[oòóỏõọôốồổỗộơớờởỡợ]',
                        'u': '[uùúủũụưứừửữự]',
                        'y': '[yỳýỷỹỵ]',
                        'd': '[dđ]'
                    };
                    
                    const normalized = removeVietnameseTones(text).toLowerCase();
                    let flexPattern = '';
                    
                    for (const char of normalized) {
                        if (charMap[char]) {
                            flexPattern += charMap[char];
                        } else {
                            flexPattern += char;
                        }
                    }
                    
                    return flexPattern;
                };
                
                // For full name patterns (e.g., "bình chánh"), match the whole phrase
                if (pattern.includes(' ')) {
                    const flexiblePattern = buildFlexiblePattern(pattern);
                    const originalRegex = new RegExp(`\\b${flexiblePattern}\\b`, 'gi');
                    const originalMatch = processedAddress.match(originalRegex);
                    
                    if (originalMatch) {
                        processedAddress = processedAddress.replace(originalMatch[0], info.full);
                        provinceHint = info.province;
                        dictionaryApplied = true;
                        console.log(`  ✓ Dictionary: "${originalMatch[0]}" → "${info.full}" (province hint: ${info.province})`);
                        break;
                    }
                } else if (pattern.includes('/') || pattern.includes('.')) {
                    // For abbreviations with separator (e.g., "b/chánh")
                    const flexibleRest = buildFlexiblePattern(restPattern);
                    
                    // Match: [Bb][\.\\/]?[chánh] (flexible matching with tones)
                    const originalRegex = new RegExp(`\\b[${firstChar}${firstChar.toUpperCase()}][\\.\\/]?${flexibleRest}\\b`, 'gi');
                    const originalMatch = processedAddress.match(originalRegex);
                    
                    if (originalMatch) {
                        processedAddress = processedAddress.replace(originalMatch[0], info.full);
                        provinceHint = info.province;
                        dictionaryApplied = true;
                        console.log(`  ✓ Dictionary: "${originalMatch[0]}" → "${info.full}" (province hint: ${info.province})`);
                        break;
                    }
                } else {
                    // For simple patterns without space or separator (e.g., "tt", "tdm")
                    const flexiblePattern = buildFlexiblePattern(pattern);
                    const originalRegex = new RegExp(`\\b${flexiblePattern}\\b`, 'gi');
                    const originalMatch = processedAddress.match(originalRegex);
                    
                    if (originalMatch) {
                        processedAddress = processedAddress.replace(originalMatch[0], info.full);
                        provinceHint = info.province;
                        dictionaryApplied = true;
                        console.log(`  ✓ Dictionary: "${originalMatch[0]}" → "${info.full}" (province hint: ${info.province})`);
                        break;
                    } else {
                        console.log(`  ⚠️ Pattern "${pattern}" matched in normalized text but not found in original address`);
                    }
                }
            }
        }
        
        if (dictionaryApplied) break;
    }
    
    // Step 2: Check common patterns (Q1-Q12, P1-P30, F1-F30)
    if (!dictionaryApplied) {
        for (const { pattern, template, province } of commonDistrictPatterns) {
            const matches = processedAddress.match(pattern);
            
            if (matches) {
                // Replace all matches
                processedAddress = processedAddress.replace(pattern, (match, number) => {
                    const expanded = template.replace('$1', number);
                    console.log(`  ✓ Pattern: "${match}" → "${expanded}" (province hint: ${province})`);
                    return expanded;
                });
                
                provinceHint = province;
                dictionaryApplied = true;
                break;
            }
        }
    }
    
    if (!dictionaryApplied) {
        console.log('  ⏭️ No dictionary match');
    } else {
        // Dictionary was applied - update addressText with the expanded district name
        addressText = processedAddress;
    }

    // Normalize dictionary province labels for robust comparison above.
    function provinceHintMapName(hint) {
        const map = {
            'TP.HCM': 'Thành phố Hồ Chí Minh',
            'TPHCM': 'Thành phố Hồ Chí Minh',
            'HCM': 'Thành phố Hồ Chí Minh',
            'Sài Gòn': 'Thành phố Hồ Chí Minh',
            'TP.HN': 'Thành phố Hà Nội',
            'TPHN': 'Thành phố Hà Nội',
            'HN': 'Thành phố Hà Nội',
            'TP.ĐN': 'Thành phố Đà Nẵng',
            'ĐN': 'Thành phố Đà Nẵng'
        };
        return map[hint] || hint;
    }
    
    // CRITICAL: Sync processedAddress with addressText (after landmark extraction)
    // This ensures expand abbreviations works on CLEAN address
    processedAddress = addressText;
    
    // ============================================
    // PRE-PROCESSING: Expand common abbreviations (EXISTING)
    // ============================================
    // CRITICAL: Expand FULL NAMES FIRST before expanding abbreviations
    // This prevents false matches like "Bình" → "BìNhơn Trạch"
    
    // PRIORITY 1: Protect common place names from being corrupted
    // Mark them with special tokens that won't be expanded
    const PROTECTED_PATTERNS = [
        // TP.HCM districts/wards with "nh" in name
        { pattern: /\bbinh chanh\b/gi, token: '___BINH_CHANH___' },
        { pattern: /\bbinh thanh\b/gi, token: '___BINH_THANH___' },
        { pattern: /\bbinh tan\b/gi, token: '___BINH_TAN___' },
        { pattern: /\bbinh loi\b/gi, token: '___BINH_LOI___' },
        { pattern: /\bbinh tri\b/gi, token: '___BINH_TRI___' },
        { pattern: /\bbinh hung\b/gi, token: '___BINH_HUNG___' },
        { pattern: /\bbinh hoa\b/gi, token: '___BINH_HOA___' },
        { pattern: /\bbinh phu\b/gi, token: '___BINH_PHU___' },
        { pattern: /\bbinh an\b/gi, token: '___BINH_AN___' },
        { pattern: /\bbinh khanh\b/gi, token: '___BINH_KHANH___' },
        { pattern: /\bbinh nhut\b/gi, token: '___BINH_NHUT___' },
        { pattern: /\bbinh chieu\b/gi, token: '___BINH_CHIEU___' },
        { pattern: /\bbinh tho\b/gi, token: '___BINH_THO___' },
        { pattern: /\bbinh trung\b/gi, token: '___BINH_TRUNG___' },
        
        // Other common names with "nh"
        { pattern: /\bthanh xuan\b/gi, token: '___THANH_XUAN___' },
        { pattern: /\bthanh khe\b/gi, token: '___THANH_KHE___' },
        { pattern: /\bthanh chuong\b/gi, token: '___THANH_CHUONG___' },
        { pattern: /\bthanh hoa\b/gi, token: '___THANH_HOA___' },
        { pattern: /\bthanh pho\b/gi, token: '___THANH_PHO___' },
        { pattern: /\bvinh long\b/gi, token: '___VINH_LONG___' },
        { pattern: /\bvinh phuc\b/gi, token: '___VINH_PHUC___' },
        { pattern: /\bvinh cuu\b/gi, token: '___VINH_CUU___' },
        { pattern: /\bvinh loc\b/gi, token: '___VINH_LOC___' },
        { pattern: /\bphu nhuan\b/gi, token: '___PHU_NHUAN___' },
        { pattern: /\bphu hoa\b/gi, token: '___PHU_HOA___' },
        { pattern: /\bphu loi\b/gi, token: '___PHU_LOI___' },
        { pattern: /\bphu tho\b/gi, token: '___PHU_THO___' },
        { pattern: /\btan nhut\b/gi, token: '___TAN_NHUT___' },
        { pattern: /\btan phu\b/gi, token: '___TAN_PHU___' },
        { pattern: /\btan binh\b/gi, token: '___TAN_BINH___' },
        { pattern: /\btan thanh\b/gi, token: '___TAN_THANH___' },
        { pattern: /\blong thanh\b/gi, token: '___LONG_THANH___' },
        { pattern: /\blong khanh\b/gi, token: '___LONG_KHANH___' },
        { pattern: /\blong an\b/gi, token: '___LONG_AN___' },
        { pattern: /\blong xuyen\b/gi, token: '___LONG_XUYEN___' },
        { pattern: /\bminh long\b/gi, token: '___MINH_LONG___' },
        { pattern: /\bquynh phu\b/gi, token: '___QUYNH_PHU___' },
        { pattern: /\bquynh luu\b/gi, token: '___QUYNH_LUU___' }
    ];
    
    // Step 1: Protect common place names
    const protectedMap = new Map();
    for (const { pattern, token } of PROTECTED_PATTERNS) {
        const matches = [...processedAddress.matchAll(pattern)];
        for (const match of matches) {
            protectedMap.set(token, match[0]); // Store original text
            processedAddress = processedAddress.replace(pattern, token);
        }
    }
    
    if (protectedMap.size > 0) {
        console.log(`  🛡️ Protected ${protectedMap.size} place names from corruption:`, Array.from(protectedMap.values()));
    }
    
    // F1-F30, P1-P30 → Phường 1-30
    // Q1-Q12 → Quận 1-12
    // X. → Xã, H. → Huyện, T. → Tỉnh
    // TP HN, TP.HN → Thành phố Hà Nội
    
    // Expand city abbreviations FIRST (highest priority)
    // TP HCM, TP.HCM, TPHCM, tp hcm, tphcm → Thành phố Hồ Chí Minh
    // TP HN, TP.HN, TPHN, tp hn, tphn → Thành phố Hà Nội
    // Sài Gòn, SG → Thành phố Hồ Chí Minh
    
    // Pattern 1: TP HCM, TP.HCM, tp hcm, tp.hcm (with space/dot)
    // ENHANCED: Add major cities and districts across Vietnam
    processedAddress = processedAddress.replace(/\b(tp|thanh pho)\.?\s*(hn|hcm|dn|hp|ct|tdm|da|ta|bh|lk|vt|pt|nt|qn|hue|vl|dl|bmt)\b/gi, (match, prefix, city) => {
        const cityMap = {
            // Major cities
            'hn': 'Thành phố Hà Nội',
            'hcm': 'Thành phố Hồ Chí Minh',
            'dn': 'Thành phố Đà Nẵng',
            'hp': 'Thành phố Hải Phòng',
            'ct': 'Thành phố Cần Thơ',
            'hue': 'Thành phố Huế',
            'vt': 'Thành phố Vũng Tàu',
            'pt': 'Thành phố Phan Thiết',
            'nt': 'Thành phố Nha Trang',
            'qn': 'Thành phố Quy Nhơn',
            'vl': 'Thành phố Vinh',
            'dl': 'Thành phố Đà Lạt',
            'bmt': 'Thành phố Buôn Ma Thuột',
            // Bình Dương districts
            'tdm': 'Thành phố Thủ Dầu Một',
            'da': 'Thành phố Dĩ An',
            'ta': 'Thành phố Thuận An',
            // Đồng Nai districts
            'bh': 'Thành phố Biên Hòa',
            'lk': 'Thành phố Long Khánh'
        };
        return cityMap[city.toLowerCase()] || match;
    });
    
    // Pattern 2: TPHCM, tphcm, TPHN, tphn (no space/dot)
    // ENHANCED: Add all major cities
    processedAddress = processedAddress.replace(/\btp(hn|hcm|dn|hp|ct|tdm|da|ta|bh|lk|vt|pt|nt|qn|hue|vl|dl|bmt)\b/gi, (match, city) => {
        const cityMap = {
            // Major cities
            'hn': 'Thành phố Hà Nội',
            'hcm': 'Thành phố Hồ Chí Minh',
            'dn': 'Thành phố Đà Nẵng',
            'hp': 'Thành phố Hải Phòng',
            'ct': 'Thành phố Cần Thơ',
            'hue': 'Thành phố Huế',
            'vt': 'Thành phố Vũng Tàu',
            'pt': 'Thành phố Phan Thiết',
            'nt': 'Thành phố Nha Trang',
            'qn': 'Thành phố Quy Nhơn',
            'vl': 'Thành phố Vinh',
            'dl': 'Thành phố Đà Lạt',
            'bmt': 'Thành phố Buôn Ma Thuột',
            // Bình Dương districts
            'tdm': 'Thành phố Thủ Dầu Một',
            'da': 'Thành phố Dĩ An',
            'ta': 'Thành phố Thuận An',
            // Đồng Nai districts
            'bh': 'Thành phố Biên Hòa',
            'lk': 'Thành phố Long Khánh'
        };
        return cityMap[city.toLowerCase()] || match;
    });
    
    // Pattern 3: Sài Gòn, SG → TP.HCM
    processedAddress = processedAddress.replace(/\b(sai gon|saigon|sg)\b/gi, 'Thành phố Hồ Chí Minh');
    
    // Pattern 3.2: Standalone city codes at END of address (without "tp" prefix)
    // "quận tân phú hcm" → "quận tân phú Thành phố Hồ Chí Minh"
    // IMPORTANT: Only match at end or before comma/space
    // ENHANCED: Add major cities across Vietnam
    processedAddress = processedAddress.replace(/\s+(hcm|hn|dn|hp|ct|tdm|da|ta|bh|lk|vt|pt|nt|qn|hue|vl|dl|bmt)(?:\s|,|$)/gi, (match, city) => {
        const cityMap = {
            // Major cities
            'hn': ' Thành phố Hà Nội',
            'hcm': ' Thành phố Hồ Chí Minh',
            'dn': ' Thành phố Đà Nẵng',
            'hp': ' Thành phố Hải Phòng',
            'ct': ' Thành phố Cần Thơ',
            'hue': ' Thành phố Huế',
            'vt': ' Thành phố Vũng Tàu',
            'pt': ' Thành phố Phan Thiết',
            'nt': ' Thành phố Nha Trang',
            'qn': ' Thành phố Quy Nhơn',
            'vl': ' Thành phố Vinh',
            'dl': ' Thành phố Đà Lạt',
            'bmt': ' Thành phố Buôn Ma Thuột',
            // Bình Dương districts
            'tdm': ' Thành phố Thủ Dầu Một',
            'da': ' Thành phố Dĩ An',
            'ta': ' Thành phố Thuận An',
            // Đồng Nai districts
            'bh': ' Thành phố Biên Hòa',
            'lk': ' Thành phố Long Khánh'
        };
        const trailing = match.match(/[\s,]$/)?.[0] || '';
        return cityMap[city.toLowerCase()] + trailing;
    });
    
    // Pattern 3.5: Province abbreviations (common 2-letter codes)
    // IMPORTANT: These must be at word boundaries to avoid false matches
    // CONFLICT HANDLING: Some codes are ambiguous, prioritize most common usage
    
    // 4-letter codes (no conflicts)
    processedAddress = processedAddress.replace(/\bbrvt\b/gi, 'Bà Rịa - Vũng Tàu');
    processedAddress = processedAddress.replace(/\btth\b/gi, 'Thừa Thiên Huế');
    processedAddress = processedAddress.replace(/\bbtr\b/gi, 'Bến Tre');
    
    // 2-letter codes - UNAMBIGUOUS (safe to expand)
    processedAddress = processedAddress.replace(/\bbn\b/gi, 'Bắc Ninh');
    processedAddress = processedAddress.replace(/\bbg\b/gi, 'Bắc Giang');
    processedAddress = processedAddress.replace(/\bbk\b/gi, 'Bắc Kạn');
    processedAddress = processedAddress.replace(/\bhb\b/gi, 'Hòa Bình');
    processedAddress = processedAddress.replace(/\bhy\b/gi, 'Hưng Yên');
    processedAddress = processedAddress.replace(/\bls\b/gi, 'Lạng Sơn');
    processedAddress = processedAddress.replace(/\blc\b/gi, 'Lào Cai');
    processedAddress = processedAddress.replace(/\bnb\b/gi, 'Ninh Bình');
    processedAddress = processedAddress.replace(/\bpt\b/gi, 'Phú Thọ');
    processedAddress = processedAddress.replace(/\bsl\b/gi, 'Sơn La');
    processedAddress = processedAddress.replace(/\btb\b/gi, 'Thái Bình');
    processedAddress = processedAddress.replace(/\btq\b/gi, 'Tuyên Quang');
    processedAddress = processedAddress.replace(/\bvp\b/gi, 'Vĩnh Phúc');
    processedAddress = processedAddress.replace(/\byb\b/gi, 'Yên Bái');
    processedAddress = processedAddress.replace(/\bna\b/gi, 'Nghệ An');
    processedAddress = processedAddress.replace(/\bht\b/gi, 'Hà Tĩnh');
    processedAddress = processedAddress.replace(/\bqb\b/gi, 'Quảng Bình');
    processedAddress = processedAddress.replace(/\bqt\b/gi, 'Quảng Trị');
    processedAddress = processedAddress.replace(/\bqng\b/gi, 'Quảng Ngãi');
    processedAddress = processedAddress.replace(/\bpy\b/gi, 'Phú Yên');
    // FIXED: Only match "kh" as standalone abbreviation, not as part of other words
    // Use lookahead/lookbehind to ensure it's surrounded by spaces or punctuation
    processedAddress = processedAddress.replace(/(?<=^|\s|,)kh(?=\s|,|$)/gi, 'Khánh Hòa');
    processedAddress = processedAddress.replace(/\bnt\b/gi, 'Ninh Thuận');
    processedAddress = processedAddress.replace(/\bgl\b/gi, 'Gia Lai');
    processedAddress = processedAddress.replace(/\bkt\b/gi, 'Kon Tum');
    processedAddress = processedAddress.replace(/\bld\b/gi, 'Lâm Đồng');
    processedAddress = processedAddress.replace(/\bbp\b/gi, 'Bình Phước');
    processedAddress = processedAddress.replace(/\bla\b/gi, 'Long An');
    processedAddress = processedAddress.replace(/\btg\b/gi, 'Tiền Giang');
    processedAddress = processedAddress.replace(/\bvl\b/gi, 'Vĩnh Long');
    processedAddress = processedAddress.replace(/\bdt\b/gi, 'Đồng Tháp');
    processedAddress = processedAddress.replace(/\bag\b/gi, 'An Giang');
    processedAddress = processedAddress.replace(/\bkg\b/gi, 'Kiên Giang');
    processedAddress = processedAddress.replace(/\bbl\b/gi, 'Bạc Liêu');
    processedAddress = processedAddress.replace(/\bcm\b/gi, 'Cà Mau');
    processedAddress = processedAddress.replace(/\bst\b/gi, 'Sóc Trăng');
    processedAddress = processedAddress.replace(/\btv\b/gi, 'Trà Vinh');
    
    // 2-letter codes - AMBIGUOUS (need context or prioritize common usage)
    // BD: Bình Dương (more common) vs Bình Định
    processedAddress = processedAddress.replace(/\bbd\b/gi, 'Bình Dương');
    // BT: Bình Thuận (more common) vs Bến Tre (use BTR)
    processedAddress = processedAddress.replace(/\bbt\b/gi, 'Bình Thuận');
    // DN: Đồng Nai (more common) vs Đắk Nông (use DL for Đắk Lắk region)
    processedAddress = processedAddress.replace(/\bdn\b/gi, 'Đồng Nai');
    // DL: Đắk Lắk (more common than Đồng Nai in this context)
    processedAddress = processedAddress.replace(/\bdl\b/gi, 'Đắk Lắk');
    // TN: Thái Nguyên (more common) vs Tây Ninh
    processedAddress = processedAddress.replace(/\btn\b/gi, 'Thái Nguyên');
    // HG: Hà Giang (Northern, more common) vs Hậu Giang (Southern)
    processedAddress = processedAddress.replace(/\bhg\b/gi, 'Hà Giang');
    // QN: Quảng Ninh (more common) vs Quảng Nam
    processedAddress = processedAddress.replace(/\bqn\b/gi, 'Quảng Ninh');
    // HN: Hà Nam (province) - but be careful with Hà Nội (city, already handled)
    processedAddress = processedAddress.replace(/\bhn\b/gi, 'Hà Nam');
    
    // ENHANCED: Add more common district/city abbreviations across Vietnam
    // CRITICAL: Only use SAFE abbreviations (3+ letters or very specific 2-letter codes)
    // Avoid short codes that appear in common words (nh, th, ph, etc.)
    
    // Bình Dương districts (SAFE - specific to region)
    processedAddress = processedAddress.replace(/\btdm\b/gi, 'Thủ Dầu Một');
    // DA, TA removed - too ambiguous (conflicts with "đa", "ta" in common words)
    processedAddress = processedAddress.replace(/\bbc\b/gi, 'Bến Cát');
    processedAddress = processedAddress.replace(/\btu\b/gi, 'Tân Uyên');
    
    // Đồng Nai districts (SAFE - specific)
    processedAddress = processedAddress.replace(/\bbh\b/gi, 'Biên Hòa');
    processedAddress = processedAddress.replace(/\blk\b/gi, 'Long Khánh');
    // NH removed - conflicts with "nh" in "Bình", "Thanh", "Vinh", etc.
    
    // Long An districts (SAFE - specific)
    processedAddress = processedAddress.replace(/\bcg\b/gi, 'Cần Giuộc');
    processedAddress = processedAddress.replace(/\bbl\b/gi, 'Bến Lức');
    processedAddress = processedAddress.replace(/\bdh\b/gi, 'Đức Hòa');
    // TT removed - conflicts with "thị trấn" abbreviation
    
    // Hà Nội districts (REMOVED - too many conflicts)
    // HK, CG, TX, HD, LB, GL, DA, ML all conflict with common words
    // Users should type full names or use "q." prefix
    
    // Major cities (SAFE - 3+ letters or very specific)
    processedAddress = processedAddress.replace(/\bhue\b/gi, 'Huế');
    // VT, PT, NT, QN, VL, DL, BMT removed - too ambiguous
    // Users should use "tp" prefix: "tp VT", "tp NT", etc.
    
    // Pattern 4: "hồ chí minh" (without "thành phố") → add prefix
    // IMPORTANT: Check if "Thành phố" already exists before it
    processedAddress = processedAddress.replace(/(?<!thành phố\s)\b(ho chi minh|hồ chí minh)\b/gi, 'Thành phố Hồ Chí Minh');
    
    // Pattern 5: "hà nội" (without "thành phố") → add prefix  
    // IMPORTANT: Check if "Thành phố" already exists before it
    // DISABLED: This causes issues with n-gram matching (e.g., "Dong Cao Mê Linh Hà Nội" → loses "Dong Cao")
    // processedAddress = processedAddress.replace(/(?<!thành phố\s)\b(ha noi|hà nội)\b/gi, 'Thành phố Hà Nội');
    
    // Pattern 6: "tp HCM", "tp HN" at end → add comma before
    // Example: "quận Tân Phú tp HCM" → "quận Tân Phú, tp HCM"
    // IMPORTANT: Also handle "TPHcM" (mixed case without space)
    // Then Pattern 1-2 will expand "tp HCM" → "Thành phố Hồ Chí Minh"
    processedAddress = processedAddress.replace(/\s+(tp\s*h[cn]m?|tph[cn]m?)\b/gi, ', $1');
    
    // Normalize "Ấp3" → "Ấp 3" (add space between Ấp and number)
    processedAddress = processedAddress.replace(/\b([ấấĂăÂâ]p)(\d+)\b/gi, '$1 $2');
    
    // Normalize Tây Nguyên place names (Đắk Lắk, Ea Súp, M'Đrắk...)
    // IMPORTANT: Match full province/district names first (most specific)
    // "tỉnh đaklak" → "tỉnh Đắk Lắk", "huyện easup" → "huyện Ea Súp"
    
    // Province level (highest priority) - with and without prefix
    // Đắk Lắk - MANY VARIANTS (customers often misspell)
    // IMPORTANT: "ă" vs "ắ" - both must be handled!
    processedAddress = processedAddress.replace(/\b(tinh|tỉnh)\s+(dak\s*lak|đak\s*lak|dac\s*lac|đắc\s*lắc|daklak|đaklak|đăklăk|đắklắk|daclac|đắclắc|dak\s*lac|đak\s*lac|dac\s*lak|đắc\s*lak|đăk\s*lăk)\b/gi, 'Tỉnh Đắk Lắk');
    // Đắk Nông - variants
    processedAddress = processedAddress.replace(/\b(tinh|tỉnh)\s+(dak\s*nong|đak\s*nông|dac\s*nong|đắc\s*nông|daknong|đaknông|dacnong|đắcnông|đăk\s*nông)\b/gi, 'Tỉnh Đắk Nông');
    // Other provinces
    processedAddress = processedAddress.replace(/\b(tinh|tỉnh)\s+(gia\s*lai|gialai)\b/gi, 'Tỉnh Gia Lai');
    processedAddress = processedAddress.replace(/\b(tinh|tỉnh)\s+(kon\s*tum|kontum)\b/gi, 'Tỉnh Kon Tum');
    processedAddress = processedAddress.replace(/\b(tinh|tỉnh)\s+(lam\s*dong|lâm\s*đồng|lamdong|lâmđồng)\b/gi, 'Tỉnh Lâm Đồng');
    
    // Province names WITHOUT prefix (standalone) - Đắk Lắk variants
    // CRITICAL: \b doesn't work with Unicode! Use (?:^|[,\s]) and (?:[,\s]|$) instead
    processedAddress = processedAddress.replace(/(?:^|[,\s])(dak\s*lak|daklak|đaklak|đăklăk|đắklắk|dac\s*lac|daclac|đắclắc|dak\s*lac|dac\s*lak|đak\s*lac|đắc\s*lak|đắc\s*lắc|đăk\s*lăk)(?![a-zàáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ])/gi, (match, p1) => {
        // Preserve leading comma/space
        const leading = match.match(/^[,\s]/)?.[0] || '';
        return leading + 'Đắk Lắk';
    });
    processedAddress = processedAddress.replace(/(?:^|[,\s])(dak\s*nong|daknong|đaknông|dac\s*nong|dacnong|đắcnông|đăk\s*nông)(?![a-zàáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ])/gi, (match, p1) => {
        const leading = match.match(/^[,\s]/)?.[0] || '';
        return leading + 'Đắk Nông';
    });
    
    // District/Ward level - EXPANDED with more patterns
    // Ea districts
    processedAddress = processedAddress.replace(/\b(huyen|huyện|tt|thi\s*tran|thị\s*trấn)\s+(ea\s*sup|easup)\b/gi, (match, prefix) => {
        const prefixMap = {
            'huyen': 'Huyện',
            'huyện': 'Huyện',
            'tt': 'Thị trấn',
            'thi tran': 'Thị trấn',
            'thị trấn': 'Thị trấn'
        };
        return `${prefixMap[prefix.toLowerCase().replace(/\s+/g, ' ')] || prefix} Ea Súp`;
    });
    processedAddress = processedAddress.replace(/\b(huyen|huyện)\s+(ea\s*h'?leo|eahleo|eah'leo)\b/gi, "Huyện Ea H'Leo");
    processedAddress = processedAddress.replace(/\b(huyen|huyện)\s+(ea\s*kar|eakar)\b/gi, 'Huyện Ea Kar');
    
    // Krông districts - normalize spacing
    processedAddress = processedAddress.replace(/\b(huyen|huyện)\s+(krong\s*a\s*na|krongana)\b/gi, 'Huyện Krông A Na');
    processedAddress = processedAddress.replace(/\b(huyen|huyện)\s+(krong\s*buk|krongbuk|krông\s*búk)\b/gi, 'Huyện Krông Búk');
    processedAddress = processedAddress.replace(/\b(huyen|huyện)\s+(krong\s*nang|krongnang|krông\s*năng)\b/gi, 'Huyện Krông Năng');
    processedAddress = processedAddress.replace(/\b(huyen|huyện)\s+(krong\s*bong|krongbong|krông\s*bông)\b/gi, 'Huyện Krông Bông');
    processedAddress = processedAddress.replace(/\b(huyen|huyện)\s+(krong\s*pac|krongpac|krông\s*pắc)\b/gi, 'Huyện Krông Pắc');
    processedAddress = processedAddress.replace(/\b(huyen|huyện)\s+(krong\s*no|krongno|krông\s*nô)\b/gi, 'Huyện Krông Nô');
    
    // M' districts
    processedAddress = processedAddress.replace(/\b(huyen|huyện)\s+(m'?drak|mdrak|m'?đrắk)\b/gi, "Huyện M'Đrắk");
    
    // Cu districts
    processedAddress = processedAddress.replace(/\b(huyen|huyện)\s+(cu\s*jut|cujut|cu\s*jút)\b/gi, 'Huyện Cu Jút');
    processedAddress = processedAddress.replace(/\b(huyen|huyện)\s+(cu\s*mgar|cumgar|cu\s*m'gar)\b/gi, "Huyện Cu M'gar");
    
    // Buôn districts
    processedAddress = processedAddress.replace(/\b(huyen|huyện|tx|thi\s*xa|thị\s*xã)\s+(buon\s*don|buôn\s*đôn|buondon)\b/gi, 'Huyện Buôn Đôn');
    processedAddress = processedAddress.replace(/\b(tx|thi\s*xa|thị\s*xã)\s+(buon\s*ho|buôn\s*hồ|buonho)\b/gi, 'Thị xã Buôn Hồ');
    
    // Ea wards - normalize spacing
    processedAddress = processedAddress.replace(/\b(xa|xã)\s+(ea\s*na|eana)\b/gi, 'Xã Ea Na');
    processedAddress = processedAddress.replace(/\b(xa|xã)\s+(ea\s*sin|easin)\b/gi, 'Xã Ea Sin');
    processedAddress = processedAddress.replace(/\b(xa|xã)\s+(ea\s*ngai|eangai)\b/gi, 'Xã Ea Ngai');
    processedAddress = processedAddress.replace(/\b(xa|xã)\s+(ea\s*sol|easol)\b/gi, 'Xã Ea Sol');
    processedAddress = processedAddress.replace(/\b(xa|xã)\s+(ea\s*ral|earal)\b/gi, 'Xã Ea Ral');
    processedAddress = processedAddress.replace(/\b(xa|xã)\s+(ea\s*tul|eatul)\b/gi, 'Xã Ea Tul');
    
    // Cu wards - normalize spacing (Cu Kty, Cu Pui, etc.)
    processedAddress = processedAddress.replace(/\b(xa|xã)\s+(cu\s*kty|cukty|cư\s*kty|cưkty)\b/gi, 'Xã Cu Kty');
    processedAddress = processedAddress.replace(/\b(xa|xã)\s+(cu\s*pui|cupui)\b/gi, 'Xã Cu Pui');
    processedAddress = processedAddress.replace(/\b(xa|xã)\s+(cu\s*bao|cubao)\b/gi, 'Xã Cu Bao');
    
    // Buôn wards
    processedAddress = processedAddress.replace(/\b(xa|xã)\s+(buon\s*ma\s*thuot|buôn\s*ma\s*thuột|buonmathuot)\b/gi, 'Xã Buôn Ma Thuột');
    processedAddress = processedAddress.replace(/\b(xa|xã)\s+(buon\s*trap|buôn\s*trap|buontrap)\b/gi, 'Xã Buôn Trap');
    
    // Ia wards (Gia Lai)
    processedAddress = processedAddress.replace(/\b(xa|xã)\s+(ia\s*grai|iagrai)\b/gi, 'Xã Ia Grai');
    processedAddress = processedAddress.replace(/\b(xa|xã)\s+(ia\s*ly|ialy)\b/gi, 'Xã Ia Ly');
    processedAddress = processedAddress.replace(/\b(xa|xã)\s+(ia\s*nan|ianan)\b/gi, 'Xã Ia Nan');
    
    // General place names (lower priority - only if not already matched above)
    // Đắk Lắk - all variants (with space) - MUST handle ă vs ắ
    // CRITICAL: \b doesn't work with Unicode! Use negative lookahead instead
    processedAddress = processedAddress.replace(/(?:^|[,\s])(dak|đak|dac|đắc|đăk)\s+(lak|lắk|lac|lắc|lăk)(?![a-zàáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ])/gi, (match) => {
        const leading = match.match(/^[,\s]/)?.[0] || '';
        return leading + 'Đắk Lắk';
    });
    processedAddress = processedAddress.replace(/(?:^|[,\s])(dak|đak|dac|đắc|đăk)\s+(nong|nông)(?![a-zàáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ])/gi, (match) => {
        const leading = match.match(/^[,\s]/)?.[0] || '';
        return leading + 'Đắk Nông';
    });
    processedAddress = processedAddress.replace(/\b(ea)\s*(sup|súp)\b/gi, 'Ea Súp');
    processedAddress = processedAddress.replace(/\b(ea)\s*(h'?leo|hleo)\b/gi, "Ea H'Leo");
    processedAddress = processedAddress.replace(/\b(ea)\s*(kar|kăr)\b/gi, 'Ea Kar');
    processedAddress = processedAddress.replace(/\b(ea)\s*(na)\b/gi, 'Ea Na');
    processedAddress = processedAddress.replace(/\b(krong|krông)\s*(a\s*na)\b/gi, 'Krông A Na');
    processedAddress = processedAddress.replace(/\b(krong|krông)\s*(buk|búk)\b/gi, 'Krông Búk');
    processedAddress = processedAddress.replace(/\b(krong|krông)\s*(bong|bông)\b/gi, 'Krông Bông');
    processedAddress = processedAddress.replace(/\b(buon|buôn)\s*(ma\s*thuot|ma\s*thuột)\b/gi, 'Buôn Ma Thuột');
    processedAddress = processedAddress.replace(/\b(cu)\s*(jut|jút)\b/gi, 'Cu Jút');
    processedAddress = processedAddress.replace(/\b(cu)\s*(mgar|m'gar)\b/gi, "Cu M'gar");
    processedAddress = processedAddress.replace(/\b(cu)\s*(kty|cư\s*kty)\b/gi, 'Cu Kty');
    processedAddress = processedAddress.replace(/\b(m)('?)(drak|đrắk)\b/gi, "M'Đrắk");
    processedAddress = processedAddress.replace(/\b(ia)\s*(grai)\b/gi, 'Ia Grai');
    
    // Remove "cũ" and "mới" from district names (for TP.HCM administrative changes)
    // "quận 9 cũ" → "quận 9", "quận 2 mới" → "quận 2"
    // SAFE: Only remove exact words "cũ" and "mới", use lookahead to handle comma/space/end
    processedAddress = processedAddress.replace(/\b(quận|huyện|phường|xã)\s+([^\s,]+)\s+(cũ|mới)(?=\s|,|$)/gi, '$1 $2');
    
    // Remove noise phrases before province names
    // "nay là tp hcm" → "tp hcm", "hiện nay là hà nội" → "hà nội"
    processedAddress = processedAddress.replace(/\b(nay là|hiện nay là|bây giờ là|giờ là)\s+/gi, '');
    
    // Expand ward abbreviations: F17, F.17, f17, f.17 → Phường 17
    // Also: P17, P.17, p17, p.17 → Phường 17
    // IMPORTANT: Don't match "Ấp3" (should remain as "Ấp 3")
    processedAddress = processedAddress.replace(/\b([FP])\.?(\d{1,2})\b/gi, (match, letter, num) => {
        // Check if this is part of "Ấp" or "ấp"
        const beforeMatch = processedAddress.substring(0, processedAddress.indexOf(match));
        if (/[ấấĂăÂâ]$/i.test(beforeMatch)) {
            return match; // Don't replace if preceded by Ấ/ấ/Ă/ă/Â/â
        }
        return `Phường ${num}`;
    });
    
    // Expand district abbreviations: Q8, Q.8, q8, q.8 → Quận 8
    processedAddress = processedAddress.replace(/\bQ\.?(\d{1,2})\b/gi, 'Quận $1');
    
    // Expand ward abbreviations for "X." → "Xã"
    // Example: "X.Tráng Việt" → "Xã Tráng Việt"
    processedAddress = processedAddress.replace(/\bX\./gi, 'Xã ');
    
    // Expand district abbreviations for "H." → "Huyện"
    // Example: "H.Mê Linh" → "Huyện Mê Linh"
    processedAddress = processedAddress.replace(/\bH\./gi, 'Huyện ');
    
    // Expand province abbreviations for "T." → "Tỉnh"
    // Example: "T.Hà Nam" → "Tỉnh Hà Nam"
    processedAddress = processedAddress.replace(/\bT\./gi, 'Tỉnh ');
    
    // CRITICAL: Restore protected place names BEFORE logging
    // This ensures the final address has correct Vietnamese names
    for (const [token, original] of protectedMap.entries()) {
        processedAddress = processedAddress.replace(new RegExp(token, 'g'), original);
    }
    
    if (processedAddress !== addressText) {
        console.log('📝 Expanded abbreviations:', addressText, '→', processedAddress);
        addressText = processedAddress;
    }
    
    // Split by comma OR dash (-) OR period (.)
    // BUT: Don't split if comma is between numbers (e.g., "4,5" = decimal)
    let parts = [];
    let currentPart = '';
    
    for (let i = 0; i < addressText.length; i++) {
        const char = addressText[i];
        const prevChar = i > 0 ? addressText[i - 1] : '';
        const nextChar = i < addressText.length - 1 ? addressText[i + 1] : '';
        
        if ((char === ',' || char === '-' || char === '.') && 
            !(char === ',' && /\d/.test(prevChar) && /\d/.test(nextChar))) {
            // This is a separator (not a decimal comma)
            if (currentPart.trim()) {
                parts.push(currentPart.trim());
            }
            currentPart = '';
        } else {
            currentPart += char;
        }
    }
    
    // Add last part
    if (currentPart.trim()) {
        parts.push(currentPart.trim());
    }
    
    console.log('📝 Address parts (split by comma/dash/period):', parts.length, 'parts');
    
    // ENHANCEMENT: Split parts that contain multiple location keywords
    // Example: "phường 14 quận 8" → ["phường 14", "quận 8"]
    const expandedParts = [];
    
    for (const part of parts) {
        const normalized = removeVietnameseTones(part).toLowerCase();
        
        // Check if part contains multiple administrative levels
        const hasWard = /\b(phuong|xa|thi tran|tt|khom)\b/.test(normalized);
        const hasDistrict = /\b(quan|huyen|thanh pho|tp|thi xa|tx)\b/.test(normalized);
        const hasProvince = /\b(tinh)\b/.test(normalized);
        
        const levelCount = [hasWard, hasDistrict, hasProvince].filter(Boolean).length;
        
        console.log(`  🔍 Checking part: "${part}"`);
        console.log(`     hasWard: ${hasWard}, hasDistrict: ${hasDistrict}, hasProvince: ${hasProvince}, levelCount: ${levelCount}`);
        
        // Split if has ward keyword (even if levelCount = 1)
        // This helps extract ward name for better district matching
        // Example: "Thuỳ Trang khóm 3 thị trấn Năm Căn" → ["Thuỳ Trang khóm 3", "thị trấn Năm Căn"]
        if (hasWard || levelCount > 1) {
            console.log(`  📌 Part has ${levelCount} admin levels: "${part}"`);
            console.log(`     Normalized: "${normalized}"`);
            console.log(`     hasWard: ${hasWard}, hasDistrict: ${hasDistrict}, hasProvince: ${hasProvince}`);
            
            // Simple split by common patterns
            // Pattern: "xã X huyện Y tỉnh Z" → split into 3 parts
            let subParts = [];
            
            // STRATEGY: Split by keywords in order: street → ward → district → province
            let remainingText = part;
            let streetPortion = ''; // Track street address before ward
            
            // Step 1: Extract ward (if exists)
            if (hasWard) {
                // IMPROVED STRATEGY: Find all keyword positions, then extract between them
                // Example: "thôn Tân Dương [xã Nhơn An] [thị xã An Nhơn] [tỉnh Bình Định]"
                // Extract: street="thôn Tân Dương", ward="xã Nhơn An", district="thị xã An Nhơn", province="tỉnh Bình Định"
                
                // Find all administrative keyword positions (2-word keywords first, then 1-word)
                // IMPORTANT: Order matters - check 2-word patterns first to avoid false matches
                const keywords = [
                    { pattern: /\b(thị xã|thi xa)\s+/gi, type: 'district', words: 2 },
                    { pattern: /\b(thị trấn|thi tran)\s+/gi, type: 'ward', words: 2 },
                    { pattern: /\b(thành phố|thanh pho)\s+/gi, type: 'district', words: 2 },
                    { pattern: /\b(xã|xa)\s+/gi, type: 'ward', words: 1 },
                    { pattern: /\b(phường|phuong)\s+/gi, type: 'ward', words: 1 },
                    { pattern: /\b(quận|quan)\s+/gi, type: 'district', words: 1 },
                    { pattern: /\b(huyện|huyen)\s+/gi, type: 'district', words: 1 },
                    { pattern: /\b(tỉnh|tinh)\s+/gi, type: 'province', words: 1 },
                    { pattern: /\b(khóm|khom)\s+/gi, type: 'ward', words: 1 },
                    { pattern: /\b(ấp|ap)\s+/gi, type: 'locality', words: 1 },
                    { pattern: /\b(thôn|thon)\s+/gi, type: 'locality', words: 1 },
                    { pattern: /\b(xóm|xom)\s+/gi, type: 'locality', words: 1 },
                    { pattern: /\b(tt)\s+/gi, type: 'ward', words: 1 },
                    { pattern: /\b(tp)\s+/gi, type: 'district', words: 1 },
                    { pattern: /\b(tx)\s+/gi, type: 'district', words: 1 }
                ];
                
                // Find all keyword positions
                let positions = [];
                for (const kw of keywords) {
                    const matches = [...remainingText.matchAll(kw.pattern)];
                    for (const match of matches) {
                        positions.push({
                            index: match.index,
                            keyword: match[0],
                            type: kw.type,
                            words: kw.words,
                            length: match[0].length
                        });
                    }
                }
                
                // CRITICAL FIX: Remove overlapping keywords (keep longer ones)
                // Example: "thị xã" at index 33 should remove "xã" at index 37
                positions.sort((a, b) => {
                    if (a.index !== b.index) return a.index - b.index;
                    return b.words - a.words; // Prefer longer keywords
                });
                
                const filteredPositions = [];
                for (let i = 0; i < positions.length; i++) {
                    const current = positions[i];
                    const isOverlapping = filteredPositions.some(p => {
                        // Check if current overlaps with any already added position
                        const pEnd = p.index + p.length;
                        const currentEnd = current.index + current.length;
                        return (current.index >= p.index && current.index < pEnd) ||
                               (p.index >= current.index && p.index < currentEnd);
                    });
                    
                    if (!isOverlapping) {
                        filteredPositions.push(current);
                    }
                }
                
                positions = filteredPositions;
                
                console.log(`    🔍 Found ${positions.length} keywords:`, positions.map(p => `"${p.keyword}" at ${p.index}`).join(', '));
                
                if (positions.length > 0) {
                    // Extract street (before first keyword)
                    if (positions[0].index > 0) {
                        streetPortion = remainingText.substring(0, positions[0].index).trim();
                        if (streetPortion) {
                            console.log(`    → Split street: "${streetPortion}"`);
                            subParts.push(streetPortion);
                        }
                    }
                    
                    // IMPROVED: Smart extraction with ward name detection
                    // Strategy: Extract ward name (1-3 words after keyword), then continue
                    // Example: "xa thuan thanh can giuoc long an" → "xa thuan thanh" + "can giuoc long an"
                    for (let i = 0; i < positions.length; i++) {
                        const current = positions[i];
                        const next = positions[i + 1];
                        
                        let endIndex;
                        if (next) {
                            // Extract until next keyword
                            endIndex = next.index;
                        } else {
                            // Last keyword - need to determine where ward name ends
                            // CRITICAL FIX: Check if part has MULTIPLE admin levels before splitting
                            // Example: "Xã Tân Bình" (1 level) → DON'T split
                            // Example: "Xã Tân Bình Huyện Vĩnh Cửu" (2 levels) → DO split
                            
                            const afterKeyword = remainingText.substring(current.index + current.keyword.length).trim();
                            const afterKeywordNormalized = removeVietnameseTones(afterKeyword).toLowerCase();
                            
                            // Check if there's another admin level keyword after this ward
                            const hasDistrictKeyword = /\b(quan|huyen|thi xa|tx)\b/.test(afterKeywordNormalized);
                            const hasProvinceKeyword = /\b(tinh|thanh pho|tp)\b/.test(afterKeywordNormalized);
                            
                            if (!hasDistrictKeyword && !hasProvinceKeyword) {
                                // Only ward keyword, no other admin levels → Don't split
                                console.log(`    ⏭️ Part has ONLY ward keyword, no split needed`);
                                endIndex = remainingText.length;
                            } else {
                                // Has multiple admin levels → Need to split
                                console.log(`    🔍 Part has multiple admin levels, attempting split...`);
                                
                                // SMART STRATEGY: Ward names are typically 1-3 words
                                // Extract 1-3 words after keyword, rest is district/province
                                
                                const words = afterKeyword.split(/\s+/);
                                
                                console.log(`    🔍 Analyzing last keyword "${current.keyword}" with ${words.length} words after: [${words.join(', ')}]`);
                                
                                // IMPROVED: Check if remaining words match district/province names
                                // Check each possible split point and see if remaining matches known locations
                                let wardWordCount = Math.min(2, words.length); // Default: 2 words
                                let bestSplitScore = 0;
                                
                                // CRITICAL: Check if this is "Thành phố Hồ Chí Minh" (special case)
                                // Don't split it!
                                const fullText = current.keyword + words.join(' ');
                                const fullTextNormalized = removeVietnameseTones(fullText).toLowerCase();
                                
                                if (fullTextNormalized === 'thanh pho ho chi minh' || fullTextNormalized === 'tp ho chi minh') {
                                    // This is the full province name - don't split!
                                    wardWordCount = 0; // No ward, all is province
                                    bestSplitScore = 10.0; // Highest priority
                                    console.log(`    ✅✅✅ Detected full province name: "${fullText}" → no split needed`);
                                } else if (words.length >= 2) {
                                const knownDistrictPatterns = [
                                    // HCMC districts
                                    /\b(go vap|gò vấp)\b/i,
                                    /\b(tan binh|tân bình)\b/i,
                                    /\b(binh thanh|bình thạnh)\b/i,
                                    /\b(phu nhuan|phú nhuận)\b/i,
                                    /\b(tan phu|tân phú)\b/i,
                                    /\b(binh tan|bình tân)\b/i,
                                    /\b(thu duc|thủ đức)\b/i,
                                    /\b(binh chanh|bình chánh)\b/i,
                                    /\b(hoc mon|hóc môn)\b/i,
                                    /\b(nha be|nhà bè)\b/i,
                                    /\b(can gio|cần giờ)\b/i,
                                    /\b(cu chi|củ chi)\b/i,
                                    // Bình Dương districts
                                    /\b(thu dau mot|thủ dầu một)\b/i,
                                    /\b(di an|dĩ an)\b/i,
                                    /\b(thuan an|thuận an)\b/i,
                                    /\b(ben cat|bến cát)\b/i,
                                    /\b(tan uyen|tân uyên)\b/i,
                                    /\b(bau bang|bàu bàng)\b/i,
                                    /\b(dau tieng|dầu tiếng)\b/i,
                                    /\b(phu giao|phú giáo)\b/i,
                                    /\b(bac tan uyen|bắc tân uyên)\b/i,
                                    // Long An districts
                                    /\b(can giuoc|cần giuộc)\b/i,
                                    /\b(tan an|tân an)\b/i,
                                    /\b(ben luc|bến lức)\b/i,
                                    /\b(duc hoa|đức hòa)\b/i,
                                    /\b(thu thua|thủ thừa)\b/i,
                                    // Nghệ An districts
                                    /\b(thanh chuong|thanh chương)\b/i,
                                    /\b(nghi loc|nghi lộc)\b/i,
                                    /\b(nam dan|nam đàn)\b/i
                                ];
                                
                                // Check last 2-3 words
                                for (let lastWordCount = 3; lastWordCount >= 2; lastWordCount--) {
                                    const lastWords = words.slice(-lastWordCount).join(' ');
                                    const lastWordsNormalized = removeVietnameseTones(lastWords).toLowerCase();
                                    
                                    let foundPattern = false;
                                    for (const pattern of knownDistrictPatterns) {
                                        if (pattern.test(lastWordsNormalized)) {
                                            // IMPORTANT: Verify that the match is the FULL lastWords, not a substring
                                            // Example: "14 gò vấp" should NOT match pattern "gò vấp" for 3 words
                                            // Only "gò vấp" (2 words) should match
                                            
                                            const match = lastWordsNormalized.match(pattern);
                                            if (match && match[0]) {
                                                const matchedText = match[0].trim();
                                                const matchedWords = matchedText.split(/\s+/).length;
                                                
                                                // Only accept if matched word count equals lastWordCount
                                                // OR if lastWords is exactly the matched text
                                                if (matchedWords === lastWordCount || lastWordsNormalized === matchedText) {
                                                    wardWordCount = words.length - lastWordCount;
                                                    bestSplitScore = 3.0;
                                                    foundPattern = true;
                                                    console.log(`    ✅✅ Found district in LAST ${lastWordCount} words: "${lastWords}" → ward=${wardWordCount} words`);
                                                    break;
                                                } else {
                                                    console.log(`    ⚠️ Pattern matched but word count mismatch: "${lastWords}" (${lastWordCount} words) vs pattern "${matchedText}" (${matchedWords} words)`);
                                                }
                                            }
                                        }
                                    }
                                    if (foundPattern) break;
                                }
                            }
                            
                            if (bestSplitScore < 3.0 && words.length > 2) {
                                // Try different split points (1-3 words for ward)
                                // IMPORTANT: Try from LONGEST to SHORTEST (3→2→1)
                                // This prefers more specific ward names
                                // Example: "thuan thanh" (2 words) is better than "thuan" (1 word)
                                for (let splitPoint = Math.min(3, words.length - 2); splitPoint >= 1; splitPoint--) {
                                    const possibleWard = words.slice(0, splitPoint).join(' ');
                                    const possibleLocation = words.slice(splitPoint).join(' ');
                                    
                                    console.log(`    🔍 Try split: ward="${possibleWard}" | location="${possibleLocation}"`);
                                    
                                    // Check if possibleLocation contains district/province keywords
                                    const locationNormalized = removeVietnameseTones(possibleLocation).toLowerCase();
                                    const hasLocationKeyword = /\b(quan|huyen|tinh|thanh pho|tp|thi xa|tx)\b/.test(locationNormalized);
                                    
                                    if (hasLocationKeyword) {
                                        wardWordCount = splitPoint;
                                        console.log(`    ✅ Found location keyword in remaining, ward is ${wardWordCount} words`);
                                        break;
                                    }
                                    
                                    // IMPROVED: Check if possibleLocation matches known district/province names
                                    // This is more accurate than just counting words
                                    let locationScore = 0;
                                    
                                    // Quick check: does it contain common district/province name patterns?
                                    // PRIORITY: District names (score 2.0) > Province names (score 1.0)
                                    // Example: "can giuoc long an" → "can giuoc" (district) should win over "long an" (province)
                                    const districtPatterns = [
                                        /\b(tan an|tân an)\b/i,
                                        /\b(can giuoc|cần giuộc)\b/i,
                                        /\b(ben luc|bến lức)\b/i,
                                        /\b(duc hoa|đức hòa)\b/i,
                                        /\b(thu thua|thủ thừa)\b/i,
                                        /\b(moc hoa|mộc hóa)\b/i,
                                        /\b(tan hung|tân hưng)\b/i,
                                        /\b(vinh hung|vĩnh hưng)\b/i,
                                        /\b(tan thanh|tân thạnh)\b/i,
                                        /\b(thanh hoa|thạnh hóa)\b/i,
                                        /\b(duc hue|đức huệ)\b/i,
                                        /\b(can duoc|cần đước)\b/i
                                    ];
                                    
                                    const provincePatterns = [
                                        /\b(long an)\b/i
                                    ];
                                    
                                    // Check district patterns first (higher priority)
                                    for (const pattern of districtPatterns) {
                                        if (pattern.test(possibleLocation)) {
                                            locationScore = 2.0; // Higher score for district
                                            console.log(`    ✅ Found district pattern in "${possibleLocation}" (split at ${splitPoint})`);
                                            break;
                                        }
                                    }
                                    
                                    // If no district, check province patterns
                                    if (locationScore === 0) {
                                        for (const pattern of provincePatterns) {
                                            if (pattern.test(possibleLocation)) {
                                                locationScore = 1.0; // Lower score for province only
                                                console.log(`    ⚠️ Found province pattern in "${possibleLocation}" (split at ${splitPoint})`);
                                                break;
                                            }
                                        }
                                    }
                                    
                                    // If no pattern match, use word count heuristic
                                    if (locationScore === 0 && words.length - splitPoint >= 2) {
                                        locationScore = 0.5;
                                        console.log(`    ⚠️ Remaining has ${words.length - splitPoint} words, possibly location`);
                                    }
                                    
                                    if (locationScore > bestSplitScore) {
                                        bestSplitScore = locationScore;
                                        wardWordCount = splitPoint;
                                        console.log(`    📊 New best split: ${splitPoint} words for ward (score: ${locationScore})`);
                                    }
                                    
                                    // Don't break early - check all split points to find best match
                                    // Example: "thuan thanh can giuoc" → try 1,2,3 words
                                    // splitPoint=1: "thanh can giuoc" has "can giuoc" (score 1.0)
                                    // splitPoint=2: "can giuoc" has "can giuoc" (score 1.0)
                                    // Both have same score, but splitPoint=2 is better (more specific ward name)
                                }
                            }
                            
                            // Extract ward part
                            const wardPart = current.keyword + words.slice(0, wardWordCount).join(' ');
                            subParts.push(wardPart.trim());
                            console.log(`    → Split ${current.type}: "${wardPart.trim()}"`);
                            
                            // Extract remaining as separate part (district/province)
                            if (words.length > wardWordCount) {
                                const remainingPart = words.slice(wardWordCount).join(' ');
                                subParts.push(remainingPart.trim());
                                console.log(`    → Split remaining: "${remainingPart.trim()}"`);
                            }
                            
                            continue; // Skip normal extraction below
                            } // End of else block (has multiple admin levels)
                        }
                        
                        const part = remainingText.substring(current.index, endIndex).trim();
                        if (part) {
                            subParts.push(part);
                            console.log(`    → Split ${current.type}: "${part}"`);
                        }
                    }
                } else {
                    console.log(`    ⚠️ Ward keyword found in check but no positions found`);
                }
            }
            
            // Step 2: Extract district (if exists)
            if (hasDistrict && remainingText) {
                const districtMatch = remainingText.match(/(quận|huyện|thành phố|tp|thị xã|tx)\s+([^,]+?)(?=\s*(?:tỉnh|tinh|thành phố|tp)|$)/i);
                if (districtMatch) {
                    let districtPart = districtMatch[0].trim();
                    
                    // SMART FIX: Check if district part contains a province name at the end
                    // Example: "huyện Vĩnh Hưng Long An" → split into "huyện Vĩnh Hưng" + "Long An"
                    const districtNormalized = removeVietnameseTones(districtPart).toLowerCase();
                    
                    let foundProvinceSplit = false;
                    
                    for (const province of vietnamAddressData) {
                        const provinceName = removeVietnameseTones(province.Name.replace(/^(Tỉnh|Thành phố)\s+/i, '')).toLowerCase();
                        
                        // Check if district part ends with province name
                        if (districtNormalized.endsWith(provinceName) && provinceName.length >= 4) {
                            // Found province name at end - split it
                            const provinceStartIndex = districtPart.length - provinceName.length;
                            
                            // Look backwards for space before province name
                            let splitIndex = provinceStartIndex;
                            while (splitIndex > 0 && districtPart[splitIndex - 1] !== ' ') {
                                splitIndex--;
                            }
                            
                            if (splitIndex > 0) {
                                const actualDistrict = districtPart.substring(0, splitIndex).trim();
                                const actualProvince = districtPart.substring(splitIndex).trim();
                                
                                // Verify the split makes sense
                                const districtWords = actualDistrict.split(/\s+/);
                                if (districtWords.length >= 2) {
                                    districtPart = actualDistrict;
                                    subParts.push(districtPart);
                                    console.log(`    → Split district: "${districtPart}"`);
                                    
                                    // Add province part
                                    subParts.push(actualProvince);
                                    console.log(`    → Split province (inferred): "${actualProvince}"`);
                                    
                                    foundProvinceSplit = true;
                                    break;
                                }
                            }
                        }
                    }
                    
                    if (!foundProvinceSplit) {
                        subParts.push(districtPart);
                        console.log(`    → Split district: "${districtPart}"`);
                    }
                    
                    // Remove district from remaining text
                    remainingText = remainingText.substring(districtMatch.index + districtMatch[0].length).trim();
                }
            }
            
            // Step 3: Extract province (if exists)
            if (hasProvince && remainingText) {
                const provinceMatch = remainingText.match(/(tỉnh|tinh|thành phố|tp)\s+.+/i);
                if (provinceMatch) {
                    const provincePart = provinceMatch[0].trim();
                    subParts.push(provincePart);
                    console.log(`    → Split province: "${provincePart}"`);
                }
            }
            
            if (subParts.length > 0) {
                expandedParts.push(...subParts);
            } else {
                console.log(`    ⚠️ Failed to split, keeping original`);
                expandedParts.push(part);
            }
        } else {
            expandedParts.push(part);
        }
    }
    
    parts = expandedParts;
    console.log('📝 Expanded parts:', parts.length, 'parts -', parts);
    
    // IMPORTANT: Save original full address before n-gram processing
    // This is needed for correct street address extraction later
    const originalFullAddress = addressText;
    
    // If no commas, split by spaces and create n-grams
    if (parts.length === 1) {
        console.log('⚠️ No commas found, using n-gram approach');
        const words = addressText.split(/\s+/).filter(w => w.length > 0);
        console.log('📝 Words:', words.length, 'words');
        
        // STRATEGY: For addresses without commas, try to identify district/ward by keywords first
        // Then infer province from district
        // Example: "26 duong so 6 thôn phú tây điện quang điện bàn quảng nam"
        // → Should identify "điện bàn" as district, "điện quang" as ward, then infer "quảng nam" as province
        
        // Check if text contains district/ward keywords
        const normalized = removeVietnameseTones(addressText).toLowerCase();
        const hasDistrictKeyword = /(quan|huyen|thanh pho|tp|thi xa|tx)\s+/i.test(addressText);
        const hasWardKeyword = /(phuong|xa|thi tran|tt)\s+/i.test(addressText);
        
        if (hasDistrictKeyword || hasWardKeyword) {
            console.log('📍 Found district/ward keywords, will prioritize finding district first');
            // Generate n-grams but will search for district first (see below)
        }
        
        // ============================================
        // OPTIMIZATION: Smart N-gram Generation
        // ============================================
        let originalNGrams = null;
        
        if (OPTIMIZATION_FLAGS.NGRAM_LIMIT) {
            console.log('🚀 Optimization: N-gram limit enabled');
            
            // Strategy 1: Reduce maxN from 4 to 3 (giảm 50% n-grams)
            // Safe: 3-word phrases vẫn đủ cho hầu hết địa danh
            const maxN = 3; // Was 4
            const minN = 2; // Keep same
            
            // Strategy 2: Smart word selection - prioritize location keywords AND known place names
            // IMPROVED: Detect common 2-word place names and keep them together
            let wordsToUse = words;
            
            if (words.length > 6) {
                // IMPROVED: Check for common 2-word place names first
                const commonPlaceNames = [
                    'phan thiet', 'nha trang', 'vung tau', 'da lat', 'quy nhon',
                    'bien hoa', 'long xuyen', 'rach gia', 'ca mau', 'bac lieu',
                    'ha noi', 'da nang', 'hai phong', 'can tho', 'vinh long',
                    'tan binh', 'tan phu', 'binh thanh', 'go vap', 'thu duc',
                    'phu nhuan', 'binh tan', 'dong anh', 'gia lam', 'long bien',
                    'cau giay', 'ha dong', 'thanh xuan', 'me linh', 'soc son',
                    'phu hoa', 'phu hoai', 'tan thanh', 'binh hung', 'an phu'
                ];
                
                // Find if any 2-word place name exists in the address
                const addressNormalized = removeVietnameseTones(addressText).toLowerCase();
                let foundPlaceName = null;
                let placeNameIndex = -1;
                
                for (const placeName of commonPlaceNames) {
                    const index = addressNormalized.indexOf(placeName);
                    if (index !== -1) {
                        foundPlaceName = placeName;
                        // Find word index in words array
                        const beforePlace = addressNormalized.substring(0, index).trim();
                        placeNameIndex = beforePlace.split(/\s+/).filter(w => w.length > 0).length;
                        console.log(`  🎯 Found place name: "${placeName}" at word index ${placeNameIndex}`);
                        break;
                    }
                }
                
                // Check if any word is a location keyword (Quận, Huyện, Phường, Xã...)
                const locationKeywordIndices = [];
                const locationKeywords = ['quan', 'huyen', 'phuong', 'xa', 'thi', 'thanh', 'tinh'];
                
                for (let i = 0; i < words.length; i++) {
                    const wordNormalized = removeVietnameseTones(words[i]).toLowerCase();
                    if (locationKeywords.some(kw => wordNormalized.includes(kw))) {
                        locationKeywordIndices.push(i);
                    }
                }
                
                // If we have place name or location keywords, include them + surrounding words
                if (foundPlaceName || locationKeywordIndices.length > 0) {
                    const importantIndices = new Set();
                    
                    // Add place name indices (2 consecutive words)
                    if (foundPlaceName && placeNameIndex >= 0 && placeNameIndex + 1 < words.length) {
                        importantIndices.add(placeNameIndex);
                        importantIndices.add(placeNameIndex + 1);
                        console.log(`  📍 Keeping place name: "${words[placeNameIndex]} ${words[placeNameIndex + 1]}"`);
                    }
                    
                    // Add location keyword indices + 1 word after each
                    for (const idx of locationKeywordIndices) {
                        importantIndices.add(idx);
                        if (idx + 1 < words.length) importantIndices.add(idx + 1);
                    }
                    
                    // Always include last 4 words (province info) - but avoid duplicates
                    for (let i = Math.max(0, words.length - 4); i < words.length; i++) {
                        importantIndices.add(i);
                    }
                    
                    // Build wordsToUse from important indices
                    const sortedIndices = Array.from(importantIndices).sort((a, b) => a - b);
                    wordsToUse = sortedIndices.map(i => words[i]);
                    
                    console.log('  📝 Smart selection: keeping', wordsToUse.length, 'important words (from', words.length, 'words)');
                    console.log('  📝 Selected words:', wordsToUse.join(' '));
                } else {
                    // No location keywords or place names - use last 6 words (original strategy)
                    wordsToUse = words.slice(-6);
                    console.log('  📝 Using last', wordsToUse.length, 'words (optimized from', words.length, 'words)');
                }
            }
            
            // Generate optimized n-grams
            const optimizedNGrams = generateNGrams(wordsToUse, minN, maxN);
            
            // Keep original for rollback
            const originalWordsToUse = words.length > 8 ? words.slice(-8) : words;
            originalNGrams = generateNGrams(originalWordsToUse, 2, 4);
            
            console.log(`  📊 N-grams: ${originalNGrams.length} → ${optimizedNGrams.length} (${Math.round((1 - optimizedNGrams.length/originalNGrams.length) * 100)}% reduction)`);
            
            OPTIMIZATION_METRICS.ngramReduction = originalNGrams.length - optimizedNGrams.length;
            
            // Validation: If optimization produces too few n-grams, rollback
            if (optimizedNGrams.length < 5 && originalNGrams.length >= 10) {
                console.warn('  ⚠️ Too few n-grams, rolling back to original');
                parts = originalNGrams;
                OPTIMIZATION_METRICS.rollbackCount++;
            } else {
                parts = optimizedNGrams;
            }
        } else {
            // Original logic (unchanged)
            const wordsToUse = words.length > 8 ? words.slice(-8) : words;
            
            if (words.length > 8) {
                console.log('📝 Using last', wordsToUse.length, 'words (optimized from', words.length, 'words)');
            }
            
            parts = generateNGrams(wordsToUse, 2, 4); // 2-4 word combinations (skip single words for now)
            console.log('📝 Generated', parts.length, 'n-grams (2-4 words)');
        }
    }
    
    // Step 1: Find Province - PRIORITIZE PROVINCE HINT from Dictionary
    console.log('🔍 Step 1: Finding Province...');
    
    // CRITICAL: If provinceHint exists from dictionary, use it IMMEDIATELY
    if (provinceHint) {
        console.log(`  🎯 Province hint from dictionary: "${provinceHint}"`);
        
        // Map common abbreviations to full names
        const provinceHintMap = {
            'TP.HCM': 'Thành phố Hồ Chí Minh',
            'TPHCM': 'Thành phố Hồ Chí Minh',
            'HCM': 'Thành phố Hồ Chí Minh',
            'Sài Gòn': 'Thành phố Hồ Chí Minh',
            'TP.HN': 'Thành phố Hà Nội',
            'TPHN': 'Thành phố Hà Nội',
            'HN': 'Thành phố Hà Nội',
            'TP.ĐN': 'Thành phố Đà Nẵng',
            'ĐN': 'Thành phố Đà Nẵng'
        };
        
        const mappedHint = provinceHintMap[provinceHint] || provinceHint;
        
        // Find exact province match
        for (const province of vietnamAddressData) {
            if (province.Name === mappedHint || 
                province.Name.includes(mappedHint) ||
                mappedHint.includes(province.Name)) {
                result.province = province;
                result.confidence = 'high';
                console.log(`  ✅ Province matched (from hint): ${result.province.Name}`);
                break;
            }
        }
        
        // If found, skip normal province search
        if (result.province) {
            console.log(`  ⏭️ Skipping normal province search (using hint)`);
        }
    }
    
    // IMPROVED: Check for known place names in ORIGINAL address FIRST
    // This prevents n-gram from breaking up place names like "phan thiết"
    if (!result.province) {
        const commonCities = [
            { name: 'phan thiet', full: 'Thành phố Phan Thiết', province: 'Tỉnh Bình Thuận' },
            { name: 'nha trang', full: 'Thành phố Nha Trang', province: 'Tỉnh Khánh Hòa' },
            { name: 'vung tau', full: 'Thành phố Vũng Tàu', province: 'Tỉnh Bà Rịa - Vũng Tàu' },
            { name: 'da lat', full: 'Thành phố Đà Lạt', province: 'Tỉnh Lâm Đồng' },
            { name: 'quy nhon', full: 'Thành phố Quy Nhơn', province: 'Tỉnh Bình Định' },
            { name: 'bien hoa', full: 'Thành phố Biên Hòa', province: 'Tỉnh Đồng Nai' },
            { name: 'long xuyen', full: 'Thành phố Long Xuyên', province: 'Tỉnh An Giang' },
            { name: 'rach gia', full: 'Thành phố Rạch Giá', province: 'Tỉnh Kiên Giang' },
            { name: 'ca mau', full: 'Thành phố Cà Mau', province: 'Tỉnh Cà Mau' },
            { name: 'bac lieu', full: 'Thành phố Bạc Liêu', province: 'Tỉnh Bạc Liêu' }
        ];
        
        const addressNormalized = removeVietnameseTones(addressText).toLowerCase();
        
        for (const city of commonCities) {
            if (addressNormalized.includes(city.name)) {
                console.log(`  🎯 Detected city: "${city.name}" → ${city.full}`);
                
                // Find province
                const province = vietnamAddressData.find(p => p.Name === city.province);
                if (province) {
                    result.province = province;
                    result.confidence = 'high';
                    console.log(`  ✅ Province matched (from city): ${result.province.Name}`);
                    
                    // Also try to find district
                    const district = province.Districts.find(d => d.Name === city.full);
                    if (district) {
                        result.district = district;
                        console.log(`  ✅ District matched (from city): ${result.district.Name}`);
                    }
                    
                    break;
                }
            }
        }
    }
    
    let bestProvinceMatch = null;
    let bestProvinceScore = 0;
    let bestProvinceWordCount = 0;
    
    // Only search if no province hint or hint not found
    if (!result.province) {
    
    // Common province abbreviations (highest priority)
    const provinceAbbreviations = {
        'hcm': 'Thành phố Hồ Chí Minh',
        'hn': 'Thành phố Hà Nội',
        'dn': 'Thành phố Đà Nẵng',
        'hp': 'Tỉnh Hải Phòng',
        'ct': 'Thành phố Cần Thơ'
    };
    
    // Check for abbreviations first (highest priority)
    for (let i = parts.length - 1; i >= 0; i--) {
        const part = parts[i];
        const normalized = removeVietnameseTones(part).toLowerCase().trim();
        
        if (provinceAbbreviations[normalized]) {
            const targetName = provinceAbbreviations[normalized];
            const match = vietnamAddressData.find(p => p.Name === targetName);
            if (match) {
                bestProvinceMatch = { match, score: 1.0, confidence: 'high' };
                bestProvinceScore = 1.0;
                bestProvinceWordCount = 1;
                console.log(`  ✓ Province abbreviation: "${part}" → ${match.Name} (score: 1.00)`);
                break;
            }
        }
    }
    
    // If no abbreviation found, do normal matching
    if (!bestProvinceMatch) {
        // IMPORTANT: Skip parts with district/ward keywords when looking for province
        // Example: "quận Bình Tân" should NOT be checked for province
        // BUT: Be careful with words like "quảng" which can be part of province name
        const districtWardKeywords = ['phuong', 'xa', 'thi tran', 'tt', 'thi xa', 'tx'];
        // District keywords that should be checked more carefully
        const districtKeywordsCareful = ['quan', 'huyen'];
        
        for (let i = parts.length - 1; i >= 0; i--) {
            const part = parts[i];
            const normalized = removeVietnameseTones(part).toLowerCase().trim();
            const wordCount = part.split(/\s+/).length;
            
            // Skip very short parts (less than 4 chars for provinces)
            if (part.length < 4) continue;
            
            // CRITICAL: Skip parts with ward keywords when looking for province
            // Ward parts like "xa thanh long" should NOT match province "Long An"
            const hasWardKeyword = districtWardKeywords.some(kw => normalized.includes(kw));
            const hasDistrictKeywordSeparate = districtKeywordsCareful.some(kw => {
                const regex = new RegExp(`\\b${kw}\\b`, 'i');
                return regex.test(normalized);
            });
            
            // Skip if has ward keyword (even if >2 words)
            // Example: "xa thanh long" should be skipped even though it's 3 words
            if (hasWardKeyword) {
                console.log(`  ⏭️ Skipping ward keyword part: "${part}"`);
                continue;
            }
            
            // Skip if has district keyword AND only 1-2 words (pure district name like "quan 1")
            if (hasDistrictKeywordSeparate && wordCount <= 2) {
                console.log(`  ⏭️ Skipping short district keyword part (${wordCount} words): "${part}"`);
                continue;
            }
            
            // SPECIAL CASE: "Thành phố X" - check if it's a province first
            // Example: "Thành phố Hà Nội" is a PROVINCE, not a district
            const hasThanhPho = /\b(thanh pho|tp)\b/.test(normalized);
            if (hasThanhPho) {
                // Try to match with provinces first
                const provinceMatch = fuzzyMatch(part, vietnamAddressData, 0.7);
                if (provinceMatch && provinceMatch.score >= 0.7) {
                    // This is a province!
                    const isGoodMatch = provinceMatch.score >= 0.7;
                    const isBestGood = bestProvinceScore >= 0.7;
                    
                    let shouldReplace = false;
                    
                    if (isGoodMatch && !isBestGood) {
                        shouldReplace = true;
                    } else if (isGoodMatch && isBestGood) {
                        shouldReplace = provinceMatch.score > bestProvinceScore + 0.05 ||
                                      (Math.abs(provinceMatch.score - bestProvinceScore) <= 0.05 && wordCount > bestProvinceWordCount);
                    } else {
                        shouldReplace = provinceMatch.score > bestProvinceScore + 0.05 ||
                                      (Math.abs(provinceMatch.score - bestProvinceScore) <= 0.05 && wordCount > bestProvinceWordCount);
                    }
                    
                    if (shouldReplace) {
                        bestProvinceMatch = provinceMatch;
                        bestProvinceScore = provinceMatch.score;
                        bestProvinceWordCount = wordCount;
                        console.log(`  ✓ Province candidate: "${part}" (${wordCount} words) → ${provinceMatch.match.Name} (score: ${provinceMatch.score.toFixed(2)})`);
                    }
                    continue; // Skip district check for this part
                }
            }
            
            const provinceMatch = fuzzyMatch(part, vietnamAddressData, 0.4);
            if (provinceMatch) {
                // PRIORITY: When iterating from END to START (i from high to low)
                // - First good match (score >= 0.7) wins (province usually at end)
                // - For lower scores, prefer higher score or longer phrase
                
                const isGoodMatch = provinceMatch.score >= 0.7;
                const isBestGood = bestProvinceScore >= 0.7;
                
                // ============================================
                // LAYER 3: CONTEXT PENALTY (NEW - Safe)
                // ============================================
                // Apply penalties based on context to filter false matches
                // Rule: Don't change fuzzy matching, only add penalty layer
                
                let adjustedScore = provinceMatch.score;
                const penalties = [];
                
                // Penalty 0: BLACKLIST - Known street names that look like provinces
                // Example: "Nghệ Tĩnh" (street) should NOT match "Nghệ An" or "Hà Tĩnh"
                const streetNameBlacklist = [
                    /nghe\s+tinh/i,  // "Nghệ Tĩnh" street
                    /xo\s+viet/i,    // "Xô Viết" street prefix
                    /cach\s+mang/i,  // "Cách Mạng" street prefix
                    /hai\s+ba\s+trung/i, // "Hai Bà Trưng" street
                    /le\s+loi/i,     // "Lê Lợi" street
                    /tran\s+hung\s+dao/i // "Trần Hưng Đạo" street
                ];
                
                const partNormalized = removeVietnameseTones(part).toLowerCase();
                for (const pattern of streetNameBlacklist) {
                    if (pattern.test(partNormalized)) {
                        adjustedScore = 0; // Complete rejection
                        penalties.push('street_name_blacklist(-100%)');
                        break;
                    }
                }
                
                // Penalty 1: Has slash (/) - likely district abbreviation, not province
                // Example: "B/Thạnh" should not match "Hà Nội"
                if (part.includes('/')) {
                    adjustedScore -= 0.40;
                    penalties.push('has_slash(-0.40)');
                }
                
                // Penalty 2: Too short (<4 chars) without province keyword
                // Example: "HCM" without "TP" prefix
                if (part.length < 4 && !/\b(tinh|thanh pho|tp)\b/i.test(normalized)) {
                    adjustedScore -= 0.30;
                    penalties.push('too_short(-0.30)');
                }
                
                // Penalty 3: No province keyword (tỉnh, thành phố) - STRONGER PENALTY
                // Example: "thanh long" matching "Long An" (no "tỉnh" keyword)
                // IMPROVED: Heavier penalty for single-word matches without keyword
                const hasProvinceKeyword = /\b(tinh|thanh pho|tp)\b/i.test(normalized);
                if (!hasProvinceKeyword) {
                    if (wordCount === 1 && provinceMatch.score < 0.99) {
                        // Single word without keyword - very likely wrong
                        adjustedScore -= 0.50;
                        penalties.push('single_word_no_keyword(-0.50)');
                    } else if (provinceMatch.score < 0.9) {
                        adjustedScore -= 0.30;
                        penalties.push('no_keyword(-0.30)');
                    }
                }
                
                // Penalty 4: Has "Đường" prefix - this is a STREET name, not province
                // Example: "Đường Hà Nội" should NOT match province "Hà Nội"
                // Example: "Đường Sài Gòn" should NOT match province "TP.HCM"
                // IMPROVED: Handle abbreviations and typos: "dg", "đg", "đương" (typo)
                // CRITICAL: Use word boundary to avoid matching "Dương" in "Bình Dương"
                const hasStreetPrefix = /\b(duong|đường|dg|đg|đuong|đương)\s+/i.test(part);
                if (hasStreetPrefix) {
                    adjustedScore -= 0.80; // Heavy penalty - almost certainly NOT a province
                    penalties.push('street_prefix(-0.80)');
                }
                
                // Penalty 5: Has house number before - likely part of street address
                // Example: "123 Hà Nội" where "Hà Nội" is street name, not province
                // Check if previous part (i-1) is a number or has number pattern
                if (i > 0) {
                    const prevPart = parts[i - 1];
                    const prevNormalized = removeVietnameseTones(prevPart).toLowerCase();
                    const hasNumberPattern = /^\d+([\/\-]\d+)*[a-z]?$/i.test(prevNormalized.trim());
                    
                    if (hasNumberPattern) {
                        adjustedScore -= 0.60; // Strong penalty - likely street address
                        penalties.push('after_house_number(-0.60)');
                    }
                }
                
                // Penalty 4: Contains numbers (unlikely for province)
                // Example: "22" should not match province
                if (/\d/.test(part) && wordCount <= 2) {
                    adjustedScore -= 0.25;
                    penalties.push('has_numbers(-0.25)');
                }
                
                if (penalties.length > 0) {
                    console.log(`  🔧 Context penalties applied: ${penalties.join(', ')}`);
                }
                
                // IMPROVED: Check if part contains province keyword (tỉnh, thành phố)
                // If yes, verify the province name matches closely
                if (hasProvinceKeyword) {
                    // Extract province name from BOTH part and match
                    // IMPORTANT: Normalize first, then remove prefix
                    const normalizedPart = removeVietnameseTones(part).toLowerCase();
                    const provinceNameInPart = normalizedPart.replace(/^(tinh|thanh pho|tp)\s+/, '').trim();
                    const provinceNameInMatch = removeVietnameseTones(provinceMatch.match.Name.replace(/^(Tỉnh|Thành phố)\s+/i, '').trim()).toLowerCase();
                    
                    console.log(`  🔍 Checking province keyword: part="${provinceNameInPart}" vs match="${provinceNameInMatch}"`);
                    
                    // Calculate similarity between province names (without prefix)
                    const nameSimilarity = similarityScore(provinceNameInPart, provinceNameInMatch);
                    
                    if (nameSimilarity >= 0.85) {
                        // Good match - boost score
                        adjustedScore = Math.max(adjustedScore, 0.99);
                        console.log(`  ✨ Province name match: similarity=${nameSimilarity.toFixed(2)}, boosted to ${adjustedScore.toFixed(2)}`);
                    } else if (nameSimilarity < 0.7) {
                        // Poor match - penalize heavily
                        adjustedScore *= 0.3;
                        console.log(`  ⚠️ Province name mismatch: similarity=${nameSimilarity.toFixed(2)}, penalized to ${adjustedScore.toFixed(2)}`);
                    }
                } else {
                    // NEW: Bonus for multi-word matches that contain full province name
                    // Example: "ninh hòa khanh hòa" should get bonus for matching "Khánh Hòa"
                    if (wordCount >= 2) {
                        const provinceNameInMatch = removeVietnameseTones(provinceMatch.match.Name.replace(/^(Tỉnh|Thành phố)\s+/i, '').trim()).toLowerCase();
                        const partWords = removeVietnameseTones(part).toLowerCase().split(/\s+/);
                        
                        // Check if province name words appear consecutively in part
                        const provinceWords = provinceNameInMatch.split(/\s+/);
                        let consecutiveMatches = 0;
                        
                        for (let i = 0; i <= partWords.length - provinceWords.length; i++) {
                            let matches = 0;
                            for (let j = 0; j < provinceWords.length; j++) {
                                if (partWords[i + j] === provinceWords[j]) {
                                    matches++;
                                }
                            }
                            if (matches === provinceWords.length) {
                                consecutiveMatches = matches;
                                break;
                            }
                        }
                        
                        if (consecutiveMatches === provinceWords.length) {
                            // Full province name found consecutively - strong bonus
                            adjustedScore += 0.25;
                            penalties.push('multi_word_full_match(+0.25)');
                            console.log(`  ✨ Multi-word bonus: "${part}" contains full province name "${provinceNameInMatch}"`);
                        }
                    }
                }
                
                let shouldReplace = false;
                
                if (isGoodMatch && !isBestGood) {
                    // Good match beats weak match
                    shouldReplace = true;
                } else if (isGoodMatch && isBestGood) {
                    // Both good - prefer higher adjusted score, or longer phrase if similar
                    shouldReplace = adjustedScore > bestProvinceScore + 0.05 ||
                                  (Math.abs(adjustedScore - bestProvinceScore) <= 0.05 && wordCount > bestProvinceWordCount);
                } else {
                    // Both weak - prefer higher adjusted score or longer phrase
                    shouldReplace = adjustedScore > bestProvinceScore + 0.05 ||
                                  (Math.abs(adjustedScore - bestProvinceScore) <= 0.05 && wordCount > bestProvinceWordCount);
                }
                
                if (shouldReplace) {
                    bestProvinceMatch = provinceMatch;
                    bestProvinceScore = adjustedScore; // Use adjusted score
                    bestProvinceWordCount = wordCount;
                    console.log(`  ✓ Province candidate: "${part}" (${wordCount} words) → ${provinceMatch.match.Name} (score: ${adjustedScore.toFixed(2)})`);
                }
            }
        }
    }
    } // End of if (!result.province) block
    
    if (!result.province && bestProvinceMatch && bestProvinceScore >= 0.7) {
        result.province = bestProvinceMatch.match;
        result.confidence = bestProvinceMatch.confidence;
        console.log(`  ✅ Province matched: ${result.province.Name} (score: ${bestProvinceScore.toFixed(2)}, ${bestProvinceWordCount} words)`);
    } else if (!result.province && bestProvinceMatch && bestProvinceScore >= 0.5 && bestProvinceMatch.score >= 0.9) {
        result.province = bestProvinceMatch.match;
        result.confidence = 'medium';
        console.log(`  ✅ Province matched: ${result.province.Name}`);
    } else if (!result.province) {
        // ============================================
        // LAYER 1 FALLBACK: Use Province Hint from Dictionary
        // ============================================
        // If dictionary was applied but province not found via fuzzy matching
        // Use the province hint from dictionary (safe because dictionary has context checks)
        if (provinceHint && !result.province) {
            console.log(`  🔧 Using province hint from dictionary: ${provinceHint}`);
            
            // Find province by name
            const hintProvince = vietnamAddressData.find(p => {
                const pName = removeVietnameseTones(p.Name).toLowerCase();
                const hint = removeVietnameseTones(provinceHint).toLowerCase();
                return pName.includes(hint) || hint.includes(pName);
            });
            
            if (hintProvince) {
                result.province = hintProvince;
                result.confidence = 'medium'; // Medium confidence since inferred from dictionary
                console.log(`  ✅ Province set from hint: ${result.province.Name}`);
            } else {
                console.log(`  ⚠️ Province hint not found in database: ${provinceHint}`);
            }
        }
        
        if (bestProvinceMatch && !result.province) {
            console.log(`  ⚠️ Province match score too low (${bestProvinceScore.toFixed(2)}), will try to infer from district...`);
        } else if (!result.province) {
            console.log(`  ⚠️ No province found directly, will try to infer from district...`);
        }
        // Don't set province yet - try to find district first, then infer province
    }
    
    // ============================================
    // STEP 1.5: EARLY WARD LOOKUP (if no province/district found)
    // ============================================
    // If input has clear ward name (xã/phường + name) but no province/district
    // → Try to find ward first, then infer district/province
    // This helps cases like "thôn đông cao, xã tráng việt" where ward name is clear
    // IMPORTANT: Only use when NO district/province keywords found (to avoid false matches)
    
    // IMPORTANT: Declare these variables BEFORE Early Ward Lookup
    let bestDistrictMatch = null;
    let bestDistrictScore = 0;
    let bestDistrictWordCount = 0;
    
    if (!result.province && !result.district) {
        console.log('  🔍 Step 1.5: Early Ward Lookup (no province/district found)...');
        
        // Check if input has district/province keywords
        const addressNormalized = removeVietnameseTones(addressText).toLowerCase();
        const hasDistrictKeyword = /\b(quan|huyen|thanh pho|tp|thi xa|tx)\b/.test(addressNormalized);
        const hasProvinceKeyword = /\b(tinh)\b/.test(addressNormalized);
        
        if (hasDistrictKeyword || hasProvinceKeyword) {
            console.log(`  ⏭️ Skipping Early Ward Lookup - input has district/province keywords`);
        } else {
        
        // Find parts with ward keywords
        const wardKeywords = ['phuong', 'xa', 'thi tran', 'tt'];
        const wardParts = parts.filter(part => {
            const normalized = removeVietnameseTones(part).toLowerCase();
            return wardKeywords.some(kw => normalized.includes(kw)) && part.length >= 4;
        });
        
        if (wardParts.length > 0) {
            console.log(`    📌 Found ${wardParts.length} parts with ward keywords`);
            
            // CRITICAL: Check for province/district hints in OTHER parts first
            let provinceHint = null;
            let districtHint = null;
            
            // Strategy 1: Check non-ward parts for province/district names
            const nonWardParts = parts.filter(p => !wardParts.includes(p));
            console.log(`    🔍 Checking ${nonWardParts.length} non-ward parts for province/district hints...`);
            
            for (const part of nonWardParts) {
                if (part.length < 4) continue;
                
                // Try to match province (try full part first, then last 2 words)
                if (!provinceHint) {
                    // Try full part
                    const provinceMatch = fuzzyMatch(part, vietnamAddressData, 0.7);
                    if (provinceMatch && provinceMatch.score >= 0.7) {
                        provinceHint = provinceMatch.match;
                        console.log(`    ✓ Province hint (full): "${part}" → ${provinceHint.Name} (score: ${provinceMatch.score.toFixed(2)})`);
                    }
                    
                    // Try last 2 words (common pattern: "Đức Hòa Long An" → "Long An")
                    if (!provinceHint) {
                        const words = part.split(/\s+/).filter(w => w.length > 0);
                        if (words.length >= 2) {
                            const last2Words = words.slice(-2).join(' ');
                            const provinceMatch2 = fuzzyMatch(last2Words, vietnamAddressData, 0.7);
                            if (provinceMatch2 && provinceMatch2.score >= 0.7) {
                                provinceHint = provinceMatch2.match;
                                console.log(`    ✓ Province hint (last 2 words): "${last2Words}" from "${part}" → ${provinceHint.Name} (score: ${provinceMatch2.score.toFixed(2)})`);
                            }
                        }
                    }
                }
                
                // Try to match district (if we have province hint)
                if (provinceHint && !districtHint) {
                    // Try full part
                    const districtMatch = fuzzyMatch(part, provinceHint.Districts, 0.7);
                    if (districtMatch && districtMatch.score >= 0.7) {
                        districtHint = districtMatch.match;
                        console.log(`    ✓ District hint (full): "${part}" → ${districtHint.Name} (score: ${districtMatch.score.toFixed(2)})`);
                    }
                    
                    // Try first 2 words (common pattern: "Đức Hòa Long An" → "Đức Hòa")
                    if (!districtHint) {
                        const words = part.split(/\s+/).filter(w => w.length > 0);
                        if (words.length >= 2) {
                            const first2Words = words.slice(0, 2).join(' ');
                            const districtMatch2 = fuzzyMatch(first2Words, provinceHint.Districts, 0.7);
                            if (districtMatch2 && districtMatch2.score >= 0.7) {
                                districtHint = districtMatch2.match;
                                console.log(`    ✓ District hint (first 2 words): "${first2Words}" from "${part}" → ${districtHint.Name} (score: ${districtMatch2.score.toFixed(2)})`);
                            }
                        }
                    }
                }
            }
            
            let bestWardMatch = null;
            let bestWardScore = 0;
            let wardParentDistrict = null;
            let wardParentProvince = null;
            
            // Search each ward part - FILTER by province/district hints if available
            for (const wardPart of wardParts) {
                console.log(`    🔍 Searching ward: "${wardPart}"`);
                
                // If we have hints, search ONLY in that province/district
                if (provinceHint) {
                    console.log(`    📍 Filtering by province hint: ${provinceHint.Name}`);
                    const districtsToSearch = districtHint ? [districtHint] : provinceHint.Districts;
                    
                    for (const district of districtsToSearch) {
                        const wardMatch = fuzzyMatch(wardPart, district.Wards, 0.7);
                        if (wardMatch && wardMatch.score > bestWardScore) {
                            bestWardMatch = wardMatch.match;
                            bestWardScore = wardMatch.score;
                            wardParentDistrict = district;
                            wardParentProvince = provinceHint;
                            console.log(`      ✓ Ward match (filtered): "${wardPart}" → ${wardMatch.match.Name} in ${district.Name}, ${provinceHint.Name} (score: ${wardMatch.score.toFixed(2)})`);
                        }
                    }
                } else {
                    // No hints - search ALL provinces (original behavior)
                    for (const province of vietnamAddressData) {
                        for (const district of province.Districts) {
                            const wardMatch = fuzzyMatch(wardPart, district.Wards, 0.7);
                            if (wardMatch && wardMatch.score > bestWardScore) {
                                bestWardMatch = wardMatch.match;
                                bestWardScore = wardMatch.score;
                                wardParentDistrict = district;
                                wardParentProvince = province;
                                console.log(`      ✓ Ward match: "${wardPart}" → ${wardMatch.match.Name} in ${district.Name}, ${province.Name} (score: ${wardMatch.score.toFixed(2)})`);
                            }
                        }
                    }
                }
            }
            
            // If found good ward match (≥0.98), use it to infer district/province
            // CRITICAL: Use VERY HIGH threshold (0.98) to avoid false matches
            // Example: "xã Phước" (score 0.98) should NOT match "Phường Phú Thượng" (different name!)
            // VALIDATION: Check if ward input text actually contains ward name
            if (bestWardMatch && bestWardScore >= 0.98) {
                // Additional validation: Check if input contains actual ward name
                const wardNameNormalized = removeVietnameseTones(bestWardMatch.Name)
                    .toLowerCase()
                    .replace(/^(phường|xã|thị trấn|tt|khóm)\s+/i, '');
                
                // Find which wardPart matched this ward
                let matchedPart = null;
                for (const wardPart of wardParts) {
                    const partNormalized = removeVietnameseTones(wardPart)
                        .toLowerCase()
                        .replace(/^(phường|xã|thị trấn|tt|khóm)\s+/i, '');
                    
                    // Check if part contains ward name or vice versa
                    if (partNormalized.includes(wardNameNormalized) || wardNameNormalized.includes(partNormalized)) {
                        matchedPart = wardPart;
                        break;
                    }
                }
                
                if (matchedPart) {
                    result.ward = bestWardMatch;
                    result.district = wardParentDistrict;
                    result.province = wardParentProvince;
                    result.confidence = 'high';
                    console.log(`  ✅ Early Ward Lookup SUCCESS: ${result.ward.Name} → ${result.district.Name} → ${result.province.Name}`);
                    console.log(`  ⚡ Skipping Step 2 (district search) - already found via ward`);
                    
                    // Skip Step 2 by setting bestDistrictMatch
                    bestDistrictMatch = { match: result.district, score: bestWardScore };
                    bestDistrictScore = bestWardScore;
                    bestDistrictWordCount = 2;
                } else {
                    console.log(`  ⚠️ Early Ward Lookup: Validation failed - input doesn't contain ward name "${wardNameNormalized}"`);
                }
            } else if (bestWardMatch) {
                console.log(`  ⚠️ Early Ward Lookup: Score too low (${bestWardScore.toFixed(2)} < 0.98), will continue normal flow`);
            }
            
            // IMPORTANT: Even if ward match failed, pass province/district hints to Step 2
            if (provinceHint && !result.province) {
                result.province = provinceHint;
                console.log(`  ✓ Using province hint from Early Ward Lookup: ${provinceHint.Name}`);
            }
            if (districtHint && !result.district) {
                result.district = districtHint;
                bestDistrictMatch = { match: districtHint, score: 1.0 };
                bestDistrictScore = 1.0;
                bestDistrictWordCount = 2;
                console.log(`  ✓ Using district hint from Early Ward Lookup: ${districtHint.Name}`);
            }
        }
        
        } // End of hasDistrictKeyword check
    }
    
    // Step 2: Find District - PRIORITIZE LONGER PHRASES with keywords
    console.log('  🔍 Step 2: Finding District...');
    
    // Track which part was used for province to avoid reusing it (needed for Step 3 too)
    let provincePartIndex = -1;
    
    // Skip Step 2 if already found via Early Ward Lookup
    if (result.district && result.ward) {
        console.log('  ⏭️ Skipping Step 2 - district already found via Early Ward Lookup');
    } else {
    
    // Priority keywords for districts
    const districtKeywords = ['thanh pho', 'tp', 'quan', 'huyen', 'thi xa', 'tx'];
    
    if (result.province) {
        // Find which part matched the province - prefer SHORTEST match
        // Example: prefer "thanh hoá" over "thọ xuân thanh hoá"
        let shortestMatchLength = Infinity;
        
        for (let i = 0; i < parts.length; i++) {
            const match = fuzzyMatch(parts[i], [result.province], 0.7);
            if (match && match.score >= 0.7) {
                const partLength = parts[i].length;
                
                // Prefer shorter matches (more precise)
                if (partLength < shortestMatchLength) {
                    provincePartIndex = i;
                    shortestMatchLength = partLength;
                    console.log(`    📍 Province part candidate: ${i} ("${parts[i]}", length: ${partLength})`);
                }
            }
        }
        
        if (provincePartIndex >= 0) {
            console.log(`    ✅ Province part index: ${provincePartIndex} ("${parts[provincePartIndex]}")`);
        }
    }
    
    // If province found, search within that province
    if (result.province) {
        // First pass: Check parts with district keywords (higher priority)
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            
            // Skip if this is the exact province part (to avoid matching district in province name)
            const isProvincePart = (i === provincePartIndex);
            
            // If it's province part, check if it also contains district name
            if (isProvincePart) {
                const normalized = removeVietnameseTones(part).toLowerCase();
                
                // SPECIAL CASE: If province name = district name (e.g., "Thái Nguyên")
                // Try to find OTHER districts first before using this one
                const provinceNameNormalized = removeVietnameseTones(result.province.Name).toLowerCase()
                    .replace(/^(tinh|thanh pho|tp)\s+/i, '');
                const partNormalized = removeVietnameseTones(part).toLowerCase();
                
                // Check if this part is EXACTLY the province name (no other info)
                const isExactlyProvinceName = (partNormalized === provinceNameNormalized || 
                                              partNormalized === 'tinh ' + provinceNameNormalized ||
                                              partNormalized === 'thanh pho ' + provinceNameNormalized);
                
                if (isExactlyProvinceName) {
                    console.log(`    ⏭️ Skipping province part (exact match, will check other parts first): "${part}"`);
                    continue;
                }
                
                // Try to find district in this part
                let foundDistrictInProvincePart = false;
                for (const district of result.province.Districts) {
                    const districtNameNormalized = removeVietnameseTones(district.Name).toLowerCase()
                        .replace(/^(quan|huyen|thanh pho|tp|thi xa|tx)\s+/i, '');
                    
                    if (normalized.includes(districtNameNormalized)) {
                        // Found district name in province part!
                        const districtMatch = fuzzyMatch(part, result.province.Districts, 0.4);
                        if (districtMatch) {
                            const wordCount = part.split(/\s+/).length;
                            
                            // Check if district name appears in part
                            const districtNameInPart = normalized.includes(districtNameNormalized);
                            
                            let adjustedScore = districtMatch.score;
                            if (!districtNameInPart) {
                                adjustedScore *= 0.5;
                            }
                            
                            const shouldReplace = 
                                adjustedScore > bestDistrictScore + 0.05 ||
                                (Math.abs(adjustedScore - bestDistrictScore) <= 0.05 && wordCount > bestDistrictWordCount);
                            
                            if (shouldReplace) {
                                bestDistrictMatch = districtMatch;
                                bestDistrictScore = adjustedScore;
                                bestDistrictWordCount = wordCount;
                                result.district = districtMatch.match;
                                foundDistrictInProvincePart = true;
                                break;
                            }
                        }
                    }
                }
                
                if (!foundDistrictInProvincePart) {
                    console.log(`    ⏭️ Skipping province part: "${part}"`);
                    continue;
                }
            }
            
            const normalized = removeVietnameseTones(part).toLowerCase();
            const hasKeyword = districtKeywords.some(kw => normalized.includes(kw));
            const wordCount = part.split(/\s+/).length;
            
            if (hasKeyword && part.length >= 4) {
                const districtMatch = fuzzyMatch(part, result.province.Districts, 0.4);
                if (districtMatch) {
                    // IMPROVED: Check if this part contains actual district name (not just keyword)
                    // Example: "Thành phố Hà" should NOT match "Quận Hai Bà Trưng"
                    // But "đông anh Thành phố" should match "Huyện Đông Anh"
                    const districtNameNormalized = removeVietnameseTones(districtMatch.match.Name).toLowerCase()
                        .replace(/^(quan|huyen|thanh pho|tp|thi xa|tx)\s+/i, '');
                    
                    const partNormalized = removeVietnameseTones(part).toLowerCase();
                    
                    // Check if district name appears in part
                    const districtNameInPart = partNormalized.includes(districtNameNormalized);
                    
                    // If district name NOT in part, reduce score significantly
                    let adjustedScore = districtMatch.score;
                    if (!districtNameInPart) {
                        adjustedScore *= 0.5; // 50% penalty
                        console.log(`    ⚠️ District name "${districtNameNormalized}" NOT in part "${part}", score ${districtMatch.score.toFixed(2)} → ${adjustedScore.toFixed(2)}`);
                    }
                    
                    const shouldReplace = 
                        adjustedScore > bestDistrictScore + 0.05 ||
                        (Math.abs(adjustedScore - bestDistrictScore) <= 0.05 && wordCount > bestDistrictWordCount);
                    
                    if (shouldReplace) {
                        bestDistrictMatch = districtMatch;
                        bestDistrictScore = adjustedScore;
                        bestDistrictWordCount = wordCount;
                        result.district = districtMatch.match;
                    }
                }
            }
        }
        
        // Second pass: Check all parts if not found with good score
        // IMPROVED: Always check all parts to find better district match
        // Example: "Thái Nguyên" matches both province and district (score 1.0)
        // But "Phú bình" should match "Huyện Phú Bình" (score 0.9) and be preferred
        if (bestDistrictScore < 0.95 || !bestDistrictMatch) {
            console.log(`    🔍 Checking all parts for better district match (current score: ${bestDistrictScore.toFixed(2)})...`);
            
            // Collect all district candidates first
            const districtCandidates = [];
            
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                
                // Skip if this part was used for province (unless it's the ONLY match)
                const isProvincePart = (i === provincePartIndex);
                if (isProvincePart && bestDistrictMatch) {
                    console.log(`    ⏭️ Skipping province part (already have district): "${part}"`);
                    continue;
                }
                
                if (part.length < 4) continue;
                
                // IMPORTANT: Skip parts that look like ward names (have ward keyword + short)
                const partNormalized = removeVietnameseTones(part).toLowerCase();
                const hasWardKeyword = /\b(xa|phuong|thi tran|tt|khom)\b/.test(partNormalized);
                const partWordCount = part.split(/\s+/).length;
                
                if (hasWardKeyword && partWordCount <= 3) {
                    console.log(`    ⏭️ Skipping ward-like part: "${part}" (has ward keyword, ${partWordCount} words)`);
                    continue;
                }
                
                // Check ALL districts in province, not just best match
                for (const district of result.province.Districts) {
                    const match = fuzzyMatch(part, [district], 0.4);
                    if (match && match.score >= 0.4) {
                        // BONUS: If part is NOT the province name, give bonus
                        const provinceNameNormalized = removeVietnameseTones(result.province.Name).toLowerCase()
                            .replace(/^(tinh|thanh pho|tp)\s+/i, '');
                        
                        let adjustedScore = match.score;
                        const isNotProvinceName = !partNormalized.includes(provinceNameNormalized);
                        
                        if (isNotProvinceName && match.score >= 0.7) {
                            adjustedScore += 0.2; // Bonus for NOT being province name
                            console.log(`    ✨ Bonus for non-province part: "${part}" → ${district.Name} (score: ${match.score.toFixed(2)} + 0.2 = ${adjustedScore.toFixed(2)})`);
                        }
                        
                        // EXTRA BONUS: If part contains explicit district name (without prefix)
                        const districtNameNormalized = removeVietnameseTones(district.Name)
                            .toLowerCase()
                            .replace(/^(quan|huyen|thanh pho|tp|thi xa|tx)\s+/i, '');
                        
                        if (partNormalized.includes(districtNameNormalized) && districtNameNormalized.length >= 4) {
                            adjustedScore += 0.3; // Extra bonus for explicit district name
                            console.log(`    ✨✨ Extra bonus for explicit district name: "${part}" → ${district.Name} (score: ${adjustedScore.toFixed(2)})`);
                        }
                        
                        // SUPER BONUS: If part has explicit district keyword (Quận, Huyện, Thành phố)
                        // This indicates user explicitly mentioned district type
                        // Example: "Quận 5" should be heavily preferred over fuzzy matches
                        const hasExplicitDistrictKeyword = /\b(quan|huyen|thanh pho|tp|thi xa|tx)\s+/i.test(part);
                        if (hasExplicitDistrictKeyword && match.score >= 0.9) {
                            adjustedScore += 0.5; // Heavy boost for explicit keyword
                            console.log(`    🌟 SUPER bonus for explicit district keyword: "${part}" → ${district.Name} (score: ${adjustedScore.toFixed(2)})`);
                        }
                        
                        // ============================================
                        // DISTRICT AMBIGUITY RESOLUTION (NEW)
                        // ============================================
                        // Boost score if surrounding context mentions province
                        // Example: "Đông Anh Hà Nội" → boost "Đông Anh (Hà Nội)" over "Đông Anh (Thái Nguyên)"
                        
                        // Get surrounding text (previous + current + next parts)
                        const surroundingParts = [];
                        if (i > 0) surroundingParts.push(parts[i - 1]);
                        surroundingParts.push(part);
                        if (i < parts.length - 1) surroundingParts.push(parts[i + 1]);
                        
                        const surroundingText = removeVietnameseTones(surroundingParts.join(' ')).toLowerCase();
                        
                        // Check if surrounding text mentions province name
                        // Use result.province (already found) to check context
                        if (result.province) {
                            const provinceNameNormalized = removeVietnameseTones(result.province.Name)
                                .toLowerCase()
                                .replace(/^(tinh|thanh pho|tp)\s+/i, '');
                            
                            if (surroundingText.includes(provinceNameNormalized) && provinceNameNormalized.length >= 4) {
                                adjustedScore += 0.25; // Context boost
                            }
                        }
                        
                        // PROVINCE HINT BOOST
                        if (provinceHint && district.Name.includes(provinceHint)) {
                            adjustedScore += 0.2;
                        }
                        
                        districtCandidates.push({
                            part,
                            index: i,
                            district: district,
                            score: adjustedScore, // Use adjusted score (with bonus)
                            originalScore: match.score, // Keep original for reference
                            wordCount: partWordCount
                        });
                    }
                }
            }
            
            console.log(`    📊 Found ${districtCandidates.length} district candidate(s)`);
            
            // If multiple candidates with similar scores, verify with ward data
            if (districtCandidates.length > 1) {
                console.log(`    🔍 Multiple district candidates found, verifying with ward data...`);
                
                // Check which district has better ward matches
                for (const candidate of districtCandidates) {
                    let bestWardScoreForDistrict = 0;
                    
                    // Check all parts for ward matches in this district
                    for (let j = 0; j < parts.length; j++) {
                        if (j === provincePartIndex || j === candidate.index) continue;
                        
                        const wardMatch = fuzzyMatch(parts[j], candidate.district.Wards, 0.4);
                        if (wardMatch && wardMatch.score > bestWardScoreForDistrict) {
                            bestWardScoreForDistrict = wardMatch.score;
                        }
                    }
                    
                    candidate.wardScore = bestWardScoreForDistrict;
                    console.log(`    📊 District "${candidate.part}" → ${candidate.district.Name}: district_score=${candidate.score.toFixed(2)}, best_ward_score=${bestWardScoreForDistrict.toFixed(2)}`);
                }
                
                // Choose district with best combined score
                // IMPROVED: Prioritize district_score when difference is significant (≥0.3)
                districtCandidates.sort((a, b) => {
                    const districtScoreDiff = Math.abs(a.score - b.score);
                    const wardScoreDiff = Math.abs(a.wardScore - b.wardScore);
                    
                    // CRITICAL: Check if candidate part is from province name
                    // Example: "Thành phố Hồ" is substring of "Thành phố Hồ Chí Minh" (province)
                    const provinceNameNormalized = removeVietnameseTones(result.province.Name).toLowerCase();
                    const aPartNormalized = removeVietnameseTones(a.part).toLowerCase();
                    const bPartNormalized = removeVietnameseTones(b.part).toLowerCase();
                    
                    const aIsFromProvince = provinceNameNormalized.includes(aPartNormalized) && aPartNormalized.length >= 6;
                    const bIsFromProvince = provinceNameNormalized.includes(bPartNormalized) && bPartNormalized.length >= 6;
                    
                    // Check if candidate has explicit district keyword (Quận, Huyện, etc.)
                    const aHasDistrictKeyword = /\b(quan|huyen|thi xa|tx)\b/.test(aPartNormalized); // Exclude "thanh pho", "tp"
                    const bHasDistrictKeyword = /\b(quan|huyen|thi xa|tx)\b/.test(bPartNormalized);
                    
                    // PRIORITY 0: If one is from province name and other is NOT, prefer the one NOT from province
                    // Example: "Thành phố Hồ" (from province) vs "Quận Gò" (not from province)
                    if (aIsFromProvince && !bIsFromProvince && b.score >= 0.8) {
                        console.log(`    🎯 Prioritizing "${b.part}" (not from province) over "${a.part}" (from province name)`);
                        return 1; // b wins
                    }
                    if (bIsFromProvince && !aIsFromProvince && a.score >= 0.8) {
                        console.log(`    🎯 Prioritizing "${a.part}" (not from province) over "${b.part}" (from province name)`);
                        return -1; // a wins
                    }
                    
                    // PRIORITY 1: If one has district keyword (Quận, Huyện) and other doesn't, prefer the one with keyword
                    // Example: "Quận Gò" (has keyword) vs "Hồ Chí" (no keyword)
                    if (aHasDistrictKeyword && !bHasDistrictKeyword && a.score >= 0.8) {
                        console.log(`    🎯 Prioritizing "${a.part}" (has district keyword) over "${b.part}"`);
                        return -1;
                    }
                    if (bHasDistrictKeyword && !aHasDistrictKeyword && b.score >= 0.8) {
                        console.log(`    🎯 Prioritizing "${b.part}" (has district keyword) over "${a.part}"`);
                        return 1;
                    }
                    
                    // Case 1: One has EXACT district match (1.0), other doesn't → Choose exact match
                    if (a.score === 1.0 && b.score < 1.0) return -1;
                    if (b.score === 1.0 && a.score < 1.0) return 1;
                    
                    // Case 2: District score difference is HUGE (≥0.3) → Prioritize district_score
                    // Example: "Mê Linh" (1.00) vs "Dong Cao" (0.64) → Choose "Mê Linh"
                    // BUT: Check if lower score has explicit district name match
                    if (districtScoreDiff >= 0.3) {
                        // EXCEPTION: If lower score candidate has explicit district name in part
                        // and higher score is from a ward-like part, prefer lower score
                        // Example: "xa thuan" (1.18) vs "can giuoc" (0.90)
                        // → "can giuoc" is explicit district name, prefer it
                        
                        const higherCandidate = a.score > b.score ? a : b;
                        const lowerCandidate = a.score > b.score ? b : a;
                        
                        // Check if higher score part looks like ward (has ward keyword)
                        const higherPartNormalized = removeVietnameseTones(higherCandidate.part).toLowerCase();
                        const hasWardKeyword = /\b(xa|phuong|thi tran|tt|khom)\b/.test(higherPartNormalized);
                        
                        // Check if lower score part contains explicit district name
                        const lowerPartNormalized = removeVietnameseTones(lowerCandidate.part).toLowerCase();
                        const districtNameNormalized = removeVietnameseTones(lowerCandidate.district.Name)
                            .toLowerCase()
                            .replace(/^(quan|huyen|thanh pho|tp|thi xa|tx)\s+/i, '');
                        
                        const hasExplicitDistrictName = lowerPartNormalized.includes(districtNameNormalized);
                        
                        if (hasWardKeyword && hasExplicitDistrictName && lowerCandidate.score >= 0.7) {
                            console.log(`    📊 Higher score has ward keyword, lower has explicit district name, prefer lower`);
                            return b.score - a.score; // Reverse order (prefer lower score)
                        }
                        
                        console.log(`    📊 Large district_score diff (${districtScoreDiff.toFixed(2)}), prioritizing district_score`);
                        return b.score - a.score;
                    }
                    
                    // Case 3: District scores similar (< 0.3), but one has EXACT ward match
                    if (districtScoreDiff < 0.3) {
                        if (a.wardScore === 1.0 && b.wardScore < 1.0) return -1;
                        if (b.wardScore === 1.0 && a.wardScore < 1.0) return 1;
                    }
                    
                    // Case 4: District scores similar, check ward_score difference
                    // If ward_score difference is significant (>0.15), prioritize ward_score
                    if (wardScoreDiff > 0.15) {
                        return b.wardScore - a.wardScore;
                    }
                    
                    // Case 5: Both similar, prioritize district_score
                    return b.score - a.score;
                });
                
                const bestCandidate = districtCandidates[0];
                bestDistrictMatch = { match: bestCandidate.district, score: bestCandidate.score, confidence: 'high' };
                bestDistrictScore = bestCandidate.score;
                bestDistrictWordCount = bestCandidate.wordCount;
                result.district = bestCandidate.district; // SET result.district!
                console.log(`    ✅ Best district (verified): "${bestCandidate.part}" → ${bestCandidate.district.Name} (district_score: ${bestCandidate.score.toFixed(2)}, ward_score: ${bestCandidate.wardScore.toFixed(2)})`);
            } else if (districtCandidates.length === 1) {
                // Only one candidate
                const candidate = districtCandidates[0];
                bestDistrictMatch = { match: candidate.district, score: candidate.score, confidence: 'high' };
                bestDistrictScore = candidate.score;
                bestDistrictWordCount = candidate.wordCount;
                result.district = candidate.district; // SET result.district!
                console.log(`    ✓ District candidate: "${candidate.part}" (${candidate.wordCount} words, pos: ${candidate.index}) → ${candidate.district.Name} (score: ${candidate.score.toFixed(2)})`);
            }
        }
    } else {
        // Province not found - Search ALL provinces for district match
        console.log(`    🔍 Province not found, searching ALL provinces for district...`);
        
        // Initialize candidates array (use let for reassignment in province validation)
        let districtCandidates = [];
        
        // PRIORITY: Check parts with district keywords FIRST
        const partsWithKeywords = parts.filter(part => {
            const normalized = removeVietnameseTones(part).toLowerCase();
            const hasDistrictKeyword = districtKeywords.some(kw => normalized.includes(kw));
            
            // IMPORTANT: Check if this part is actually a PROVINCE, not a district
            // Example: "Thành phố Hà Nội" has "thanh pho" but it's a PROVINCE
            if (hasDistrictKeyword) {
                // Try to match with provinces first
                for (const province of vietnamAddressData) {
                    const provinceMatch = fuzzyMatch(part, [province], 0.7);
                    if (provinceMatch && provinceMatch.score >= 0.7) {
                        console.log(`    ⏭️ Skipping "${part}" - it's a PROVINCE (${province.Name}), not a district`);
                        return false; // Skip this part
                    }
                }
                return true; // It's a district keyword and not a province
            }
            return false;
        });
        
        console.log(`    📌 Parts with district keywords:`, partsWithKeywords.length);
        
        for (const part of partsWithKeywords) {
            // Search across ALL provinces
            for (const province of vietnamAddressData) {
                const districtMatch = fuzzyMatch(part, province.Districts, 0.5); // Higher threshold for safety
                if (districtMatch) {
                    const wordCount = part.split(/\s+/).length;
                    const shouldReplace = 
                        districtMatch.score > bestDistrictScore + 0.05 ||
                        (Math.abs(districtMatch.score - bestDistrictScore) <= 0.05 && wordCount > bestDistrictWordCount);
                    
                    if (shouldReplace) {
                        bestDistrictMatch = districtMatch;
                        bestDistrictScore = districtMatch.score;
                        bestDistrictWordCount = wordCount;
                        // IMPORTANT: Set province and district from match
                        result.province = province;
                        result.district = districtMatch.match; // SET result.district!
                        console.log(`    ✓ District found in province: "${part}" → ${districtMatch.match.Name} in ${province.Name} (score: ${districtMatch.score.toFixed(2)})`);
                    }
                }
            }
        }
        
        // If still not found, search ALL parts (without keyword requirement)
        // IMPROVED: Extract district name from ward parts intelligently
        if (!bestDistrictMatch) {
            console.log(`    🔍 No district found with keywords, searching ALL parts...`);
            
            for (const part of parts) {
                // Skip very short parts
                if (part.length < 3) continue;
                
                const normalized = removeVietnameseTones(part).toLowerCase();
                const hasWardKeyword = ['phuong', 'xa', 'thi tran', 'tt', 'khom', 'ap', 'thon', 'xom'].some(kw => normalized.includes(kw));
                
                let searchParts = [{ text: part, strategy: 'original' }]; // Array of parts to search
                
                // If has ward keyword, try multiple extraction strategies
                if (hasWardKeyword) {
                    // Strategy 1: Extract text after ward name
                    // "phường 14 gò vấp" → "gò vấp"
                    const afterWardMatch = part.match(/(phường|xã|thị trấn|tt|khóm|ấp|ap|thôn|thon|xóm|xom)\s+\S+(?:\s+\S+)?\s+(.+)/i);
                    if (afterWardMatch && afterWardMatch[2]) {
                        const afterWard = afterWardMatch[2].trim();
                        searchParts.push({ text: afterWard, strategy: 'strategy-1' });
                        console.log(`    📍 Strategy 1 - After ward: "${afterWard}"`);
                        
                        // IMPROVED: Extract multiple segments from afterWard
                        // Example: "thuan thanh can giuoc long an" → try "can giuoc", "giuoc long", etc.
                        const afterWardWords = afterWard.split(/\s+/).filter(w => w.length > 0);
                        if (afterWardWords.length >= 3) {
                            // Try first 2 words (likely district)
                            const first2 = afterWardWords.slice(0, 2).join(' ');
                            searchParts.push({ text: first2, strategy: 'strategy-1b' });
                            console.log(`    📍 Strategy 1b - First 2 words after ward: "${first2}" (likely district)`);
                            
                            // Try middle 2 words (if exists)
                            if (afterWardWords.length >= 4) {
                                const middle2 = afterWardWords.slice(1, 3).join(' ');
                                searchParts.push({ text: middle2, strategy: 'strategy-1c' });
                                console.log(`    📍 Strategy 1c - Middle 2 words: "${middle2}" (possible district)`);
                                
                                // Try words 2-3 (another middle segment)
                                if (afterWardWords.length >= 5) {
                                    const middle2b = afterWardWords.slice(2, 4).join(' ');
                                    searchParts.push({ text: middle2b, strategy: 'strategy-1d' });
                                    console.log(`    📍 Strategy 1d - Middle 2 words (2-3): "${middle2b}" (possible district)`);
                                }
                            }
                        }
                    }
                    
                    // Strategy 2: Extract last 1-2 words (common pattern)
                    // "xã tân vĩnh hiệp tân uyên" → "tân uyên"
                    // NOTE: These are VERY LIKELY province names, so will get STRONG penalty
                    const words = part.split(/\s+/).filter(w => w.length > 0);
                    if (words.length >= 4) {
                        // Try last 2 words (VERY LIKELY PROVINCE - will get strong penalty)
                        const last2 = words.slice(-2).join(' ');
                        searchParts.push({ text: last2, strategy: 'strategy-2-last2' });
                        console.log(`    📍 Strategy 2 - Last 2 words: "${last2}" (VERY likely province)`);
                        
                        // Try last 1 word (EXTREMELY LIKELY PROVINCE - will get very strong penalty)
                        const last1 = words[words.length - 1];
                        if (last1.length >= 3) {
                            searchParts.push({ text: last1, strategy: 'strategy-2-last1' });
                            console.log(`    📍 Strategy 2 - Last word: "${last1}" (EXTREMELY likely province)`);
                        }
                    }
                    
                    // Strategy 3: Extract district name after ward keyword
                    // SMART: Try ALL possible ward name lengths (1-3 words)
                    // Example: "thị trấn Năm Căn Cà Mau"
                    //   - If ward = 1 word ("Năm") → district might be "Căn Cà" or "Cà Mau"
                    //   - If ward = 2 words ("Năm Căn") → district might be "Cà Mau" ✅
                    //   - If ward = 3 words ("Năm Căn Cà") → district might be "Mau"
                    const afterKeywordMatch = part.match(/(phường|xã|thị trấn|tt|khóm)\s+(.+)/i);
                    if (afterKeywordMatch) {
                        const wardKeyword = afterKeywordMatch[1];
                        const afterKeyword = afterKeywordMatch[2].trim(); // Everything after keyword
                        const words = afterKeyword.split(/\s+/);
                        
                        if (words.length >= 2) {
                            // CRITICAL: Also try ward name itself as district search
                            // Example: "thị trấn Năm Căn" might match "Huyện Năm Căn"
                            // Try first 1 word as ward name
                            if (words.length >= 1) {
                                const ward1Word = words[0];
                                searchParts.push({ text: ward1Word, strategy: 'strategy-3-ward1' });
                                console.log(`    📍 Strategy 3-ward1 - Ward name (1 word): "${ward1Word}"`);
                            }
                            
                            // Try first 2 words as ward name
                            if (words.length >= 2) {
                                const ward2Words = words.slice(0, 2).join(' ');
                                searchParts.push({ text: ward2Words, strategy: 'strategy-3-ward2' });
                                console.log(`    📍 Strategy 3-ward2 - Ward name (2 words): "${ward2Words}"`);
                            }
                            
                            // Try first 3 words as ward name
                            if (words.length >= 3) {
                                const ward3Words = words.slice(0, 3).join(' ');
                                searchParts.push({ text: ward3Words, strategy: 'strategy-3-ward3' });
                                console.log(`    📍 Strategy 3-ward3 - Ward name (3 words): "${ward3Words}"`);
                            }
                            
                            // NEW: Try first 4 words as ward name (for Tây Nguyên addresses)
                            // Example: "Xã Cu Kty Krông Bông Đắk Lắk" → ward might be "Cu Kty Krông Bông"
                            if (words.length >= 4) {
                                const ward4Words = words.slice(0, 4).join(' ');
                                searchParts.push({ text: ward4Words, strategy: 'strategy-3-ward4' });
                                console.log(`    📍 Strategy 3-ward4 - Ward name (4 words): "${ward4Words}"`);
                            }
                            
                            // Try ward name = 1 word, extract remaining 2+ words as district
                            if (words.length >= 3) {
                                const remaining2Words = words.slice(1, 3).join(' ');
                                searchParts.push({ text: remaining2Words, strategy: 'strategy-3a' });
                                console.log(`    📍 Strategy 3a - Ward=1word, District=2words: "${remaining2Words}"`);
                            }
                            
                            // Try ward name = 2 words, extract remaining as district
                            if (words.length >= 4) {
                                const remaining2Words = words.slice(2, 4).join(' ');
                                searchParts.push({ text: remaining2Words, strategy: 'strategy-3b' });
                                console.log(`    📍 Strategy 3b - Ward=2words, District=2words: "${remaining2Words}"`);
                            }
                            
                            // NEW: Try ward name = 3 words, extract remaining as district (for Tây Nguyên)
                            // Example: "Xã Cu Kty Krông Bông Đắk Lắk" → ward="Cu Kty Krông", district="Bông Đắk"
                            if (words.length >= 5) {
                                const remaining2Words = words.slice(3, 5).join(' ');
                                searchParts.push({ text: remaining2Words, strategy: 'strategy-3d' });
                                console.log(`    📍 Strategy 3d - Ward=3words, District=2words: "${remaining2Words}"`);
                            }
                            
                            // Try ward name = 2 words, extract last 2 words as district (most common)
                            if (words.length >= 3) {
                                const last2Words = words.slice(-2).join(' ');
                                searchParts.push({ text: last2Words, strategy: 'strategy-3c' });
                                console.log(`    📍 Strategy 3c - Last 2 words: "${last2Words}"`);
                            }
                        }
                    }
                } else {
                    // No ward keyword, search as-is
                    searchParts.push({ text: part, strategy: 'no-ward-keyword' });
                    console.log(`    📍 No ward keyword, search as-is: "${part}"`);
                }
                
                // Remove duplicates (by text)
                const uniqueSearchParts = [];
                const seenTexts = new Set();
                for (const sp of searchParts) {
                    if (!seenTexts.has(sp.text)) {
                        seenTexts.add(sp.text);
                        uniqueSearchParts.push(sp);
                    }
                }
                searchParts = uniqueSearchParts;
                
                // Search each extracted part
                for (const searchPartObj of searchParts) {
                    const searchPart = searchPartObj.text;
                    const strategy = searchPartObj.strategy;
                    
                    if (searchPart.length < 3) continue;
                    
                    // FIRST: Check if this is last 2 words and matches a PROVINCE
                    // If yes, prioritize province match over district match
                    const originalWords = part.split(/\s+/).filter(w => w.length > 0);
                    const last2Words = originalWords.slice(-2).join(' ');
                    const isLast2Words = (searchPart === last2Words);
                    
                    if (isLast2Words) {
                        console.log(`    🔍 Checking if last 2 words "${searchPart}" is a PROVINCE...`);
                        // Check province match FIRST
                        for (const province of vietnamAddressData) {
                            const provinceScore = fuzzyMatch(searchPart, [province]); // Pass as array!
                            if (provinceScore && provinceScore.score >= 0.7) {
                                // STRONG match for province - add with BOOST
                                const boostedScore = provinceScore.score * 1.3;
                                districtCandidates.push({
                                    part: searchPart,
                                    district: null,
                                    province: province,
                                    score: boostedScore,
                                    wordCount: searchPart.split(/\s+/).length,
                                    strategy: 'last-2-words-province-match',
                                    extractionStrategy: strategy
                                });
                            }
                        }
                    }
                    
                    // Search across ALL provinces for DISTRICT match
                    for (const province of vietnamAddressData) {
                        const districtMatch = fuzzyMatch(searchPart, province.Districts, 0.7);
                        if (districtMatch) {
                            const wordCount = searchPart.split(/\s+/).length;
                            
                            // IMPROVED: Prioritize middle parts over last parts
                            // Check position in ORIGINAL part, not in searchParts array
                            const originalPart = part; // The full ward part
                            const searchPartIndex = originalPart.indexOf(searchPart);
                            const searchPartEnd = searchPartIndex + searchPart.length;
                            const isAtEnd = (searchPartEnd >= originalPart.length - 3); // Within 3 chars of end
                            const isNearEnd = (searchPartEnd >= originalPart.length * 0.7); // In last 30%
                            
                            // Apply penalty/bonus based on position AND extraction strategy
                            let adjustedScore = districtMatch.score;
                            
                            // CRITICAL: BOOST for Strategy 3 (extracted from ward keyword)
                            // These are HIGHLY LIKELY to be correct district names
                            if (strategy.startsWith('strategy-3-ward')) {
                                // Ward name matching district name
                                adjustedScore += 0.50;
                            } else if (strategy.startsWith('strategy-3')) {
                                adjustedScore += 0.40;
                            } else if (isLast2Words) {
                                adjustedScore -= 0.30;
                            } else if (isAtEnd) {
                                adjustedScore -= 0.20;
                            } else if (isNearEnd) {
                                adjustedScore -= 0.10;
                            } else if (searchPartIndex > 0 && searchPartIndex < originalPart.length * 0.5) {
                                adjustedScore += 0.10;
                            }
                            
                            const shouldReplace = 
                                adjustedScore > bestDistrictScore + 0.05 ||
                                (Math.abs(adjustedScore - bestDistrictScore) <= 0.05 && wordCount > bestDistrictWordCount);
                            
                            if (shouldReplace) {
                                districtCandidates.push({
                                    part: searchPart,
                                    district: districtMatch.match,
                                    province: province,
                                    score: adjustedScore,
                                    wordCount: wordCount,
                                    strategy: 'district-match',
                                    extractionStrategy: strategy
                                });
                            }
                        }
                    }
                }
            }
        }
        
        // Sort candidates: prioritize province matches over district matches
        if (districtCandidates.length > 0) {
            console.log(`  📊 Sorting ${districtCandidates.length} candidates...`);
            
            // ============================================
            // OPTIMIZATION: Province-First Validation
            // ============================================
            // If we have a strong province hint from the text, filter candidates
            // to only those within that province. This fixes cases like:
            // "xã Phước Hòa Phú Giáo Bình Dương" where "Phú" matches many districts
            // but we should only consider districts in "Bình Dương"
            
            if (OPTIMIZATION_FLAGS.PROVINCE_FIRST_VALIDATION) {
                // Try to find province from the ORIGINAL address text (not split parts)
                let provinceHintFromText = null;
                let provinceHintScore = 0;
                
                // Strategy 1: Check last 2 words from original address
                const addressWords = addressText.trim().split(/\s+/);
                if (addressWords.length >= 2) {
                    const last2Words = addressWords.slice(-2).join(' ');
                    const provinceMatch = fuzzyMatch(last2Words, vietnamAddressData, 0.6);
                    if (provinceMatch && provinceMatch.score >= 0.7) {
                        provinceHintFromText = provinceMatch.match;
                        provinceHintScore = provinceMatch.score;
                        console.log(`  🔍 Province hint from last 2 words: "${last2Words}" → ${provinceHintFromText.Name} (score: ${provinceHintScore.toFixed(2)})`);
                    }
                }
                
                // Strategy 2: Check last 3 words if no strong 2-word match
                if (!provinceHintFromText && addressWords.length >= 3) {
                    const last3Words = addressWords.slice(-3).join(' ');
                    const provinceMatch = fuzzyMatch(last3Words, vietnamAddressData, 0.6);
                    if (provinceMatch && provinceMatch.score >= 0.7) {
                        provinceHintFromText = provinceMatch.match;
                        provinceHintScore = provinceMatch.score;
                        console.log(`  🔍 Province hint from last 3 words: "${last3Words}" → ${provinceHintFromText.Name} (score: ${provinceHintScore.toFixed(2)})`);
                    }
                }
                
                // Strategy 3: Try each part that might contain province
                if (!provinceHintFromText) {
                    for (const part of parts) {
                        // Skip ward keyword parts
                        if (/^(xa|phuong|thi tran)\s/i.test(removeVietnameseTones(part))) {
                            continue;
                        }
                        
                        // Try to match this part as province
                        const provinceMatch = fuzzyMatch(part, vietnamAddressData, 0.6);
                        if (provinceMatch && provinceMatch.score >= 0.7) {
                            provinceHintFromText = provinceMatch.match;
                            provinceHintScore = provinceMatch.score;
                            console.log(`  🔍 Province hint from part: "${part}" → ${provinceHintFromText.Name} (score: ${provinceHintScore.toFixed(2)})`);
                            break;
                        }
                    }
                }
                
                // If we have a province hint (even with lower score), filter district candidates
                if (provinceHintFromText && provinceHintScore >= 0.7) {
                    const beforeFilter = districtCandidates.length;
                    const provinceId = provinceHintFromText.Id;
                    
                    // Filter: Keep only districts in the hinted province
                    districtCandidates = districtCandidates.filter(candidate => {
                        if (candidate.strategy === 'last-2-words-province-match') {
                            // Keep province matches
                            return true;
                        }
                        // Keep only if district belongs to hinted province
                        return candidate.province.Id === provinceId;
                    });
                    
                    if (districtCandidates.length < beforeFilter) {
                        console.log(`  ✅ Province validation: Filtered ${beforeFilter} → ${districtCandidates.length} candidates (kept only ${provinceHintFromText.Name})`);
                        OPTIMIZATION_METRICS.provinceValidationUsed++;
                    }
                }
            }
            
            districtCandidates.sort((a, b) => {
                // 1. HIGHEST PRIORITY: Strategy 3 district matches (extracted from ward keyword)
                const aIsStrategy3 = a.extractionStrategy && a.extractionStrategy.startsWith('strategy-3');
                const bIsStrategy3 = b.extractionStrategy && b.extractionStrategy.startsWith('strategy-3');
                if (aIsStrategy3 && !bIsStrategy3) return -1;
                if (!aIsStrategy3 && bIsStrategy3) return 1;
                
                // 2. Prioritize province matches (strategy: last-2-words-province-match)
                const aIsProvince = a.strategy === 'last-2-words-province-match';
                const bIsProvince = b.strategy === 'last-2-words-province-match';
                if (aIsProvince && !bIsProvince) return -1;
                if (!aIsProvince && bIsProvince) return 1;
                
                // ============================================
                // IMPROVEMENT 3: Prioritize common provinces when district name is ambiguous
                // ============================================
                // If both candidates are district matches (not province matches)
                // AND scores are similar (within 0.1)
                // → Prioritize major provinces (TP.HCM, Hà Nội, Đà Nẵng...)
                if (!aIsProvince && !bIsProvince && Math.abs(a.score - b.score) <= 0.1) {
                    // List of major provinces (by population/commerce)
                    const majorProvinces = [
                        'Thành phố Hồ Chí Minh',
                        'Thành phố Hà Nội',
                        'Thành phố Đà Nẵng',
                        'Tỉnh Bình Dương',
                        'Tỉnh Đồng Nai',
                        'Thành phố Hải Phòng',
                        'Thành phố Cần Thơ',
                        'Tỉnh Bà Rịa - Vũng Tàu',
                        'Tỉnh Khánh Hòa',
                        'Tỉnh Long An'
                    ];
                    
                    const aIsMajor = majorProvinces.includes(a.province.Name);
                    const bIsMajor = majorProvinces.includes(b.province.Name);
                    
                    if (aIsMajor && !bIsMajor) {
                        console.log(`  🎯 Prioritizing major province: ${a.province.Name} over ${b.province.Name}`);
                        return -1;
                    }
                    if (!aIsMajor && bIsMajor) {
                        console.log(`  🎯 Prioritizing major province: ${b.province.Name} over ${a.province.Name}`);
                        return 1;
                    }
                }
                
                // 3. Prioritize multi-word matches over single-word (more specific)
                if (a.wordCount >= 2 && b.wordCount === 1) return -1;
                if (b.wordCount >= 2 && a.wordCount === 1) return 1;
                
                // 4. Then by score (but only if difference is significant)
                if (Math.abs(a.score - b.score) > 0.15) {
                    return b.score - a.score;
                }
                
                // 5. If scores similar, prefer more words (more specific)
                if (a.wordCount !== b.wordCount) {
                    return b.wordCount - a.wordCount;
                }
                
                // 6. Finally by score
                return b.score - a.score;
            });
            
            const bestCandidate = districtCandidates[0];
            console.log(`  🏆 Best candidate: "${bestCandidate.part}" (strategy: ${bestCandidate.strategy}, extraction: ${bestCandidate.extractionStrategy || 'N/A'}, score: ${bestCandidate.score.toFixed(2)}, words: ${bestCandidate.wordCount})`);
            
            if (bestCandidate.strategy === 'last-2-words-province-match') {
                // This is a province match
                result.province = bestCandidate.province;
                console.log(`  ✅ Province matched from last 2 words: ${result.province.Name}`);
                // Set bestDistrictMatch to null since we only found province
                bestDistrictMatch = null;
                bestDistrictScore = 0;
                
                // NOW: Try to find district within this province
                console.log(`  🔍 Now searching for district within ${result.province.Name}...`);
                
                // IMPROVED: Also try to extract district from ward parts
                // Example: "Xã Cu Kty Krông Bông Đắk Lắk" → extract "Krông Bông" as district
                for (let i = 0; i < parts.length; i++) {
                    const part = parts[i];
                    
                    // Skip the part that matched province
                    if (part === bestCandidate.part) {
                        console.log(`    ⏭️ Skipping province part: "${part}"`);
                        continue;
                    }
                    
                    if (part.length < 4) continue;
                    
                    // Check if this part has ward keyword
                    const normalized = removeVietnameseTones(part).toLowerCase();
                    const hasWardKeyword = /\b(xa|phuong|thi tran|tt|khom)\b/.test(normalized);
                    
                    if (hasWardKeyword) {
                        // Extract potential district names from ward part
                        // Example: "Xã Cu Kty Krông Bông Đắk Lắk" → try "Krông Bông", "Bông Đắk", etc.
                        const afterKeywordMatch = part.match(/(phường|xã|thị trấn|tt|khóm)\s+(.+)/i);
                        if (afterKeywordMatch) {
                            const afterKeyword = afterKeywordMatch[2].trim();
                            const words = afterKeyword.split(/\s+/).filter(w => w.length > 0);
                            
                            // Remove province name from end if present
                            const provinceNameNormalized = removeVietnameseTones(result.province.Name)
                                .toLowerCase()
                                .replace(/^(tinh|thanh pho|tp)\s+/i, '');
                            const provinceWords = provinceNameNormalized.split(/\s+/);
                            
                            // Check if last N words match province name
                            let wordsWithoutProvince = words;
                            if (words.length > provinceWords.length) {
                                const lastNWords = words.slice(-provinceWords.length).join(' ');
                                const lastNWordsNormalized = removeVietnameseTones(lastNWords).toLowerCase();
                                
                                if (lastNWordsNormalized === provinceNameNormalized) {
                                    wordsWithoutProvince = words.slice(0, -provinceWords.length);
                                    console.log(`    🔧 Removed province name from end: "${words.join(' ')}" → "${wordsWithoutProvince.join(' ')}"`);
                                }
                            }
                            
                            // Now try different district extraction strategies
                            const districtCandidates = [];
                            
                            // Strategy 1: Ward=2words, District=next 2 words
                            if (wordsWithoutProvince.length >= 4) {
                                const district2Words = wordsWithoutProvince.slice(2, 4).join(' ');
                                districtCandidates.push(district2Words);
                                console.log(`    📍 District candidate (ward=2, dist=2): "${district2Words}"`);
                            }
                            
                            // Strategy 2: Ward=1word, District=next 2 words
                            if (wordsWithoutProvince.length >= 3) {
                                const district2Words = wordsWithoutProvince.slice(1, 3).join(' ');
                                districtCandidates.push(district2Words);
                                console.log(`    📍 District candidate (ward=1, dist=2): "${district2Words}"`);
                            }
                            
                            // Strategy 3: Last 2 words (before province)
                            if (wordsWithoutProvince.length >= 2) {
                                const last2Words = wordsWithoutProvince.slice(-2).join(' ');
                                districtCandidates.push(last2Words);
                                console.log(`    📍 District candidate (last 2): "${last2Words}"`);
                            }
                            
                            // Try each candidate
                            for (const candidate of districtCandidates) {
                                const districtMatch = fuzzyMatch(candidate, result.province.Districts, 0.7);
                                if (districtMatch) {
                                    const wordCount = candidate.split(/\s+/).length;
                                    const shouldReplace = 
                                        districtMatch.score > bestDistrictScore + 0.05 ||
                                        (Math.abs(districtMatch.score - bestDistrictScore) <= 0.05 && wordCount > bestDistrictWordCount);
                                    
                                    if (shouldReplace) {
                                        bestDistrictMatch = districtMatch;
                                        bestDistrictScore = districtMatch.score;
                                        bestDistrictWordCount = wordCount;
                                        result.district = districtMatch.match;
                                        console.log(`    ✓ District found (from ward part): "${candidate}" → ${districtMatch.match.Name} (score: ${districtMatch.score.toFixed(2)})`);
                                    }
                                }
                            }
                        }
                    } else {
                        // No ward keyword - try direct match
                        const districtMatch = fuzzyMatch(part, result.province.Districts, 0.4);
                        if (districtMatch) {
                            const wordCount = part.split(/\s+/).length;
                            const shouldReplace = 
                                districtMatch.score > bestDistrictScore + 0.05 ||
                                (Math.abs(districtMatch.score - bestDistrictScore) <= 0.05 && wordCount > bestDistrictWordCount);
                            
                            if (shouldReplace) {
                                bestDistrictMatch = districtMatch;
                                bestDistrictScore = districtMatch.score;
                                bestDistrictWordCount = wordCount;
                                result.district = districtMatch.match;
                                console.log(`    ✓ District found: "${part}" → ${districtMatch.match.Name} (score: ${districtMatch.score.toFixed(2)})`);
                            }
                        }
                    }
                }
                
                if (result.district) {
                    console.log(`  ✅ District matched: ${result.district.Name} (score: ${bestDistrictScore.toFixed(2)})`);
                }
            } else {
                // This is a district match
                result.district = bestCandidate.district;
                result.province = bestCandidate.province;
                console.log(`  ✅ Province inferred from district: ${result.province.Name}`);
                console.log(`  ✅ District matched: ${result.district.Name} (score: ${bestCandidate.score.toFixed(2)}, ${bestCandidate.wordCount} words)`);
                
                // ============================================
                // IMPROVEMENT 2: District Name Validation
                // ============================================
                // Check if district name actually appears in original address
                const districtNameNormalized = removeVietnameseTones(result.district.Name)
                    .toLowerCase()
                    .replace(/^(quan|huyen|thanh pho|tp|thi xa|tx)\s+/i, '');
                const addressNormalized = removeVietnameseTones(addressText).toLowerCase();
                
                // Check if district name (or significant part) appears in address
                const districtWords = districtNameNormalized.split(/\s+/).filter(w => w.length >= 3);
                let districtWordsFound = 0;
                
                for (const word of districtWords) {
                    if (addressNormalized.includes(word)) {
                        districtWordsFound++;
                    }
                }
                
                const districtMatchRatio = districtWords.length > 0 ? districtWordsFound / districtWords.length : 0;
                
                if (districtMatchRatio < 0.5 && bestCandidate.score < 0.95) {
                    // District name not clearly in address AND score not perfect
                    console.log(`  ⚠️ District validation warning: Only ${districtWordsFound}/${districtWords.length} words found in address`);
                    result.warnings.push(`⚠️ Tên quận/huyện không rõ ràng trong địa chỉ - Vui lòng kiểm tra lại`);
                    
                    // Downgrade confidence
                    if (result.confidence === 'high') {
                        result.confidence = 'medium';
                    } else if (result.confidence === 'medium') {
                        result.confidence = 'low';
                    }
                    console.log(`  📉 Confidence downgraded due to district validation`);
                } else {
                    console.log(`  ✅ District validation passed: ${districtWordsFound}/${districtWords.length} words found`);
                }
                
                // Set bestDistrictMatch for legacy code compatibility
                bestDistrictMatch = { match: bestCandidate.district, score: bestCandidate.score };
                bestDistrictScore = bestCandidate.score;
                bestDistrictWordCount = bestCandidate.wordCount;
            }
            result.confidence = 'medium'; // Lower confidence since inferred
        }
    }
    
    if (result.district && !bestDistrictMatch) {
        // Legacy code path - should not reach here anymore
        bestDistrictMatch = { match: result.district };
        bestDistrictScore = 0.8;
        bestDistrictWordCount = 1;
    }
    
    if (bestDistrictMatch) {
        // Upgrade confidence based on district match quality
        if (bestDistrictScore >= 0.9) {
            // Perfect or near-perfect match
            if (result.confidence === 'low') {
                result.confidence = 'medium';
            }
        } else if (bestDistrictScore >= 0.7) {
            // Good match
            if (result.confidence === 'low') {
                result.confidence = 'medium';
            }
        }
        // Note: Don't set 'high' yet - wait for ward
    } else {
        console.log(`  ⚠️ No district found`);
    }
    
    } // End of else block for Step 2 (closes the else that started at line 906)
    
    // ============================================
    // STEP 2.5: REVERSE LOOKUP - Find Ward first, then infer District/Province
    // ============================================
    // If no district found, try to find ward directly across ALL provinces
    // Then infer district and province from the ward
    if (!result.district && !result.ward) {
        console.log('  🔍 Step 2.5: Reverse Lookup - Finding Ward across all provinces...');
        
        let bestWardMatch = null;
        let bestWardScore = 0;
        let wardParentDistrict = null;
        let wardParentProvince = null;
        
        // Check parts with ward keywords
        const wardKeywords = ['phuong', 'xa', 'thi tran', 'tt', 'khom'];
        
        for (const part of parts) {
            const normalized = removeVietnameseTones(part).toLowerCase();
            const hasWardKeyword = wardKeywords.some(kw => normalized.includes(kw));
            
            if (hasWardKeyword && part.length >= 4) {
                console.log(`    🔍 Checking ward part: "${part}"`);
                
                // IMPROVED: Extract ward name from part BEFORE searching
                // Example: "xa thuan thanh can giuoc long an" → extract "thuan thanh" (2 words after "xa")
                const afterKeywordMatch = part.match(/(phường|phuong|xã|xa|thị trấn|thi tran|tt|khóm|khom|ấp|ap|thôn|thon|xóm|xom)\s+(.+)/i);
                
                if (afterKeywordMatch) {
                    const afterKeyword = afterKeywordMatch[2].trim();
                    const words = afterKeyword.split(/\s+/).filter(w => w.length > 0);
                    
                    // Try different ward name lengths (1-3 words)
                    const wardCandidates = [];
                    
                    // Most common: 2 words
                    if (words.length >= 2) {
                        wardCandidates.push({
                            text: words.slice(0, 2).join(' '),
                            length: 2,
                            priority: 1 // Highest priority
                        });
                    }
                    
                    // Also try 3 words
                    if (words.length >= 3) {
                        wardCandidates.push({
                            text: words.slice(0, 3).join(' '),
                            length: 3,
                            priority: 2
                        });
                    }
                    
                    // Also try 1 word (least common)
                    if (words.length >= 1) {
                        wardCandidates.push({
                            text: words[0],
                            length: 1,
                            priority: 3
                        });
                    }
                    
                    // Also try full text (fallback)
                    wardCandidates.push({
                        text: part,
                        length: words.length,
                        priority: 4
                    });
                    
                    console.log(`    📝 Ward candidates: ${wardCandidates.length} - ${wardCandidates.map(c => `"${c.text}" (${c.length}w)`).join(', ')}`);
                    
                    // Search each candidate
                    for (const candidate of wardCandidates) {
                        const wardText = candidate.text;
                        
                        // Search across provinces (filtered if province already found)
                        // IMPORTANT: If province found in Step 1, only search in that province
                        const provincesToSearch = result.province ? [result.province] : vietnamAddressData;
                        
                        for (const province of provincesToSearch) {
                            for (const district of province.Districts) {
                                const wardMatch = fuzzyMatch(wardText, district.Wards, 0.7);
                                if (wardMatch) {
                                    // IMPORTANT: Check if ward name is valid (not undefined)
                                    if (!wardMatch.match || !wardMatch.match.Name) {
                                        console.log(`      ⚠️ Skipping invalid ward (undefined name)`);
                                        continue;
                                    }
                                    
                                    // IMPROVED: Check if district name appears in ORIGINAL part
                                    // This helps avoid false matches
                                    const districtNameNormalized = removeVietnameseTones(district.Name).toLowerCase()
                                        .replace(/^(quan|huyen|thanh pho|tp|thi xa|tx)\s+/i, '');
                                    
                                    const partNormalized = removeVietnameseTones(part).toLowerCase();
                                    const districtInPart = partNormalized.includes(districtNameNormalized);
                                    
                                    // Calculate final score with bonuses
                                    let finalScore = wardMatch.score;
                                    
                                    // Bonus 1: District name in part
                                    if (districtInPart) {
                                        finalScore += 0.20;
                                        console.log(`      ✓ Ward candidate: "${wardText}" → ${wardMatch.match.Name} in ${district.Name}, ${province.Name} (score: ${wardMatch.score.toFixed(2)} + 0.20 district bonus = ${finalScore.toFixed(2)})`);
                                    } else {
                                        console.log(`      ✓ Ward candidate: "${wardText}" → ${wardMatch.match.Name} in ${district.Name}, ${province.Name} (score: ${wardMatch.score.toFixed(2)})`);
                                    }
                                    
                                    // Bonus 2: Shorter ward name (more precise)
                                    // 2 words is ideal, 3 words is ok, 1 word or full text is less ideal
                                    if (candidate.length === 2) {
                                        finalScore += 0.15;
                                    } else if (candidate.length === 3) {
                                        finalScore += 0.10;
                                    } else if (candidate.length === 1) {
                                        finalScore += 0.05;
                                    }
                                    // Full text gets no bonus
                                    
                                    if (finalScore > bestWardScore) {
                                        bestWardScore = finalScore;
                                        bestWardMatch = wardMatch.match;
                                        wardParentDistrict = district;
                                        wardParentProvince = province;
                                    }
                                }
                            }
                        }
                    }
                } else {
                    // No keyword match - try full part (fallback)
                    const provincesToSearch = result.province ? [result.province] : vietnamAddressData;
                    
                    for (const province of provincesToSearch) {
                        for (const district of province.Districts) {
                            const wardMatch = fuzzyMatch(part, district.Wards, 0.7);
                            if (wardMatch && wardMatch.score > bestWardScore) {
                                if (!wardMatch.match || !wardMatch.match.Name) {
                                    continue;
                                }
                                
                                const districtNameNormalized = removeVietnameseTones(district.Name).toLowerCase()
                                    .replace(/^(quan|huyen|thanh pho|tp|thi xa|tx)\s+/i, '');
                                
                                const addressTextNormalized = removeVietnameseTones(addressText).toLowerCase();
                                const districtInAddress = addressTextNormalized.includes(districtNameNormalized);
                                
                                let finalScore = wardMatch.score;
                                if (districtInAddress) {
                                    finalScore += 0.15;
                                }
                                
                                if (finalScore > bestWardScore) {
                                    bestWardScore = finalScore;
                                    bestWardMatch = wardMatch.match;
                                    wardParentDistrict = district;
                                    wardParentProvince = province;
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // STRICTER THRESHOLD: 0.85 instead of 0.7 to avoid false matches
        if (bestWardMatch && bestWardScore >= 0.85) {
            result.ward = bestWardMatch;
            result.district = wardParentDistrict;
            result.province = wardParentProvince;
            
            // Set confidence based on match quality
            if (bestWardScore >= 0.95) {
                result.confidence = 'high'; // Near-perfect reverse lookup
            } else {
                result.confidence = 'medium'; // Good reverse lookup
            }
            
            console.log(`  ✅ Reverse Lookup SUCCESS: ${result.ward.Name} → ${result.district.Name} → ${result.province.Name} (confidence: ${result.confidence})`);
        } else if (bestWardMatch) {
            console.log(`  ⚠️ Reverse Lookup: Ward score too low (${bestWardScore.toFixed(2)} < 0.85)`);
        } else {
            console.log(`  ⚠️ Reverse Lookup: No ward found`);
        }
    }
    
    // ============================================
    // EARLY STREET EXTRACTION (for PASS 0)
    // ============================================
    // Extract street address BEFORE ward matching for learning database
    // This is a simplified extraction - full extraction happens in Step 4
    if (result.district) {
        // Strategy 1: Use the first part that was split (if available)
        // Example: parts = ["595/15f cmt8", "Phường 15", "quận 10"]
        // → Street = "595/15f cmt8"
        // IMPORTANT: Skip this strategy if n-gram was used (originalFullAddress exists)
        
        const usedNGram = (typeof originalFullAddress !== 'undefined');
        
        if (parts.length > 1 && !usedNGram) {
            // Check if first part looks like street address (no location keywords)
            const firstPart = parts[0];
            const normalized = removeVietnameseTones(firstPart).toLowerCase();
            const locationKeywords = ['phuong', 'xa', 'quan', 'huyen', 'thanh pho', 'tp', 'tinh', 'thi tran', 'tt', 'thi xa', 'tx', 'khom'];
            const hasLocationKeyword = locationKeywords.some(kw => normalized.includes(kw));
            
            // Check if first part matches province name
            const isProvinceName = result.province && 
                fuzzyMatch(firstPart, [result.province], 0.7) && 
                fuzzyMatch(firstPart, [result.province], 0.7).score >= 0.7;
            
            if (!hasLocationKeyword && !isProvinceName && firstPart.length >= 3) {
                result.street = firstPart;
                console.log(`  🏠 Early street extraction (from split parts): "${result.street}"`);
            } else if (isProvinceName) {
                console.log(`  ⏭️ Skipping province name as street: "${firstPart}"`);
                
                // Look for locality markers (xóm, thôn, ấp...) in other parts
                for (const part of parts) {
                    const partNormalized = removeVietnameseTones(part).toLowerCase();
                    if (/\b(xom|thon|ap|khom|khu|to|cum|bon|lang)\b/.test(partNormalized)) {
                        result.street = part;
                        console.log(`  🏠 Early street extraction (locality): "${result.street}"`);
                        break;
                    }
                }
            }
        } else if (usedNGram) {
            console.log(`  ⏭️ Skipping Strategy 1 (n-gram was used, will use original full address)`);
        }
        
        // Strategy 2: If no street from parts, extract from original addressText
        // IMPORTANT: Use originalFullAddress if available (when n-gram was used)
        if (!result.street) {
            const addressForStreetExtraction = (typeof originalFullAddress !== 'undefined') ? originalFullAddress : addressText;
            
            // PRIORITY 1: Check for locality markers (xóm, thôn, ấp, khu...)
            // These are the most specific street addresses
            // Example: "phú thọ huyện Tân sơn xã thu ngạc xóm cọ sơn" → street = "xóm cọ sơn"
            const normalizedForLocality = removeVietnameseTones(addressForStreetExtraction).toLowerCase();
            const localityMatch = normalizedForLocality.match(/\b(xom|thon|ap|khom|khu|to|cum|bon|lang)\s+[^\s,]+(?:\s+[^\s,]+)*/i);
            
            if (localityMatch) {
                // Extract locality from original text (preserve Vietnamese tones)
                const localityStart = localityMatch.index;
                // Find end: take until next comma or location keyword
                let localityEnd = addressForStreetExtraction.length;
                const afterLocality = addressForStreetExtraction.substring(localityStart);
                const endMatch = afterLocality.match(/[,，]|\s+(xa|phuong|quan|huyen|tinh|thanh pho|thi xa|thi tran)\s+/i);
                if (endMatch) {
                    localityEnd = localityStart + endMatch.index;
                }
                
                result.street = addressForStreetExtraction.substring(localityStart, localityEnd).trim();
                console.log(`  🏠 Early street extraction (locality marker): "${result.street}"`);
            } else {
            
            const districtName = removeVietnameseTones(result.district.Name).toLowerCase()
                .replace(/^(quan|huyen|thanh pho|tp|thi xa|tx)\s+/i, ''); // Remove prefix
            
            const normalizedAddress = removeVietnameseTones(addressForStreetExtraction).toLowerCase();
            
            // IMPROVED: Check for landmarks FIRST (sau, gần, đối diện...)
            // Extract street BEFORE landmark
            // Example: "ngõ 2 sau đình hậu dưỡng đông anh" → street = "ngõ 2"
            const landmarkPattern = /^(.+?)\s+(sau|gan|doi dien|canh|truoc|ben)\s+/i;
            const landmarkMatch = normalizedAddress.match(landmarkPattern);
            
            if (landmarkMatch && landmarkMatch[1]) {
                result.street = addressForStreetExtraction.substring(0, landmarkMatch[1].length).trim();
                console.log(`  🏠 Early street extraction (before landmark): "${result.street}"`);
            } else {
            
            // Find LAST occurrence of district name
            const occurrences = [];
            let index = normalizedAddress.indexOf(districtName);
            while (index !== -1) {
                occurrences.push(index);
                index = normalizedAddress.indexOf(districtName, index + 1);
            }
            
            if (occurrences.length > 0) {
                // Use LAST occurrence (most likely the actual district mention)
                const lastIndex = occurrences[occurrences.length - 1];
                
                // Look backwards from lastIndex to find district keyword
                const beforeDistrict = normalizedAddress.substring(0, lastIndex).trim();
                const districtKeywords = ['quan', 'huyen', 'thanh pho', 'tp', 'thi xa', 'tx'];
                
                let actualDistrictStart = lastIndex;
                
                // Check if there's a district keyword right before the district name
                for (const keyword of districtKeywords) {
                    const keywordIndex = beforeDistrict.lastIndexOf(keyword);
                    if (keywordIndex !== -1) {
                        // Check if keyword is right before district name (with optional space)
                        const textBetween = beforeDistrict.substring(keywordIndex + keyword.length).trim();
                        if (textBetween === '' || normalizedAddress.substring(keywordIndex).startsWith(keyword + ' ' + districtName)) {
                            actualDistrictStart = keywordIndex;
                            break;
                        }
                    }
                }
                
                // Now find the FIRST location keyword (ward/district) to extract street before it
                // IMPORTANT: Use word boundary check to avoid matching "tx" in "ktx" or "tt" in other words
                const allLocationKeywords = ['phuong', 'xa', 'quan', 'huyen', 'thanh pho', 'tp', 'tinh', 'thi tran', 'tt', 'thi xa', 'tx', 'khom'];
                let firstKeywordIndex = actualDistrictStart;
                
                for (const keyword of allLocationKeywords) {
                    // Use regex with word boundary for short keywords (tt, tx, tp)
                    if (keyword === 'tt' || keyword === 'tx' || keyword === 'tp') {
                        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
                        const match = normalizedAddress.match(regex);
                        if (match && match.index < firstKeywordIndex) {
                            firstKeywordIndex = match.index;
                        }
                    } else {
                        const keywordIndex = normalizedAddress.indexOf(keyword);
                        if (keywordIndex !== -1 && keywordIndex < firstKeywordIndex) {
                            firstKeywordIndex = keywordIndex;
                        }
                    }
                }
                
                result.street = addressForStreetExtraction.substring(0, firstKeywordIndex).trim();
                
                if (occurrences.length > 1) {
                    console.log(`  🏠 Early street extraction (last of ${occurrences.length} occurrences): "${result.street}"`);
                } else {
                    console.log(`  🏠 Early street extraction (before first location keyword): "${result.street}"`);
                }
            }
            
            } // End of else block (no landmark found)
            } // End of else block (no locality marker)
        }
        
        // Strategy 3: Fallback - regex to find text before first location keyword
        // IMPORTANT: Don't match "TX" if it's part of "KTX" (ký túc xá)
        // Use word boundary \b to avoid matching within words
        if (!result.street && addressText) {
            const addressForFallback = (typeof originalFullAddress !== 'undefined') ? originalFullAddress : addressText;
            const match = addressForFallback.match(/^(.+?)\s*(?:phường|xã|quận|huyện|thị trấn|\btt\b|thành phố|tp|tỉnh|thị xã|\btx\b|khóm)/i);
            if (match && match[1].trim()) {
                result.street = match[1].trim();
                console.log(`  🏠 Early street extraction (regex): "${result.street}"`);
            }
        }
    }
    
    // ============================================
    // PASS 0: Learning Database (Highest Priority)
    // ============================================
    // Check if we have learned this address pattern before
    // This is MUCH faster than fuzzy matching (50ms vs 200-500ms)
    // IMPORTANT: Run BEFORE Step 3 (fuzzy ward matching)
    if (result.district && result.street && !result.ward) {
        console.log('🔍 PASS 0: Checking Learning Database...');
        console.log(`   District: ${result.district.Name} (ID: ${result.district.Id})`);
        console.log(`   Street: "${result.street}"`);
        
        try {
            // ============================================
            // OPTIMIZATION: Expanded keyword extraction
            // ============================================
            let keywords = [];
            
            // CRITICAL: If landmark exists, extract keywords from ORIGINAL address (before landmark extraction)
            // This ensures we capture locality names like "Hậu Dưỡng" that come after landmark
            // Example: "sau đình hậu dưỡng đông anh" → extract from full text, not just "sau đình"
            const originalAddress = landmarkInfo && landmarkInfo.landmark 
                ? (landmarkInfo.street + ' ' + landmarkInfo.landmark + ' ' + addressText).trim()
                : addressText;
            
            const landmarkKeywords = extractAddressKeywords(originalAddress);
            keywords.push(...landmarkKeywords);
            
            if (landmarkInfo && landmarkInfo.landmark) {
                console.log(`   🏷️ Landmark keywords from full address: ${landmarkKeywords.length} - [${landmarkKeywords.join(', ')}]`);
            }
            
            // Original: Locality markers from clean address
            const localityKeywords = extractAddressKeywords(addressText);
            keywords.push(...localityKeywords);
            
            // NEW: Street names and numbers (if enabled)
            if (OPTIMIZATION_FLAGS.LEARNING_EXPANDED) {
                const streetNames = extractStreetNames(addressText);
                keywords.push(...streetNames);
                
                const streetNumbers = extractStreetNumbers(addressText);
                keywords.push(...streetNumbers);
                
                console.log(`   📊 Keywords: locality=${localityKeywords.length}, streets=${streetNames.length}, numbers=${streetNumbers.length}`);
            }
            
            // Remove duplicates
            keywords = [...new Set(keywords)];
            
            console.log(`   📝 Total keywords: ${keywords.length} - [${keywords.join(', ')}]`);
            
            if (keywords.length > 0) {
                // Search in learning database
                const learningResult = await searchAddressLearning(keywords, result.district.Id);
                
                if (learningResult.found) {
                    console.log(`   ✅ Found in learning DB!`);
                    console.log(`      Ward ID: ${learningResult.ward_id}`);
                    console.log(`      Ward Name: ${learningResult.ward_name}`);
                    console.log(`      Confidence: ${learningResult.confidence} (need ≥2 to auto-fill)`);
                    
                    // Only auto-fill if confidence >= 2 (confirmed at least twice)
                    // This prevents false positives from single incorrect entries
                    if (learningResult.confidence >= 2) {
                        // Find ward object from ID
                        // IMPORTANT: Compare both as strings and numbers (API may return different formats)
                        console.log(`   🔍 Searching for ward ID: ${learningResult.ward_id} (type: ${typeof learningResult.ward_id})`);
                        console.log(`   📊 District has ${result.district.Wards.length} wards`);
                        
                        const learnedWard = result.district.Wards.find(w => {
                            // Try both strict and loose comparison
                            return w.Id == learningResult.ward_id || // Loose (493 == "493")
                                   w.Id === learningResult.ward_id || // Strict
                                   w.Id === String(learningResult.ward_id) || // String comparison
                                   parseInt(w.Id) === parseInt(learningResult.ward_id); // Number comparison
                        });
                        
                        if (learnedWard) {
                            result.ward = learnedWard;
                            result.confidence = 'high';
                            console.log(`   🎯 PASS 0 SUCCESS: Auto-filled ward "${learnedWard.Name}" (ID: ${learnedWard.Id})`);
                            console.log(`   ⚡ Skipping Step 3 (fuzzy matching)`);
                            
                            // Extract street address (skip to Step 4)
                            // This is a simplified version - full logic is in Step 4 below
                            if (addressText.includes(',') || addressText.includes('.')) {
                                // Has separators - already extracted in result.street
                            } else {
                                // No separators - take first 3-5 words
                                const words = addressText.split(/\s+/);
                                result.street = words.slice(0, Math.min(5, words.length)).join(' ');
                            }
                            
                            console.log('  🏠 Street address:', result.street || '(none)');
                            
                            // Return early - skip fuzzy matching (Step 3)
                            return result;
                        } else {
                            console.warn(`   ⚠️ Ward ID ${learningResult.ward_id} not found in district wards`);
                            // Debug: Show first 3 ward IDs
                            const sampleWards = result.district.Wards.slice(0, 3).map(w => `${w.Name} (ID: ${w.Id}, type: ${typeof w.Id})`);
                            console.warn(`   📋 Sample wards: ${sampleWards.join(', ')}`);
                        }
                    } else {
                        console.log(`   ⏭️ Confidence too low (${learningResult.confidence} < 1), will use fuzzy matching`);
                    }
                } else {
                    console.log(`   ❌ Not found in learning DB, will use fuzzy matching`);
                }
            } else {
                console.log(`   ⚠️ No keywords extracted from street address`);
            }
        } catch (error) {
            console.error('   ❌ PASS 0 Error:', error);
            console.log('   ⏭️ Falling back to fuzzy matching');
        }
    }
    
    // Step 3: Find Ward - PRIORITIZE LONGER PHRASES with keywords
    // IMPORTANT: Only run if PASS 0 didn't find a ward
    if (result.district && !result.ward) {
        console.log('  🔍 Step 3: Finding Ward (fuzzy matching)...');
        let bestWardMatch = null;
        let bestWardScore = 0;
        let bestWardWordCount = 0;
        let bestWardInputText = null;  // Track input text for validation
        
        // Priority keywords for wards
        const wardKeywords = ['phuong', 'xa', 'thi tran', 'tt'];
        
        // ============================================
        // PRE-SCAN 2.0: Intelligent Ward Matching with Context-Aware Scoring
        // ============================================
        // This prevents n-gram from splitting ward names incorrectly
        // Uses smart scoring system to prioritize best matches
        console.log('    🔍 Pre-scan 2.0: Intelligent ward search with context scoring...');
        const originalNormalized = removeVietnameseTones(addressText).toLowerCase();
        const inputLength = originalNormalized.length;
        
        // Track all candidates with scores
        const wardCandidates = [];
        
        for (const ward of result.district.Wards) {
            const wardNameNormalized = removeVietnameseTones(ward.Name).toLowerCase();
            const wardNameClean = wardNameNormalized.replace(/^(xa|phuong|thi tran|tt|khom)\s+/i, '');
            const wardWords = wardNameClean.split(/\s+/).filter(w => w.length > 0);
            
            // Skip if ward name is too short (< 2 chars total)
            if (wardNameClean.length < 2) continue;
            
            // Build flexible pattern to find ward name
            // Supports: "Tân Lập", "xã Tân Lập", "p15", "phường 15"
            const wardPattern = `(xa|phuong|thi tran|tt|khom|p\\.?)?\\s*(${wardWords.join('\\s+')})`;
            const regex = new RegExp(wardPattern, 'gi');
            let match;
            
            while ((match = regex.exec(originalNormalized)) !== null) {
                const matchedText = match[0].trim();
                const matchIndex = match.index;
                const hasWardKeyword = match[1] ? true : false;
                
                // ============================================
                // SCORING SYSTEM
                // ============================================
                let score = 1.0; // Base score
                const scoreDetails = [];
                
                // BONUS: Has ward keyword before match (+0.3)
                if (hasWardKeyword) {
                    score += 0.3;
                    scoreDetails.push('ward_keyword(+0.3)');
                }
                
                // BONUS: Multi-word ward name (+0.2)
                if (wardWords.length >= 2) {
                    score += 0.2;
                    scoreDetails.push('multi_word(+0.2)');
                }
                
                // BONUS: Match position in middle of address (+0.1)
                const relativePosition = matchIndex / inputLength;
                if (relativePosition > 0.2 && relativePosition < 0.8) {
                    score += 0.1;
                    scoreDetails.push('mid_position(+0.1)');
                }
                
                // ============================================
                // CONTEXT ANALYSIS (Check surrounding text)
                // ============================================
                const textBefore = originalNormalized.substring(Math.max(0, matchIndex - 25), matchIndex);
                const textAfter = originalNormalized.substring(matchIndex + matchedText.length, Math.min(inputLength, matchIndex + matchedText.length + 25));
                
                // PENALTY: District keyword before match (-0.5)
                // Example: "huyện thanh chuong" → "thanh chuong" is district, not ward
                if (/(huyen|quan|thanh pho|tp|thi xa|tx)\s*$/i.test(textBefore)) {
                    score -= 0.5;
                    scoreDetails.push('district_before(-0.5)');
                }
                
                // PENALTY: Street keyword before match (-0.3)
                // Example: "đường thanh long" → "thanh long" is street, not ward
                if (/(duong|pho|hem|ngo|lo)\s*$/i.test(textBefore)) {
                    score -= 0.3;
                    scoreDetails.push('street_before(-0.3)');
                }
                
                // PENALTY: Province keyword after match (-0.2)
                // Example: "thanh hoa tinh" → "thanh hoa" is province, not ward
                if (/^\s*(tinh|thanh pho)/i.test(textAfter)) {
                    score -= 0.2;
                    scoreDetails.push('province_after(-0.2)');
                }
                
                // PENALTY: Single-word ward without keyword (-0.1)
                // Example: "15 quận 10" → less confident than "phường 15 quận 10"
                if (wardWords.length === 1 && !hasWardKeyword) {
                    score -= 0.1;
                    scoreDetails.push('single_word_no_keyword(-0.1)');
                }
                
                // Store candidate
                wardCandidates.push({
                    ward: ward,
                    score: score,
                    matchedText: matchedText,
                    matchIndex: matchIndex,
                    wordCount: wardWords.length,
                    hasKeyword: hasWardKeyword,
                    scoreDetails: scoreDetails
                });
                
                console.log(`    📊 Candidate: "${matchedText}" → ${ward.Name} (score: ${score.toFixed(2)}) [${scoreDetails.join(', ')}]`);
            }
        }
        
        // ============================================
        // SELECT BEST CANDIDATE
        // ============================================
        if (wardCandidates.length > 0) {
            // Sort by score (highest first), then by position (earlier first), then by word count
            wardCandidates.sort((a, b) => {
                // 1. Score difference > 0.05 → prefer higher score
                if (Math.abs(a.score - b.score) > 0.05) {
                    return b.score - a.score;
                }
                // 2. Same score → prefer earlier position (first ward in text)
                if (Math.abs(a.matchIndex - b.matchIndex) > 5) {
                    return a.matchIndex - b.matchIndex;
                }
                // 3. Same position → prefer longer word count
                return b.wordCount - a.wordCount;
            });
            
            const bestCandidate = wardCandidates[0];
            
            // Use threshold to determine if match is good enough
            if (bestCandidate.score >= 1.2) {
                // High confidence - use immediately
                bestWardMatch = { match: bestCandidate.ward, score: bestCandidate.score };
                bestWardScore = bestCandidate.score;
                bestWardWordCount = bestCandidate.wordCount;
                bestWardInputText = removeVietnameseTones(bestCandidate.ward.Name)
                    .toLowerCase()
                    .replace(/^(xa|phuong|thi tran|tt|khom)\s+/i, '');
                console.log(`    ✅ Best match: "${bestCandidate.matchedText}" → ${bestCandidate.ward.Name} (score: ${bestCandidate.score.toFixed(2)})`);
            } else if (bestCandidate.score >= 0.9) {
                // Medium confidence - use but continue checking
                bestWardMatch = { match: bestCandidate.ward, score: bestCandidate.score };
                bestWardScore = bestCandidate.score;
                bestWardWordCount = bestCandidate.wordCount;
                bestWardInputText = removeVietnameseTones(bestCandidate.ward.Name)
                    .toLowerCase()
                    .replace(/^(xa|phuong|thi tran|tt|khom)\s+/i, '');
                console.log(`    ⚠️ Medium confidence: "${bestCandidate.matchedText}" → ${bestCandidate.ward.Name} (score: ${bestCandidate.score.toFixed(2)})`);
            } else {
                // Low confidence - skip and use n-gram
                console.log(`    ❌ Low confidence: best score ${bestCandidate.score.toFixed(2)} < 0.9, will use n-gram matching`);
            }
        } else {
            console.log(`    ℹ️ No pre-scan candidates found`);
        }
        
        // If pre-scan found a good match, use it and skip n-gram matching
        if (bestWardScore >= 1.2) {
            result.ward = bestWardMatch.match;
            console.log(`  ✅ Ward matched (pre-scan): ${result.ward.Name} (score: ${bestWardScore.toFixed(2)})`);
        } else {
            // Pre-scan didn't find good match, continue with normal flow
            if (bestWardScore > 0) {
                console.log(`    ⏭️ Pre-scan score ${bestWardScore.toFixed(2)} < 1.2, continuing with n-gram matching...`);
            }
        } // End of pre-scan else block
        
        // ============================================
        // Track which part was used for district to avoid reusing it
        // IMPORTANT: Define this OUTSIDE the pre-scan block so it's always available
        // ============================================
        let districtPartIndex = -1;
        let shortestDistrictMatchLength = Infinity;
        
        for (let i = 0; i < parts.length; i++) {
            const match = fuzzyMatch(parts[i], [result.district], 0.7);
            if (match && match.score >= 0.7) {
                const partLength = parts[i].length;
                
                // Prefer shorter matches (more precise)
                if (partLength < shortestDistrictMatchLength) {
                    districtPartIndex = i;
                    shortestDistrictMatchLength = partLength;
                    console.log(`    📍 District part candidate: ${i} ("${parts[i]}", length: ${partLength})`);
                }
            }
        }
        
        if (districtPartIndex >= 0) {
            console.log(`    ✅ District part index: ${districtPartIndex} ("${parts[districtPartIndex]}")`);
        }
        
        // Only continue with n-gram matching if pre-scan didn't find a good match
        if (bestWardScore < 1.2) {
            // First pass: Check parts with ward keywords (higher priority)
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                
                // Skip if this part was used for province
                // IMPORTANT: Only skip if it's ACTUALLY a province (not a ward with province-like name)
                if (i === provincePartIndex) {
                    // Check if this part has ward keyword - if yes, DON'T skip it!
                const normalized = removeVietnameseTones(part).toLowerCase();
                const hasWardKeyword = wardKeywords.some(kw => normalized.includes(kw));
                
                if (!hasWardKeyword) {
                    console.log(`    ⏭️ Skipping province part: "${part}"`);
                    continue;
                } else {
                    console.log(`    ✓ Province part has ward keyword, will check: "${part}"`);
                }
            }
            
            // IMPROVED: Skip if this part matches district name exactly
            // Example: "Mê Linh" matches "Huyện Mê Linh" → Skip when finding ward
            // This prevents matching "Xã Mê Linh" when district is "Huyện Mê Linh"
            const isDistrictPart = (i === districtPartIndex);
            if (isDistrictPart) {
                const normalizedPart = removeVietnameseTones(part).toLowerCase();
                const normalizedDistrictName = removeVietnameseTones(result.district.Name).toLowerCase()
                    .replace(/^(quan|huyen|thanh pho|tp|thi xa|tx)\s+/i, '');
                
                // If part matches district name (without prefix), skip it
                if (normalizedPart === normalizedDistrictName || normalizedDistrictName.includes(normalizedPart)) {
                    console.log(`    ⏭️ Skipping district part: "${part}" (matches district name)`);
                    continue;
                }
            }
            
            const normalized = removeVietnameseTones(part).toLowerCase();
            const hasKeyword = wardKeywords.some(kw => normalized.includes(kw));
            
            if (hasKeyword && part.length >= 4) {
                // Extract ward name from part - SMART STRATEGY
                // Handle multiple patterns:
                // 1. "phường 14" → "phường 14"
                // 2. "phường 14 gò vấp" → "phường 14" (district name after)
                // 3. "xã tân vĩnh hiệp tân uyên" → "xã tân vĩnh hiệp" (district name after)
                
                let wardPart = part;
                let possibleDistrictName = null;
                
                // Strategy 1: Smart ward extraction with district verification
                // IMPROVED: Try to match exact ward names from database first
                // Example: "xã Nhơn An thị xã An Nhơn" → should match "Xã Nhơn An" exactly
                
                let wardMatch = null;
                let bestWardLength = 0;
                let exactWardMatch = null;
                
                // STEP 1: Try to find exact ward name match in database (if district known)
                if (result.district && result.district.Wards) {
                    console.log(`    🔍 Trying exact ward match in ${result.district.Wards.length} wards...`);
                    
                    // CRITICAL: Search in ORIGINAL input, not just current part
                    // This handles cases where n-grams split ward name incorrectly
                    // Example: "xã Phước Hòa Phú Giáo" → should find "Phước Hòa" even if n-gram is "Phước Phú"
                    const originalInput = addressText; // Use original full address
                    const originalNormalized = removeVietnameseTones(originalInput).toLowerCase();
                    
                    // CRITICAL: Exclude district and province names from search
                    // Example: "huyện thanh chuong" should NOT match "Thị trấn Thanh Chương"
                    const districtNameNormalized = removeVietnameseTones(result.district.Name)
                        .toLowerCase()
                        .replace(/^(quan|huyen|thanh pho|tp|thi xa|tx)\s+/i, '');
                    const provinceNameNormalized = result.province ? 
                        removeVietnameseTones(result.province.Name)
                            .toLowerCase()
                            .replace(/^(tinh|thanh pho|tp)\s+/i, '') : '';
                    
                    // Try matching each ward name in the ORIGINAL input
                    for (const ward of result.district.Wards) {
                        const wardNameNormalized = removeVietnameseTones(ward.Name).toLowerCase();
                        const partNormalized = removeVietnameseTones(part).toLowerCase();
                        
                        // Remove ward keyword from both for comparison
                        const wardNameClean = wardNameNormalized.replace(/^(xa|phuong|thi tran|tt|khom)\s+/i, '');
                        const wardWords = wardNameClean.split(/\s+/);
                        
                        // CRITICAL: Skip if ward name is same as district name
                        // Example: "Thanh Chương" is both district and ward name
                        if (wardNameClean === districtNameNormalized) {
                            console.log(`    ⏭️ Skipping ward "${ward.Name}" - same as district name`);
                            continue;
                        }
                        
                        // CRITICAL: For numbered wards (Phường 1, Phường 2, etc.), require ward keyword
                        // Example: "7" in "nguyên thi bảy" should NOT match "Phường 7"
                        // Only match "P7", "Phường 7", "p.7", etc.
                        const isNumberedWard = /^\d+$/.test(wardNameClean);
                        
                        // IMPROVED: Check if ALL ward name words appear in sequence in ORIGINAL input
                        // Example: "Phước Hoà" should match in "xã Phước Hòa Phú Giáo"
                        // Build flexible regex that handles tone variations
                        const buildFlexiblePattern = (text) => {
                            const charMap = {
                                'a': '[aàáảãạăắằẳẵặâấầẩẫậ]',
                                'e': '[eèéẻẽẹêếềểễệ]',
                                'i': '[iìíỉĩị]',
                                'o': '[oòóỏõọôốồổỗộơớờởỡợ]',
                                'u': '[uùúủũụưứừửữự]',
                                'y': '[yỳýỷỹỵ]',
                                'd': '[dđ]'
                            };
                            
                            const normalized = removeVietnameseTones(text).toLowerCase();
                            let flexPattern = '';
                            
                            for (const char of normalized) {
                                if (charMap[char]) {
                                    flexPattern += charMap[char];
                                } else {
                                    flexPattern += char;
                                }
                            }
                            
                            return flexPattern;
                        };
                        
                        // Build pattern for ward name with flexible tone matching
                        let wardPattern;
                        if (isNumberedWard) {
                            // For numbered wards, REQUIRE ward keyword before the number
                            // Match: "P6", "Phường 6", "p.6", "F6", etc.
                            wardPattern = `(xã|phường|thị trấn|tt|khóm|[pf])\\.?\\s*${wardNameClean}`;
                        } else {
                            // For named wards, allow with or without keyword
                            wardPattern = `(xã|phường|thị trấn|tt|khóm)?\\s*(${wardWords.map(w => buildFlexiblePattern(w)).join('\\s+')})`;
                        }
                        
                        // Try to find ward name in ORIGINAL input
                        const regex = new RegExp(wardPattern + `(?=\\s|$|\\\\)`, 'i');
                        const match = originalInput.match(regex);
                        
                        if (match) {
                            const fullMatch = match[0].trim();
                            const hasKeyword = match[1] !== undefined;
                            
                            // CRITICAL: Check if this match is part of district/province name
                            // Example: "thanh chuong" in "huyện thanh chuong" should be skipped
                            // Example: "Bình Định" in "tỉnh Bình Định" should be skipped
                            const matchIndex = originalInput.toLowerCase().indexOf(fullMatch.toLowerCase());
                            
                            // Check 30 characters before and after for better context
                            const beforeMatch = originalInput.substring(Math.max(0, matchIndex - 30), matchIndex).toLowerCase();
                            const afterMatch = originalInput.substring(matchIndex + fullMatch.length, matchIndex + fullMatch.length + 30).toLowerCase();
                            
                            // Check if preceded by district/province keywords
                            const hasDistrictKeywordBefore = /(quan|huyen|thanh pho|tp|thi xa|tx)\s*$/i.test(beforeMatch);
                            const hasProvinceKeywordBefore = /(tinh|thanh pho|tp)\s*$/i.test(beforeMatch);
                            
                            // CRITICAL: Also check if this match is the province name itself
                            // Example: "Bình Định" should not match if it's the province name
                            const matchNormalized = removeVietnameseTones(fullMatch).toLowerCase();
                            const isProvinceName = provinceNameNormalized && matchNormalized === provinceNameNormalized;
                            
                            if (hasDistrictKeywordBefore || hasProvinceKeywordBefore || isProvinceName) {
                                console.log(`    ⏭️ Skipping match "${fullMatch}" - part of district/province name`);
                                continue;
                            }
                            
                            // Calculate match quality
                            const matchedWords = fullMatch.split(/\s+/).filter(w => !/^(xã|phường|thị trấn|tt|khóm|[pf])$/i.test(w));
                            const matchQuality = matchedWords.length / wardWords.length;
                            
                            // Only accept if we matched most of the ward name
                            if (matchQuality >= 0.8) {
                                exactWardMatch = {
                                    fullMatch: fullMatch,
                                    ward: ward,
                                    index: match.index,
                                    quality: matchQuality,
                                    hasKeyword: hasKeyword
                                };
                                console.log(`    ✅ Exact ward match found in ORIGINAL: "${fullMatch}" → ${ward.Name} (quality: ${matchQuality.toFixed(2)})`);
                                break;
                            }
                        }
                    }
                }
                
                // STEP 2: If exact match found, use it
                if (exactWardMatch) {
                    wardPart = exactWardMatch.fullMatch;
                    const remainingText = part.substring(exactWardMatch.index + exactWardMatch.fullMatch.length).trim();
                    
                    if (remainingText && remainingText.length >= 3) {
                        possibleDistrictName = remainingText;
                        console.log(`    📍 Ward (exact): "${wardPart}" | remaining: "${possibleDistrictName}"`);
                    } else {
                        console.log(`    📍 Ward (exact): "${wardPart}"`);
                    }
                } else {
                    // STEP 3: No exact match - try multiple capture lengths
                    // IMPROVED: Try 2 words FIRST (more specific), then 1 word
                    // Priority: 2 words > 1 word (avoid ambiguous single-word matches)
                    // Example: "xã thu ngạc" → Try "thu ngạc" first (specific) before "thu" (ambiguous)
                    for (let wordCount = 2; wordCount >= 1; wordCount--) {
                        let pattern;
                        if (wordCount === 1) {
                            pattern = /(phường|xã|thị trấn|tt|khóm)\s+(\S+)/i;
                        } else if (wordCount === 2) {
                            pattern = /(phường|xã|thị trấn|tt|khóm)\s+(\S+\s+\S+)/i;
                        }
                        
                        const match = part.match(pattern);
                        if (match) {
                            const fullMatch = match[0].trim();
                            const remainingText = part.substring(match.index + fullMatch.length).trim();
                            const remainingWords = remainingText.split(/\s+/).filter(w => w.length > 0);
                            
                            // IMPROVED: For 2-word match, always prefer it (more specific)
                            if (wordCount === 2) {
                                wardMatch = match;
                                bestWardLength = wordCount;
                                console.log(`    📍 Ward candidate (${wordCount} words, PREFERRED): "${fullMatch}" | remaining: "${remainingText}"`);
                                break; // Use 2-word match immediately
                            }
                            // For 1-word match, only use if has good remaining text OR as last resort
                            else if (wordCount === 1) {
                                if (remainingWords.length >= 2 || (remainingWords.length === 1 && remainingWords[0].length >= 4)) {
                                    wardMatch = match;
                                    bestWardLength = wordCount;
                                    console.log(`    📍 Ward candidate (${wordCount} word): "${fullMatch}" | remaining: "${remainingText}"`);
                                    break;
                                } else if (remainingWords.length === 0 && !wardMatch) {
                                    // Fallback: 1 word with no remaining
                                    wardMatch = match;
                                    bestWardLength = wordCount;
                                    console.log(`    📍 Ward candidate (${wordCount} word, fallback): "${fullMatch}"`);
                                }
                            }
                        }
                    }
                    
                    if (wardMatch) {
                        const fullMatch = wardMatch[0].trim();
                        const remainingText = part.substring(wardMatch.index + fullMatch.length).trim();
                        
                        console.log(`    📍 Ward match: "${fullMatch}" | remaining: "${remainingText}"`);
                        
                        // Check if there's text after ward name (possible district name)
                        if (remainingText && remainingText.length >= 3) {
                            // Use matched ward part, save remaining as possible district
                            wardPart = fullMatch;
                            possibleDistrictName = remainingText;
                            console.log(`    📍 Ward: "${wardPart}" | possible district: "${possibleDistrictName}"`);
                        } else {
                            // No remaining text, use full match
                            wardPart = fullMatch;
                            console.log(`    📍 Ward (full): "${wardPart}"`);
                        }
                    } else {
                        // Fallback: Use original part
                        console.log(`    📍 Ward (original): "${wardPart}"`);
                    }
                }
                
                // Check ALL wards to find best match (word order matters!)
                let bestWardForPart = null;
                let bestScoreForPart = 0;
                
                console.log(`    🔍 Checking all ${result.district.Wards.length} wards for "${wardPart}"...`);
                
                // CRITICAL: Strip ward keyword from wardPart BEFORE matching
                // Example: "phường phú hữu" → "phú hữu"
                let cleanWardPart = wardPart.replace(/^(phường|xã|thị trấn|tt|khóm)\s+/i, '').trim();
                
                if (cleanWardPart !== wardPart) {
                    console.log(`    🧹 Stripped ward keyword: "${wardPart}" → "${cleanWardPart}"`);
                }
                
                // IMPROVED: If cleanWardPart doesn't have ward keyword, try extracting potential ward name
                // Example: "Khu phố 3 Tân lập" → extract "Tân lập" for matching
                const hasWardKeyword = /^(phường|xã|thị trấn|tt|khóm)\s+/i.test(cleanWardPart);
                let extractedWardName = cleanWardPart;
                
                if (!hasWardKeyword) {
                    // Try to extract last 1-3 words as potential ward name
                    // Example: "Khu phố 3 Tân lập" → "Tân lập"
                    const words = cleanWardPart.trim().split(/\s+/);
                    if (words.length >= 2) {
                        // Try last 2 words first (most common)
                        extractedWardName = words.slice(-2).join(' ');
                        console.log(`    💡 Extracted potential ward name: "${extractedWardName}" from "${cleanWardPart}"`);
                    }
                }
                
                // Collect all ward candidates with their scores
                const wardCandidates = [];
                
                for (const ward of result.district.Wards) {
                    // Try matching with both cleanWardPart AND extracted name
                    const match1 = fuzzyMatch(cleanWardPart, [ward], 0.4);
                    const match2 = extractedWardName !== cleanWardPart ? fuzzyMatch(extractedWardName, [ward], 0.4) : null;
                    
                    // Use better match
                    const match = (match2 && match2.score > (match1?.score || 0)) ? match2 : match1;
                    
                    if (match && match.score >= 0.4) {
                        const usedExtracted = match2 && match2.score > (match1?.score || 0);
                        console.log(`      → ${ward.Name}: score=${match.score.toFixed(2)}${usedExtracted ? ' (extracted)' : ''}`);
                        
                        // Check if ward name appears in the input (bonus for explicit mention)
                        const wardNameNormalized = removeVietnameseTones(ward.Name)
                            .toLowerCase()
                            .replace(/^(phường|xã|thị trấn|tt|khóm)\s+/i, '');
                        const inputNormalized = removeVietnameseTones(usedExtracted ? extractedWardName : cleanWardPart)
                            .toLowerCase()
                            .replace(/^(phường|xã|thị trấn|tt|khóm)\s+/i, '');
                        
                        // IMPROVED: Calculate word overlap AND exact substring match
                        // Example: input "Phước Hòa" should prefer "Phước Hoà" over "Phước Sang"
                        const inputWords = inputNormalized.split(/\s+/).filter(w => w.length > 0);
                        const wardWords = wardNameNormalized.split(/\s+/).filter(w => w.length > 0);
                        
                        let matchedWords = 0;
                        let exactWordMatches = 0; // Count exact word matches
                        
                        for (const inputWord of inputWords) {
                            for (const wardWord of wardWords) {
                                // Check if words are similar (handle tone variations)
                                if (inputWord === wardWord) {
                                    matchedWords++;
                                    exactWordMatches++; // Exact match
                                    break;
                                } else if (inputWord.includes(wardWord) || wardWord.includes(inputWord)) {
                                    matchedWords++;
                                    break;
                                }
                            }
                        }
                        
                        const wordOverlapRatio = matchedWords / Math.max(inputWords.length, wardWords.length);
                        const exactMatchRatio = exactWordMatches / Math.max(inputWords.length, wardWords.length);
                        
                        // Check if ward name is substring of input (or vice versa)
                        const isSubstring = inputNormalized.includes(wardNameNormalized) || 
                                          wardNameNormalized.includes(inputNormalized);
                        
                        // Check position of ward name in input (earlier = better)
                        const wardPosition = inputNormalized.indexOf(wardNameNormalized);
                        const isExplicitMatch = wardPosition >= 0 || wordOverlapRatio >= 0.8;
                        
                        console.log(`         Word overlap: ${matchedWords}/${Math.max(inputWords.length, wardWords.length)} (${(wordOverlapRatio * 100).toFixed(0)}%), exact: ${exactWordMatches}, substring: ${isSubstring}`);
                        
                        wardCandidates.push({
                            ward: ward,
                            score: match.score,
                            isExplicit: isExplicitMatch,
                            position: wardPosition >= 0 ? wardPosition : 9999,
                            wordOverlap: matchedWords,
                            wordOverlapRatio: wordOverlapRatio,
                            exactWordMatches: exactWordMatches,
                            exactMatchRatio: exactMatchRatio,
                            isSubstring: isSubstring
                        });
                    }
                }
                
                // Sort candidates: prioritize explicit matches at earlier positions, then by score
                if (wardCandidates.length > 0) {
                    wardCandidates.sort((a, b) => {
                        // 1. CRITICAL: If scores are similar (within 0.05), prioritize by multiple factors
                        const scoreDiff = Math.abs(a.score - b.score);
                        if (scoreDiff <= 0.05) {
                            // 1a. Prioritize substring matches (exact match in input)
                            // Example: "Phước Hoà" is substring of "Phước Hòa" (with tone variation)
                            if (a.isSubstring && !b.isSubstring) {
                                console.log(`      🎯 Prioritizing substring match: ${a.ward.Name}`);
                                return -1;
                            }
                            if (!a.isSubstring && b.isSubstring) {
                                console.log(`      🎯 Prioritizing substring match: ${b.ward.Name}`);
                                return 1;
                            }
                            
                            // 1b. Prioritize exact word matches over partial matches
                            // Example: "Phước Hoà" (2 exact) vs "Phước Sang" (1 exact + 1 partial)
                            if (a.exactWordMatches !== b.exactWordMatches) {
                                console.log(`      🎯 Prioritizing exact word matches: ${a.ward.Name} (${a.exactWordMatches}) vs ${b.ward.Name} (${b.exactWordMatches})`);
                                return b.exactWordMatches - a.exactWordMatches;
                            }
                            
                            // 1c. Prioritize higher word overlap
                            if (a.wordOverlap !== b.wordOverlap) {
                                console.log(`      🎯 Prioritizing by word overlap: ${a.ward.Name} (${a.wordOverlap} words) vs ${b.ward.Name} (${b.wordOverlap} words)`);
                                return b.wordOverlap - a.wordOverlap;
                            }
                            
                            // 1d. If same overlap, prioritize higher overlap ratio
                            if (Math.abs(a.wordOverlapRatio - b.wordOverlapRatio) > 0.1) {
                                return b.wordOverlapRatio - a.wordOverlapRatio;
                            }
                        }
                        
                        // 2. Prioritize explicit matches
                        if (a.isExplicit && !b.isExplicit) return -1;
                        if (!a.isExplicit && b.isExplicit) return 1;
                        
                        // 3. If both explicit, prioritize earlier position
                        if (a.isExplicit && b.isExplicit) {
                            if (Math.abs(a.position - b.position) > 5) {
                                return a.position - b.position;
                            }
                        }
                        
                        // 4. If scores are very similar (within 0.05), prefer longer ward names
                        // Example: "Xã Phước Hoà" (longer) vs "Thị trấn Phước Vĩnh" (shorter match)
                        if (scoreDiff <= 0.05) {
                            const aNameLength = removeVietnameseTones(a.ward.Name)
                                .toLowerCase()
                                .replace(/^(phường|xã|thị trấn|tt|khóm)\s+/i, '')
                                .length;
                            const bNameLength = removeVietnameseTones(b.ward.Name)
                                .toLowerCase()
                                .replace(/^(phường|xã|thị trấn|tt|khóm)\s+/i, '')
                                .length;
                            
                            // Prefer longer names (more specific)
                            if (Math.abs(aNameLength - bNameLength) >= 3) {
                                return bNameLength - aNameLength; // Longer name wins
                            }
                        }
                        
                        // 5. Then by score
                        return b.score - a.score;
                    });
                    
                    const bestCandidate = wardCandidates[0];
                    bestWardForPart = bestCandidate.ward;
                    bestScoreForPart = bestCandidate.score;
                    
                    if (bestCandidate.isExplicit) {
                        console.log(`      ✨ Explicit match at position ${bestCandidate.position}: ${bestCandidate.ward.Name}`);
                    }
                }
                
                if (bestWardForPart && bestScoreForPart >= 0.4) {
                    const wordCount = wardPart.split(/\s+/).length;
                    const shouldReplace = 
                        bestScoreForPart > bestWardScore + 0.01 || // Lower threshold to prefer higher scores
                        (Math.abs(bestScoreForPart - bestWardScore) <= 0.01 && wordCount > bestWardWordCount);
                    
                    if (shouldReplace) {
                        bestWardMatch = { match: bestWardForPart, score: bestScoreForPart, confidence: 'high' };
                        bestWardScore = bestScoreForPart;
                        bestWardWordCount = wordCount;
                        bestWardInputText = wardPart;  // Save input text for validation
                        console.log(`    ✓ Ward candidate (keyword): "${wardPart}" (${wordCount} words) → ${bestWardForPart.Name} (score: ${bestScoreForPart.toFixed(2)})`);
                    }
                }
            }
        }
        
        // Second pass: Check all parts if not found with good score
        if (bestWardScore < 0.7) {
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                
                // Skip if this part was used for province
                if (i === provincePartIndex) {
                    console.log(`    ⏭️ Skipping province part: "${part}"`);
                    continue;
                }
                
                // IMPROVED: Skip if this part matches district name exactly
                const isDistrictPart = (i === districtPartIndex);
                if (isDistrictPart) {
                    const normalizedPart = removeVietnameseTones(part).toLowerCase();
                    const normalizedDistrictName = removeVietnameseTones(result.district.Name).toLowerCase()
                        .replace(/^(quan|huyen|thanh pho|tp|thi xa|tx)\s+/i, '');
                    
                    if (normalizedPart === normalizedDistrictName || normalizedDistrictName.includes(normalizedPart)) {
                        console.log(`    ⏭️ Skipping district part (pass 2): "${part}"`);
                        continue;
                    }
                }
                
                if (part.length < 4) continue;
                const wordCount = part.split(/\s+/).length;
                
                // IMPROVED: Higher threshold for parts without ward keywords
                // This reduces false positives (e.g., "dong cao" matching "Xã Đông Cao")
                const normalized = removeVietnameseTones(part).toLowerCase();
                const hasWardKeyword = /\b(phuong|xa|thi tran|tt|khom)\b/i.test(normalized);
                const wardThreshold = hasWardKeyword ? 0.4 : 0.65; // Higher threshold without keyword
                
                // IMPROVED: If part doesn't have ward keyword, try extracting potential ward name
                // Example: "Khu phố 3 Tân lập" → extract "Tân lập" for matching
                let extractedWardName = part;
                if (!hasWardKeyword && wordCount >= 2) {
                    // Try to extract last 1-3 words as potential ward name
                    // Example: "Khu phố 3 Tân lập" → "Tân lập"
                    const words = part.trim().split(/\s+/);
                    if (words.length >= 2) {
                        // Try last 2 words first (most common)
                        extractedWardName = words.slice(-2).join(' ');
                        console.log(`    💡 Extracted potential ward name: "${extractedWardName}" from "${part}"`);
                    }
                }
                
                // Try matching with both original part AND extracted name
                const wardMatchResult1 = fuzzyMatch(part, result.district.Wards, wardThreshold);
                const wardMatchResult2 = extractedWardName !== part ? 
                    fuzzyMatch(extractedWardName, result.district.Wards, Math.max(0.4, wardThreshold - 0.2)) : null;
                
                // Use better match
                const wardMatchResult = (wardMatchResult2 && wardMatchResult2.score > (wardMatchResult1?.score || 0)) ? 
                    wardMatchResult2 : wardMatchResult1;
                const usedExtracted = wardMatchResult2 && wardMatchResult2.score > (wardMatchResult1?.score || 0);
                
                if (wardMatchResult) {
                    const shouldReplace = 
                        wardMatchResult.score > bestWardScore + 0.05 ||
                        (Math.abs(wardMatchResult.score - bestWardScore) <= 0.05 && wordCount > bestWardWordCount);
                    
                    if (shouldReplace) {
                        bestWardMatch = wardMatchResult;
                        bestWardScore = wardMatchResult.score;
                        bestWardWordCount = wordCount;
                        bestWardInputText = usedExtracted ? extractedWardName : part;  // Use extracted name for validation
                        console.log(`    ✓ Ward candidate: "${part}" (${wordCount} words) → ${wardMatchResult.match.Name} (score: ${wardMatchResult.score.toFixed(2)})${usedExtracted ? ' (extracted)' : ''}`);
                    }
                }
            }
        }
        
        if (bestWardMatch) {
            result.ward = bestWardMatch.match;
            console.log(`  ✅ Ward matched: ${result.ward.Name} (score: ${bestWardScore.toFixed(2)}, ${bestWardWordCount} words)`);
            
            // CRITICAL: If score is too low (< 0.7), try Step 2.5 Reverse Lookup
            // This handles cases where district/province hint is WRONG
            if (bestWardScore < 0.7) {
                console.log(`  ⚠️ Ward score too low (${bestWardScore.toFixed(2)} < 0.7), will try Reverse Lookup...`);
                // Don't set ward yet, let Step 2.5 handle it
                result.ward = null;
            } else {
            // ============================================
            // WARD NAME VALIDATION (Soft - Option 1)
            // ============================================
            // Check if ward name makes sense compared to input
            // If validation fails: add warning + reduce confidence (don't reject)
            
            let validationPassed = true;
            let validationReason = '';
            
            if (bestWardScore >= 0.85 && bestWardInputText) {
                // High score match - validate to catch false positives
                
                // CRITICAL FIX: Skip validation if input is district name, not ward name
                // Example: "Quận 5" is district name, should not be validated against ward "Phường 15"
                // Also catch abbreviations: Q5, Q.5, F5, F.5, etc.
                // BUT: P14, P.14 are WARD abbreviations (Phường), so don't skip validation for those
                const normalizedInput = removeVietnameseTones(bestWardInputText).toLowerCase();
                const hasDistrictKeyword = /\b(quan|huyen|thanh pho|thi xa|tx|tp)\b/i.test(normalizedInput);
                const isDistrictAbbreviation = /^[qf]\.?\d+/i.test(normalizedInput); // Q5, Q.5, F5, F.5 (district)
                const isWardAbbreviation = /^p\.?\d+/i.test(normalizedInput); // P14, P.14 (ward - Phường)
                const isJustNumber = /^\d+$/.test(normalizedInput.trim()); // Just "5", "14", etc.
                
                const inputHasDistrictKeyword = (hasDistrictKeyword || isDistrictAbbreviation || isJustNumber) && !isWardAbbreviation;
                
                if (inputHasDistrictKeyword) {
                    // Input is district name - skip validation
                    console.log(`  ✓ Ward validation skipped: Input "${bestWardInputText}" is district name, not ward name`);
                    validationPassed = true;
                } else {
                    // Input is ward name - proceed with validation
                    
                    // Remove prefix (Xã, Phường, Thị trấn) to compare main names
                    const removePrefix = (text) => {
                        return text.replace(/^(xã|phường|phuong|thị trấn|thi tran|thị xã|thi xa|tt)\s+/i, '').trim();
                    };
                    
                    const inputMain = removeVietnameseTones(removePrefix(bestWardInputText)).toLowerCase();
                    const matchMain = removeVietnameseTones(removePrefix(result.ward.Name)).toLowerCase();
                    
                    // Split into words
                    const inputWords = inputMain.split(/\s+/).filter(w => w.length >= 2);
                    const matchWords = matchMain.split(/\s+/).filter(w => w.length >= 2);
                    
                    // Check 1: Word overlap - at least one common word
                    const hasCommonWord = inputWords.some(iw => 
                        matchWords.some(mw => 
                            iw === mw || 
                            iw.includes(mw) || 
                            mw.includes(iw) ||
                            levenshteinDistance(iw, mw) <= 1  // Allow 1 typo
                        )
                    );
                    
                    if (!hasCommonWord && inputWords.length > 0 && matchWords.length > 0) {
                        validationPassed = false;
                        validationReason = `Không có từ chung: "${inputMain}" vs "${matchMain}"`;
                    }
                    
                    // Check 2: First word similarity (most important word)
                    if (validationPassed && inputWords.length > 0 && matchWords.length > 0) {
                        const firstWordSimilarity = 1 - (levenshteinDistance(inputWords[0], matchWords[0]) / Math.max(inputWords[0].length, matchWords[0].length));
                        
                        if (firstWordSimilarity < 0.4) {
                            validationPassed = false;
                            validationReason = `Từ đầu khác biệt: "${inputWords[0]}" vs "${matchWords[0]}" (similarity: ${firstWordSimilarity.toFixed(2)})`;
                        }
                    }
                    
                    // ============================================
                    // IMPROVEMENT 1: Check word order (Tân Vĩnh vs Vĩnh Tân)
                    // ============================================
                    if (validationPassed && inputWords.length >= 2 && matchWords.length >= 2) {
                        // Check if words appear in same order
                        let inputIndex = 0;
                        let matchIndex = 0;
                        let orderMatches = 0;
                        
                        while (inputIndex < inputWords.length && matchIndex < matchWords.length) {
                            const iw = inputWords[inputIndex];
                            const mw = matchWords[matchIndex];
                            
                            // Check if words match (exact or similar)
                            if (iw === mw || iw.includes(mw) || mw.includes(iw) || levenshteinDistance(iw, mw) <= 1) {
                                orderMatches++;
                                inputIndex++;
                                matchIndex++;
                            } else {
                                // Try to find this input word in remaining match words
                                let found = false;
                                for (let j = matchIndex + 1; j < matchWords.length; j++) {
                                    if (iw === matchWords[j] || iw.includes(matchWords[j]) || matchWords[j].includes(iw)) {
                                        found = true;
                                        break;
                                    }
                                }
                                
                                if (found) {
                                    matchIndex++; // Skip this match word
                                } else {
                                    inputIndex++; // Skip this input word
                                }
                            }
                        }
                        
                        // If less than 50% words in correct order, likely wrong match
                        const orderRatio = orderMatches / Math.min(inputWords.length, matchWords.length);
                        if (orderRatio < 0.5) {
                            validationPassed = false;
                            validationReason = `Thứ tự từ không khớp: "${inputMain}" vs "${matchMain}" (order ratio: ${orderRatio.toFixed(2)})`;
                            console.log(`    ⚠️ Word order mismatch: ${orderMatches}/${Math.min(inputWords.length, matchWords.length)} words in order`);
                        }
                    }
                }
            }
            
            // Apply validation result
            if (!validationPassed) {
                console.log(`  ⚠️ Ward validation failed: ${validationReason}`);
                
                // Soft validation: Add warning + reduce confidence (don't reject)
                result.confidence = 'low';
                result.warnings.push(`⚠️ Tên xã/phường không khớp với input - ${validationReason}`);
                
                // Reduce score for logging
                console.log(`  📉 Confidence downgraded: high → low (validation failed)`);
            } else {
                // Validation passed - upgrade confidence based on ward match quality
                // IMPROVED: Upgrade regardless of current confidence level
                if (bestWardScore >= 0.85) {
                    // Excellent ward match → high confidence
                    result.confidence = 'high';
                } else if (bestWardScore >= 0.7) {
                    // Good ward match → upgrade to medium if currently low
                    if (result.confidence === 'low') {
                        result.confidence = 'medium';
                    }
                }
            }
            } // End of else block (bestWardScore >= 0.7)
        } else {
            console.log(`  ⚠️ No ward found in current district`);
        }
        
        // ============================================
        // FALLBACK: Search ALL provinces for ward name
        // ============================================
        // This handles cases where province/district hint is COMPLETELY WRONG
        // Run this AFTER ward matching, if result.ward is still null
        // Example: "xã Kim Thái, tỉnh Ninh Bình" → Actually in "Huyện Vụ Bản, Tỉnh Nam Định"
        if (!result.ward) {
            console.log(`  🔍 FALLBACK: Searching ALL provinces for ward name...`);
            
            // Extract potential ward names from address parts
            const potentialWardNames = [];
            // Also extract potential district/province hints (parts without ward keywords)
            const potentialHints = [];
            
            for (const part of parts) {
                const normalized = removeVietnameseTones(part).toLowerCase();
                // Check if part has ward keyword
                if (/\b(xa|phuong|thi tran|tt|khom)\b/.test(normalized)) {
                    potentialWardNames.push(part);
                } else if (part.length > 3) {
                    // Non-ward parts could be district/province hints
                    potentialHints.push(part);
                }
            }
            
            console.log(`  📝 Potential ward names: ${potentialWardNames.length} - [${potentialWardNames.join(', ')}]`);
            console.log(`  📝 Potential hints: ${potentialHints.length} - [${potentialHints.join(', ')}]`);
            
            if (potentialWardNames.length > 0 && window.addressSelector && window.addressSelector.data) {
                let bestGlobalMatch = null;
                let bestGlobalScore = 0;
                let bestGlobalProvince = null;
                let bestGlobalDistrict = null;
                
                // Search all provinces
                for (const province of window.addressSelector.data) {
                    for (const district of province.Districts) {
                        // Try matching each potential ward name against all wards in this district
                        for (const wardName of potentialWardNames) {
                            const matchResult = fuzzyMatch(wardName, district.Wards, 0.4);
                            
                            if (matchResult && matchResult.score > 0) {
                                let finalScore = matchResult.score;
                                
                                // BONUS: Check if district/province name matches any hint
                                // This prioritizes correct location when multiple wards have same name
                                for (const hint of potentialHints) {
                                    const hintNormalized = removeVietnameseTones(hint).toLowerCase();
                                    const districtNormalized = removeVietnameseTones(district.Name).toLowerCase();
                                    const provinceNormalized = removeVietnameseTones(province.Name).toLowerCase();
                                    
                                    // Check district name similarity
                                    if (districtNormalized.includes(hintNormalized) || hintNormalized.includes(districtNormalized)) {
                                        finalScore += 0.5; // Big bonus for district match
                                        console.log(`     🎯 District hint match: "${hint}" ≈ "${district.Name}" (+0.5)`);
                                    }
                                    
                                    // Check province name similarity
                                    if (provinceNormalized.includes(hintNormalized) || hintNormalized.includes(provinceNormalized)) {
                                        finalScore += 0.3; // Bonus for province match
                                        console.log(`     🎯 Province hint match: "${hint}" ≈ "${province.Name}" (+0.3)`);
                                    }
                                }
                                
                                if (finalScore > bestGlobalScore) {
                                    bestGlobalMatch = matchResult;
                                    bestGlobalScore = finalScore;
                                    bestGlobalProvince = province;
                                    bestGlobalDistrict = district;
                                }
                            }
                        }
                    }
                }
                
                // If found a good match (score >= 0.7), use it
                if (bestGlobalMatch && bestGlobalScore >= 0.7) {
                    console.log(`  ✅ FALLBACK SUCCESS: Found ward in different province!`);
                    console.log(`     Ward: ${bestGlobalMatch.match.Name} (base score: ${bestGlobalMatch.score.toFixed(2)}, final: ${bestGlobalScore.toFixed(2)})`);
                    console.log(`     District: ${bestGlobalDistrict.Name}`);
                    console.log(`     Province: ${bestGlobalProvince.Name}`);
                    
                    // CRITICAL: Check if we have a provinceHint from dictionary
                    // If yes, DON'T override it - the hint is more reliable
                    // UNLESS the fallback has VERY HIGH confidence (score >= 2.0 with hints)
                    if (provinceHint) {
                        console.log(`  ⚠️ CONFLICT: Fallback found different province, but we have provinceHint: "${provinceHint}"`);
                        console.log(`     Fallback province: ${bestGlobalProvince.Name}`);
                        console.log(`     Dictionary hint: ${provinceHint}`);
                        console.log(`     Fallback score: ${bestGlobalScore.toFixed(2)}`);
                        
                        // Check if fallback province matches hint
                        const hintNormalized = removeVietnameseTones(provinceHint).toLowerCase();
                        const fallbackNormalized = removeVietnameseTones(bestGlobalProvince.Name).toLowerCase();
                        
                        if (fallbackNormalized.includes(hintNormalized) || hintNormalized.includes(fallbackNormalized)) {
                            // Match! Use fallback
                            console.log(`  ✅ Province hint matches fallback, using fallback data`);
                            result.ward = bestGlobalMatch.match;
                            result.district = bestGlobalDistrict;
                            result.province = bestGlobalProvince;
                            result.confidence = bestGlobalScore >= 0.85 ? 'high' : 'medium';
                        } else if (bestGlobalScore >= 2.0) {
                            // VERY HIGH confidence from fallback (has district + province hints)
                            // This means the address explicitly mentions province/district
                            // Trust it over dictionary pattern match
                            console.log(`  ✅ Fallback has VERY HIGH confidence (${bestGlobalScore.toFixed(2)} >= 2.0), OVERRIDING hint`);
                            console.log(`     Reason: Address explicitly mentions province/district, more reliable than pattern match`);
                            result.ward = bestGlobalMatch.match;
                            result.district = bestGlobalDistrict;
                            result.province = bestGlobalProvince;
                            result.confidence = 'high';
                            
                            // Add warning about override
                            result.warnings.push(`⚠️ Đã sửa tỉnh từ "${provinceHint}" → "${bestGlobalProvince.Name}" (độ tin cậy cao)`);
                        } else {
                            // Conflict! Trust dictionary hint over fallback
                            console.log(`  ⚠️ Province hint CONFLICTS with fallback, KEEPING hint and REJECTING fallback ward`);
                            console.log(`     Reason: Dictionary hint is more reliable than fuzzy ward matching (score ${bestGlobalScore.toFixed(2)} < 2.0)`);
                            // Don't update result - keep existing province from hint
                            // Ward will remain null (user can select manually)
                        }
                    } else {
                        // No hint, safe to use fallback
                        console.log(`  ✅ No province hint, using fallback data`);
                        result.ward = bestGlobalMatch.match;
                        result.district = bestGlobalDistrict;
                        result.province = bestGlobalProvince;
                        result.confidence = bestGlobalScore >= 0.85 ? 'high' : 'medium';
                        
                        // Add warning about province/district correction
                        result.warnings.push(`⚠️ Đã tự động sửa địa chỉ: ${bestGlobalProvince.Name} - ${bestGlobalDistrict.Name}`);
                    }
                } else {
                    console.log(`  ❌ FALLBACK: No good match found in any province (best score: ${bestGlobalScore.toFixed(2)})`);
                }
            }
        }
        } // End of if (bestWardScore < 1.2) - n-gram matching block
    }
    
    // Step 4: Extract street address - Filter out matched location parts
    let streetParts = [];
    
    if (addressText.includes(',') || addressText.includes('.')) {
        // Has commas or periods - filter out parts that matched province/district/ward
        // IMPORTANT: Use the same smart separator splitting logic to preserve decimals like "4,5"
        let commaParts = [];
        let currentPart = '';
        
        for (let i = 0; i < addressText.length; i++) {
            const char = addressText[i];
            const prevChar = i > 0 ? addressText[i - 1] : '';
            const nextChar = i < addressText.length - 1 ? addressText[i + 1] : '';
            
            if ((char === ',' || char === '.') && !(char === ',' && /\d/.test(prevChar) && /\d/.test(nextChar))) {
                // This is a separator (not a decimal comma)
                if (currentPart.trim()) {
                    commaParts.push(currentPart.trim());
                }
                currentPart = '';
            } else {
                currentPart += char;
            }
        }
        
        // Add last part
        if (currentPart.trim()) {
            commaParts.push(currentPart.trim());
        }
        
        for (const part of commaParts) {
            let isLocation = false;
            
            // Check if this part matched province
            if (result.province) {
                const provinceScore = fuzzyMatch(part, [result.province], 0.4);
                if (provinceScore && provinceScore.score >= 0.4) {
                    isLocation = true;
                }
            }
            
            // Check if this part matched district
            if (!isLocation && result.district) {
                const districtScore = fuzzyMatch(part, [result.district], 0.4);
                if (districtScore && districtScore.score >= 0.4) {
                    isLocation = true;
                }
            }
            
            // Check if this part matched ward
            if (!isLocation && result.ward) {
                const wardScore = fuzzyMatch(part, [result.ward], 0.4);
                if (wardScore && wardScore.score >= 0.4) {
                    // IMPROVED: Only mark as location if it's PURELY a ward name
                    // NOT if it contains street address (numbers, "đường", etc.)
                    const hasStreetIndicators = /\d|đường|duong|phố|pho|ngõ|ngo|hẻm|hem|số|so/i.test(part);
                    
                    if (!hasStreetIndicators) {
                        // Pure ward name - mark as location
                        isLocation = true;
                    } else {
                        // Contains street indicators - keep as street address
                        console.log(`    📍 Keeping part with street indicators: "${part}" (ward match but has address)`);
                    }
                }
            }
            
            // Check if part contains location keywords
            const normalized = removeVietnameseTones(part).toLowerCase();
            const locationKeywords = ['phuong', 'xa', 'quan', 'huyen', 'thanh pho', 'tp', 'tinh', 'thi tran', 'tt', 'thi xa', 'tx'];
            const hasLocationKeyword = locationKeywords.some(kw => normalized.includes(kw));
            
            if (hasLocationKeyword) {
                // Part has location keyword - extract street portion BEFORE the keyword
                // Example: "83/7 đường liên khu 4,5 phường bình Hưng hòa B" → "83/7 đường liên khu 4,5"
                const streetMatch = part.match(/^(.+?)\s*(?:phường|xã|quận|huyện|thị trấn|tt|thành phố|tp|tỉnh|thị xã|tx)/i);
                if (streetMatch && streetMatch[1].trim()) {
                    const streetPortion = streetMatch[1].trim();
                    
                    // CRITICAL FIX: Don't add if it's ONLY ward name without street info
                    // Example: "phường 14 quận 8" → "phường 14" is NOT street, skip it
                    // Check if extracted portion has numbers or street keywords
                    const hasStreetInfo = /\d|đường|duong|phố|pho|ngõ|ngo|hẻm|hem|số|so|khu|thôn|thon|ấp|ap|xóm|xom/i.test(streetPortion);
                    
                    if (hasStreetInfo) {
                        console.log(`    📍 Extracted street from location part: "${streetPortion}" from "${part}"`);
                        streetParts.push(streetPortion);
                    } else {
                        console.log(`    ⏭️ Skipping ward-only part: "${streetPortion}" (no street info)`);
                    }
                }
                isLocation = true;
            }
            
            // If not a location, add to street parts
            if (!isLocation) {
                streetParts.push(part);
            }
        }
        
        result.street = streetParts.join(', ').trim();
    } else {
        // No commas - use street from Early Street Extraction if available
        // Otherwise, extract from first part before location keywords
        if (!result.street) {
            // Fallback: Extract text before first location keyword
            const match = addressText.match(/^(.+?)\s*(?:phường|xã|quận|huyện|thị trấn|tt|thành phố|tp|tỉnh|thị xã|tx|khóm)/i);
            if (match && match[1].trim()) {
                result.street = match[1].trim();
            } else {
                // Last resort: take first 3-5 words
                const words = addressText.split(/\s+/);
                result.street = words.slice(0, Math.min(5, words.length)).join(' ');
            }
        }
        // If result.street already set from Early Street Extraction, keep it
    }
    
    console.log('  🏠 Street address:', result.street || '(none)');
    
    // ============================================
    // ADD LANDMARK TO RESULT (if extracted)
    // ============================================
    if (landmarkInfo && landmarkInfo.landmark) {
        result.landmark = landmarkInfo.landmark;
        console.log('  🏷️ Landmark:', result.landmark);
        
        // If street is empty or too short, use the street portion from landmark extraction
        if (!result.street || result.street.length < 5) {
            result.street = landmarkInfo.street;
            console.log('  📍 Using street from landmark extraction:', result.street);
        }
    }
    
    // ============================================
    // MONITORING: Log parsing results for analysis
    // ============================================
    const monitoringData = {
        timestamp: new Date().toISOString(),
        input: addressText,
        success: result.success,
        confidence: result.confidence,
        hasProvince: !!result.province,
        hasDistrict: !!result.district,
        hasWard: !!result.ward,
        provinceName: result.province?.Name,
        districtName: result.district?.Name,
        wardName: result.ward?.Name,
        optimizationMetrics: {
            ngramReduction: OPTIMIZATION_METRICS.ngramReduction,
            fuzzySkipped: OPTIMIZATION_METRICS.fuzzySkipped,
            levenshteinSkipped: OPTIMIZATION_METRICS.levenshteinSkipped
        }
    };
    
    // Store in sessionStorage for later analysis
    try {
        const existingLogs = JSON.parse(sessionStorage.getItem('addressParsingLogs') || '[]');
        existingLogs.push(monitoringData);
        // Keep only last 50 entries
        if (existingLogs.length > 50) {
            existingLogs.shift();
        }
        sessionStorage.setItem('addressParsingLogs', JSON.stringify(existingLogs));
    } catch (e) {
        console.warn('Failed to store monitoring data:', e);
    }
    
    // ============================================
    // OPTIMIZATION METRICS: Log performance gains
    // ============================================
    if (OPTIMIZATION_FLAGS.NGRAM_LIMIT || OPTIMIZATION_FLAGS.FUZZY_EARLY_EXIT || 
        OPTIMIZATION_FLAGS.LEVENSHTEIN_LENGTH_CHECK || OPTIMIZATION_FLAGS.LEARNING_EXPANDED ||
        OPTIMIZATION_FLAGS.PROVINCE_FIRST_VALIDATION || OPTIMIZATION_FLAGS.LANDMARK_EXTRACTION) {
        console.log('📊 Optimization Metrics:');
        if (OPTIMIZATION_METRICS.ngramReduction > 0) {
            console.log(`  ⚡ N-grams reduced: ${OPTIMIZATION_METRICS.ngramReduction}`);
        }
        if (OPTIMIZATION_METRICS.fuzzySkipped > 0) {
            console.log(`  ⚡ Fuzzy candidates skipped: ${OPTIMIZATION_METRICS.fuzzySkipped}`);
        }
        if (OPTIMIZATION_METRICS.levenshteinSkipped > 0) {
            console.log(`  ⚡ Levenshtein calculations skipped: ${OPTIMIZATION_METRICS.levenshteinSkipped}`);
        }
        if (OPTIMIZATION_METRICS.provinceValidationUsed > 0) {
            console.log(`  ✅ Province validation applied: ${OPTIMIZATION_METRICS.provinceValidationUsed} times`);
        }
        if (OPTIMIZATION_METRICS.landmarkExtracted > 0) {
            console.log(`  🏷️ Landmark extracted: ${OPTIMIZATION_METRICS.landmarkExtracted} times`);
        }
        if (OPTIMIZATION_METRICS.rollbackCount > 0) {
            console.log(`  ⚠️ Rollbacks: ${OPTIMIZATION_METRICS.rollbackCount}`);
        }
        
        // Reset metrics for next parse
        OPTIMIZATION_METRICS.ngramReduction = 0;
        OPTIMIZATION_METRICS.fuzzySkipped = 0;
        OPTIMIZATION_METRICS.levenshteinSkipped = 0;
        OPTIMIZATION_METRICS.rollbackCount = 0;
        OPTIMIZATION_METRICS.provinceValidationUsed = 0;
        OPTIMIZATION_METRICS.landmarkExtracted = 0;
    }
    
    return result;
}

/**
 * Main smart paste function
 * Parses customer info from pasted text
 */
async function smartParseCustomerInfo(text) {
    if (!text || !text.trim()) {
        return {
            success: false,
            error: 'Không có dữ liệu để phân tích'
        };
    }
    
    // Ensure addressSelector is loaded (it should be loaded when modal opens)
    if (!window.addressSelector || !window.addressSelector.loaded) {
        console.log('⏳ Waiting for addressSelector to load...');
        // Wait up to 2 seconds
        let attempts = 0;
        while ((!window.addressSelector || !window.addressSelector.loaded) && attempts < 20) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (!window.addressSelector || !window.addressSelector.loaded) {
            return {
                success: false,
                error: 'Không thể tải dữ liệu địa chỉ. Vui lòng thử lại.'
            };
        }
    }
    
    console.log('✅ AddressSelector ready with', window.addressSelector.data.length, 'provinces');
    
    // Split into lines and clean
    const lines = text
        .split(/[\n\r]+/)
        .map(line => line.trim())
        .filter(line => line.length > 0);
    
    if (lines.length === 0) {
        return {
            success: false,
            error: 'Không có dữ liệu hợp lệ'
        };
    }
    
    // Extract phone
    const phoneInfo = extractPhoneNumber(text);
    
    // Extract name
    const nameInfo = extractCustomerName(lines, phoneInfo);
    
    // Extract address (all lines except phone and name)
    // IMPROVED: Remove phone from line instead of removing entire line
    let addressLines = lines
        .filter(line => {
            // Skip if this line is ONLY the name
            if (nameInfo && line === nameInfo.name) return false;
            return true;
        })
        .map(line => {
            // Remove phone number from line if present
            if (phoneInfo && line.includes(phoneInfo.phone)) {
                return line
                    .replace(phoneInfo.phone, '')
                    .replace(/[,.\-\s]+$/, '') // Remove trailing punctuation
                    .replace(/^[,.\-\s]+/, '') // Remove leading punctuation
                    .trim();
            }
            return line;
        })
        .filter(line => line.length > 0); // Remove empty lines after phone removal
    
    const addressText = addressLines.join(', ');
    const addressInfo = await parseAddress(addressText);
    
    // Calculate overall confidence
    let overallConfidence = 'low';
    const confidenceScores = {
        'high': 3,
        'medium': 2,
        'low': 1
    };
    
    const scores = [];
    if (phoneInfo) scores.push(confidenceScores[phoneInfo.confidence]);
    if (nameInfo) scores.push(confidenceScores[nameInfo.confidence]);
    if (addressInfo.province) scores.push(confidenceScores[addressInfo.confidence]);
    
    if (scores.length > 0) {
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        if (avgScore >= 2.5) overallConfidence = 'high';
        else if (avgScore >= 1.5) overallConfidence = 'medium';
    }
    
    return {
        success: true,
        confidence: overallConfidence,
        data: {
            phone: phoneInfo?.phone || '',
            phoneConfidence: phoneInfo?.confidence || 'low',
            name: nameInfo?.name || '',
            nameConfidence: nameInfo?.confidence || 'low',
            address: {
                street: addressInfo.street,
                ward: addressInfo.ward,
                district: addressInfo.district,
                province: addressInfo.province,
                confidence: addressInfo.confidence,
                fullText: addressText
            }
        },
        warnings: []
    };
}

/**
 * Apply parsed data to form fields
 */
async function applyParsedDataToForm(parsedData) {
    if (!parsedData.success) {
        return;
    }
    
    const { data, confidence } = parsedData;
    
    console.log('📋 Parsed Data:', parsedData);
    console.log('📍 Address Info:', data.address);
    
    // Apply phone
    if (data.phone) {
        document.getElementById('newOrderCustomerPhone').value = data.phone;
        // Trigger phone change event to check customer history
        document.getElementById('newOrderCustomerPhone').dispatchEvent(new Event('input'));
    }
    
    // Apply name
    if (data.name) {
        document.getElementById('newOrderCustomerName').value = data.name;
    }
    
    // Get address form elements (declare outside to use in toast logic)
    const provinceSelect = document.getElementById('newOrderProvince');
    const districtSelect = document.getElementById('newOrderDistrict');
    const wardSelect = document.getElementById('newOrderWard');
    const streetInput = document.getElementById('newOrderStreetAddress');
    
    // Apply address - Wait for addressSelector to be ready
    if (data.address.province) {
        console.log('✅ Province found:', data.address.province.Name, 'ID:', data.address.province.Id);
        
        // Ensure addressSelector is loaded
        if (!window.addressSelector || !window.addressSelector.loaded) {
            console.log('⏳ Waiting for addressSelector to load...');
            // Wait up to 2 seconds for addressSelector
            let attempts = 0;
            while ((!window.addressSelector || !window.addressSelector.loaded) && attempts < 20) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            if (!window.addressSelector || !window.addressSelector.loaded) {
                console.error('❌ AddressSelector failed to load');
                return;
            }
        }
        
        // Set province
        provinceSelect.value = data.address.province.Id;
        console.log('✅ Province set to:', provinceSelect.value);
        
        // Render districts for this province
        if (data.address.district) {
            window.addressSelector.renderDistricts(districtSelect, data.address.province.Id);
            
            // Wait for render to complete
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Set district
            districtSelect.value = data.address.district.Id;
            console.log('✅ District set to:', districtSelect.value);
            
            // IMPORTANT: Always render wards when district is set (even if ward not found)
            // This allows user to manually select ward from dropdown
            window.addressSelector.renderWards(wardSelect, data.address.province.Id, data.address.district.Id);
            
            // Wait for render to complete
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Set ward if found
            if (data.address.ward) {
                wardSelect.value = data.address.ward.Id;
                console.log('✅ Ward set to:', wardSelect.value);
            } else {
                console.log('⚠️ Ward not found, but dropdown is enabled for manual selection');
            }
        } else if (data.address.province) {
            // Province found but no district - still render districts for manual selection
            window.addressSelector.renderDistricts(districtSelect, data.address.province.Id);
            console.log('⚠️ District not found, but dropdown is enabled for manual selection');
        }
        
        // Set street address
        if (data.address.street) {
            streetInput.value = data.address.street;
        }
        
        // Update address preview
        const fullAddress = window.addressSelector.generateFullAddress(
            streetInput.value,
            provinceSelect.value,
            districtSelect.value,
            wardSelect.value
        );
        
        const addressPreview = document.getElementById('newOrderAddressPreview');
        const hiddenAddress = document.getElementById('newOrderAddress');
        
        if (addressPreview) addressPreview.textContent = fullAddress || 'Vui lòng chọn địa chỉ';
        if (hiddenAddress) hiddenAddress.value = fullAddress;
        
        console.log('✅ Full address:', fullAddress);
    } else {
        console.warn('⚠️ No province found in parsed data');
    }
}

// Initialize on page load - NO LONGER NEEDED, use addressSelector data
// (removed loadVietnamAddressData call)

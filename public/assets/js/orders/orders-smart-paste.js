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
    // Vietnamese phone: starts with 0 or +84, network prefix 3/5/7/8/9, total 10 digits
    const phoneRegex = /(?:0|\+84)[35789]\d{8}/g;
    let matches = text.match(phoneRegex);

    if (matches && matches.length > 0) {
        const phone = matches[0].replace(/\+84/, '0');
        return { phone, confidence: 'high', original: matches[0] };
    }

    // Fallback: 9-digit number missing leading 0 (e.g. 984923405)
    const fallbackRegex = /(?<!\d)[35789]\d{8}(?!\d)/g;
    matches = text.match(fallbackRegex);
    if (matches && matches.length > 0) {
        const phone = '0' + matches[0];
        return { phone, confidence: 'high', original: matches[0] };
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
        
        // Skip if contains phone (check both normalized and original 9-digit form)
        if (phoneInfo && (line.includes(phoneInfo.phone) || (phoneInfo.original && line.includes(phoneInfo.original)))) {
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

// ============================================
// POSITION-AWARE SHORT CODE EXPANSION
// ============================================
// Mã viết tắt tỉnh/huyện 2 ký tự CHỈ được expand khi nằm ở vị trí hợp lý:
//   - Mã tỉnh: segment cuối cùng (sau dấu phẩy cuối) hoặc từ cuối cùng
//   - Mã huyện: segment áp chót
// Nguyên nhân: mã 2 ký tự như "na", "la", "cm", "kg" trùng với
// từ tiếng Việt/đơn vị đo, gây nhận diện sai khi expand vô điều kiện.

const PROVINCE_SHORT_CODES = {
    'bn': 'Bắc Ninh', 'bg': 'Bắc Giang', 'bk': 'Bắc Kạn',
    'hb': 'Hòa Bình', 'hy': 'Hưng Yên', 'ls': 'Lạng Sơn',
    'lc': 'Lào Cai', 'nb': 'Ninh Bình', 'pt': 'Phú Thọ',
    'sl': 'Sơn La', 'tb': 'Thái Bình', 'tq': 'Tuyên Quang',
    'vp': 'Vĩnh Phúc', 'yb': 'Yên Bái', 'na': 'Nghệ An',
    'ht': 'Hà Tĩnh', 'qb': 'Quảng Bình', 'qt': 'Quảng Trị',
    'py': 'Phú Yên', 'kh': 'Khánh Hòa', 'nt': 'Ninh Thuận',
    'gl': 'Gia Lai', 'kt': 'Kon Tum', 'ld': 'Lâm Đồng',
    'bp': 'Bình Phước', 'la': 'Long An', 'tg': 'Tiền Giang',
    'vl': 'Vĩnh Long', 'dt': 'Đồng Tháp', 'ag': 'An Giang',
    'kg': 'Kiên Giang', 'bl': 'Bạc Liêu', 'cm': 'Cà Mau',
    'st': 'Sóc Trăng', 'tv': 'Trà Vinh',
    'bd': 'Bình Dương', 'bt': 'Bình Thuận', 'dn': 'Đồng Nai',
    'dl': 'Đắk Lắk', 'tn': 'Thái Nguyên', 'hg': 'Hà Giang',
    'qn': 'Quảng Ninh', 'hn': 'Hà Nam'
};

const DISTRICT_SHORT_CODES = {
    'bc': 'Bến Cát', 'tu': 'Tân Uyên',
    'bh': 'Biên Hòa', 'lk': 'Long Khánh',
    'cg': 'Cần Giuộc', 'bl': 'Bến Lức', 'dh': 'Đức Hòa'
};

/**
 * Expand 2-letter province/district codes chỉ khi nằm ở vị trí phù hợp.
 *
 * Có dấu phẩy:
 *   - Segment cuối  → ưu tiên tỉnh, fallback huyện
 *   - Segment áp chót → ưu tiên huyện, fallback tỉnh
 *
 * Không có dấu phẩy:
 *   - Từ cuối cùng (cần >= 2 từ) → ưu tiên tỉnh, fallback huyện
 *
 * Segment > 3 từ bị bỏ qua (không thể là viết tắt đơn lẻ).
 */
function expandShortCodesAtEnd(address) {
    const hasCommas = address.includes(',');
    let changed = false;

    if (hasCommas) {
        const segments = address.split(',').map(s => s.trim()).filter(s => s);
        if (segments.length === 0) return address;

        // --- Segment cuối: tỉnh trước, huyện fallback ---
        const lastIdx = segments.length - 1;
        const lastWords = segments[lastIdx].split(/\s+/).filter(w => w);
        if (lastWords.length > 0 && lastWords.length <= 3) {
            const code = lastWords[lastWords.length - 1].toLowerCase();
            const expanded = PROVINCE_SHORT_CODES[code] || DISTRICT_SHORT_CODES[code];
            if (expanded) {
                const type = PROVINCE_SHORT_CODES[code] ? 'Province' : 'District';
                lastWords[lastWords.length - 1] = expanded;
                segments[lastIdx] = lastWords.join(' ');
                changed = true;
                console.log(`  ✓ ${type} code at end: "${code}" → "${expanded}"`);
            }
        }

        // --- Segment áp chót: huyện trước, tỉnh fallback ---
        if (segments.length >= 2) {
            const prevIdx = segments.length - 2;
            const prevWords = segments[prevIdx].split(/\s+/).filter(w => w);
            if (prevWords.length > 0 && prevWords.length <= 3) {
                const code = prevWords[prevWords.length - 1].toLowerCase();
                const expanded = DISTRICT_SHORT_CODES[code] || PROVINCE_SHORT_CODES[code];
                if (expanded) {
                    const type = DISTRICT_SHORT_CODES[code] ? 'District' : 'Province';
                    prevWords[prevWords.length - 1] = expanded;
                    segments[prevIdx] = prevWords.join(' ');
                    changed = true;
                    console.log(`  ✓ ${type} code at second-to-last: "${code}" → "${expanded}"`);
                }
            }
        }

        return changed ? segments.join(', ') : address;
    }

    // Không có dấu phẩy: chỉ kiểm tra từ cuối cùng
    const words = address.trim().split(/\s+/);
    if (words.length >= 2) {
        const code = words[words.length - 1].toLowerCase();
        const expanded = PROVINCE_SHORT_CODES[code] || DISTRICT_SHORT_CODES[code];
        if (expanded) {
            const type = PROVINCE_SHORT_CODES[code] ? 'Province' : 'District';
            words[words.length - 1] = expanded;
            changed = true;
            console.log(`  ✓ ${type} code as last word (no commas): "${code}" → "${expanded}"`);
        }
    }

    if (!changed) {
        console.log('  ⏭️ No position-appropriate short codes found');
    }

    return changed ? words.join(' ') : address;
}

// ============================================
// CUSTOMER ADDRESS HINT (từ lịch sử đơn hàng)
// ============================================
// Trích xuất tỉnh/huyện phổ biến nhất của khách hàng từ dữ liệu đã load
// trong bộ nhớ (allOrdersData). Không gọi API → zero latency.

/**
 * Lấy tỉnh/huyện phổ biến nhất của khách hàng từ dữ liệu đơn hàng đã load.
 * Trả về null nếu không tìm thấy hoặc dữ liệu chưa sẵn sàng.
 */
function getCustomerAddressHint(phone) {
    if (!phone || typeof allOrdersData === 'undefined' ||
        !Array.isArray(allOrdersData) || allOrdersData.length === 0) {
        return null;
    }

    const customerOrders = allOrdersData.filter(
        o => o.customer_phone === phone && o.province_id
    );
    if (customerOrders.length === 0) return null;

    // Đếm tần suất province_id
    const pCounts = {};
    for (const o of customerOrders) {
        const pid = String(o.province_id);
        pCounts[pid] = (pCounts[pid] || 0) + 1;
    }
    const topProvince = Object.entries(pCounts).sort((a, b) => b[1] - a[1])[0];
    if (!topProvince) return null;

    // Đếm tần suất district_id trong tỉnh phổ biến nhất
    const dCounts = {};
    for (const o of customerOrders) {
        if (String(o.province_id) === topProvince[0] && o.district_id) {
            const did = String(o.district_id);
            dCounts[did] = (dCounts[did] || 0) + 1;
        }
    }
    const topDistrict = Object.entries(dCounts).sort((a, b) => b[1] - a[1])[0];

    return {
        province_id: topProvince[0],
        district_id: topDistrict ? topDistrict[0] : null,
        orderCount: customerOrders.length
    };
}


// ============================================
// PARSE ADDRESS v2 — Anchor-Cascade Algorithm
// Replaces previous global N-gram implementation
// Strategy: keyword anchors → constrained cascade → reverse inference → fallback
// ============================================

// Reverse indexes: built once per data-load
let _addrIdx = null;
function _buildAddrIdx(data) {
    if (_addrIdx) return _addrIdx;
    const distProv = new Map();
    const wardLoc  = new Map();
    for (const prov of data) {
        for (const dist of (prov.Districts || [])) {
            distProv.set(dist.Id, prov);
            for (const ward of (dist.Wards || [])) {
                wardLoc.set(ward.Id, { province: prov, district: dist });
            }
        }
    }
    _addrIdx = { distProv, wardLoc };
    return _addrIdx;
}

// Strip diacritics + lowercase + normalize whitespace
function _nn(s) {
    return removeVietnameseTones(s || '').toLowerCase()
        .replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Strip admin type prefix: "Quận Bình Thạnh" → "binh thanh"
function _bare(name) {
    return _nn(name)
        .replace(/^(tinh|thanh pho|tp|quan|q|huyen|thi xa|tx|phuong|p|f|xa|thi tran|tt)\s+/, '')
        .trim();
}

// Province abbreviation map: normalized abbrev → province.Id from tree.json
const _PA = {
    'hcm':'79','tphcm':'79','tp hcm':'79','tp.hcm':'79','sai gon':'79','saigon':'79','sg':'79',
    'hn':'01','ha noi':'01','hanoi':'01',
    'dn':'48','da nang':'48','danang':'48',
    'hp':'31','hai phong':'31',
    'ct':'92','can tho':'92',
    'ag':'89','an giang':'89',
    'bk':'06','bac kan':'06','bac can':'06',
    'bg':'24','bac giang':'24',
    'bn':'27','bac ninh':'27',
    'bd':'74','binh duong':'74',
    'bp':'70','binh phuoc':'70',
    'bt':'60','binh thuan':'60',
    'brvt':'77','br vt':'77','ba ria vung tau':'77','vung tau':'77','br-vt':'77',
    'bl':'95','bac lieu':'95',
    'ben tre':'83',
    'cb':'04','cao bang':'04',
    'cm':'96','ca mau':'96',
    'db':'11','dien bien':'11',
    'dl':'66','dak lak':'66','daklak':'66','dac lac':'66','dak lac':'66','dac lak':'66',
    'dno':'67','dak nong':'67',
    'dt':'87','dong thap':'87',
    'dong nai':'75','dnai':'75',
    'gl':'64','gia lai':'64',
    'hb':'17','hoa binh':'17',
    'hag':'02','ha giang':'02',
    'hnam':'35','ha nam':'35',
    'ht':'42','ha tinh':'42',
    'hd':'30','hai duong':'30',
    'haug':'93','hau giang':'93',
    'hy':'33','hung yen':'33',
    'kh':'56','khanh hoa':'56',
    'kg':'91','kien giang':'91',
    'kt':'62','kon tum':'62',
    'lc':'10','lao cai':'10',
    'lb':'12','lai chau':'12',
    'ld':'68','lam dong':'68',
    'ls':'20','lang son':'20',
    'la':'80','long an':'80',
    'nd':'36','nam dinh':'36',
    'na':'40','nghe an':'40',
    'nb':'37','ninh binh':'37',
    'nt':'58','ninh thuan':'58',
    'pt':'25','phu tho':'25',
    'py':'54','phu yen':'54',
    'qb':'44','quang binh':'44',
    'qnam':'49','quang nam':'49',
    'qng':'51','quang ngai':'51',
    'qn':'22','quang ninh':'22',
    'qt':'45','quang tri':'45',
    'sl':'14','son la':'14',
    'st':'94','soc trang':'94',
    'tn':'19','thai nguyen':'19',
    'tb':'34','thai binh':'34',
    'th':'38','thanh hoa':'38',
    'tth':'46','thua thien hue':'46','hue':'46',
    'tg':'82','tien giang':'82',
    'tninh':'72','tay ninh':'72',
    'tv':'84','tra vinh':'84',
    'tq':'08','tuyen quang':'08',
    'vl':'86','vinh long':'86',
    'vp':'26','vinh phuc':'26',
    'yb':'15','yen bai':'15',
    'binh dinh':'52','bdinh':'52',
};

// District slash/abbrev map
const _DA = {
    'g/vap':'go vap',
    'b/thanh':'binh thanh','b/th':'binh thanh',
    't/duc':'thu duc',
    'b/chanh':'binh chanh',
    'h/mon':'hoc mon',
    'c/gio':'can gio',
    'p/nhuan':'phu nhuan',
    'b/t':'binh tan','b/tan':'binh tan',
    'tdm':'thu dau mot',
    'bmt':'buon ma thuot',
};

const _NOISE_RE = /\b(noi dai|keo dai|mo rong|viet nam|vietnam|n\u1ed1i d\u00e0i|k\u00e9o d\u00e0i|m\u1edf r\u1ed9ng)\b/gi;

// [BUG 6+10] Only strip subward when identifier is numeric (ấp 3, xóm 4, thôn 2, khu phố 3, hẻm 12)
// Do NOT strip text identifiers (khu phố Hai Son, thôn Tân Dương)
const _SUBWARD_RE = /\b(\u1ea5p|\u1ea1p|ap|x\u00f3m|xom|th\u00f4n|thon|t\u1ed5 d\u00e2n ph\u1ed1|to dan pho|t\u1ed5|to|kh\u00f3m|khom|khu ph\u1ed1|khu pho|tdp|ng\u00f5|ngo|h\u1ebem|hem)\s+(\d[\w/]*)\b/gi;

function _expand(text, data) {
    text = text.normalize('NFC').replace(/\u00A0/g, ' ');
    text = text.replace(/\s*[-\u2013\u2014|]\s*/g, ', ');

    // Slash abbreviations
    text = text.replace(/\b([\w\u00C0-\u024F]+)\/([\w\u00C0-\u024F]+)\b/g, function(m) {
        const k = _nn(m).replace(/\s/g, '/');
        const mapped = _DA[k] || _DA[m.toLowerCase()];
        if (mapped) {
            for (const prov of data) {
                const d = prov.Districts.find(function(d) { return _bare(d.Name) === mapped || _nn(d.Name).includes(mapped); });
                if (d) return d.Name;
            }
        }
        return m;
    });

    // Q.8 / Q8 / Q 8
    text = text.replace(/\bQ\.?\s*(\d{1,2})\b/gi, 'Qu\u1eadn $1');
    // P.15 / F.3 / P15 (numeric wards)
    text = text.replace(/\b[PF]\.?\s*(\d{1,2})\b/gi, 'Ph\u01b0\u1eddng $1');

    // [BUG 7] P./p. prefix for non-numeric ward names: "p.Phu Loi" → "Phường Phu Loi"
    text = text.replace(/\b[pP]\.\s?([A-Z][a-zA-Z\u00C0-\u024F]*(?:\s+[A-Z][a-zA-Z\u00C0-\u024F]*){0,2})\b/g,
        'Ph\u01b0\u1eddng $1');

    // Roman numerals in ward context
    const ROMAN = {'i':'1','ii':'2','iii':'3','iv':'4','v':'5','vi':'6','vii':'7','viii':'8','ix':'9','x':'10'};
    text = text.replace(/\b(ph\u01b0\u1eddng|phuong)\s+(x{0,1}i{0,3}|i?x|v?i{0,3})\b/gi, function(m, kw, rn) {
        const n = ROMAN[rn.toLowerCase()]; return n ? kw + ' ' + n : m;
    });

    text = text.replace(_NOISE_RE, ' ');
    text = text.replace(/\b\d{5,6}\b/g, ' ');

    // Province abbreviations: scan tokens longest-match
    const tokens = text.split(/\s+/);
    const out = []; let i = 0;
    while (i < tokens.length) {
        let matched = false;
        for (let n = Math.min(3, tokens.length - i); n >= 1; n--) {
            const key = _nn(tokens.slice(i, i + n).join(' '));
            const pid = _PA[key];
            if (pid) {
                const prov = data.find(function(p) { return p.Id === pid; });
                if (prov) { out.push(prov.Name); i += n; matched = true; break; }
            }
        }
        if (!matched) { out.push(tokens[i]); i++; }
    }
    text = out.join(' ');

    // District abbreviations (TDM, BMT — non-slash)
    for (const abbr of Object.keys(_DA)) {
        if (abbr.includes('/')) continue;
        const normName = _DA[abbr];
        const escaped = abbr.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        const re = new RegExp('\\b' + escaped + '\\b', 'gi');
        if (re.test(text)) {
            for (const prov of data) {
                const d = prov.Districts.find(function(dd) { return _bare(dd.Name) === normName || _nn(dd.Name).includes(normName); });
                if (d) { text = text.replace(re, d.Name); break; }
            }
        }
    }
    return text.replace(/\s+/g, ' ').trim();
}

function _extractSubward(text) {
    const parts = [];
    var cleaned = text.replace(_SUBWARD_RE, function(m) { parts.push(m.trim()); return ' '; })
                      .replace(/\s+/g, ' ').trim();
    return { cleaned: cleaned, subward: parts.join(', ') };
}

// [BUG 1] Comprehensive admin keyword lookahead — both diacritic AND non-diacritic variants
// Uses \s+ before keyword (left boundary) and (?:\s|$|[,.]) after (right boundary)
// instead of \b which is unreliable for non-ASCII characters in JS regex.
var _ADMIN_LA = '(?='
    + '\\s*(?:$|[,.])'
    + '|\\s+(?:'
    + 'tinh|t\u1ec9nh'
    + '|thanh\\s+pho|th\u00e0nh\\s+ph\u1ed1|tp\\.?'
    + '|quan|qu\u1eadn'
    + '|huyen|h\u01b0y\u1ec7n'
    + '|thi\\s+xa|th\u1ecb\\s+x\u00e3|tx\\.?'
    + '|phuong|ph\u01b0\u1eddng'
    + '|xa|x\u00e3'
    + '|thi\\s+tran|th\u1ecb\\s+tr\u1ea5n|tt\\.?'
    + ')(?:\\s|$|[,.])'
    + ')';

function _anchors(text) {
    const a = { province: null, district: null, ward: null };
    let m;

    // [BUG 2] Changed {2,...} to {1,...} to allow single-digit names (Quận 8, Phường 1)
    var reP = new RegExp('\\b(?:t\u1ec9nh|tinh)\\s+([^,\\n]{1,30}?)' + _ADMIN_LA, 'gi');
    reP.lastIndex = 0;
    while ((m = reP.exec(text))) a.province = m[1].trim();

    var tpCands = [];
    var reTP = new RegExp('\\b(?:th\u00e0nh\\s+ph\u1ed1|thanh\\s+pho|tp\\.?)\\s+([^,\\n]{1,25}?)' + _ADMIN_LA, 'gi');
    reTP.lastIndex = 0;
    while ((m = reTP.exec(text))) tpCands.push(m[1].trim().split(/\s*,/)[0].trim());

    var reD = new RegExp('\\b(?:qu\u1eadn|quan|h\u01b0y\u1ec7n|huyen|th\u1ecb\\s+x\u00e3|thi\\s+xa|tx\\.?)\\s+([^,\\n]{1,25}?)' + _ADMIN_LA, 'gi');
    reD.lastIndex = 0;
    while ((m = reD.exec(text))) a.district = m[1].trim().split(/\s*,/)[0].trim();

    var reW = new RegExp('\\b(?:ph\u01b0\u1eddng|phuong|th\u1ecb\\s+tr\u1ea5n|thi\\s+tran|tt\\.?|(?<!\\bthi\\s)(?<!\\bth\u1ecb\\s)(?:x\u00e3|xa))\\s+([^,\\n]{1,25}?)' + _ADMIN_LA, 'gi');
    reW.lastIndex = 0;
    while ((m = reW.exec(text))) {
        var wText = m[1].trim().split(/\s*,/)[0].trim();
        // Ward names are typically 1-3 words; trim excess words (district/province info that leaked in)
        var wWords = wText.split(/\s+/);
        if (wWords.length > 3) wText = wWords.slice(0, 2).join(' ');
        a.ward = wText;
    }

    // Resolve "thành phố" candidates: province-level or district-level city?
    const provCities = new Set(['ho chi minh','ha noi','da nang','hai phong','can tho']);
    for (var ci = 0; ci < tpCands.length; ci++) {
        var cand = tpCands[ci];
        if (provCities.has(_bare(cand))) { a.province = cand; }
        else if (!a.district) { a.district = cand; }
        else if (!a.province) { a.province = cand; }
    }
    return a;
}

function _match(cand, items, thr) {
    if (!cand || !items || !items.length) return null;
    const cn = _bare(cand); if (!cn) return null;
    let best = null, bScore = 0;
    for (const item of items) {
        const iN = _bare(item.Name);
        if (cn === iN) return item;
        let score = 0;
        if (cn.length >= 2 && iN.includes(cn)) score = cn.length / iN.length * 0.95;
        else if (iN.length >= 2 && cn.includes(iN)) score = iN.length / cn.length * 0.90;
        else {
            const maxL = Math.max(cn.length, iN.length);
            if (Math.abs(cn.length - iN.length) <= maxL * 0.5)
                score = 1 - levenshteinDistance(cn, iN) / maxL;
        }
        if (score > bScore && score >= thr) { best = item; bScore = score; }
    }
    return best;
}

// [BUG 5] Track the end-inference source text for cross-validation
var _provFromEndText = null;
function _inferProvFromEnd(text, data, thr) {
    _provFromEndText = null;
    const words = text.split(/[\s,]+/).filter(function(w) { return w.length > 1; });
    for (let n = Math.min(3, words.length); n >= 1; n--) {
        var candidate = words.slice(-n).join(' ');
        const p = _match(candidate, data, thr);
        if (p) {
            _provFromEndText = candidate;
            return p;
        }
    }
    return null;
}

let _lastDistProv = null;
function _globalDist(cand, data, province, thr) {
    if (!cand) return null;
    const cn = _bare(cand);
    let best = null, bScore = 0, bProv = null;
    const list = province ? [province] : data;
    for (const prov of list) {
        for (const dist of (prov.Districts || [])) {
            const dn = _bare(dist.Name);
            let score = cn === dn ? 1 : 0;
            if (!score && (dn.includes(cn) || cn.includes(dn)))
                score = Math.min(cn.length, dn.length) / Math.max(cn.length, dn.length) * 0.92;
            if (!score) {
                const maxL = Math.max(cn.length, dn.length);
                if (Math.abs(cn.length - dn.length) <= maxL * 0.5)
                    score = 1 - levenshteinDistance(cn, dn) / maxL;
            }
            if (score > bScore && score >= thr) { best = dist; bScore = score; bProv = prov; }
        }
    }
    _lastDistProv = bProv;
    return best;
}

function _globalWard(cand, data, province, district, thr) {
    if (!cand) return null;
    const cn = _bare(cand);
    let best = null, bScore = 0, bProv = null, bDist = null;
    for (const prov of (province ? [province] : data)) {
        for (const dist of (district ? [district] : (prov.Districts || []))) {
            for (const ward of (dist.Wards || [])) {
                const wn = _bare(ward.Name);
                let score = cn === wn ? 1 : 0;
                if (!score && (wn.includes(cn) || cn.includes(wn)))
                    score = Math.min(cn.length, wn.length) / Math.max(cn.length, wn.length) * 0.90;
                if (!score) {
                    const maxL = Math.max(cn.length, wn.length);
                    if (Math.abs(cn.length - wn.length) <= maxL * 0.5)
                        score = 1 - levenshteinDistance(cn, wn) / maxL;
                }
                if (score > bScore && score >= thr) { best = ward; bScore = score; bProv = prov; bDist = dist; }
            }
        }
    }
    return best ? { ward: best, district: bDist, province: bProv } : null;
}

// [BUG 4] Added Pass 3: district-first global search for addresses without province
function _fallback(text, data) {
    const out = { province: null, district: null, ward: null };
    const segs = text.split(',').map(function(s) { return s.trim(); }).filter(Boolean);

    // Pass 1: Comma-segment — province from segments (right-to-left)
    if (segs.length >= 2) {
        for (let pi = segs.length - 1; pi >= 0; pi--) {
            const p = _match(segs[pi], data, 0.80);
            if (!p) continue;
            out.province = p;
            if (pi > 0) {
                const d = _match(segs[pi - 1], p.Districts, 0.75);
                if (d) { out.district = d; if (pi > 1) out.ward = _match(segs[pi - 2], d.Wards, 0.73); }
            }
            return out;
        }
    }

    // Pass 2: Word n-gram — find province, then district/ward in remainder
    const words = text.split(/\s+/).filter(Boolean);
    for (let n = Math.min(3, words.length); n >= 1; n--) {
        for (let s = words.length - n; s >= 0; s--) {
            const p = _match(words.slice(s, s + n).join(' '), data, 0.82);
            if (!p) continue;
            out.province = p;
            const rem = words.slice(0, s).concat(words.slice(s + n));
            for (let dn = Math.min(3, rem.length); dn >= 1; dn--) {
                for (let ds = rem.length - dn; ds >= 0; ds--) {
                    const d = _match(rem.slice(ds, ds + dn).join(' '), p.Districts, 0.78);
                    if (!d) continue;
                    out.district = d;
                    const rem2 = rem.slice(0, ds).concat(rem.slice(ds + dn));
                    for (let wn = Math.min(3, rem2.length); wn >= 1; wn--) {
                        for (let ws = rem2.length - wn; ws >= 0; ws--) {
                            const w = _match(rem2.slice(ws, ws + wn).join(' '), d.Wards, 0.75);
                            if (w) { out.ward = w; return out; }
                        }
                    }
                    return out;
                }
            }
            return out;
        }
    }

    // Pass 3: District-first — global district search when no province found
    for (var dn = Math.min(3, words.length); dn >= 1; dn--) {
        for (var ds = words.length - dn; ds >= 0; ds--) {
            var dCand = words.slice(ds, ds + dn).join(' ');
            var d = _globalDist(dCand, data, null, 0.80);
            if (!d) continue;
            out.district = d;
            out.province = _lastDistProv;
            var rem3 = words.slice(0, ds).concat(words.slice(ds + dn));
            for (var wn = Math.min(3, rem3.length); wn >= 1; wn--) {
                for (var ws = rem3.length - wn; ws >= 0; ws--) {
                    var w = _match(rem3.slice(ws, ws + wn).join(' '), d.Wards, 0.75);
                    if (w) { out.ward = w; return out; }
                }
            }
            return out;
        }
    }

    return out;
}

// [IMPROVEMENT 1] Partial fallback — find district/ward within a known province or district
function _partialFallback(text, data, province, district) {
    var result = { district: district, ward: null };
    var segs = text.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    var words = text.split(/\s+/).filter(Boolean);

    if (province && !district) {
        // Scan right-to-left: district is usually closer to the province (at end)
        for (var si = segs.length - 1; si >= 0; si--) {
            var d = _match(segs[si], province.Districts, 0.78);
            if (d) { result.district = d; break; }
        }
        if (!result.district) {
            for (var n = Math.min(3, words.length); n >= 1; n--) {
                for (var i = 0; i <= words.length - n; i++) {
                    var d2 = _match(words.slice(i, i + n).join(' '), province.Districts, 0.78);
                    if (d2) { result.district = d2; break; }
                }
                if (result.district) break;
            }
        }
    }

    var dist = result.district;
    if (dist) {
        for (var si2 = 0; si2 < segs.length; si2++) {
            var w = _match(segs[si2], dist.Wards, 0.73);
            if (w) { result.ward = w; break; }
        }
        if (!result.ward) {
            for (var n2 = Math.min(3, words.length); n2 >= 1; n2--) {
                for (var i2 = 0; i2 <= words.length - n2; i2++) {
                    var w2 = _match(words.slice(i2, i2 + n2).join(' '), dist.Wards, 0.75);
                    if (w2) { result.ward = w2; break; }
                }
                if (result.ward) break;
            }
        }
    }

    return result;
}

// [BUG 8] Deduplicate subward from street, clean up artifacts
function _extractStreet(expanded, province, district, ward, subward) {
    let s = expanded;
    s = s.replace(/\b(?:t\u1ec9nh|tinh)\s+[^,]+/gi, ' ');
    s = s.replace(/\b(?:th\u00e0nh ph\u1ed1|thanh pho|tp\.?)\s+[^,]+/gi, ' ');
    s = s.replace(/\b(?:qu\u1eadn|quan|h\u01b0y\u1ec7n|huyen|th\u1ecb x\u00e3|thi xa|tx\.?)\s+[^,]+/gi, ' ');
    s = s.replace(/\b(?:ph\u01b0\u1eddng|phuong|x\u00e3|xa|th\u1ecb tr\u1ea5n|thi tran|tt\.?)\s+[^,]+/gi, ' ');
    function safe(n) { return n ? n.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') : ''; }
    if (province) s = s.replace(new RegExp(safe(province.Name), 'gi'), ' ');
    if (district) s = s.replace(new RegExp(safe(district.Name), 'gi'), ' ');
    if (ward)     s = s.replace(new RegExp(safe(ward.Name), 'gi'), ' ');
    // Remove subward numeric patterns to avoid duplication with prepended subward
    if (subward) s = s.replace(_SUBWARD_RE, ' ');
    // Clean up lone Q./P./F. artifacts left after keyword stripping
    s = s.replace(/\b[QPF]\.\s*/gi, ' ');
    s = s.replace(/[,\s]+$/, '').replace(/^[,\s]+/, '').replace(/,\s*,+/g, ',').replace(/\s+/g, ' ').trim();
    return subward ? subward + (s ? ', ' + s : '') : s;
}

/**
 * parseAddress v2 — Anchor-Cascade Algorithm
 */
async function parseAddress(addressText, customerHint) {
    if (customerHint === undefined) customerHint = null;
    const result = { street:'', ward:null, district:null, province:null, confidence:'low', suggestions:[], warnings:[] };
    const data = getVietnamAddressData();
    if (!data || !data.length || !addressText || !addressText.trim()) return result;
    _buildAddrIdx(data);

    // Phase 1: Expand abbreviations, normalize separators, strip noise
    const expanded = _expand(addressText, data);

    // Phase 2: Strip numeric sub-ward tokens (ấp 3, xóm 4...) → save as street prefix
    const sw = _extractSubward(expanded);
    const cleaned = sw.cleaned;
    const subward = sw.subward;

    // Phase 3: Detect keyword anchors (tỉnh X, quận X, phường X...)
    const anc = _anchors(cleaned);

    let province = null, district = null, ward = null;

    // Phase 4a: Province from anchor keyword
    if (anc.province) {
        // Guard: if the captured "province" text starts with a district/ward keyword
        // (e.g. "Quận Bình Thạnh" from false "tinh" in street name "Xô Viết Nghệ Tĩnh"),
        // treat it as a district anchor instead.
        var _provNn = _nn(anc.province);
        if (/^(quan|huyen|thi xa|tx|phuong|xa|thi tran|tt)\s/.test(_provNn)) {
            if (!anc.district) anc.district = anc.province.replace(/^\S+\s+/, '');
            anc.province = null;
        }
    }
    if (anc.province) {
        province = _match(anc.province, data, 0.78);
        if (!province) {
            const d = _globalDist(anc.province, data, null, 0.80);
            if (d) { district = d; province = _lastDistProv; anc.province = null; }
        }
    }
    // [BUG 5] Higher threshold (0.90) for end-inference to reduce false positives
    if (!province) province = _inferProvFromEnd(cleaned, data, 0.90);

    // Phase 4b: District from anchor keyword
    if (anc.district) {
        if (province) district = _match(anc.district, province.Districts, 0.78);
        if (!district) {
            district = _globalDist(anc.district, data, province, 0.78);
            if (district && !province) province = _lastDistProv;
        }
    }

    // Phase 4c: Ward from anchor keyword
    if (anc.ward) {
        if (district) ward = _match(anc.ward, district.Wards, 0.75);
        if (!ward) {
            const r = _globalWard(anc.ward, data, province, district, 0.75);
            if (r) { ward = r.ward; if (!district) district = r.district; if (!province) province = r.province; }
        }
    }

    // Phase 5: Full fallback — segment-based cascade when anchors found nothing
    if (!province && !district && !ward) {
        const fb = _fallback(cleaned, data);
        province = fb.province; district = fb.district; ward = fb.ward;
    }

    // [BUG 3 + IMPROVEMENT 1] Partial fallback — find district/ward within known province
    if (province && (!district || !ward)) {
        var pf = _partialFallback(cleaned, data, province, district);
        if (!district && pf.district) district = pf.district;
        if (!ward && pf.ward) ward = pf.ward;
    }

    // Phase 6: Reverse inference — fill missing levels using reverse index
    if (ward && !district) {
        const r = _addrIdx.wardLoc.get(ward.Id);
        if (r) { district = r.district; if (!province) province = r.province; }
    }
    if (district && !province) {
        const p = _addrIdx.distProv.get(district.Id);
        if (p) province = p;
    }

    // [IMPROVEMENT 2] Cross-validation — if only province found via end-inference,
    // try re-interpreting the candidate as a district for better coverage
    if (province && !district && !ward && _provFromEndText) {
        var altDist = _globalDist(_provFromEndText, data, null, 0.80);
        if (altDist && _lastDistProv && _lastDistProv.Id !== province.Id) {
            var altPf = _partialFallback(cleaned, data, _lastDistProv, altDist);
            if (altPf.ward) {
                province = _lastDistProv;
                district = altDist;
                ward = altPf.ward;
            } else {
                province = _lastDistProv;
                district = altDist;
            }
        }
    }

    // Cross-validate: if result came from global ward search, check if unused
    // comma segments suggest a different district (e.g. "Thoi Binh" → Cà Mau not Thái Bình)
    if (province && district && ward) {
        var cvSegs = cleaned.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
        var lastSeg = cvSegs.length > 0 ? cvSegs[cvSegs.length - 1] : '';
        if (lastSeg) {
            var lsBare = _bare(lastSeg);
            var pBare = _bare(province.Name);
            var dBare = _bare(district.Name);
            if (lsBare !== pBare && lsBare !== dBare
                && levenshteinDistance(lsBare, pBare) > 2
                && levenshteinDistance(lsBare, dBare) > 2) {
                var cvDist = _globalDist(lastSeg, data, null, 0.78);
                if (cvDist) {
                    var cvProv = _lastDistProv;
                    var wardText = anc.ward || _bare(ward.Name);
                    var cvWard = _match(wardText, cvDist.Wards, 0.75);
                    if (cvWard) {
                        province = cvProv;
                        district = cvDist;
                        ward = cvWard;
                    }
                }
            }
        }
    }

    // Phase 7: Customer hint boost (from order history)
    if (!province && customerHint && customerHint.province_id) {
        province = data.find(function(p) { return p.Id === customerHint.province_id; }) || null;
        if (province && !district && customerHint.district_id)
            district = (province.Districts || []).find(function(d) { return d.Id === customerHint.district_id; }) || null;
    }

    // Phase 8: Extract street address (remainder after removing admin units)
    result.street   = _extractStreet(expanded, province, district, ward, subward);
    result.province = province;
    result.district = district;
    result.ward     = ward;
    result.confidence = province && district && ward ? 'high' : province && district ? 'medium' : 'low';

    console.log('\uD83D\uDCCD parseAddress v2:', {
        province: province ? province.Name : null,
        district: district ? district.Name : null,
        ward: ward ? ward.Name : null,
        street: result.street,
        confidence: result.confidence
    });
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

    // Normalize phone number separators: 0984.923.405 → 0984923405, 0984-923-405 → 0984923405
    // Run twice to handle patterns where matches are adjacent (e.g. 3 groups)
    text = text
        .replace(/(\d)[.\- ](\d)/g, '$1$2')
        .replace(/(\d)[.\- ](\d)/g, '$1$2');
    
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
    
    // Customer address hint: zero-cost lookup từ dữ liệu đã load trong bộ nhớ
    const customerHint = phoneInfo?.phone ? getCustomerAddressHint(phoneInfo.phone) : null;
    if (customerHint) {
        console.log(`🧑 Customer hint found: province=${customerHint.province_id}, district=${customerHint.district_id} (${customerHint.orderCount} đơn)`);
    }
    
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
            // Also check phoneInfo.original for 9-digit fallback case (missing leading 0)
            const phoneMatch = phoneInfo && (
                line.includes(phoneInfo.phone) ? phoneInfo.phone :
                (phoneInfo.original && line.includes(phoneInfo.original)) ? phoneInfo.original : null
            );
            if (phoneMatch) {
                return line
                    .replace(phoneMatch, '')
                    .replace(/[,.\-\s]+$/, '') // Remove trailing punctuation
                    .replace(/^[,.\-\s]+/, '') // Remove leading punctuation
                    .trim();
            }
            return line;
        })
        .filter(line => line.length > 0); // Remove empty lines after phone removal
    
    const addressText = addressLines.join(', ');
    const addressInfo = await parseAddress(addressText, customerHint);
    
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

// ============================================
// WARD SUGGESTION TAGS (khi ward không tìm thấy)
// ============================================

/**
 * Tính top N phường/xã gợi ý bằng word-overlap scoring.
 * Nhẹ, nhanh (chỉ string compare, không Levenshtein).
 */
function _scoreWardSuggestions(wards, addressText, limit = 3) {
    if (!wards?.length || !addressText) return [];

    const addrNorm = removeVietnameseTones(addressText).toLowerCase();
    const scored = [];

    for (const ward of wards) {
        const nameClean = removeVietnameseTones(ward.Name).toLowerCase()
            .replace(/^(phuong|xa|thi tran|tt)\s+/i, '');
        if (nameClean.length < 2) continue;

        let score = 0;

        if (addrNorm.includes(nameClean)) {
            score = 0.8 + Math.min(nameClean.length / 30, 0.2);
        } else {
            const wardWords = nameClean.split(/\s+/).filter(w => w.length >= 2);
            const matched = wardWords.filter(w => addrNorm.includes(w));
            if (matched.length > 0) {
                score = (matched.length / wardWords.length) * 0.6;
            }
        }

        if (score > 0.15) scored.push({ ward, score });
    }

    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Hiển thị tag gợi ý phường/xã dưới grid địa chỉ.
 * Click tag → set ward dropdown + cập nhật preview + xóa tag.
 */
function renderWardSuggestions(district, addressText) {
    const old = document.getElementById('wardSuggestions');
    if (old) old.remove();

    if (!district?.Wards?.length) return;

    const wardSelect = document.getElementById('newOrderWard');
    if (!wardSelect) return;

    const suggestions = _scoreWardSuggestions(district.Wards, addressText);
    if (suggestions.length === 0) return;

    const container = document.createElement('div');
    container.id = 'wardSuggestions';
    container.className = 'mt-1.5 flex flex-wrap items-center gap-1.5';

    const label = document.createElement('span');
    label.className = 'text-xs text-gray-500';
    label.textContent = 'Gợi ý phường/xã:';
    container.appendChild(label);

    for (const { ward, score } of suggestions) {
        const btn = document.createElement('button');
        btn.type = 'button';
        const isStrong = score >= 0.6;
        btn.className = isStrong
            ? 'px-2.5 py-0.5 text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-full font-semibold transition-colors ring-1 ring-indigo-300'
            : 'px-2.5 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full font-medium transition-colors';
        btn.textContent = ward.Name;
        btn.title = `Score: ${score.toFixed(2)}`;
        btn.onclick = () => {
            wardSelect.value = ward.Id;
            wardSelect.dispatchEvent(new Event('change'));
            container.remove();
            _setFieldConfidence(wardSelect, 'high');
        };
        container.appendChild(btn);
    }

    const gridContainer = wardSelect.closest('.grid');
    if (gridContainer) {
        gridContainer.parentElement.insertBefore(container, gridContainer.nextSibling);
    }
}

/**
 * Xóa gợi ý phường/xã.
 */
function clearWardSuggestions() {
    const el = document.getElementById('wardSuggestions');
    if (el) el.remove();
}

// ============================================
// SMART PASTE CONFIDENCE INDICATORS
// ============================================

const _confidenceRingClasses = {
    high:   ['ring-2', 'ring-green-500', 'border-green-400'],
    medium: ['ring-2', 'ring-amber-500', 'border-amber-400'],
    low:    ['ring-2', 'ring-red-500',   'border-red-400']
};
const _allRingClasses = Object.values(_confidenceRingClasses).flat();

function _setFieldConfidence(el, level) {
    if (!el) return;
    el.classList.remove(..._allRingClasses);
    const cls = _confidenceRingClasses[level];
    if (cls) el.classList.add(...cls);
}

/**
 * Hiển thị confidence trực quan trên các dropdown địa chỉ sau smart paste.
 *   - Xanh lá: nhận diện chắc chắn
 *   - Vàng cam: cần kiểm tra lại
 *   - Đỏ: không tìm thấy, cần chọn tay
 * Badge tóm tắt hiển thị dưới preview địa chỉ.
 * Tự động xóa khi user thay đổi bất kỳ dropdown nào.
 */
function showSmartPasteConfidence(data) {
    const ids = ['newOrderProvince', 'newOrderDistrict', 'newOrderWard', 'newOrderStreetAddress'];
    const [provEl, distEl, wardEl, streetEl] = ids.map(id => document.getElementById(id));
    const preview = document.getElementById('newOrderAddressPreview');

    const addr = data.address;
    const overallConf = addr.confidence || 'low';

    // Province: luôn 'high' khi tìm thấy (tỉnh/TP rất ít nhầm)
    _setFieldConfidence(provEl, addr.province ? 'high' : 'low');

    // District/Ward: dùng overallConf nếu tìm thấy, 'low' nếu không
    _setFieldConfidence(distEl, addr.district ? (overallConf === 'low' ? 'medium' : overallConf) : 'low');
    _setFieldConfidence(wardEl, addr.ward ? overallConf : 'low');

    // Street: 'high' nếu có giá trị
    if (addr.street) _setFieldConfidence(streetEl, 'high');

    // Badge tóm tắt
    if (preview) {
        const items = [
            { ok: !!addr.province, label: 'Tỉnh/TP' },
            { ok: !!addr.district, label: 'Quận/Huyện' },
            { ok: !!addr.ward,     label: 'Phường/Xã' }
        ];

        let badge = document.getElementById('smartPasteConfidenceBadge');
        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'smartPasteConfidenceBadge';
            preview.parentNode.appendChild(badge);
        }

        const allOk = items.every(i => i.ok);
        const bgCls = allOk
            ? 'bg-green-50 border-green-200'
            : 'bg-amber-50 border-amber-200';

        badge.className = `mt-1.5 px-2.5 py-1 rounded-lg border text-xs flex items-center gap-1.5 ${bgCls}`;
        badge.innerHTML = items.map(i => {
            if (i.ok) return `<span class="text-green-600 font-semibold">✓ ${i.label}</span>`;
            return `<span class="text-red-600 font-semibold">✗ ${i.label}</span>`;
        }).join('<span class="text-gray-300">|</span>');
    }

    // Tự động xóa indicator khi user thay đổi bất kỳ field nào
    const clearOnce = () => clearSmartPasteConfidence();
    const opts = { once: true };
    provEl?.addEventListener('change', clearOnce, opts);
    distEl?.addEventListener('change', clearOnce, opts);
    wardEl?.addEventListener('change', clearOnce, opts);
    streetEl?.addEventListener('input', clearOnce, opts);
}

/**
 * Xóa toàn bộ confidence indicator khỏi form địa chỉ.
 */
function clearSmartPasteConfidence() {
    ['newOrderProvince', 'newOrderDistrict', 'newOrderWard', 'newOrderStreetAddress']
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove(..._allRingClasses);
        });
    const badge = document.getElementById('smartPasteConfidenceBadge');
    if (badge) badge.remove();
    clearWardSuggestions();
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
                clearWardSuggestions();
                console.log('✅ Ward set to:', wardSelect.value);
            } else {
                console.log('⚠️ Ward not found, rendering suggestions...');
                renderWardSuggestions(data.address.district, data.address.fullText);
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

    // Hiển thị confidence trực quan trên các dropdown
    showSmartPasteConfidence(data);
}

// Initialize on page load - NO LONGER NEEDED, use addressSelector data
// (removed loadVietnamAddressData call)

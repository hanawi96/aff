// Smart Paste - Auto-parse customer information
// Intelligently extracts name, phone, and address from pasted text

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
 */
function similarityScore(str1, str2) {
    const distance = levenshteinDistance(str1, str2);
    const maxLen = Math.max(str1.length, str2.length);
    return 1 - (distance / maxLen);
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
    
    for (const option of options) {
        const normalizedOption = removeVietnameseTones(option.Name);
        const cleanOption = normalizedOption
            .replace(/^(tinh|thanh pho|tp|quan|huyen|phuong|xa|thi tran|tt|thi xa|tx)\s+/i, '')
            .toLowerCase()
            .trim();
        
        let score = 0;
        let type = '';
        
        // 1. Exact match (highest priority)
        if (normalizedOption === normalizedInput || cleanOption === cleanInput) {
            return { match: option, score: 1.0, confidence: 'high' };
        }
        
        // 2. Contains match - BOTH DIRECTIONS with priority
        // Check if input contains option (user typed more than needed)
        if (normalizedInput.includes(cleanOption) && cleanOption.length >= 4) {
            score = 0.9;
            type = 'input-contains-option';
        }
        // Check if option contains input (user typed less)
        else if (cleanOption.includes(cleanInput) && cleanInput.length >= 4) {
            score = 0.85;
            type = 'option-contains-input';
        }
        // Full normalized contains
        else if (normalizedOption.includes(normalizedInput) || normalizedInput.includes(normalizedOption)) {
            score = 0.8;
            type = 'contains-full';
        }
        
        // 3. Word-by-word matching with ALL words must match
        if (score === 0) {
            const inputWords = cleanInput.split(/\s+/).filter(w => w.length > 0);
            const optionWords = cleanOption.split(/\s+/).filter(w => w.length > 0);
            
            let matchCount = 0;
            for (const iw of inputWords) {
                for (const ow of optionWords) {
                    if (iw === ow || ow.includes(iw) || iw.includes(ow)) {
                        matchCount++;
                        break;
                    }
                }
            }
            
            if (matchCount > 0) {
                // Higher score if ALL input words matched
                if (matchCount === inputWords.length) {
                    score = 0.95;
                    type = `word-match-all-${matchCount}`;
                } else {
                    score = (matchCount / Math.max(inputWords.length, optionWords.length)) * 0.7;
                    type = `word-match-${matchCount}/${inputWords.length}`;
                }
            }
        }
        
        // 4. Fuzzy matching with edit distance (for typos)
        if (score < 0.7) {
            const similarity = similarityScore(cleanInput, cleanOption);
            if (similarity > 0.6) {
                const editScore = similarity * 0.85;
                if (editScore > score) {
                    score = editScore;
                    type = 'edit-distance';
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
    
    if (bestScore >= threshold) {
        const confidence = bestScore >= 0.85 ? 'high' : bestScore >= 0.65 ? 'medium' : 'low';
        return { match: bestMatch, score: bestScore, confidence };
    }
    
    return null;
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
    const addressKeywords = ['phường', 'xã', 'quận', 'huyện', 'thành phố', 'tỉnh', 'tp', 'đường', 'phố', 'thôn', 'thon', 'xa', 'xom', 'xóm', 'ấp', 'ap', 'khu', 'số', 'so', 'đống', 'dong', 'ngõ', 'ngo', 'hem', 'hẻm'];
    
    console.log('🔍 Extracting name from', lines.length, 'lines:', lines);
    
    const candidateLines = lines.filter(line => {
        const lower = line.toLowerCase();
        // Skip if contains phone
        if (phoneInfo && line.includes(phoneInfo.phone)) {
            console.log(`  ✗ Skip (has phone): "${line}"`);
            return false;
        }
        // Skip if contains address keywords
        if (addressKeywords.some(kw => lower.includes(kw))) {
            console.log(`  ✗ Skip (has address keyword): "${line}"`);
            return false;
        }
        // Skip if too long (likely address)
        if (line.length > 50) {
            console.log(`  ✗ Skip (too long): "${line}"`);
            return false;
        }
        // Skip if contains too many numbers
        if ((line.match(/\d/g) || []).length > 3) {
            console.log(`  ✗ Skip (too many numbers): "${line}"`);
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
function parseAddress(addressText) {
    const result = {
        street: '',
        ward: null,
        district: null,
        province: null,
        confidence: 'low',
        suggestions: []
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
    
    // PRE-PROCESSING: Expand common abbreviations
    // F1-F30, P1-P30 → Phường 1-30
    // Q1-Q12 → Quận 1-12
    // X. → Xã, H. → Huyện, T. → Tỉnh
    // TP HN, TP.HN → Thành phố Hà Nội
    let processedAddress = addressText;
    
    // Expand city abbreviations FIRST (highest priority)
    // TP HN, TP.HN, tp hn, tp.hn → Thành phố Hà Nội
    processedAddress = processedAddress.replace(/\b(tp|thanh pho)\.?\s*(hn|hcm|dn|hp|ct)\b/gi, (match, prefix, city) => {
        const cityMap = {
            'hn': 'Thành phố Hà Nội',
            'hcm': 'Thành phố Hồ Chí Minh',
            'dn': 'Thành phố Đà Nẵng',
            'hp': 'Thành phố Hải Phòng',
            'ct': 'Thành phố Cần Thơ'
        };
        return cityMap[city.toLowerCase()] || match;
    });
    
    // Expand ward abbreviations: F17, F.17, f17, f.17 → Phường 17
    // Also: P17, P.17, p17, p.17 → Phường 17
    processedAddress = processedAddress.replace(/\b[FP]\.?(\d{1,2})\b/gi, 'Phường $1');
    
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
    
    if (processedAddress !== addressText) {
        console.log('📝 Expanded abbreviations:', addressText, '→', processedAddress);
        addressText = processedAddress;
    }
    
    // Split by comma OR dash (-)
    // BUT: Don't split if comma is between numbers (e.g., "4,5" = decimal)
    let parts = [];
    let currentPart = '';
    
    for (let i = 0; i < addressText.length; i++) {
        const char = addressText[i];
        const prevChar = i > 0 ? addressText[i - 1] : '';
        const nextChar = i < addressText.length - 1 ? addressText[i + 1] : '';
        
        if ((char === ',' || char === '-') && 
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
    
    console.log('📝 Address parts (split by comma/dash):', parts.length, 'parts');
    
    // ENHANCEMENT: Split parts that contain multiple location keywords
    // Example: "phường 14 quận 8" → ["phường 14", "quận 8"]
    const expandedParts = [];
    
    for (const part of parts) {
        const normalized = removeVietnameseTones(part).toLowerCase();
        
        // Check if part contains multiple administrative levels
        const hasWard = /\b(phuong|xa|thi tran|tt)\b/.test(normalized);
        const hasDistrict = /\b(quan|huyen|thanh pho|tp|thi xa|tx)\b/.test(normalized);
        const hasProvince = /\b(tinh)\b/.test(normalized);
        
        const levelCount = [hasWard, hasDistrict, hasProvince].filter(Boolean).length;
        
        if (levelCount > 1) {
            console.log(`  📌 Part has ${levelCount} admin levels: "${part}"`);
            console.log(`     Normalized: "${normalized}"`);
            console.log(`     hasWard: ${hasWard}, hasDistrict: ${hasDistrict}, hasProvince: ${hasProvince}`);
            
            // Simple split by common patterns
            // Pattern: "xã X huyện Y tỉnh Z" → split into 3 parts
            let subParts = [];
            
            // STRATEGY: Split by keywords in order: ward → district → province
            let remainingText = part;
            
            // Step 1: Extract ward (if exists)
            if (hasWard) {
                // Match with original text (not normalized) to preserve Vietnamese tones
                const wardMatch = remainingText.match(/(xã|xa|phường|phuong|thị trấn|thi tran|tt)\s+([^,]+?)(?=\s*(?:quận|quan|huyện|huyen|thành phố|thanh pho|tp|thị xã|thi xa|tx|tỉnh|tinh)|$)/i);
                console.log(`    🔍 Ward regex match:`, wardMatch);
                if (wardMatch) {
                    const wardPart = wardMatch[0].trim();
                    subParts.push(wardPart);
                    console.log(`    → Split ward: "${wardPart}"`);
                    // Remove ward from remaining text
                    remainingText = remainingText.substring(wardMatch.index + wardMatch[0].length).trim();
                } else {
                    console.log(`    ⚠️ Ward keyword found but regex didn't match`);
                }
            }
            
            // Step 2: Extract district (if exists)
            if (hasDistrict && remainingText) {
                const districtMatch = remainingText.match(/(quận|huyện|thành phố|tp|thị xã|tx)\s+([^,]+?)(?=\s*(?:tỉnh|tinh|thành phố|tp)|$)/i);
                if (districtMatch) {
                    const districtPart = districtMatch[0].trim();
                    subParts.push(districtPart);
                    console.log(`    → Split district: "${districtPart}"`);
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
        
        parts = generateNGrams(words, 2, 4); // 2-4 word combinations (skip single words for now)
        console.log('📝 Generated', parts.length, 'n-grams (2-4 words)');
    }
    
    // Step 1: Find Province - PRIORITIZE LONGER PHRASES and COMMON ABBREVIATIONS
    console.log('🔍 Step 1: Finding Province...');
    let bestProvinceMatch = null;
    let bestProvinceScore = 0;
    let bestProvinceWordCount = 0;
    
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
        const districtKeywordsCareful = ['quan', 'huyen', 'thanh pho', 'tp'];
        
        for (let i = parts.length - 1; i >= 0; i--) {
            const part = parts[i];
            const normalized = removeVietnameseTones(part).toLowerCase().trim();
            const wordCount = part.split(/\s+/).length;
            
            // Skip very short parts (less than 4 chars for provinces)
            if (part.length < 4) continue;
            
            // SKIP if part has ward keywords (phường, xã, thị trấn)
            const hasWardKeyword = districtWardKeywords.some(kw => normalized.includes(kw));
            if (hasWardKeyword) {
                console.log(`  ⏭️ Skipping part with ward keyword: "${part}"`);
                continue;
            }
            
            // For district keywords, only skip if they appear as SEPARATE WORDS
            // Example: "quận 7" should be skipped, but "quảng nam" should NOT
            const hasDistrictKeywordSeparate = districtKeywordsCareful.some(kw => {
                const regex = new RegExp(`\\b${kw}\\b`, 'i');
                return regex.test(normalized);
            });
            
            if (hasDistrictKeywordSeparate) {
                console.log(`  ⏭️ Skipping part with district keyword: "${part}"`);
                continue;
            }
            
            const provinceMatch = fuzzyMatch(part, vietnamAddressData, 0.4);
            if (provinceMatch) {
                // PRIORITY: When iterating from END to START (i from high to low)
                // - First good match (score >= 0.7) wins (province usually at end)
                // - For lower scores, prefer higher score or longer phrase
                
                const isGoodMatch = provinceMatch.score >= 0.7;
                const isBestGood = bestProvinceScore >= 0.7;
                
                let shouldReplace = false;
                
                if (isGoodMatch && !isBestGood) {
                    // Good match beats weak match
                    shouldReplace = true;
                } else if (isGoodMatch && isBestGood) {
                    // Both good - prefer higher score, or longer phrase if similar
                    shouldReplace = provinceMatch.score > bestProvinceScore + 0.05 ||
                                  (Math.abs(provinceMatch.score - bestProvinceScore) <= 0.05 && wordCount > bestProvinceWordCount);
                } else {
                    // Both weak - prefer higher score or longer phrase
                    shouldReplace = provinceMatch.score > bestProvinceScore + 0.05 ||
                                  (Math.abs(provinceMatch.score - bestProvinceScore) <= 0.05 && wordCount > bestProvinceWordCount);
                }
                
                if (shouldReplace) {
                    bestProvinceMatch = provinceMatch;
                    bestProvinceScore = provinceMatch.score;
                    bestProvinceWordCount = wordCount;
                    console.log(`  ✓ Province candidate: "${part}" (${wordCount} words) → ${provinceMatch.match.Name} (score: ${provinceMatch.score.toFixed(2)})`);
                }
            }
        }
    }
    
    if (bestProvinceMatch && bestProvinceScore >= 0.7) {
        result.province = bestProvinceMatch.match;
        result.confidence = bestProvinceMatch.confidence;
        console.log(`  ✅ Province matched: ${result.province.Name} (score: ${bestProvinceScore.toFixed(2)}, ${bestProvinceWordCount} words)`);
    } else {
        if (bestProvinceMatch) {
            console.log(`  ⚠️ Province match score too low (${bestProvinceScore.toFixed(2)}), will try to infer from district...`);
        } else {
            console.log(`  ⚠️ No province found directly, will try to infer from district...`);
        }
        // Don't set province yet - try to find district first, then infer province
    }
    
    // Step 2: Find District - PRIORITIZE LONGER PHRASES with keywords
    console.log('  🔍 Step 2: Finding District...');
    let bestDistrictMatch = null;
    let bestDistrictScore = 0;
    let bestDistrictWordCount = 0;
    
    // Priority keywords for districts
    const districtKeywords = ['thanh pho', 'tp', 'quan', 'huyen', 'thi xa', 'tx'];
    
    // Track which part was used for province to avoid reusing it
    let provincePartIndex = -1;
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
            
            // Skip if this part was used for province
            if (i === provincePartIndex) {
                console.log(`    ⏭️ Skipping province part: "${part}"`);
                continue;
            }
            
            const normalized = removeVietnameseTones(part).toLowerCase();
            const hasKeyword = districtKeywords.some(kw => normalized.includes(kw));
            const wordCount = part.split(/\s+/).length;
            
            if (hasKeyword && part.length >= 4) {
                const districtMatch = fuzzyMatch(part, result.province.Districts, 0.4);
                if (districtMatch) {
                    const shouldReplace = 
                        districtMatch.score > bestDistrictScore + 0.05 ||
                        (Math.abs(districtMatch.score - bestDistrictScore) <= 0.05 && wordCount > bestDistrictWordCount);
                    
                    if (shouldReplace) {
                        bestDistrictMatch = districtMatch;
                        bestDistrictScore = districtMatch.score;
                        bestDistrictWordCount = wordCount;
                        console.log(`    ✓ District candidate (keyword): "${part}" (${wordCount} words) → ${districtMatch.match.Name} (score: ${districtMatch.score.toFixed(2)})`);
                    }
                }
            }
        }
        
        // Second pass: Check all parts if not found with good score
        // IMPORTANT: Check all districts to find multiple matches for verification
        if (bestDistrictScore < 0.7) {
            // Collect all district candidates first
            const districtCandidates = [];
            
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                
                // Skip if this part was used for province
                if (i === provincePartIndex) continue;
                if (part.length < 4) continue;
                
                // Check ALL districts in province, not just best match
                for (const district of result.province.Districts) {
                    const match = fuzzyMatch(part, [district], 0.4);
                    if (match && match.score >= 0.4) {
                        districtCandidates.push({
                            part,
                            index: i,
                            district: district,
                            score: match.score,
                            wordCount: part.split(/\s+/).length
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
                
                // Choose district with best combined score (ward score is priority)
                districtCandidates.sort((a, b) => {
                    // Priority: ward score (more important), then district score
                    if (Math.abs(a.wardScore - b.wardScore) > 0.1) {
                        return b.wardScore - a.wardScore;
                    }
                    return b.score - a.score;
                });
                
                const bestCandidate = districtCandidates[0];
                bestDistrictMatch = { match: bestCandidate.district, score: bestCandidate.score, confidence: 'high' };
                bestDistrictScore = bestCandidate.score;
                bestDistrictWordCount = bestCandidate.wordCount;
                console.log(`    ✅ Best district (verified): "${bestCandidate.part}" → ${bestCandidate.district.Name} (ward_score: ${bestCandidate.wardScore.toFixed(2)})`);
            } else if (districtCandidates.length === 1) {
                // Only one candidate
                const candidate = districtCandidates[0];
                bestDistrictMatch = { match: candidate.district, score: candidate.score, confidence: 'high' };
                bestDistrictScore = candidate.score;
                bestDistrictWordCount = candidate.wordCount;
                console.log(`    ✓ District candidate: "${candidate.part}" (${candidate.wordCount} words, pos: ${candidate.index}) → ${candidate.district.Name} (score: ${candidate.score.toFixed(2)})`);
            }
        }
    } else {
        // Province not found - Search ALL provinces for district match
        console.log(`    🔍 Province not found, searching ALL provinces for district...`);
        
        // PRIORITY: Check parts with district keywords FIRST
        const partsWithKeywords = parts.filter(part => {
            const normalized = removeVietnameseTones(part).toLowerCase();
            return districtKeywords.some(kw => normalized.includes(kw));
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
                        // IMPORTANT: Set province from district's parent
                        result.province = province;
                        console.log(`    ✓ District found in province: "${part}" → ${districtMatch.match.Name} in ${province.Name} (score: ${districtMatch.score.toFixed(2)})`);
                    }
                }
            }
        }
        
        if (result.province) {
            console.log(`  ✅ Province inferred from district: ${result.province.Name}`);
            result.confidence = 'medium'; // Lower confidence since inferred
        }
    }
    
    if (bestDistrictMatch) {
        result.district = bestDistrictMatch.match;
        console.log(`  ✅ District matched: ${result.district.Name} (score: ${bestDistrictScore.toFixed(2)}, ${bestDistrictWordCount} words)`);
        if (bestDistrictMatch.confidence === 'high') {
            result.confidence = 'high';
        }
    } else {
        console.log(`  ⚠️ No district found`);
    }
    
    // Step 3: Find Ward - PRIORITIZE LONGER PHRASES with keywords
    if (result.district) {
        console.log('  🔍 Step 3: Finding Ward...');
        let bestWardMatch = null;
        let bestWardScore = 0;
        let bestWardWordCount = 0;
        
        // Priority keywords for wards
        const wardKeywords = ['phuong', 'xa', 'thi tran', 'tt'];
        
        // Track which part was used for district to avoid reusing it
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
        
        // First pass: Check parts with ward keywords (higher priority)
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            
            // Skip if this part was used for province or district
            if (i === provincePartIndex || i === districtPartIndex) {
                console.log(`    ⏭️ Skipping province/district part: "${part}"`);
                continue;
            }
            
            const normalized = removeVietnameseTones(part).toLowerCase();
            const hasKeyword = wardKeywords.some(kw => normalized.includes(kw));
            
            if (hasKeyword && part.length >= 4) {
                // Extract ward name from part (may contain street address too)
                // Example: "83/7 đường... phường Bình Hưng Hòa B quận..." → extract "phường Bình Hưng Hòa B"
                let wardPart = part;
                
                // Try to extract ward portion using regex
                // IMPORTANT: Stop at district keywords (quận, huyện, etc.)
                const wardMatch = part.match(/(phường|xã|thị trấn|tt)\s+([^,]+?)(?=\s*(?:quận|huyện|thành phố|tp|thi xa|tx)|$)/i);
                if (wardMatch) {
                    // wardMatch[0] = full match including keyword
                    // wardMatch[1] = ward keyword (phường, xã, etc.)
                    // wardMatch[2] = ward name without keyword
                    wardPart = wardMatch[0].trim();
                    console.log(`    📍 Extracted ward portion: "${wardPart}" from "${part}"`);
                }
                
                const wardMatchResult = fuzzyMatch(wardPart, result.district.Wards, 0.4);
                if (wardMatchResult) {
                    const wordCount = wardPart.split(/\s+/).length;
                    const shouldReplace = 
                        wardMatchResult.score > bestWardScore + 0.05 ||
                        (Math.abs(wardMatchResult.score - bestWardScore) <= 0.05 && wordCount > bestWardWordCount);
                    
                    if (shouldReplace) {
                        bestWardMatch = wardMatchResult;
                        bestWardScore = wardMatchResult.score;
                        bestWardWordCount = wordCount;
                        console.log(`    ✓ Ward candidate (keyword): "${wardPart}" (${wordCount} words) → ${wardMatchResult.match.Name} (score: ${wardMatchResult.score.toFixed(2)})`);
                    }
                }
            }
        }
        
        // Second pass: Check all parts if not found with good score
        if (bestWardScore < 0.7) {
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                
                // Skip if this part was used for province or district
                if (i === provincePartIndex || i === districtPartIndex) {
                    console.log(`    ⏭️ Skipping province/district part: "${part}"`);
                    continue;
                }
                
                if (part.length < 4) continue;
                const wordCount = part.split(/\s+/).length;
                
                const wardMatchResult = fuzzyMatch(part, result.district.Wards, 0.4);
                if (wardMatchResult) {
                    const shouldReplace = 
                        wardMatchResult.score > bestWardScore + 0.05 ||
                        (Math.abs(wardMatchResult.score - bestWardScore) <= 0.05 && wordCount > bestWardWordCount);
                    
                    if (shouldReplace) {
                        bestWardMatch = wardMatchResult;
                        bestWardScore = wardMatchResult.score;
                        bestWardWordCount = wordCount;
                        console.log(`    ✓ Ward candidate: "${part}" (${wordCount} words) → ${wardMatchResult.match.Name} (score: ${wardMatchResult.score.toFixed(2)})`);
                    }
                }
            }
        }
        
        if (bestWardMatch) {
            result.ward = bestWardMatch.match;
            console.log(`  ✅ Ward matched: ${result.ward.Name} (score: ${bestWardScore.toFixed(2)}, ${bestWardWordCount} words)`);
            if (bestWardMatch.confidence === 'high' && result.confidence !== 'low') {
                result.confidence = 'high';
            }
        } else {
            console.log(`  ⚠️ No ward found`);
        }
    }
    
    // Step 4: Extract street address - Filter out matched location parts
    let streetParts = [];
    
    if (addressText.includes(',')) {
        // Has commas - filter out parts that matched province/district/ward
        // IMPORTANT: Use the same smart comma splitting logic to preserve decimals like "4,5"
        let commaParts = [];
        let currentPart = '';
        
        for (let i = 0; i < addressText.length; i++) {
            const char = addressText[i];
            const prevChar = i > 0 ? addressText[i - 1] : '';
            const nextChar = i < addressText.length - 1 ? addressText[i + 1] : '';
            
            if (char === ',' && !(char === ',' && /\d/.test(prevChar) && /\d/.test(nextChar))) {
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
                    isLocation = true;
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
                    console.log(`    📍 Extracted street from location part: "${streetPortion}" from "${part}"`);
                    streetParts.push(streetPortion);
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
        // No commas - take first 3-5 words as street address
        const words = addressText.split(/\s+/);
        result.street = words.slice(0, Math.min(5, words.length)).join(' ');
    }
    
    console.log('  🏠 Street address:', result.street || '(none)');
    
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
    let addressLines = lines.filter(line => {
        if (phoneInfo && line.includes(phoneInfo.phone)) return false;
        if (nameInfo && line === nameInfo.name) return false;
        return true;
    });
    
    const addressText = addressLines.join(', ');
    const addressInfo = parseAddress(addressText);
    
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
        showToast(parsedData.error, 'error');
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
                showToast('Lỗi: Không thể tải dữ liệu địa chỉ', 'error');
                return;
            }
        }
        
        const provinceSelect = document.getElementById('newOrderProvince');
        const districtSelect = document.getElementById('newOrderDistrict');
        const wardSelect = document.getElementById('newOrderWard');
        const streetInput = document.getElementById('newOrderStreetAddress');
        
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
            
            // Render wards for this district
            if (data.address.ward) {
                window.addressSelector.renderWards(wardSelect, data.address.province.Id, data.address.district.Id);
                
                // Wait for render to complete
                await new Promise(resolve => setTimeout(resolve, 50));
                
                // Set ward
                wardSelect.value = data.address.ward.Id;
                console.log('✅ Ward set to:', wardSelect.value);
            }
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
    
    // Show result toast
    const confidenceEmoji = {
        'high': '✅',
        'medium': '⚠️',
        'low': '❓'
    };
    
    const confidenceText = {
        'high': 'Phân tích chính xác',
        'medium': 'Vui lòng kiểm tra lại',
        'low': 'Cần kiểm tra kỹ'
    };
    
    showToast(
        `${confidenceEmoji[confidence]} ${confidenceText[confidence]} - Đã điền thông tin tự động`,
        confidence === 'high' ? 'success' : confidence === 'medium' ? 'warning' : 'info',
        3000
    );
}

// Initialize on page load - NO LONGER NEEDED, use addressSelector data
// (removed loadVietnamAddressData call)

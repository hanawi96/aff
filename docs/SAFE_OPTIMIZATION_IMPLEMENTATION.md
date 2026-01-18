# Safe Optimization Implementation Plan

## Nguyên tắc tối cao

> **"Mỗi optimization phải có rollback mechanism và không được phá vỡ logic hiện tại"**

---

## 🔴 PRIORITY 1: N-gram Optimization (Week 1)

### Vấn đề
- Tạo 375 n-grams cho 10 từ
- 4 triệu comparisons
- Chậm 200-500ms

### ✅ SAFE Implementation

#### Step 1: Add Feature Flag (Day 1 - 2h)

```javascript
// Thêm vào đầu file
const OPTIMIZATION_FLAGS = {
    NGRAM_LIMIT: true,           // Giới hạn số n-grams
    NGRAM_SMART_GENERATION: false, // Smart generation (test sau)
    FUZZY_EARLY_EXIT: false,      // Early exit (test sau)
    CACHE_ENABLED: false          // Cache (test sau)
};
```

**An toàn**: Tất cả flags = false ban đầu, bật từng cái một

---

#### Step 2: Optimize N-gram Generation (Day 1-2 - 4h)

**Vị trí**: Sau dòng 1073 (đã có optimization nhưng cần improve)

**Code hiện tại**:
```javascript
// OPTIMIZATION: Only use last 8 words (location info usually at end)
const wordsToUse = words.length > 8 ? words.slice(-8) : words;
parts = generateNGrams(wordsToUse, 2, 4); // 2-4 word combinations
```

**Thêm layer mới** (KHÔNG sửa code cũ):

```javascript
// ============================================
// OPTIMIZATION LAYER: Smart N-gram Generation
// ============================================
if (OPTIMIZATION_FLAGS.NGRAM_LIMIT) {
    console.log('🚀 Optimization: N-gram limit enabled');
    
    // Strategy 1: Reduce maxN from 4 to 3 (giảm 50% n-grams)
    // Safe: 3-word phrases vẫn đủ cho hầu hết địa danh
    const maxN = 3; // Was 4
    const minN = 2; // Keep same
    
    // Strategy 2: Only use last 6 words (was 8)
    // Safe: Location info luôn ở cuối
    const wordsToUse = words.length > 6 ? words.slice(-6) : words;
    
    // Generate n-grams with new limits
    const optimizedNGrams = generateNGrams(wordsToUse, minN, maxN);
    
    console.log(`  📊 N-grams: ${parts.length} → ${optimizedNGrams.length} (${Math.round((1 - optimizedNGrams.length/parts.length) * 100)}% reduction)`);
    
    // IMPORTANT: Keep original as fallback
    const originalNGrams = parts;
    parts = optimizedNGrams;
    
    // Validation: If optimization produces too few n-grams, rollback
    if (parts.length < 5 && originalNGrams.length >= 10) {
        console.warn('  ⚠️ Too few n-grams, rolling back to original');
        parts = originalNGrams;
    }
} else {
    // Original logic (unchanged)
    const wordsToUse = words.length > 8 ? words.slice(-8) : words;
    parts = generateNGrams(wordsToUse, 2, 4);
}
```

**Validation**:
```javascript
// After optimization, validate result quality
if (OPTIMIZATION_FLAGS.NGRAM_LIMIT) {
    // If no province/district found, try again with original n-grams
    if (!result.province && !result.district) {
        console.warn('⚠️ Optimization failed, retrying with full n-grams');
        OPTIMIZATION_FLAGS.NGRAM_LIMIT = false; // Disable temporarily
        return parseAddress(addressText); // Retry
    }
}
```

**Test cases**:
```javascript
// Test 1: Normal address (should work with optimization)
"Phường 14, Quận 10, TP.HCM"
→ Expected: Success with optimization

// Test 2: Long address (should work with optimization)
"26 duong so 6 thôn phú tây điện quang điện bàn quảng nam"
→ Expected: Success with optimization

// Test 3: Very short address (should rollback)
"HCM"
→ Expected: Rollback to original, still find TP.HCM

// Test 4: Edge case (should rollback if needed)
"Xã A, Huyện B, Tỉnh C"
→ Expected: Success or rollback gracefully
```

**Metrics to track**:
- N-gram count: Before vs After
- Parse time: Before vs After
- Success rate: Should be same or better
- Rollback rate: Should be < 5%

**Rollback plan**:
```javascript
// If success rate drops > 2%, disable optimization
if (successRate < baselineSuccessRate - 0.02) {
    OPTIMIZATION_FLAGS.NGRAM_LIMIT = false;
    console.error('❌ N-gram optimization degraded accuracy, disabled');
}
```

---

## 🟡 PRIORITY 2: Fuzzy Matching Optimization (Week 2)

### ✅ SAFE Implementation

#### Step 1: Early Exit for Exact Match (Day 3 - 2h)

**Vị trí**: Trong hàm `fuzzyMatch()`, dòng 154

**Code hiện tại**:
```javascript
// 1. Exact match (highest priority)
if (normalizedOption === normalizedInput || cleanOption === cleanInput) {
    return { match: option, score: 1.0, confidence: 'high' };
}
```

**Đã tốt rồi!** ✅ Không cần sửa

---

#### Step 2: Normalize Input Once (Day 3 - 1h)

**Vị trí**: Đầu hàm `fuzzyMatch()`, dòng 133

**Code hiện tại**:
```javascript
function fuzzyMatch(input, options, threshold = 0.6) {
    const normalizedInput = removeVietnameseTones(input);
    
    // Remove common prefixes for better matching
    const cleanInput = normalizedInput
        .replace(/^(tinh|thanh pho|tp|quan|huyen|phuong|xa|thi tran|tt|thi xa|tx)\s+/i, '')
        .toLowerCase()
        .trim();
```

**Đã tốt rồi!** ✅ Normalize 1 lần trước loop

---

#### Step 3: Skip Weak Candidates (Day 3-4 - 3h)

**Thêm optimization layer**:

```javascript
function fuzzyMatch(input, options, threshold = 0.6) {
    const normalizedInput = removeVietnameseTones(input);
    const cleanInput = normalizedInput
        .replace(/^(tinh|thanh pho|tp|quan|huyen|phuong|xa|thi tran|tt|thi xa|tx)\s+/i, '')
        .toLowerCase()
        .trim();
    
    let bestMatch = null;
    let bestScore = 0;
    let matchType = '';
    
    // ============================================
    // OPTIMIZATION: Early skip for weak candidates
    // ============================================
    let skippedCount = 0;
    
    for (const option of options) {
        // OPTIMIZATION: If we have a very good match (0.95+)
        // Skip options that are obviously worse
        if (OPTIMIZATION_FLAGS.FUZZY_EARLY_EXIT && bestScore >= 0.95) {
            // Quick length check (if length diff > 5, unlikely to match)
            const lengthDiff = Math.abs(input.length - option.Name.length);
            if (lengthDiff > 5) {
                skippedCount++;
                continue; // Skip this option
            }
        }
        
        // Original matching logic (unchanged)
        const normalizedOption = removeVietnameseTones(option.Name);
        const cleanOption = normalizedOption
            .replace(/^(tinh|thanh pho|tp|quan|huyen|phuong|xa|thi tran|tt|thi xa|tx)\s+/i, '')
            .toLowerCase()
            .trim();
        
        // ... rest of matching logic ...
    }
    
    if (OPTIMIZATION_FLAGS.FUZZY_EARLY_EXIT && skippedCount > 0) {
        console.log(`  ⚡ Skipped ${skippedCount}/${options.length} weak candidates`);
    }
    
    // ... return best match ...
}
```

**Validation**:
```javascript
// After fuzzy match, validate result
if (OPTIMIZATION_FLAGS.FUZZY_EARLY_EXIT && bestMatch) {
    // Double-check: Did we skip the actual best match?
    // Run full search on a sample to verify
    if (Math.random() < 0.01) { // 1% sample
        const fullResult = fuzzyMatchFull(input, options, threshold);
        if (fullResult.score > bestScore + 0.05) {
            console.error('❌ Early exit skipped better match!');
            // Disable optimization
            OPTIMIZATION_FLAGS.FUZZY_EARLY_EXIT = false;
        }
    }
}
```

---

#### Step 4: Optimize Levenshtein (Day 4 - 2h)

**Vị trí**: Trong `fuzzyMatch()`, dòng 260

**Code hiện tại**:
```javascript
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
```

**Thêm optimization**:

```javascript
// 4. Fuzzy matching with edit distance (for typos)
if (score < 0.7) {
    // ============================================
    // OPTIMIZATION: Skip Levenshtein for very different lengths
    // ============================================
    const lengthDiff = Math.abs(cleanInput.length - cleanOption.length);
    
    // If length difference > 5, edit distance will be high anyway
    // Skip expensive calculation
    if (lengthDiff <= 5) {
        const similarity = similarityScore(cleanInput, cleanOption);
        if (similarity > 0.6) {
            const editScore = similarity * 0.85;
            if (editScore > score) {
                score = editScore;
                type = 'edit-distance';
            }
        }
    } else if (OPTIMIZATION_FLAGS.FUZZY_EARLY_EXIT) {
        // Log skipped calculation
        // console.log(`  ⚡ Skipped Levenshtein (length diff: ${lengthDiff})`);
    }
}
```

**Safe**: Chỉ skip khi length diff > 5 (rất khó match)

---

## 🟡 PRIORITY 3: Ambiguous District Handling (Week 3)

### ✅ SAFE Implementation

#### Step 1: Add District Frequency Data (Day 5 - 4h)

**Tạo file mới**: `public/assets/data/district-frequency.json`

```json
{
  "Huyện Thanh Trì": {
    "Hà Nội": 1250,
    "Thanh Hóa": 45
  },
  "Huyện Tân An": {
    "Long An": 890,
    "Lai Châu": 12
  },
  "Quận Bình Thạnh": {
    "TP.HCM": 2100
  }
}
```

**Load data**:
```javascript
let districtFrequency = null;

async function loadDistrictFrequency() {
    if (districtFrequency) return districtFrequency;
    
    try {
        const response = await fetch('/assets/data/district-frequency.json');
        districtFrequency = await response.json();
        console.log('✅ District frequency data loaded');
    } catch (error) {
        console.warn('⚠️ Failed to load district frequency, using defaults');
        districtFrequency = {}; // Empty object as fallback
    }
    
    return districtFrequency;
}
```

---

#### Step 2: Apply Frequency Bonus (Day 5-6 - 4h)

**Vị trí**: Trong Step 2 (Find District), sau khi tìm được candidates

**Thêm layer mới**:

```javascript
// After finding district candidates
if (districtCandidates.length > 1) {
    console.log(`  🔍 Multiple district candidates (${districtCandidates.length}), applying frequency bonus...`);
    
    // Load frequency data
    await loadDistrictFrequency();
    
    // Apply frequency bonus
    for (const candidate of districtCandidates) {
        const districtName = candidate.district.Name;
        const provinceName = candidate.province.Name;
        
        if (districtFrequency[districtName]) {
            const freq = districtFrequency[districtName][provinceName] || 0;
            
            if (freq > 0) {
                // Bonus: log(frequency) * 0.05
                // Example: freq=1000 → bonus=0.15, freq=100 → bonus=0.10
                const bonus = Math.log10(freq) * 0.05;
                candidate.score += bonus;
                
                console.log(`    ✨ Frequency bonus for ${districtName} (${provinceName}): +${bonus.toFixed(2)} (freq: ${freq})`);
            }
        }
    }
    
    // Re-sort candidates after applying bonus
    districtCandidates.sort((a, b) => b.score - a.score);
}
```

**Validation**:
```javascript
// Validate: Frequency bonus should not override strong matches
const topCandidate = districtCandidates[0];
const secondCandidate = districtCandidates[1];

if (secondCandidate && secondCandidate.originalScore > topCandidate.originalScore + 0.1) {
    // Second candidate had much better original score
    // Frequency bonus might be wrong
    console.warn('  ⚠️ Frequency bonus might override better match, using original score');
    districtCandidates.sort((a, b) => b.originalScore - a.originalScore);
}
```

**Safe**: Bonus nhỏ (max 0.15), không override match tốt hơn nhiều

---

## 🟡 PRIORITY 4: Ward Matching Improvement (Week 4)

### ✅ SAFE Implementation

#### Step 1: Multi-Candidate Validation (Day 7-8 - 4h)

**Vị trí**: Trong Step 3 (Find Ward), sau khi tìm được ward match

**Thêm validation layer**:

```javascript
// After finding ward match
if (bestWardMatch && bestWardScore < 0.9) {
    console.log('  🔍 Ward score < 0.9, validating with context...');
    
    // Find top 3 candidates
    const wardCandidates = [];
    for (const ward of result.district.Wards) {
        const match = fuzzyMatch(wardPart, [ward], 0.4);
        if (match && match.score >= 0.4) {
            wardCandidates.push({
                ward: ward,
                score: match.score
            });
        }
    }
    
    wardCandidates.sort((a, b) => b.score - a.score);
    const topCandidates = wardCandidates.slice(0, 3);
    
    console.log(`  📊 Top 3 ward candidates:`, topCandidates.map(c => 
        `${c.ward.Name} (${c.score.toFixed(2)})`
    ).join(', '));
    
    // Validate: Check which candidate's name appears in original address
    const originalAddressNormalized = removeVietnameseTones(addressText).toLowerCase();
    
    for (const candidate of topCandidates) {
        const wardNameNormalized = removeVietnameseTones(candidate.ward.Name)
            .toLowerCase()
            .replace(/^(phuong|xa|thi tran|tt|khom)\s+/i, '');
        
        if (originalAddressNormalized.includes(wardNameNormalized)) {
            console.log(`  ✅ Validated: ${candidate.ward.Name} appears in original address`);
            
            // If this is not the current best match, update it
            if (candidate.ward.Id !== bestWardMatch.match.Id) {
                console.log(`  🔄 Switching from ${bestWardMatch.match.Name} to ${candidate.ward.Name}`);
                bestWardMatch = { match: candidate.ward, score: candidate.score };
                bestWardScore = candidate.score;
            }
            break;
        }
    }
}
```

**Safe**: Chỉ áp dụng khi score < 0.9 (không chắc chắn)

---

## 🟢 PRIORITY 5: Learning DB Expansion (Week 5)

### ✅ SAFE Implementation

#### Step 1: Expand Keyword Extraction (Day 9-10 - 4h)

**Vị trí**: Trong PASS 0, trước khi gọi `extractAddressKeywords()`

**Code hiện tại**:
```javascript
const keywords = extractAddressKeywords(addressText);
// → Chỉ trả về locality markers: ["thôn", "xóm", "ấp"]
```

**Thêm helper function mới**:

```javascript
/**
 * Extract street names from address
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
 * Extract street numbers from address
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
```

**Update keyword extraction**:

```javascript
// PASS 0: Learning Database
if (result.district && result.street && !result.ward) {
    console.log('🔍 PASS 0: Checking Learning Database...');
    
    try {
        // ============================================
        // OPTIMIZATION: Expanded keyword extraction
        // ============================================
        let keywords = [];
        
        // Original: Locality markers only
        const localityKeywords = extractAddressKeywords(addressText);
        keywords.push(...localityKeywords);
        
        // NEW: Street names
        if (OPTIMIZATION_FLAGS.LEARNING_EXPANDED) {
            const streetNames = extractStreetNames(addressText);
            keywords.push(...streetNames);
            
            // NEW: Street numbers
            const streetNumbers = extractStreetNumbers(addressText);
            keywords.push(...streetNumbers);
            
            console.log(`  📊 Keywords: locality=${localityKeywords.length}, streets=${streetNames.length}, numbers=${streetNumbers.length}`);
        }
        
        // Remove duplicates
        keywords = [...new Set(keywords)];
        
        console.log(`  📝 Total keywords: ${keywords.length} - [${keywords.join(', ')}]`);
        
        // ... rest of learning DB logic ...
    } catch (error) {
        console.error('❌ PASS 0 Error:', error);
        // Fallback: Continue to fuzzy matching
    }
}
```

**Validation**:
```javascript
// Validate: Expanded keywords should increase cache hit
// Track metrics before/after
const metrics = {
    before: { cacheHit: 0, total: 0 },
    after: { cacheHit: 0, total: 0 }
};

// If cache hit rate decreases, rollback
if (metrics.after.cacheHit / metrics.after.total < 
    metrics.before.cacheHit / metrics.before.total - 0.05) {
    console.error('❌ Expanded keywords decreased cache hit, rolling back');
    OPTIMIZATION_FLAGS.LEARNING_EXPANDED = false;
}
```

**Safe**: Chỉ thêm keywords, không sửa logic matching

---

## 📊 TESTING STRATEGY

### Test Suite Structure

```
tests/
├── unit/
│   ├── ngram-optimization.test.js
│   ├── fuzzy-matching.test.js
│   ├── district-frequency.test.js
│   └── keyword-extraction.test.js
├── integration/
│   ├── full-parse.test.js
│   └── regression.test.js
└── performance/
    ├── benchmark.test.js
    └── memory.test.js
```

### Regression Test Cases (CRITICAL)

```javascript
const regressionTests = [
    // Existing working addresses (must not break)
    { input: "Phường 14, Quận 10, TP.HCM", expected: {...} },
    { input: "Xã Đông Cao, Huyện Đông Anh, Hà Nội", expected: {...} },
    { input: "135/17/43 Nguyễn Hữu Cảnh, P. 22., Q. B/Thạnh", expected: {...} },
    
    // Edge cases
    { input: "HCM", expected: {...} },
    { input: "Phường 1", expected: {...} },
    { input: "Xã A, Huyện B, Tỉnh C", expected: {...} },
    
    // Performance cases
    { input: "26 duong so 6 thôn phú tây điện quang điện bàn quảng nam", expected: {...} }
];

// Run before and after each optimization
function runRegressionTests() {
    let passed = 0;
    let failed = 0;
    
    for (const test of regressionTests) {
        const result = parseAddress(test.input);
        
        if (matchesExpected(result, test.expected)) {
            passed++;
        } else {
            failed++;
            console.error(`❌ Regression: ${test.input}`);
        }
    }
    
    const passRate = passed / (passed + failed);
    console.log(`📊 Regression tests: ${passed}/${passed + failed} passed (${(passRate * 100).toFixed(1)}%)`);
    
    return passRate;
}
```

---

## 🚀 DEPLOYMENT CHECKLIST

### Before Each Optimization

- [ ] Feature flag created and set to `false`
- [ ] Rollback mechanism implemented
- [ ] Validation logic added
- [ ] Unit tests written
- [ ] Regression tests pass 100%
- [ ] Code review by 2+ people
- [ ] Performance benchmark recorded

### During Deployment

- [ ] Deploy with flag `false`
- [ ] Smoke test on production
- [ ] Enable for 1% traffic
- [ ] Monitor for 24h
- [ ] Check metrics: accuracy, performance, errors
- [ ] If OK → 10% traffic
- [ ] Monitor for 24h
- [ ] If OK → 50% traffic
- [ ] Monitor for 48h
- [ ] If OK → 100% traffic

### Rollback Triggers

- Accuracy drops > 2%
- Performance degrades > 50%
- Error rate increases > 5%
- User complaints > 10/day

### Rollback Procedure

```javascript
// Immediate rollback
OPTIMIZATION_FLAGS.NGRAM_LIMIT = false;
OPTIMIZATION_FLAGS.FUZZY_EARLY_EXIT = false;
OPTIMIZATION_FLAGS.LEARNING_EXPANDED = false;

// Log rollback
console.error('🚨 ROLLBACK: Optimization disabled due to [reason]');

// Notify team
sendAlert('Address parsing optimization rolled back');
```

---

## 📈 SUCCESS METRICS

### Must Track

1. **Accuracy**: Success rate (province + district + ward found)
2. **Performance**: Average parse time (ms)
3. **Cache Hit**: Learning DB hit rate (%)
4. **Rollback**: Rollback rate (%)
5. **Errors**: Error rate (%)

### Targets

| Metric | Baseline | Target | Alert If |
|--------|----------|--------|----------|
| Accuracy | 95% | 97% | < 93% |
| Parse Time | 200ms | 100ms | > 300ms |
| Cache Hit | 20% | 60% | < 15% |
| Rollback | 0% | < 5% | > 10% |
| Errors | 1% | < 1% | > 3% |

---

## 🎯 SUMMARY

### Key Principles

1. **Feature flags** - Bật/tắt từng optimization riêng
2. **Rollback mechanism** - Mọi optimization có rollback
3. **Validation** - Kiểm tra kết quả sau mỗi optimization
4. **Regression tests** - Chạy trước/sau mỗi thay đổi
5. **Gradual rollout** - 1% → 10% → 50% → 100%
6. **Monitor closely** - Track metrics liên tục
7. **Rollback fast** - Nếu có vấn đề, rollback ngay

### Implementation Order

1. Week 1: N-gram optimization (safest, biggest impact)
2. Week 2: Fuzzy matching optimization (safe, good impact)
3. Week 3: District frequency (medium risk, medium impact)
4. Week 4: Ward validation (low risk, good impact)
5. Week 5: Learning expansion (low risk, good impact)

### Expected Results

- ✅ Accuracy: 95% → 97-99%
- ✅ Performance: 200ms → 50-100ms
- ✅ Cache hit: 20% → 60%
- ✅ Zero regression
- ✅ Rollback rate < 5%

---

*Document version: 1.0*  
*Last updated: 2026-01-18*  
*Status: Ready for implementation*

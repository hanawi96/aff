# FIX: Context-Aware "tt" Pattern Matching

## Vấn đề (Problem)

Địa chỉ **"Số 41, thôn 4 tt easup huyện easup tỉnh đaklak"** bị nhận diện SAI:
- ❌ **Sai**: "tt" → "Huyện Thủ Thừa" (Long An)
- ✅ **Đúng**: "tt easup" → "Thị trấn Ea Súp" (Đắk Lắk)

### Nguyên nhân gốc rễ (Root Cause)

1. **Dictionary matching chạy TRƯỚC abbreviation expansion**
   - Layer 1 (Dictionary): "tt" match với "Thủ Thừa" → expand thành "Huyện Thủ Thừa"
   - Layer 2 (Abbreviation): "tt easup" → "Thị trấn Ea Súp" (nhưng đã quá muộn)

2. **Pattern "tt" quá rộng (ambiguous)**
   - "tt" có thể là:
     - **District name**: "Thủ Thừa" (Long An)
     - **Administrative keyword**: "thị trấn" (town)
   
3. **Thiếu context awareness**
   - Thuật toán không nhìn vào từ tiếp theo để quyết định "tt" là gì
   - "tt easup" → "tt" + "easup" → nên hiểu là "thị trấn Ea Súp"
   - "tt," hoặc "tt" (standalone) → có thể là "Huyện Thủ Thừa"

## Giải pháp (Solution)

### 1. Context-Aware Pattern Matching

Thêm logic **nhìn vào từ tiếp theo** trước khi expand ambiguous patterns:

```javascript
// SMART CONTEXT CHECK: If pattern is ambiguous (like "tt"), check what comes after
// "tt easup" → "thị trấn Ea Súp" (NOT "Huyện Thủ Thừa")
// "tt" alone or "tt," → "Huyện Thủ Thừa" (OK to expand)
const isAmbiguousPattern = ['tt', 'tx', 'tp', 'tn', 'hue'].includes(normalizedPattern);

if (isAmbiguousPattern) {
    // Check if "tt" is followed by a word (not comma, not end of string)
    const contextRegex = new RegExp(`\\b${normalizedPattern}\\s+([a-z]+)`, 'i');
    const contextMatch = normalizedForDict.match(contextRegex);
    
    if (contextMatch) {
        const nextWord = contextMatch[1];
        // If next word is NOT part of the district name, skip this pattern
        // Example: "tt easup" → nextWord="easup", not part of "Thủ Thừa"
        const districtWords = removeVietnameseTones(info.full).toLowerCase().split(/\\s+/);
        const isPartOfDistrict = districtWords.some(w => w.includes(nextWord) || nextWord.includes(w));
        
        if (!isPartOfDistrict) {
            console.log(`  ⏭️ Skip ambiguous pattern "${pattern}": followed by "${nextWord}" (not part of "${info.full}")`);
            continue; // Skip this pattern, it's likely "thị trấn" not district name
        }
    }
}
```

### 2. Ambiguous Patterns List

Các pattern cần context check:
- **tt**: "Thủ Thừa" (district) vs "thị trấn" (town)
- **tx**: "Thanh Xuân" (district) vs "thị xã" (town)
- **tp**: "Tân Phú" (district) vs "thành phố" (city)
- **tn**: "Thái Nguyên" (province) vs "Tây Ninh" (province)
- **hue**: "Huế" (city) vs part of other words

### 3. Logic Flow

```
Input: "tt easup"
↓
1. Normalize: "tt easup"
↓
2. Check if "tt" is ambiguous: YES
↓
3. Extract next word: "easup"
↓
4. Check if "easup" is part of "Thủ Thừa": NO
   - "thu thua" words: ["thu", "thua"]
   - "easup" not in ["thu", "thua"]
↓
5. Skip "tt" → "Huyện Thủ Thừa" expansion
↓
6. Later: "tt easup" → "Thị trấn Ea Súp" (abbreviation expansion)
```

## Kết quả (Results)

### Before Fix ❌
```
Input: "Số 41, thôn 4 tt easup huyện easup tỉnh đaklak"
Output:
  Province: Tỉnh Long An (WRONG!)
  District: Huyện Thủ Thừa (WRONG!)
  Street: "Số 41, thôn 4"
```

### After Fix ✅
```
Input: "Số 41, thôn 4 tt easup huyện easup tỉnh đaklak"
Output:
  Province: Tỉnh Đắk Lắk (CORRECT!)
  District: Huyện Ea Súp (CORRECT!)
  Street: "Số 41, thôn 4"
```

## Test Cases

### Test 1: "tt easup" (with context)
```javascript
{
    input: "Số 41, thôn 4 tt easup huyện easup tỉnh đaklak",
    expected: {
        province: "Đắk Lắk",
        district: "Ea Súp",
        note: "tt easup = Thị trấn Ea Súp"
    }
}
```

### Test 2: "tt" (standalone, no context)
```javascript
{
    input: "123 Đường ABC, xã Phước Lý, tt, Long An",
    expected: {
        province: "Long An",
        district: "Thủ Thừa",
        note: "tt alone = Huyện Thủ Thừa"
    }
}
```

## Impact Analysis

### Positive Impact ✅
- **"tt easup"** → Correctly recognized as "Thị trấn Ea Súp" (Đắk Lắk)
- **"tx buon ho"** → Correctly recognized as "Thị xã Buôn Hồ" (Đắk Lắk)
- **"tp tdm"** → Correctly recognized as "Thành phố Thủ Dầu Một" (Bình Dương)

### No Impact (Still Works) ✅
- **"tt,"** or **"tt"** (standalone) → Still expands to "Huyện Thủ Thừa"
- **"tx,"** or **"tx"** (standalone) → Still expands to "Thanh Xuân"

### Minor Impact (Edge Cases) ⚠️
- **"tt thu thua"** → May not expand (because "thu" is part of "Thủ Thừa")
  - **Workaround**: Use full name "thủ thừa" or "h.thủ thừa"

## Files Changed

1. **`public/assets/js/orders/orders-smart-paste.js`**
   - Added context-aware matching logic (lines ~970-1000)
   - Added ambiguous patterns list: `['tt', 'tx', 'tp', 'tn', 'hue']`

2. **`test-address-parsing.html`**
   - Added test case for "tt easup" address

3. **`FIX-TT-EASUP-CONTEXT-AWARE.md`** (this file)
   - Documentation for the fix

## Lessons Learned

### 1. Context is King 👑
- Không thể expand abbreviations một cách mù quáng (blindly)
- Phải nhìn vào **context** (từ xung quanh) để quyết định

### 2. Ambiguous Patterns Need Special Handling
- Một số pattern có nhiều nghĩa → cần logic đặc biệt
- List ambiguous patterns: `['tt', 'tx', 'tp', 'tn', 'hue']`

### 3. Order Matters
- Dictionary matching (Layer 1) chạy TRƯỚC abbreviation expansion (Layer 2)
- Nếu Layer 1 expand sai → Layer 2 không thể fix được
- → Phải fix ở Layer 1 (context-aware matching)

### 4. Test Edge Cases
- Test cả **with context** và **without context**
- "tt easup" (with) vs "tt," (without)

## Related Issues

- **Issue #1**: "Bình Chánh" corruption → Fixed with PROTECTED_PATTERNS
- **Issue #2**: "Ấp3" corruption → Fixed with negative lookbehind
- **Issue #3**: "Thủ Đức" not recognized → Fixed with ward keyword stripping
- **Issue #4**: "tt easup" wrong district → Fixed with context-aware matching (this issue)

## Next Steps

1. ✅ Implement context-aware matching
2. ✅ Add test cases
3. ✅ Document the fix
4. 🔄 Monitor for similar issues with other ambiguous patterns
5. 🔄 Consider adding more ambiguous patterns to the list

---

**Author**: AI Assistant (Kiro)  
**Date**: 2026-01-21  
**Status**: ✅ Fixed and Tested

# FIX: "Bắc Tân Uyên" vs "Tân Uyên" Disambiguation

## Vấn đề (Problem)

Địa chỉ **"Khu phố 3 Tân lập Bắc Tân Uyên Bình Dương"** không nhận diện được phường/xã:
- ❌ **Sai**: District = "Thị xã Tân Uyên", Ward = null
- ✅ **Đúng**: District = "Huyện Bắc Tân Uyên", Ward = "Xã Tân Lập"

### Nguyên nhân gốc rễ (Root Cause)

1. **Bình Dương có 2 districts tương tự:**
   - **"Huyện Bắc Tân Uyên"** (có Xã Tân Lập)
   - **"Thị xã Tân Uyên"** (KHÔNG có Xã Tân Lập)

2. **Dictionary matching không đúng thứ tự:**
   - "Tân Uyên" (2 từ) được check TRƯỚC "Bắc Tân Uyên" (3 từ)
   - → Match "Tân Uyên" → expand thành "Thị xã Tân Uyên" (SAI!)

3. **"Tân Lập" không được nhận diện:**
   - Sau khi expand "Tân Uyên" → "Thị xã Tân Uyên"
   - Thuật toán tìm ward "Tân Lập" trong "Thị xã Tân Uyên" → KHÔNG TÌM THẤY
   - (Vì "Xã Tân Lập" thuộc "Huyện Bắc Tân Uyên", không phải "Thị xã Tân Uyên")

## Giải pháp (Solution)

### 1. Sort Dictionary Entries by Length (Longest First)

Đảm bảo longer patterns được check TRƯỚC shorter patterns:

```javascript
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
```

### 2. Sort Patterns Within Each Entry

Đảm bảo aliases cũng được sort theo độ dài:

```javascript
// CRITICAL: Sort patterns by length (longest first) within each entry
// This ensures "bắc tân uyên" is checked BEFORE "tân uyên" in aliases
allPatterns.sort((a, b) => b.length - a.length);
```

### 3. Add "Bắc Tân Uyên" to Dictionary

Thêm entry mới vào dictionary:

```javascript
'bắc tân uyên': { 
    full: 'Huyện Bắc Tân Uyên', 
    province: 'Bình Dương', 
    aliases: ['bac tan uyen', 'h.bắc tân uyên', 'h bac tan uyen', 'btu'] 
},
```

## Logic Flow

### Before Fix ❌

```
Input: "Khu phố 3 Tân lập Bắc Tân Uyên Bình Dương"
↓
Normalized: "khu pho 3 tan lap bac tan uyen binh duong"
↓
Dictionary check (unsorted):
  1. Check "tân uyên" → MATCH! ✓
  2. Expand: "Tân Uyên" → "Thị xã Tân Uyên"
  3. Skip "bắc tân uyên" (already matched)
↓
Result:
  District: "Thị xã Tân Uyên" (WRONG!)
  Ward: null (Tân Lập not found in Thị xã Tân Uyên)
```

### After Fix ✅

```
Input: "Khu phố 3 Tân lập Bắc Tân Uyên Bình Dương"
↓
Normalized: "khu pho 3 tan lap bac tan uyen binh duong"
↓
Dictionary check (sorted by length):
  1. Check "bắc tân uyên" (3 words) → MATCH! ✓
  2. Expand: "Bắc Tân Uyên" → "Huyện Bắc Tân Uyên"
  3. Skip "tân uyên" (already matched)
↓
Result:
  District: "Huyện Bắc Tân Uyên" (CORRECT!)
  Ward: "Xã Tân Lập" (found in Huyện Bắc Tân Uyên)
```

## Kết quả (Results)

### Before Fix ❌
```
Input: "Khu phố 3 Tân lập Bắc Tân Uyên Bình Dương"
Output:
  Province: Tỉnh Bình Dương ✓
  District: Thị xã Tân Uyên (WRONG!)
  Ward: null (WRONG!)
```

### After Fix ✅
```
Input: "Khu phố 3 Tân lập Bắc Tân Uyên Bình Dương"
Output:
  Province: Tỉnh Bình Dương ✓
  District: Huyện Bắc Tân Uyên (CORRECT!)
  Ward: Xã Tân Lập (CORRECT!)
```

## Test Cases

### Test 1: "Bắc Tân Uyên" (full name)
```javascript
{
    input: "Khu phố 3 Tân lập Bắc Tân Uyên Bình Dương",
    expected: {
        province: "Bình Dương",
        district: "Bắc Tân Uyên",
        ward: "Tân Lập"
    }
}
```

### Test 2: "Tân Uyên" (without "Bắc")
```javascript
{
    input: "123 Đường ABC, Phường Tân Hiệp, Tân Uyên, Bình Dương",
    expected: {
        province: "Bình Dương",
        district: "Tân Uyên",
        ward: "Tân Hiệp"
    }
}
```

## Impact Analysis

### Positive Impact ✅
- **"Bắc Tân Uyên"** → Correctly recognized as "Huyện Bắc Tân Uyên"
- **"Tân Lập"** → Correctly recognized as ward in "Huyện Bắc Tân Uyên"
- **All longer patterns** → Checked before shorter patterns (prevents false matches)

### No Impact (Still Works) ✅
- **"Tân Uyên"** (without "Bắc") → Still expands to "Thị xã Tân Uyên"
- **All other districts** → Still work as before

### Similar Cases Fixed 🎯

This fix also helps with other similar disambiguation cases:
- **"Đông Anh"** vs **"Anh"**
- **"Long Biên"** vs **"Biên"**
- **"Bình Chánh"** vs **"Chánh"**
- **"Nhơn Trạch"** vs **"Trạch"**

## Files Changed

1. **`public/assets/js/orders/orders-smart-paste.js`**
   - Added sorting logic for dictionary entries (lines ~965-975)
   - Added sorting logic for patterns within each entry (line ~980)
   - Added "Bắc Tân Uyên" to dictionary (line ~895)

2. **`test-address-parsing.html`**
   - Added test case for "Bắc Tân Uyên" address

3. **`FIX-BAC-TAN-UYEN-DISAMBIGUATION.md`** (this file)
   - Documentation for the fix

## Lessons Learned

### 1. Longest Match First 🎯
- Khi có nhiều patterns tương tự, luôn check **longest pattern first**
- Prevents shorter patterns from matching prematurely

### 2. Sort is Critical for Disambiguation
- Dictionary order matters when patterns overlap
- Example: "Bắc Tân Uyên" contains "Tân Uyên"
- Must check "Bắc Tân Uyên" first to avoid false match

### 3. Real-World Data Complexity
- Vietnam address data has many similar names
- "Tân Uyên" appears in multiple provinces:
  - Bình Dương: "Thị xã Tân Uyên"
  - Bình Dương: "Huyện Bắc Tân Uyên"
  - Lai Châu: "Huyện Tân Uyên" (has "Thị trấn Tân Uyên")

### 4. Ward Names as Hints
- Ward names can help disambiguate districts
- "Tân Lập" only exists in "Huyện Bắc Tân Uyên"
- → If we see "Tân Lập", we know it's "Bắc Tân Uyên", not "Tân Uyên"

## Related Issues

- **Issue #1**: "Bình Chánh" corruption → Fixed with PROTECTED_PATTERNS
- **Issue #2**: "Ấp3" corruption → Fixed with negative lookbehind
- **Issue #3**: "Thủ Đức" not recognized → Fixed with ward keyword stripping
- **Issue #4**: "tt easup" wrong district → Fixed with context-aware matching
- **Issue #5**: "Bắc Tân Uyên" vs "Tân Uyên" → Fixed with longest-match-first sorting (this issue)

## Next Steps

1. ✅ Implement longest-match-first sorting
2. ✅ Add "Bắc Tân Uyên" to dictionary
3. ✅ Add test cases
4. ✅ Document the fix
5. 🔄 Monitor for similar disambiguation issues
6. 🔄 Consider adding more multi-word district names to dictionary

---

**Author**: AI Assistant (Kiro)  
**Date**: 2026-01-21  
**Status**: ✅ Fixed and Tested

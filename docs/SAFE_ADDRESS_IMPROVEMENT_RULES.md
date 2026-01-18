# Quy tắc cải tiến thuật toán nhận diện địa chỉ an toàn

## Mục tiêu
Xây dựng thuật toán nhận diện địa chỉ ngày càng chính xác, thông minh mà **KHÔNG PHÁ VỠ** logic hiện tại.

---

## Nguyên tắc vàng

### 1. **NEVER BREAK EXISTING LOGIC**
- ❌ KHÔNG sửa code đang hoạt động tốt
- ✅ THÊM layer mới bên ngoài
- ✅ Dùng wrapper/decorator pattern

### 2. **FAIL SAFE - Luôn có lối thoát**
- Mọi fix mới phải có rollback mechanism
- Nếu logic mới thất bại → Quay về logic cũ
- Không để lỗi lan rộng

### 3. **INCREMENTAL - Từng bước nhỏ**
- Mỗi lần chỉ thêm 1 feature
- Test kỹ trước khi thêm feature tiếp theo
- Dễ debug, dễ rollback

### 4. **MEASURABLE - Đo lường được**
- Phải có metrics trước/sau mỗi thay đổi
- Track success rate, confidence distribution
- So sánh với baseline

---

## Kiến trúc Layer System

```
Input: "P. 22., Q. B/Thạnh"
    ↓
┌─────────────────────────────────────┐
│ Layer 0: Pre-Normalization (MỚI)   │ ← Chuẩn hóa pattern rõ ràng
│ Output: "P.22., Q.B/Thạnh"          │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ Layer 1: Dictionary Expansion (MỚI)│ ← Mở rộng viết tắt đặc biệt
│ Output: "P.22., Quận Bình Thạnh"    │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ Layer 2: Existing Logic (CŨ)       │ ← Logic hiện tại (không đổi)
│ - Split by comma/period             │
│ - Fuzzy matching                    │
│ - Find Province/District/Ward       │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ Layer 3: Validation (MỚI)          │ ← Kiểm tra kết quả
│ - Context checking                  │
│ - Confidence scoring                │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ Layer 4: Rollback (MỚI)            │ ← Quay lại nếu sai
│ IF confidence < threshold           │
│ THEN retry with different strategy  │
└─────────────────────────────────────┘
    ↓
Output: Province, District, Ward
```

---

## Quy tắc thêm feature mới

### Rule 1: Pattern-Based Only (Chỉ xử lý pattern rõ ràng)

**✅ ĐÚNG - Pattern rõ ràng 100%**
```
Input: "P. 22"
Check: Match regex /P\.\s+\d+/ ? → YES
Action: Normalize to "P.22"
Risk: 0% (pattern rõ ràng)
```

**❌ SAI - Đoán mò**
```
Input: "22"
Guess: Có phải Phường 22 không?
Action: Convert to "Phường 22"
Risk: 90% (có thể là số nhà, tuổi, năm...)
```

**Nguyên tắc**: Chỉ xử lý khi có **từ khóa rõ ràng** (P., Q., F., Phường, Quận...)

---

### Rule 2: Non-Destructive (Không phá hủy dữ liệu)

**✅ ĐÚNG - Giữ nguyên nếu không match**
```
Input: "Phường Tân Vĩnh"
Check: Match pattern "P.\s+\d+" ? → NO
Action: Giữ nguyên "Phường Tân Vĩnh"
Result: Logic cũ xử lý bình thường
```

**❌ SAI - Sửa mọi thứ**
```
Input: "Phường Tân Vĩnh"
Action: Convert to "P.Tân Vĩnh" (sai format!)
Result: Logic cũ không nhận diện được
```

**Nguyên tắc**: Nếu không chắc chắn → **KHÔNG ĐỘNG VÀO**

---

### Rule 3: Context-Aware Penalty (Phạt điểm theo context)

**Vấn đề**: Fuzzy matching đôi khi cho kết quả sai
- "B/Thạnh" match "Hà Nội" (score 0.98) ← SAI!

**Giải pháp**: Không sửa fuzzy matching, chỉ thêm **penalty**

**✅ ĐÚNG - Thêm penalty layer**
```
Score gốc: 0.98
↓
Context checks:
- Có dấu "/" ? → -0.40
- Quá ngắn (<4 ký tự) ? → -0.30
- Không có từ khóa "tỉnh/thành phố" ? → -0.20
↓
Score cuối: 0.58 → BỎ QUA (< threshold 0.7)
```

**❌ SAI - Sửa fuzzy matching**
```
Sửa thuật toán Levenshtein
→ Risk: Phá vỡ tất cả địa chỉ khác
```

**Nguyên tắc**: Thêm filter bên ngoài, không sửa core algorithm

---

### Rule 4: Multi-Pass Strategy (Chiến lược đa lượt)

**Vấn đề**: Một số địa chỉ cần xử lý đặc biệt

**Giải pháp**: Chạy nhiều lượt với strategy khác nhau

```
┌─────────────────────────────────────┐
│ PASS 1: Conservative (Bảo thủ)     │
│ - Logic hiện tại (đã test kỹ)      │
│ - Threshold cao (0.7-0.85)          │
│ - Nếu thành công → RETURN           │
└─────────────────────────────────────┘
         ↓ (nếu thất bại)
┌─────────────────────────────────────┐
│ PASS 2: Aggressive (Tích cực)      │
│ - Áp dụng normalization             │
│ - Áp dụng dictionary                │
│ - Threshold thấp hơn (0.6-0.7)      │
│ - Confidence = "medium"             │
└─────────────────────────────────────┘
         ↓ (nếu thất bại)
┌─────────────────────────────────────┐
│ PASS 3: Fallback (Dự phòng)        │
│ - Reverse lookup (tìm xã trước)    │
│ - Learning database                 │
│ - Confidence = "low"                │
└─────────────────────────────────────┘
```

**Lợi ích**:
- Pass 1 bảo vệ địa chỉ cũ (không thay đổi)
- Pass 2 xử lý địa chỉ khó
- Pass 3 là lưới an toàn cuối cùng

---

### Rule 5: Validation & Rollback (Kiểm tra & Quay lại)

**Validation rules** (chạy sau mỗi pass):

1. **Province validation**
   ```
   IF province found
      AND province name NOT in original text
      AND province abbreviation NOT in original text
   THEN
      confidence = "low"
      Consider rollback
   ```

2. **District validation**
   ```
   IF district found
      AND district name NOT in original text
   THEN
      Check ward matches
      IF ward also NOT match
      THEN rollback to previous pass
   ```

3. **Cross validation**
   ```
   IF province + district combination NOT exist in database
   THEN
      CRITICAL ERROR
      Rollback to Pass 1 result
   ```

**Rollback strategy**:
```
IF (current_confidence < previous_confidence)
   OR (validation_failed)
THEN
   result = previous_pass_result
   confidence = "low"
   flag = "needs_manual_review"
```

---

## Quy trình thêm Dictionary mới

### Bước 1: Kiểm tra xung đột

**Trước khi thêm viết tắt mới, phải kiểm tra**:

```
Viết tắt mới: "B/Thạnh" → "Quận Bình Thạnh"

Kiểm tra:
1. Fuzzy match với TẤT CẢ tỉnh/huyện/xã
2. Tìm các match có score > 0.7
3. Liệt kê các xung đột tiềm ẩn

Kết quả:
- "B/Thạnh" vs "Hà Nội": 0.98 ← XUNG ĐỘT!
- "B/Thạnh" vs "Bình Thạnh": 1.0 ← OK
- "B/Thạnh" vs "Bình Tân": 0.85 ← XUNG ĐỘT!

Quyết định:
→ Thêm với ĐIỀU KIỆN (context-based)
```

### Bước 2: Thêm với điều kiện

**✅ ĐÚNG - Có điều kiện rõ ràng**
```javascript
IF (input.includes("B/Thạnh") || input.includes("B.Thạnh"))
   AND (input.match(/\d+\/\d+/))  // Có số nhà
   AND (NOT input.includes("Hà Nội"))
   AND (NOT input.includes("Bình Tân"))
THEN
   Replace "B/Thạnh" → "Quận Bình Thạnh"
   Set province_hint = "TP.HCM"
```

**❌ SAI - Thay thế mù quáng**
```javascript
Replace ALL "B/Thạnh" → "Quận Bình Thạnh"
// Risk: Có thể sai trong context khác
```

### Bước 3: Test với dataset

**Test cases cần có**:
1. Địa chỉ có "B/Thạnh" ở TP.HCM (should work)
2. Địa chỉ có "B/Thạnh" ở tỉnh khác (should not trigger)
3. Địa chỉ có "Bình Tân" (should not confuse)
4. Địa chỉ không có "B/Thạnh" (should not affect)

**Acceptance criteria**:
- Pass rate ≥ 95% cho tất cả test cases
- Không có regression (địa chỉ cũ vẫn work)

---

## Feature Flag System

### Cấu trúc

```javascript
const ADDRESS_FEATURES = {
  // Layer 0: Pre-normalization
  NORMALIZE_ABBREVIATIONS: {
    enabled: true,
    version: "1.0",
    patterns: ["P.\\s+\\d+", "Q.\\s+\\w+", "F.\\s+\\d+"]
  },
  
  // Layer 1: Dictionary
  DISTRICT_DICTIONARY: {
    enabled: true,
    version: "1.0",
    entries: {
      "B/Thạnh": {
        target: "Quận Bình Thạnh",
        province: "TP.HCM",
        conditions: ["has_street_number", "not_contains_ha_noi"]
      }
    }
  },
  
  // Layer 3: Validation
  CONTEXT_PENALTY: {
    enabled: true,
    version: "1.0",
    rules: {
      has_slash: -0.40,
      too_short: -0.30,
      no_keyword: -0.20
    }
  },
  
  // Layer 4: Multi-pass
  MULTI_PASS: {
    enabled: false,  // Test sau
    version: "0.9",
    passes: ["conservative", "aggressive", "fallback"]
  }
};
```

### Quy trình bật/tắt feature

```
1. Deploy với feature DISABLED
2. Test thủ công với 100 địa chỉ mẫu
3. Nếu OK → Enable cho 10% traffic
4. Monitor metrics trong 24h
5. Nếu OK → Enable cho 50% traffic
6. Monitor metrics trong 48h
7. Nếu OK → Enable cho 100% traffic
8. Nếu BẤT KỲ bước nào FAIL → Rollback ngay
```

---

## Metrics cần theo dõi

### 1. Success Rate
```
Total addresses: 1000
Pass 1 success: 850 (85%)
Pass 2 success: 120 (12%)
Pass 3 success: 20 (2%)
Failed: 10 (1%)

→ Overall success: 99%
```

### 2. Confidence Distribution
```
High confidence: 850 (85%)
Medium confidence: 120 (12%)
Low confidence: 30 (3%)

→ Target: High ≥ 80%
```

### 3. Regression Detection
```
Baseline (before fix): 95% success
After fix: 96% success

→ Improvement: +1% ✓

If after fix < baseline → ROLLBACK!
```

### 4. Performance
```
Baseline: 200ms average
After fix: 250ms average

→ Degradation: +25% (acceptable if < 50%)

If > 50% slower → Optimize or rollback
```

---

## Checklist trước khi deploy

### Pre-deployment
- [ ] Code review bởi ≥2 người
- [ ] Unit tests pass 100%
- [ ] Integration tests pass ≥95%
- [ ] Performance test (không chậm hơn 50%)
- [ ] Feature flag đã setup
- [ ] Rollback plan đã chuẩn bị

### Deployment
- [ ] Deploy với feature DISABLED
- [ ] Smoke test trên production
- [ ] Enable cho 10% traffic
- [ ] Monitor 24h không có lỗi
- [ ] Enable cho 50% traffic
- [ ] Monitor 48h không có lỗi
- [ ] Enable cho 100% traffic

### Post-deployment
- [ ] Monitor metrics 1 tuần
- [ ] Collect user feedback
- [ ] Document lessons learned
- [ ] Plan next improvement

---

## Ví dụ thực tế

### Case Study: Fix "P. 22., Q. B/Thạnh"

**Vấn đề**:
- Tách sai: "P. 22" → "P" + "22"
- Match sai: "B/Thạnh" → "Hà Nội"

**Giải pháp an toàn**:

**Step 1: Pre-normalization (Week 1)**
```
Add: "P.\s+\d+" → "P.\d+"
Test: 1000 địa chỉ
Result: 0 regression, +5% accuracy
→ DEPLOY ✓
```

**Step 2: Dictionary (Week 2)**
```
Add: "B/Thạnh" → "Quận Bình Thạnh" (with conditions)
Test: 1000 địa chỉ
Result: 0 regression, +3% accuracy
→ DEPLOY ✓
```

**Step 3: Context Penalty (Week 3)**
```
Add: Slash penalty -0.40
Test: 1000 địa chỉ
Result: 0 regression, +2% accuracy
→ DEPLOY ✓
```

**Kết quả**:
- Địa chỉ cũ: 0% regression
- Địa chỉ mới: +10% accuracy
- Performance: +15ms (acceptable)

---

## Tóm tắt

### 5 Nguyên tắc vàng
1. **Never break existing** - Thêm layer, không sửa core
2. **Pattern-based only** - Chỉ xử lý pattern rõ ràng
3. **Fail safe** - Luôn có rollback
4. **Incremental** - Từng bước nhỏ
5. **Measurable** - Đo lường trước/sau

### 3 Câu hỏi trước mỗi thay đổi
1. Có phá vỡ logic cũ không? → Phải là KHÔNG
2. Có rollback được không? → Phải là CÓ
3. Có đo lường được không? → Phải là CÓ

### 1 Quy tắc tối thượng
**"Nếu không chắc chắn 100% → KHÔNG LÀM"**

---

*Document version: 1.0*  
*Last updated: 2026-01-18*

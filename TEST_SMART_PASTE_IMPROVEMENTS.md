# TEST CASES - SMART PASTE IMPROVEMENTS

## 🧪 TEST SUITE

### Test #1: N-grams Optimization
**Mục đích:** Verify giảm số lượng n-grams

**Input:**
```
26 duong so 6 thôn phú tây điện quang điện bàn quảng nam
```

**Expected Behavior:**
- Trước: 10 từ → 24 n-grams
- Sau: Chỉ dùng 8 từ cuối → ~12 n-grams
- Log: "📝 Using last 8 words (optimized from 10 words)"

**Verify:**
```javascript
// Check console log
// Should see: "Generated X n-grams" where X < 15
```

---

### Test #2: Early Street Extraction - Last Occurrence
**Mục đích:** Verify xử lý district name xuất hiện nhiều lần

**Test Case 2.1: District name xuất hiện 2 lần**
```
Input: "đông anh đông anh hà nội"
Expected street: "đông anh" (before LAST occurrence)
Expected log: "Early street extraction (last of 2 occurrences)"
```

**Test Case 2.2: District name xuất hiện 1 lần (normal)**
```
Input: "ngõ 2 sau đình hậu dưỡng đông anh hà nội"
Expected street: "ngõ 2 sau đình hậu dưỡng"
Expected log: "Early street extraction (before district)"
```

**Test Case 2.3: District name là substring**
```
Input: "ngõ đông anh 123 đông anh hà nội"
Expected street: "ngõ đông anh 123" (before LAST "đông anh")
Expected log: "Early street extraction (last of 2 occurrences)"
```

---

### Test #3: Ward Threshold - Reduce False Positives
**Mục đích:** Verify không chọn ward khi score thấp và không có keyword

**Test Case 3.1: Không có ward keyword, score thấp**
```
Input: "dong cao me linh ha noi"
Expected: Không chọn "Xã Đông Cao" (score ~0.53 < 0.65)
Expected: Dùng PASS 0 learning hoặc không fill ward
```

**Test Case 3.2: Có ward keyword, score thấp OK**
```
Input: "xã dong cao me linh ha noi"
Expected: Có thể chọn "Xã Đông Cao" (threshold 0.4)
```

**Test Case 3.3: Không có keyword, score cao**
```
Input: "trang viet me linh ha noi"
Expected: Chọn "Xã Tráng Việt" (score ~0.9 > 0.65)
```

---

### Test #4: Phone Removal - Clean Punctuation
**Mục đích:** Verify remove cả dấu câu xung quanh phone

**Test Case 4.1: Phone ở cuối với dấu phẩy**
```
Input: "Ấp3 xã Phước vân, 0937834118"
Expected addressText: "Ấp3 xã Phước vân" (không có dấu phẩy)
```

**Test Case 4.2: Phone ở cuối với dấu chấm**
```
Input: "Ấp3 xã Phước vân. 0937834118"
Expected addressText: "Ấp3 xã Phước vân" (không có dấu chấm)
```

**Test Case 4.3: Phone ở cuối với nhiều spaces**
```
Input: "Ấp3 xã Phước vân   0937834118"
Expected addressText: "Ấp3 xã Phước vân" (trim spaces)
```

---

### Test #5: District Selection - Exact Match Priority
**Mục đích:** Verify ưu tiên exact match

**Test Case 5.1: Exact match vs partial match**
```
Input: "me linh ha noi"
Candidates:
- "Huyện Mê Linh" (score: 1.0, ward_score: 0.5)
- "Quận Đống Đa" (score: 0.6, ward_score: 0.8)

Expected: Chọn "Huyện Mê Linh" (exact match wins)
```

**Test Case 5.2: Both exact, check ward score**
```
Candidates:
- District A (score: 1.0, ward_score: 0.9)
- District B (score: 1.0, ward_score: 0.5)

Expected: Chọn District A (higher ward_score)
```

**Test Case 5.3: Large district score diff**
```
Candidates:
- District A (score: 0.9, ward_score: 0.5)
- District B (score: 0.5, ward_score: 0.9)

Expected: Chọn District A (district_score diff = 0.4 ≥ 0.3)
```

---

## 🎯 REGRESSION TESTS (Đảm bảo không break existing functionality)

### Regression #1: Địa chỉ có dấu phẩy (normal case)
```
Input: "83/7 đường liên khu 4,5, phường Bình Hưng Hòa B, quận Bình Tân, TP HCM"
Expected: Parse chính xác như trước
- Province: TP Hồ Chí Minh
- District: Quận Bình Tân
- Ward: Phường Bình Hưng Hòa B
- Street: 83/7 đường liên khu 4,5
```

### Regression #2: PASS 0 Learning vẫn hoạt động
```
Input: "thôn hậu dưỡng đông anh hà nội"
Expected: 
- District: Huyện Đông Anh
- Street: "thôn hậu dưỡng"
- PASS 0 tìm thấy trong learning DB
- Ward: Xã Kim Chung (from learning)
```

### Regression #3: Abbreviations vẫn expand
```
Input: "F17 Q8 TP HCM"
Expected:
- Expand: "Phường 17 Quận 8 Thành phố Hồ Chí Minh"
- Province: TP Hồ Chí Minh
- District: Quận 8
- Ward: Phường 17
```

### Regression #4: Phone extraction vẫn hoạt động
```
Input: "Nguyễn Văn A\n0912345678\nHà Nội"
Expected:
- Name: Nguyễn Văn A
- Phone: 0912345678
- Address: Hà Nội
```

---

## 📝 MANUAL TESTING CHECKLIST

### Pre-deployment Checklist:
- [ ] Test #1: N-grams optimization (check console log)
- [ ] Test #2.1: District name 2 lần
- [ ] Test #2.2: District name 1 lần
- [ ] Test #2.3: District name substring
- [ ] Test #3.1: Ward threshold without keyword
- [ ] Test #3.2: Ward threshold with keyword
- [ ] Test #4.1: Phone removal with comma
- [ ] Test #4.2: Phone removal with period
- [ ] Test #5.1: Exact match priority
- [ ] Regression #1: Comma-separated address
- [ ] Regression #2: PASS 0 learning
- [ ] Regression #3: Abbreviations
- [ ] Regression #4: Phone extraction

### Performance Checklist:
- [ ] Parse time < 200ms for 10-word addresses
- [ ] Parse time < 300ms for 15-word addresses
- [ ] No console errors
- [ ] No infinite loops

### Accuracy Checklist:
- [ ] Province accuracy ≥ 95%
- [ ] District accuracy ≥ 90%
- [ ] Ward accuracy ≥ 85% (with PASS 0)
- [ ] Street extraction ≥ 90%

---

## 🐛 KNOWN EDGE CASES (Chưa fix)

### Edge Case #1: Địa chỉ quá ngắn
```
Input: "Hà Nội"
Expected: Chỉ có province, không có district/ward
Status: ✅ Hoạt động đúng
```

### Edge Case #2: Địa chỉ không có location keywords
```
Input: "123 abc xyz"
Expected: Không parse được
Status: ✅ Hoạt động đúng (return low confidence)
```

### Edge Case #3: Địa chỉ có typo nhiều
```
Input: "me lin ha noi" (thiếu "h" trong "linh")
Expected: Có thể không match
Status: ⚠️ Phụ thuộc vào fuzzy matching threshold
```

---

## 📊 EXPECTED IMPROVEMENTS

**Trước cải tiến:**
- Parse time: 200-500ms (10-word address)
- N-grams: 24 (10 words)
- Operations: ~18,000
- False positives: ~10%

**Sau cải tiến:**
- Parse time: 100-250ms (50% faster) ✅
- N-grams: ~12 (8 words) ✅
- Operations: ~9,000 (50% reduction) ✅
- False positives: ~5% (50% reduction) ✅

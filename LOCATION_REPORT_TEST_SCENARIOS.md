# 🧪 Location Report - Test Scenarios

## Test Coverage: Frontend + Backend + Analytics

---

## 1️⃣ FUNCTIONAL TESTS

### Test 1.1: AI Insights Generation
**Scenario:** Kiểm tra insights tự động
```
Given: Có 63 tỉnh với data current và previous
When: Load trang với period = "month"
Then: 
  ✅ Hiển thị insights banner
  ✅ Có 3-5 insights
  ✅ Insights chứa số liệu chính xác
  ✅ Format HTML đúng với <strong> tags
```

**Test Data:**
```javascript
currentData = [
  { id: '01', name: 'Hà Nội', revenue: 100000000, orders: 500 },
  { id: '79', name: 'TP.HCM', revenue: 150000000, orders: 700 },
  // ... 61 tỉnh khác
]
previousData = [
  { id: '01', revenue: 80000000, orders: 400 },
  { id: '79', revenue: 140000000, orders: 650 },
]
```

**Expected Insights:**
- "📈 Doanh thu tăng X% so với kỳ trước"
- "🎯 TOP 3 khu vực chiếm X% tổng doanh thu"
- "👑 Hà Nội/TP.HCM dẫn đầu với X%"

---

### Test 1.2: Growth Calculation
**Scenario:** Tính % tăng trưởng chính xác
```
Test Case 1: Tăng trưởng dương
  Current: 100, Previous: 80
  Expected: +25.0%
  
Test Case 2: Giảm sút
  Current: 80, Previous: 100
  Expected: -20.0%
  
Test Case 3: Không đổi
  Current: 100, Previous: 100
  Expected: ~0%
  
Test Case 4: Previous = 0
  Current: 100, Previous: 0
  Expected: +100%
  
Test Case 5: Current = 0
  Current: 0, Previous: 100
  Expected: -100%
```

**Code:**
```javascript
assert(AnalyticsEngine.calculateGrowth(100, 80) === 25);
assert(AnalyticsEngine.calculateGrowth(80, 100) === -20);
assert(AnalyticsEngine.calculateGrowth(100, 100) === 0);
assert(AnalyticsEngine.calculateGrowth(100, 0) === 100);
assert(AnalyticsEngine.calculateGrowth(0, 100) === -100);
```

---

### Test 1.3: Anomaly Detection
**Scenario:** Phát hiện outliers
```
Given: 10 locations với revenue từ 10M-20M
  And: 1 location có revenue 100M (outlier)
When: Run detectAnomalies()
Then: 
  ✅ Detect location 100M là anomaly
  ✅ Deviation > 2 standard deviations
  ✅ Return correct deviation percentage
```

**Test Data:**
```javascript
data = [
  { name: 'A', revenue: 10000000 },
  { name: 'B', revenue: 12000000 },
  // ... 8 locations 10-20M
  { name: 'Z', revenue: 100000000 } // Outlier
]
```

---

### Test 1.4: Concentration Analysis
**Scenario:** Tính TOP N chiếm X%
```
Given: 10 locations
  TOP 3 có tổng revenue = 80% total
When: Run findConcentration()
Then:
  ✅ Return { count: 3, percentage: 80.0 }
```

---

### Test 1.5: Trend Chart Rendering
**Scenario:** Vẽ biểu đồ xu hướng
```
Given: TOP 5 locations
When: Select metric = "revenue"
Then:
  ✅ Chart hiển thị 5 lines
  ✅ Mỗi line có 7 data points
  ✅ Colors khác nhau
  ✅ Tooltip format currency đúng
  
When: Change metric to "orders"
Then:
  ✅ Chart update với data mới
  ✅ Y-axis format number (không có đ)
```

---

### Test 1.6: Growth List
**Scenario:** Hiển thị TOP 5 tăng trưởng
```
Given: 20 locations với growth từ -50% đến +100%
When: Render growth list
Then:
  ✅ Hiển thị TOP 5 growth dương
  ✅ Sort descending
  ✅ Emoji đúng: 🚀⭐✨📈
  ✅ Badge màu xanh
  
When: Không có location nào có growth > 0
Then:
  ✅ Hiển thị "Chưa có dữ liệu so sánh"
```

---

### Test 1.7: Table Sorting
**Scenario:** Sort theo các cột
```
Test Case 1: Sort by Revenue DESC
  Click column "Doanh thu"
  Expected: Highest revenue first
  
Test Case 2: Sort by Revenue ASC
  Click again
  Expected: Lowest revenue first
  
Test Case 3: Sort by Growth DESC
  Click column "Tăng trưởng"
  Expected: Highest growth first
  
Test Case 4: Sort by Name ASC
  Click column "Tên"
  Expected: Alphabetical order
```

---

### Test 1.8: Drill-down Navigation
**Scenario:** Navigate qua 3 levels
```
Level 1: Province
  ✅ Hiển thị 63 tỉnh
  ✅ Breadcrumb: "Tỉnh/TP"
  ✅ Table title: "Danh sách Tỉnh/Thành phố"
  
Click "Hà Nội" → Level 2: District
  ✅ Hiển thị quận/huyện của Hà Nội
  ✅ Breadcrumb: "Tỉnh/TP > Hà Nội"
  ✅ Table title: "Danh sách Quận/Huyện - Hà Nội"
  
Click "Ba Đình" → Level 3: Ward
  ✅ Hiển thị phường/xã của Ba Đình
  ✅ Breadcrumb: "Tỉnh/TP > Hà Nội > Ba Đình"
  ✅ Table title: "Danh sách Phường/Xã - Ba Đình"
  ✅ Không có button "Xem chi tiết"
  
Click "Hà Nội" in breadcrumb
  ✅ Quay về level 2
  ✅ Reset ward data
```

---

### Test 1.9: Period Filter
**Scenario:** Chuyển đổi time period
```
Test Case 1: Today
  Click "Hôm nay"
  Expected:
    ✅ Button màu indigo
    ✅ Load data từ 00:00 hôm nay
    ✅ Previous = yesterday
    ✅ Show comparison
    
Test Case 2: All
  Click "Tất cả"
  Expected:
    ✅ Load all data
    ✅ No previous data
    ✅ Hide comparison badges
    ✅ Hide insights (or show without comparison)
```

---

### Test 1.10: Search/Filter
**Scenario:** Tìm kiếm trong table
```
Given: Table có 63 tỉnh
When: Type "Hà" in search box
Then:
  ✅ Hiển thị: Hà Nội, Hà Giang, Hà Nam, Hà Tĩnh
  ✅ Hide các tỉnh khác
  ✅ Ranking không thay đổi
  
When: Clear search
Then:
  ✅ Hiển thị lại tất cả
```

---

## 2️⃣ BACKEND API TESTS

### Test 2.1: Get Province Stats
**Request:**
```
GET /api?action=getLocationStats
  &level=province
  &period=month
  &startDate=2024-11-01T00:00:00Z
  &previousStartDate=2024-10-01T00:00:00Z
  &previousEndDate=2024-10-31T23:59:59Z
```

**Expected Response:**
```json
{
  "success": true,
  "level": "province",
  "period": "month",
  "locations": [
    {
      "id": "01",
      "name": "Hà Nội",
      "orders": 500,
      "revenue": 100000000,
      "customers": 350,
      "avgValue": 200000
    }
  ],
  "previousLocations": [
    {
      "id": "01",
      "orders": 400,
      "revenue": 80000000
    }
  ],
  "total": 63
}
```

---

### Test 2.2: Get District Stats
**Request:**
```
GET /api?action=getLocationStats
  &level=district
  &provinceId=01
  &period=week
```

**Expected:**
- ✅ Filter by province_id = '01'
- ✅ Group by district_id
- ✅ Return districts of Hà Nội only

---

### Test 2.3: Get Ward Stats
**Request:**
```
GET /api?action=getLocationStats
  &level=ward
  &provinceId=01
  &districtId=001
  &period=today
```

**Expected:**
- ✅ Filter by province_id = '01' AND district_id = '001'
- ✅ Group by ward_id
- ✅ Return wards of Ba Đình only

---

### Test 2.4: Date Range Calculation
**Scenario:** Tính startDate và previousDate đúng
```
Period: "month"
Current Date: 2024-11-18

Expected:
  startDate: 2024-11-01 00:00:00 UTC
  previousStartDate: 2024-10-01 00:00:00 UTC
  previousEndDate: 2024-10-31 23:59:59 UTC
```

---

### Test 2.5: Empty Results
**Scenario:** Không có data
```
Given: Province có 0 orders
When: Query stats
Then:
  ✅ Return empty array
  ✅ No error
  ✅ total = 0
```

---

## 3️⃣ EDGE CASES

### Test 3.1: Division by Zero
```
Scenario: Previous revenue = 0
  Current: 100, Previous: 0
  Expected: +100% (not Infinity or NaN)
  
Scenario: Current orders = 0
  avgValue = revenue / orders
  Expected: 0 (not NaN)
```

---

### Test 3.2: Missing Data
```
Scenario: Location không có province_name
  Expected: Skip hoặc show "Unknown"
  
Scenario: Previous period không có data
  Expected: Hide comparison, show "-"
```

---

### Test 3.3: Large Numbers
```
Scenario: Revenue > 1 tỷ
  Input: 1234567890
  Expected: "1.234.567.890đ"
  
Scenario: Growth > 1000%
  Input: 1500%
  Expected: "↑1500.0%"
```

---

### Test 3.4: Special Characters
```
Scenario: Location name có ký tự đặc biệt
  Input: "Đắk Lắk"
  Expected: Hiển thị đúng, không bị escape
  
Scenario: Search với dấu
  Input: "Đắk"
  Expected: Tìm thấy "Đắk Lắk", "Đắk Nông"
```

---

### Test 3.5: Concurrent Requests
```
Scenario: User click nhiều period liên tục
  Click "Hôm nay" → "Tuần này" → "Tháng này" nhanh
  Expected:
    ✅ Chỉ request cuối cùng được xử lý
    ✅ Không bị race condition
    ✅ Cache đúng data
```

---

## 4️⃣ PERFORMANCE TESTS

### Test 4.1: Load Time
```
Scenario: Load 63 tỉnh lần đầu
  Expected: < 2 seconds
  
Scenario: Load từ cache
  Expected: < 100ms
  
Scenario: Drill-down to district
  Expected: < 1 second
```

---

### Test 4.2: Chart Rendering
```
Scenario: Render 4 charts cùng lúc
  Expected: < 500ms total
  
Scenario: Update trend chart khi change metric
  Expected: < 200ms
```

---

### Test 4.3: Table Rendering
```
Scenario: Render 63 rows
  Expected: < 300ms
  
Scenario: Sort table
  Expected: < 100ms
  
Scenario: Search/filter
  Expected: < 50ms (instant)
```

---

### Test 4.4: Memory Usage
```
Scenario: Navigate qua 3 levels nhiều lần
  Expected:
    ✅ No memory leak
    ✅ Charts destroyed properly
    ✅ Cache size reasonable (<10MB)
```

---

## 5️⃣ INTEGRATION TESTS

### Test 5.1: End-to-End Flow
```
1. User mở trang → Load province data
2. Click "Tháng này" → Load với previous data
3. See AI insights → Verify calculations
4. Click "Hà Nội" → Drill to districts
5. Sort by Growth → Verify order
6. Search "Ba" → Filter results
7. Click breadcrumb → Back to province
8. Click "Làm mới" → Reload data
```

---

### Test 5.2: Cache Invalidation
```
1. Load "Tháng này" → Data cached
2. Click "Làm mới" → Cache cleared
3. Load again → Fresh data from API
4. Verify data is updated
```

---

### Test 5.3: Error Handling
```
Scenario: API returns error
  Expected:
    ✅ Show toast "Không thể tải dữ liệu"
    ✅ Keep previous data if available
    ✅ No crash
    
Scenario: Network timeout
  Expected:
    ✅ Show loading state
    ✅ Retry or show error after 10s
```

---

## 6️⃣ ACCESSIBILITY TESTS

### Test 6.1: Keyboard Navigation
```
✅ Tab through all interactive elements
✅ Enter to click buttons
✅ Arrow keys in dropdowns
✅ Escape to close modals
```

---

### Test 6.2: Screen Reader
```
✅ All images have alt text
✅ Charts have aria-labels
✅ Table has proper headers
✅ Buttons have descriptive text
```

---

## 7️⃣ BROWSER COMPATIBILITY

### Test 7.1: Cross-browser
```
✅ Chrome 90+
✅ Firefox 88+
✅ Safari 14+
✅ Edge 90+
```

---

### Test 7.2: Mobile Responsive
```
✅ iPhone 12 (390x844)
✅ Samsung Galaxy S21 (360x800)
✅ iPad (768x1024)
✅ Desktop (1920x1080)
```

---

## 📋 TEST CHECKLIST

### Before Release:
- [ ] All functional tests pass
- [ ] All edge cases handled
- [ ] Performance benchmarks met
- [ ] No console errors
- [ ] No memory leaks
- [ ] API responses validated
- [ ] Cache working correctly
- [ ] Charts render properly
- [ ] Mobile responsive
- [ ] Accessibility compliant

### After Release:
- [ ] Monitor error logs
- [ ] Check performance metrics
- [ ] Gather user feedback
- [ ] A/B test insights accuracy
- [ ] Optimize slow queries

---

**Test Coverage Target:** 90%+
**Critical Path Coverage:** 100%
**Performance Budget:** <2s initial load, <500ms interactions

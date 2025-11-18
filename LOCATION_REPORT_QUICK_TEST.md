# ✅ Location Report - Quick Test Checklist

## 🚀 Test ngay sau khi deploy (5 phút)

### 1. Load trang lần đầu
```
URL: http://127.0.0.1:5500/public/admin/location-report.html
```
- [ ] Trang load thành công (không có lỗi console)
- [ ] Hiển thị loading spinner
- [ ] Data load trong <2 giây
- [ ] 4 KPI cards hiển thị số liệu

### 2. Kiểm tra AI Insights
- [ ] Banner insights hiển thị (nếu có previous data)
- [ ] Có 3-5 insights
- [ ] Insights có số liệu cụ thể
- [ ] Format đẹp với icons

### 3. Kiểm tra Charts
- [ ] TOP 10 bar chart hiển thị
- [ ] Pie chart hiển thị
- [ ] Trend chart hiển thị (7 ngày)
- [ ] Growth list hiển thị TOP 5

### 4. Kiểm tra Table
- [ ] Table hiển thị đầy đủ 9 cột
- [ ] Ranking có emoji 🥇🥈🥉
- [ ] Cột "Tăng trưởng" có badge màu
- [ ] Click sort hoạt động

### 5. Test Period Filter
- [ ] Click "Hôm nay" → data update
- [ ] Click "Tuần này" → data update
- [ ] Click "Tháng này" → data update
- [ ] Click "Tất cả" → hide comparison

### 6. Test Drill-down
- [ ] Click vào 1 tỉnh → chuyển sang quận
- [ ] Breadcrumb hiển thị đúng
- [ ] Click breadcrumb → quay lại
- [ ] Click vào 1 quận → chuyển sang phường

### 7. Test Search
- [ ] Gõ "Hà" → filter đúng
- [ ] Clear search → hiển thị lại tất cả

### 8. Test Refresh
- [ ] Click "Làm mới" → reload data
- [ ] Toast hiển thị "Đang làm mới..."

---

## 🐛 Các lỗi thường gặp

### Lỗi 1: Insights không hiển thị
**Nguyên nhân:** Chưa có previous data  
**Giải pháp:** Chọn period khác "Tất cả"

### Lỗi 2: Growth hiển thị "-"
**Nguyên nhân:** Không có data kỳ trước  
**Giải pháp:** Bình thường, đúng logic

### Lỗi 3: Chart không render
**Nguyên nhân:** Chart.js chưa load  
**Giải pháp:** Check CDN, refresh trang

### Lỗi 4: API error
**Nguyên nhân:** Backend chưa deploy  
**Giải pháp:** Deploy worker.js trước

---

## 📊 Expected Results

### KPI Cards (với previous data)
```
Tổng đơn hàng: 1,234 ↑12.5%
Tổng doanh thu: 123.456.789đ ↑8.3%
Khách hàng: 567 ↑15.2%
Giá trị TB: 100.000đ ↓2.1%
```

### AI Insights (ví dụ)
```
📈 Doanh thu tăng 15.2% so với kỳ trước
🎯 TOP 3 khu vực chiếm 65.8% tổng doanh thu
👑 Hà Nội dẫn đầu với 28.5% tổng doanh thu
💎 5 khu vực có giá trị đơn hàng cao gấp 1.5x trung bình
⚡ TP.HCM có doanh thu cao bất thường (45.2% so với TB)
```

### Growth List
```
🚀 Hà Nội - 123.456.789đ - ↑45.5%
⭐ TP.HCM - 156.789.012đ - ↑38.2%
✨ Đà Nẵng - 45.678.901đ - ↑32.1%
📈 Cần Thơ - 23.456.789đ - ↑28.5%
📈 Hải Phòng - 34.567.890đ - ↑25.3%
```

---

## ⚡ Performance Check

### Load Time
- Initial load: <2s ✅
- Period change: <1s ✅
- Drill-down: <1s ✅
- Chart render: <500ms ✅

### Console Log
```
🗺️ Location Analytics Dashboard initialized
📦 Using cached data (nếu có cache)
⚡ Load Location Data: 1234.56ms
```

### Network Tab
- API call: 1 request
- Response size: <100KB
- Status: 200 OK

---

## 🎯 Success Criteria

### Must Have (Critical)
- [x] Trang load không lỗi
- [x] Data hiển thị đúng
- [x] Charts render đúng
- [x] Drill-down hoạt động
- [x] Period filter hoạt động

### Should Have (Important)
- [x] AI Insights hiển thị
- [x] Growth indicators đúng
- [x] Comparison badges đúng
- [x] Performance <2s
- [x] Mobile responsive

### Nice to Have (Optional)
- [ ] Export to Excel
- [ ] Map visualization
- [ ] Real-time updates

---

## 📝 Test Report Template

```
Date: ___________
Tester: ___________
Browser: ___________
Device: ___________

✅ PASSED:
- Load trang thành công
- AI Insights hiển thị đúng
- Charts render đẹp
- Drill-down hoạt động
- Performance tốt

❌ FAILED:
- (none)

⚠️ ISSUES:
- (none)

📊 PERFORMANCE:
- Load time: 1.2s
- Chart render: 350ms
- Memory usage: 45MB

💡 NOTES:
- Tất cả tính năng hoạt động tốt
- UX mượt mà
- Insights rất hữu ích

OVERALL: ✅ PASS
```

---

## 🚀 Quick Commands

### Start local server
```bash
# Using Python
python -m http.server 5500

# Using Node.js
npx http-server -p 5500

# Using Live Server (VS Code)
Right-click → Open with Live Server
```

### Open in browser
```
http://127.0.0.1:5500/public/admin/location-report.html
```

### Check console
```
F12 → Console tab
Look for errors (red text)
```

### Check network
```
F12 → Network tab
Filter: XHR
Check API calls
```

---

**Time to test:** 5 minutes  
**Difficulty:** Easy  
**Required:** Browser + Internet

# ⚡ QUICK TEST GUIDE - 5 Minutes

## 🚀 Quick Start

### **1. Start Backend** (30 seconds)
```bash
npm run dev
```
**Expected:** Backend running on `http://127.0.0.1:8787`

### **2. Open Frontend** (10 seconds)
Open in browser:
```
http://localhost:5500/shop/index.html
```
Or use Live Server in VS Code

### **3. Open Console** (5 seconds)
Press `F12` → Console Tab

---

## ✅ 5-Minute Test

### **Test 1: Page Loads** (30 seconds)
- [ ] Console shows: `🚀 Initializing Vòng Đầu Tam Shop...`
- [ ] Console shows: `✅ Application initialized successfully`
- [ ] No red errors in console
- [ ] Products display
- [ ] Categories display

**✅ PASS** if all checked

---

### **Test 2: Add to Cart** (30 seconds)
1. Click "Thêm giỏ" on any product
2. Check cart badge (should show `1`)
3. Click "Thêm giỏ" again
4. Check cart badge (should show `2`)

**✅ PASS** if cart count updates

---

### **Test 3: Quick Checkout** (1 minute)
1. Click "Mua ngay" on any product
2. Modal opens
3. Click `+` button (quantity increases)
4. Click `-` button (quantity decreases)
5. Fill in phone: `0912345678`
6. Fill in name: `Test User`
7. Fill in address: `Test Address`
8. Check summary updates

**✅ PASS** if modal works and summary updates

---

### **Test 4: Filter & Sort** (1 minute)
1. Click "Phổ biến" filter
2. Products update
3. Click "Mới nhất" filter
4. Products update
5. Select "Giá: Thấp đến cao"
6. Products sort by price

**✅ PASS** if filtering and sorting work

---

### **Test 5: Mobile View** (1 minute)
1. Resize browser to mobile width (< 768px)
2. Check products grid (2 columns)
3. Check "Thêm giỏ" button (icon only)
4. Click hamburger menu
5. Menu toggles open/close

**✅ PASS** if mobile responsive

---

### **Test 6: Cart Navigation** (30 seconds)
1. Click cart icon in header
2. Browser navigates to `cart.html`

**✅ PASS** if navigation works

---

### **Test 7: Flash Sale** (1 minute)
**Note:** Only if flash sale is active

1. Check flash sale section displays
2. Timer counts down
3. Click prev/next buttons
4. Carousel scrolls

**✅ PASS** if carousel works

---

## 🎯 Quick Results

### **All Tests Passed?** ✅
**Status:** Ready for production!

### **Some Tests Failed?** ⚠️
**Action:** Check TESTING-CHECKLIST.md for detailed debugging

### **Many Tests Failed?** ❌
**Action:** 
1. Hard refresh (Ctrl + Shift + R)
2. Check backend is running
3. Check console for errors
4. Review PHASE-3-COMPLETE.md

---

## 🐛 Common Quick Fixes

### **Cart count not updating**
```javascript
// Check cart.service.js has:
window.dispatchEvent(new CustomEvent('cartUpdated'));
```

### **Products not loading**
```javascript
// Check backend is running on port 8787
// Check API_BASE_URL in config.js
```

### **Module not found**
```html
<!-- Check HTML has: -->
<script type="module" src="assets/js/app.js"></script>
```

### **Buttons not working**
```javascript
// Check window objects are set:
window.productActions = this.productActions;
window.quickCheckout = this.quickCheckout;
```

---

## 📊 Expected Console Output

```
🚀 Initializing Vòng Đầu Tam Shop...
Data loaded: {products: 50, categories: 10, flashSales: 1}
✅ Application initialized successfully
```

**No errors should appear!**

---

## ⏱️ Performance Check

### **Load Time**
- Initial load: < 500ms
- Module loading: < 100ms
- Rendering: < 200ms

### **Interactions**
- Button clicks: Instant
- Filter/sort: < 100ms
- Modal open: < 50ms

**If slower, check:**
- Network tab for slow API calls
- Console for errors
- Browser cache

---

## 🎉 Success!

If all 7 tests pass, you're ready to go! 🚀

**Next Steps:**
1. Run full testing checklist (TESTING-CHECKLIST.md)
2. Test on different browsers
3. Test on real mobile devices
4. Deploy to production

---

**Quick Test Time:** ~5 minutes
**Full Test Time:** ~30 minutes
**Confidence Level:** 95%

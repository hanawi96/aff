# 🧪 TESTING CHECKLIST - Modular Architecture

## 📋 Pre-Testing Setup

### **1. Start Development Server**
```bash
# Make sure backend is running on port 8787
npm run dev

# Open frontend on port 5500
# Use Live Server or similar
```

### **2. Open Browser Console**
```
F12 → Console Tab
```

### **3. Clear Cache**
```
Ctrl + Shift + R (Hard Refresh)
```

---

## ✅ TESTING STEPS

### **1. Initial Load** 🚀
- [ ] Open `http://localhost:5500/shop/index.html`
- [ ] Console shows: `🚀 Initializing Vòng Đầu Tam Shop...`
- [ ] Console shows: `✅ Application initialized successfully`
- [ ] No console errors
- [ ] Products grid loads
- [ ] Categories grid loads
- [ ] Flash sale section loads (if active)
- [ ] Cart count shows `0`

**Expected Result:** Page loads successfully with all content

---

### **2. Products Display** 📦
- [ ] Products grid shows 12 products initially
- [ ] Each product card has:
  - [ ] Product image
  - [ ] Product name
  - [ ] Price (formatted with đ)
  - [ ] "Thêm giỏ" button (40% width on desktop)
  - [ ] "Mua ngay" button (60% width on desktop)
  - [ ] Badges (if any: NEW, HOT, SALE)

**Expected Result:** Products display correctly with proper styling

---

### **3. Filter Products** 🔍
- [ ] Click "Tất cả" → Shows all products
- [ ] Click "Phổ biến" → Filters popular products
- [ ] Click "Mới nhất" → Filters new products
- [ ] Click "Giảm giá" → Filters sale products
- [ ] Active filter button has red background
- [ ] Inactive buttons have white background

**Expected Result:** Filtering works correctly

---

### **4. Sort Products** 📊
- [ ] Select "Giá: Thấp đến cao" → Products sorted by price ascending
- [ ] Select "Giá: Cao đến thấp" → Products sorted by price descending
- [ ] Select "Tên A-Z" → Products sorted alphabetically
- [ ] Select "Mặc định" → Products return to default order

**Expected Result:** Sorting works correctly

---

### **5. Load More** ➕
- [ ] Click "Xem thêm sản phẩm" button
- [ ] More products appear (12 more)
- [ ] Button still visible if more products available
- [ ] Button hides if all products shown

**Expected Result:** Pagination works correctly

---

### **6. Add to Cart** 🛒
- [ ] Click "Thêm giỏ" button on any product
- [ ] Toast notification appears: "Đã thêm vào giỏ hàng!"
- [ ] Cart count badge updates (0 → 1)
- [ ] Click "Thêm giỏ" on same product again
- [ ] Cart count updates (1 → 2)
- [ ] Check localStorage → cart data saved

**Expected Result:** Add to cart works, UI updates immediately

---

### **7. Quick Checkout Modal** ⚡
- [ ] Click "Mua ngay" button on any product
- [ ] Modal opens with product details
- [ ] Product image, name, price displayed
- [ ] Quantity selector shows 1
- [ ] Click `-` button → Quantity stays at 1 (minimum)
- [ ] Click `+` button → Quantity increases to 2
- [ ] Summary updates: Subtotal = price × quantity
- [ ] Shipping fee shows: 30.000đ
- [ ] Total = Subtotal + Shipping

**Expected Result:** Modal opens and quantity selector works

---

### **8. Quick Checkout Form Validation** ✍️
- [ ] Leave all fields empty, click "Đặt hàng ngay"
- [ ] Phone field shows error (required)
- [ ] Name field shows error (required)
- [ ] Address field shows error (required)
- [ ] Enter invalid phone (e.g., "123") → Shows error
- [ ] Enter valid phone (e.g., "0912345678") → No error
- [ ] Fill all required fields → Submit button enabled
- [ ] Click "Đặt hàng ngay" → Order submits

**Expected Result:** Form validation works correctly

---

### **9. Flash Sale** 🔥
**Note:** Only if flash sale is active

- [ ] Flash sale section displays
- [ ] Countdown timer shows hours:minutes:seconds
- [ ] Timer counts down every second
- [ ] Flash sale products display in carousel
- [ ] Click "Previous" button → Carousel scrolls left
- [ ] Click "Next" button → Carousel scrolls right
- [ ] Wait 5 seconds → Auto-play scrolls automatically
- [ ] Hover over carousel → Auto-play pauses
- [ ] Move mouse away → Auto-play resumes
- [ ] Flash sale products have icon button (50×50px)
- [ ] Flash sale products have "MUA NGAY" button

**Expected Result:** Flash sale carousel works with auto-play

---

### **10. Categories** 📂
- [ ] Categories grid displays
- [ ] Each category card has:
  - [ ] Category icon
  - [ ] Category name
  - [ ] Product count
- [ ] Click any category card
- [ ] Products filter by category (TODO: implement)

**Expected Result:** Categories display correctly

---

### **11. Cart Navigation** 🛒
- [ ] Click cart icon in header
- [ ] Browser navigates to `cart.html`
- [ ] Cart page loads (uses cart.js)

**Expected Result:** Navigation to cart page works

---

### **12. Mobile Menu** 📱
- [ ] Resize browser to mobile width (< 1024px)
- [ ] Hamburger menu icon appears
- [ ] Click hamburger icon
- [ ] Mobile menu slides down
- [ ] Click hamburger icon again
- [ ] Mobile menu slides up

**Expected Result:** Mobile menu toggle works

---

### **13. Smooth Scroll** 🎯
- [ ] Click "Trang chủ" in nav → Scrolls to top
- [ ] Click "Sản phẩm" in nav → Scrolls to products section
- [ ] Click "Flash Sale" in nav → Scrolls to flash sale section
- [ ] Click "Về chúng tôi" in nav → Scrolls to features section
- [ ] Scroll is smooth (animated)

**Expected Result:** Smooth scroll navigation works

---

### **14. Header Scroll Effect** 📜
- [ ] Scroll down page > 100px
- [ ] Header gets `scrolled` class (shadow effect)
- [ ] Scroll back to top
- [ ] Header loses `scrolled` class

**Expected Result:** Header scroll effect works

---

### **15. Mobile Responsive** 📱

#### **Desktop (> 1024px)**
- [ ] Products grid: 4 columns
- [ ] Categories grid: 6 columns
- [ ] "Thêm giỏ" button: 40% width, text visible
- [ ] "Mua ngay" button: 60% width

#### **Tablet (768px - 1024px)**
- [ ] Products grid: 3 columns
- [ ] Categories grid: 3 columns
- [ ] Buttons adjust properly

#### **Mobile (< 768px)**
- [ ] Products grid: 2 columns
- [ ] Categories grid: 2 columns
- [ ] "Thêm giỏ" button: 35% width, icon only
- [ ] "Mua ngay" button: 65% width
- [ ] Mobile menu works
- [ ] Touch/swipe on flash sale carousel works

**Expected Result:** Responsive design works on all screen sizes

---

### **16. LocalStorage Persistence** 💾
- [ ] Add products to cart
- [ ] Refresh page (F5)
- [ ] Cart count persists
- [ ] Cart data still in localStorage
- [ ] Navigate to cart.html
- [ ] Cart items display correctly

**Expected Result:** Cart data persists across page reloads

---

### **17. Console Errors** 🐛
- [ ] No console errors during load
- [ ] No console errors during interactions
- [ ] No 404 errors for missing files
- [ ] No CORS errors
- [ ] All API calls successful

**Expected Result:** No console errors

---

### **18. Performance** ⚡
- [ ] Page loads in < 1 second
- [ ] Interactions are smooth (no lag)
- [ ] Animations are smooth (60fps)
- [ ] No memory leaks
- [ ] No excessive re-renders

**Expected Result:** Good performance

---

## 🐛 COMMON ISSUES & FIXES

### **Issue: Cart count not updating**
**Fix:** Check if `cartUpdated` event is dispatched in cart.service.js

### **Issue: Products not loading**
**Fix:** Check API_BASE_URL in config.js, ensure backend is running

### **Issue: Module not found errors**
**Fix:** Check import paths, ensure all files exist

### **Issue: Flash sale not showing**
**Fix:** Check if there's an active flash sale in database

### **Issue: Buttons not working**
**Fix:** Check if onclick handlers are attached to window object

---

## ✅ SIGN-OFF

### **Tested By:** _________________
### **Date:** _________________
### **Browser:** _________________
### **Screen Size:** _________________

### **Overall Status:**
- [ ] ✅ All tests passed
- [ ] ⚠️ Some issues found (list below)
- [ ] ❌ Major issues found (list below)

### **Issues Found:**
```
1. 
2. 
3. 
```

### **Notes:**
```


```

---

**Testing Complete:** ___/___/___

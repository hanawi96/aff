# 🎨 Skeleton Loading Implementation Guide

## 📋 Tổng quan

Đã implement skeleton loading cho trang giỏ hàng với phong cách mềm mại, pastel phù hợp với mẹ bỉm sữa.

## ✨ Tính năng

### 1. **Skeleton Loading State**
- Hiển thị ngay khi trang load
- Animation shimmer mượt mà (2s loop)
- Màu pastel nhẹ nhàng (mint green, peach)
- Icon giỏ hàng với animation bounce
- Text thân thiện: "Đang chuẩn bị giỏ hàng của mẹ..."

### 2. **Skeleton Components**

#### Cart Items Skeleton (3 items)
- Image placeholder: 100x100px (mobile: 80x80px)
- Title line: 80% width
- Subtitle line: 50% width  
- Price line: 35% width
- Shimmer animation từ trái sang phải

#### Section Skeletons (2 sections)
- Section title placeholder
- Box placeholder (60px height)
- Dashed border với màu pastel

#### Summary Skeleton
- Header với title placeholder
- 3 row placeholders
- Divider line
- Total placeholder (28px height)
- Button placeholder (56px height)

### 3. **Smooth Transitions**

#### Fade Out Skeleton (300ms)
```javascript
skeleton.style.opacity = '0';
skeleton.style.transition = 'opacity 0.3s ease';
setTimeout(() => skeleton.classList.add('hidden'), 300);
```

#### Fade In Content (400ms)
```javascript
element.style.opacity = '0';
element.style.transition = 'opacity 0.4s ease';
setTimeout(() => element.style.opacity = '1', 100);
```

#### Staggered Animation
- Mỗi section delay thêm 50ms
- Tạo hiệu ứng cascade mượt mà

## 🔧 Implementation Details

### Synchronous Loading Flow

```javascript
// 1. Page loads → Skeleton visible (opacity: 1)
// 2. Load data from localStorage/API
await cart.loadAvailableDiscounts();
await cart.loadBundleProducts();

// 3. Wait for skeleton to completely fade out (300ms)
await cart.hideSkeleton(); // Returns Promise

// 4. After skeleton hidden, show all content together
cart.render();           // Fade-in cart items
cart.updateSummary();    // Fade-in summary
cart.renderBundleOffer(); // Fade-in bundle section
```

### Key Changes for Synchronization

**Problem**: Content was appearing before skeleton finished fading out

**Solution**: 
1. Made `hideSkeleton()` return a Promise
2. Used `await` to wait for skeleton fade-out completion
3. All content starts with `opacity: 0`
4. Content fades in together using `requestAnimationFrame`

### Timing Sequence

```
0ms    → Skeleton visible (opacity: 1)
500ms  → Data loaded
500ms  → Skeleton fade-out starts (opacity: 1 → 0)
800ms  → Skeleton hidden (display: none)
800ms  → Content fade-in starts (opacity: 0 → 1)
1300ms → All content visible (opacity: 1)
```

### HTML Structure

```html
<!-- Skeleton (visible by default) -->
<div class="cart-skeleton" id="cartSkeleton">
  <!-- Skeleton content -->
</div>

<!-- Real content (hidden by default) -->
<div class="cart-items hidden" id="cartItems">
  <!-- Real cart items -->
</div>
```

### CSS Key Features

```css
/* Prevent flash during transition */
.cart-items,
.discount-section,
.cart-summary {
    opacity: 1;
    transition: opacity 0.5s ease;
}

.cart-items.hidden {
    opacity: 0 !important;
}

/* Shimmer Animation */
@keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}

/* Gentle Bounce */
@keyframes gentleBounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
}
```

### JavaScript Flow - SYNCHRONIZED

```javascript
// Hide skeleton with Promise
hideSkeleton: () => {
    return Promise.all([
        fadeOutSkeleton(),
        fadeOutSkeletonSummary()
    ]);
}

// Render content after skeleton hidden
render: () => {
    container.classList.remove('hidden');
    container.style.opacity = '0'; // Start invisible
    
    // Fade in together
    requestAnimationFrame(() => {
        container.style.transition = 'opacity 0.5s ease';
        container.style.opacity = '1';
    });
}
```

## 📱 Responsive Design

### Desktop
- Skeleton items: 100x100px images
- Full padding: 2rem 1.5rem
- Icon size: 3rem

### Mobile (≤768px)
- Skeleton items: 80x80px images
- Reduced padding: 1.5rem 1rem
- Icon size: 2.5rem

## 🎨 Color Palette

### Skeleton Colors
- Background: `rgba(248, 237, 235, 0.3)` (warm peach)
- Shimmer: `rgba(244, 162, 97, 0.1)` → `rgba(233, 196, 106, 0.15)` (peach to yellow)
- Border: `rgba(244, 162, 97, 0.1)` (soft peach)
- Text: `var(--primary)` (#f4a261)

### Animation Colors
- Icon: Primary color with bounce
- Shimmer: Gradient peach/yellow
- Button: Primary to secondary gradient

## ⚡ Performance

### Timing - SYNCHRONIZED
- Skeleton display: Instant (0ms)
- Data loading: ~500-1000ms (depends on API)
- Skeleton fade out: 300ms
- Content fade in: 500ms (starts AFTER skeleton hidden)
- Total perceived time: ~1.3-1.8s

### Optimization
- CSS animations (GPU accelerated)
- Promise-based synchronization (no race conditions)
- RequestAnimationFrame for smooth transitions
- Staggered loading prevents jank (30ms between sections)
- No layout shift (skeleton matches real layout)
- All content appears together (no flash)

## 🐛 Troubleshooting

### Issue: Skeleton không hiển thị
**Solution**: Kiểm tra `cart-skeleton` không có class `hidden` trong HTML

### Issue: Content nhảy khi load
**Solution**: Đảm bảo skeleton có cùng kích thước với content thật

### Issue: Animation giật lag
**Solution**: Sử dụng `transform` và `opacity` thay vì `width/height`

### Issue: Skeleton hiển thị quá lâu
**Solution**: Kiểm tra `cart.hideSkeleton()` được gọi sau khi load data

### Issue: Content hiện ra trước khi skeleton ẩn (FIXED)
**Problem**: Cart items xuất hiện trước khi skeleton fade-out xong
**Solution**: 
- Đổi `hideSkeleton()` thành async function trả về Promise
- Dùng `await cart.hideSkeleton()` để đợi skeleton ẩn hoàn toàn
- Tất cả content bắt đầu với `opacity: 0`
- Content chỉ fade-in sau khi skeleton đã hidden

### Issue: Các section không đồng bộ
**Problem**: Discount, payment sections hiện ra lúc khác nhau
**Solution**:
- Tất cả sections đều `opacity: 0` ban đầu
- Dùng `requestAnimationFrame` để fade-in cùng lúc
- Stagger nhẹ (30ms) giữa các sections cho mượt mà

## 📊 User Experience Benefits

### Before (No Skeleton)
- ❌ Trang trắng xóa 1-2s
- ❌ Content nhảy đột ngột
- ❌ User không biết đang load gì
- ❌ Cảm giác chậm, lag

### After (With Skeleton)
- ✅ Thấy content ngay lập tức
- ✅ Transition mượt mà
- ✅ Biết đang load giỏ hàng
- ✅ Cảm giác nhanh, chuyên nghiệp

## 🎯 Best Practices Applied

1. **Match Real Layout**: Skeleton giống y hệt layout thật
2. **Soft Colors**: Màu pastel nhẹ nhàng, không chói mắt
3. **Smooth Animation**: 2s shimmer, không quá nhanh/chậm
4. **Friendly Text**: "Đang chuẩn bị giỏ hàng của mẹ..."
5. **Staggered Loading**: Sections xuất hiện lần lượt
6. **No Layout Shift**: Không bị nhảy layout
7. **Mobile Optimized**: Responsive cho mọi màn hình

## 🚀 Future Enhancements

- [ ] Add progress bar (0-100%)
- [ ] Show estimated time remaining
- [ ] Add micro-interactions (pulse on load complete)
- [ ] Skeleton for recommended products
- [ ] Error state skeleton (if load fails)

## 📝 Notes

- Skeleton được thiết kế theo phong cách "mẹ bỉm sữa"
- Màu sắc pastel, mềm mại, thân thiện
- Animation nhẹ nhàng, không gây mệt mắt
- Text động viên, tạo cảm giác được chăm sóc
- Phù hợp với brand identity của Vòng Đầu Tam

---

**Implemented by**: Kiro AI Assistant  
**Date**: January 27, 2026  
**Status**: ✅ Complete & Tested

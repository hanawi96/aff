# Marquee Banner - Dòng Chữ Chạy Thông Báo

## Tổng quan
Thêm banner thông báo với dòng chữ chạy liên tục từ phải sang trái ở trên cùng của tất cả các trang.

## Thông tin
- **Nội dung**: "🎁 Mua thêm bó dâu tằm để được miễn phí ship 🚚"
- **Vị trí**: Trên cùng, trước header (fixed position)
- **Chiều cao**: 50px (desktop), 45px (mobile)
- **Màu sắc**: Gradient đỏ (#ff6b6b → #ee5a6f) phù hợp với UI warm/handmade
- **Animation**: Chạy liên tục 30s, pause khi hover

## Files đã chỉnh sửa

### 1. HTML Files

#### `public/shop/cart.html`
```html
<body>
    <!-- Marquee Banner - Announcement -->
    <div class="marquee-banner">
        <div class="marquee-content">
            <span class="marquee-text">
                🎁 Mua thêm bó dâu tằm để được miễn phí ship 🚚 ...
            </span>
            <span class="marquee-text" aria-hidden="true">
                🎁 Mua thêm bó dâu tằm để được miễn phí ship 🚚 ...
            </span>
        </div>
    </div>
    
    <!-- Header -->
    <header class="cart-header">
```

#### `public/shop/index.html`
```html
<body class="bg-warm">
    <!-- Marquee Banner - Announcement -->
    <div class="marquee-banner">
        <div class="marquee-content">
            <span class="marquee-text">
                🎁 Mua thêm bó dâu tằm để được miễn phí ship 🚚 ...
            </span>
            <span class="marquee-text" aria-hidden="true">
                🎁 Mua thêm bó dâu tằm để được miễn phí ship 🚚 ...
            </span>
        </div>
    </div>
    
    <!-- Header - Handmade Style -->
    <header class="bg-white/95 backdrop-blur-sm shadow-sm sticky top-0 z-50 border-b-2 border-primary/20">
```

### 2. CSS File

#### `public/shop/cart.css`

**Marquee Banner Styles:**
```css
.marquee-banner {
    height: 50px;
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 50%, #ff6b6b 100%);
    overflow: hidden;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1100;
    display: flex;
    align-items: center;
    box-shadow: 0 2px 8px rgba(255, 107, 107, 0.3);
    border-bottom: 2px solid rgba(255, 255, 255, 0.2);
}

.marquee-content {
    display: flex;
    animation: marquee 30s linear infinite;
    white-space: nowrap;
}

.marquee-text {
    display: inline-block;
    padding: 0 2rem;
    font-size: 1rem;
    font-weight: 700;
    color: #ffffff;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    letter-spacing: 0.5px;
}

@keyframes marquee {
    0% {
        transform: translateX(0);
    }
    100% {
        transform: translateX(-50%);
    }
}

.marquee-banner:hover .marquee-content {
    animation-play-state: paused;
}
```

**Body Adjustment:**
```css
body {
    padding-top: 50px; /* Space for fixed marquee banner */
}
```

**Header Adjustment:**
```css
.cart-header {
    position: sticky;
    top: 50px; /* Below marquee banner */
    z-index: 100;
}

body > header.sticky {
    top: 50px !important;
}
```

**Mobile Responsive:**
```css
@media (max-width: 768px) {
    body {
        padding-top: 45px;
    }
    
    .marquee-banner {
        height: 45px;
    }
    
    .marquee-text {
        font-size: 0.9rem;
        padding: 0 1.5rem;
    }
    
    body > header.sticky {
        top: 45px !important;
    }
    
    .cart-header {
        top: 45px;
    }
}
```

## Tính năng

### 1. Animation
- **Infinite loop**: Chạy liên tục không dừng
- **Smooth**: Animation mượt mà với linear timing
- **Duration**: 30 giây cho một vòng
- **Pause on hover**: Dừng lại khi hover để đọc

### 2. Design
- **Gradient background**: Đỏ gradient (#ff6b6b → #ee5a6f)
- **White text**: Chữ trắng với text-shadow để nổi bật
- **Icons**: Emoji 🎁 và 🚚 để thu hút attention
- **Border**: Border trắng mờ ở dưới để tách biệt với header

### 3. Layout
- **Fixed position**: Luôn ở trên cùng khi scroll
- **Z-index 1100**: Cao hơn header (z-index 100)
- **Full width**: Chiếm toàn bộ chiều rộng màn hình

### 4. Accessibility
- **Duplicate text**: 2 span để tạo hiệu ứng loop liền mạch
- **aria-hidden**: Span thứ 2 có aria-hidden="true" để screen reader không đọc 2 lần

### 5. Responsive
- **Desktop**: 50px height, font-size 1rem
- **Mobile**: 45px height, font-size 0.9rem
- **Auto adjust**: Header tự động điều chỉnh top position

## Technical Details

### Animation Technique
- Sử dụng 2 span giống nhau để tạo infinite loop
- Transform translateX từ 0 đến -50%
- Khi span đầu tiên đi hết, span thứ 2 xuất hiện liền mạch

### Z-Index Hierarchy
```
Marquee Banner: 1100 (highest)
Modal: 1050
Header: 100
Content: 1 (base)
```

### Performance
- CSS animation (GPU accelerated)
- No JavaScript required
- Lightweight và smooth

## Browser Support
- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers

## Future Enhancements
- [ ] Admin panel để thay đổi nội dung
- [ ] Multiple messages rotation
- [ ] Click to navigate to bundle products
- [ ] Close button (optional)
- [ ] Different colors for different campaigns

## Notes
- Banner được áp dụng cho TẤT CẢ các trang (cart, index, etc.)
- CSS được share qua cart.css
- Text được duplicate để tạo seamless loop
- Hover để pause giúp user đọc dễ hơn

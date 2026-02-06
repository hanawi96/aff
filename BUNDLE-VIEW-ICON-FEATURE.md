# Thêm Icon Con Mắt Để Xem Bó Dâu Tằm

## Tổng quan
Thêm icon con mắt ở cuối dòng "💡 Mẹo: Mua thêm bó dâu tằm để được miễn phí vận chuyển" để khách hàng có thể click và cuộn đến phần mua bó dâu tằm.

## Vị trí thực hiện

### 1. Trang giỏ hàng (cart.html)
- **Vị trí**: Phần "Mã giảm giá" → dòng discount-tip
- **Cuộn đến**: `bundleOfferSection` - Box "Ưu đãi đặc biệt"
- **Hành vi**: Cuộn lên phần bundle offer với hiệu ứng highlight

### 2. Modal mua ngay (index.html)
- **Vị trí**: Phần "Mã giảm giá" → dòng discount-tip
- **Cuộn đến**: `crossSellProducts` - Phần "Mua kèm - MIỄN PHÍ SHIP"
- **Hành vi**: Cuộn trong modal body đến phần cross-sell với hiệu ứng highlight

## Files đã chỉnh sửa

### 1. HTML Files

#### `public/shop/cart.html`
```html
<p class="discount-tip">
    💡 <strong>Mẹo:</strong> Mua thêm bó dâu tằm để được miễn phí vận chuyển
    <button class="btn-view-bundle" onclick="cart.scrollToBundleSection()" title="Xem bó dâu tằm" aria-label="Xem bó dâu tằm">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
            <path fill-rule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 0 1 0-1.113ZM17.25 12a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0Z" clip-rule="evenodd" />
        </svg>
    </button>
</p>
```

#### `public/shop/index.html`
```html
<p class="discount-tip">
    💡 <strong>Mẹo:</strong> Mua thêm bó dâu tằm để được miễn phí vận chuyển
    <button class="btn-view-bundle" onclick="quickCheckout.scrollToCrossSellSection()" title="Xem bó dâu tằm" aria-label="Xem bó dâu tằm">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
            <path fill-rule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 0 1 0-1.113ZM17.25 12a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0Z" clip-rule="evenodd" />
        </svg>
    </button>
</p>
```

### 2. JavaScript Files

#### `public/shop/cart.js`
Thêm function mới trong cart object:
```javascript
// Scroll to bundle section
scrollToBundleSection: () => {
    const bundleSection = document.getElementById('bundleOfferSection');
    if (bundleSection && !bundleSection.classList.contains('hidden')) {
        bundleSection.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center'
        });
        
        // Add highlight effect
        bundleSection.style.transition = 'all 0.3s ease';
        bundleSection.style.transform = 'scale(1.02)';
        bundleSection.style.boxShadow = '0 8px 30px rgba(244, 162, 97, 0.3)';
        
        setTimeout(() => {
            bundleSection.style.transform = 'scale(1)';
            bundleSection.style.boxShadow = '';
        }, 600);
    } else {
        utils.showToast('Phần bó dâu tằm chưa sẵn sàng', 'info');
    }
},
```

#### `public/shop/assets/js/features/checkout/quick-checkout.js`
Thêm method mới trong class QuickCheckout:
```javascript
/**
 * Scroll to cross-sell section
 */
scrollToCrossSellSection() {
    const crossSellContainer = document.getElementById('crossSellProducts');
    const modalBody = document.querySelector('.quick-checkout-body');
    
    if (crossSellContainer && modalBody) {
        // Scroll within modal body
        const containerTop = crossSellContainer.offsetTop;
        modalBody.scrollTo({
            top: containerTop - 20, // 20px offset for better visibility
            behavior: 'smooth'
        });
        
        // Add highlight effect
        crossSellContainer.style.transition = 'all 0.3s ease';
        crossSellContainer.style.transform = 'scale(1.02)';
        crossSellContainer.style.filter = 'brightness(1.05)';
        
        setTimeout(() => {
            crossSellContainer.style.transform = 'scale(1)';
            crossSellContainer.style.filter = '';
        }, 600);
    }
}
```

### 3. CSS File

#### `public/shop/cart.css`
```css
.discount-tip {
    margin-top: 0.875rem;
    padding: 0.625rem 0.875rem;
    background: linear-gradient(135deg, #fff5e6 0%, #ffe8cc 100%);
    border-left: 3px solid #f4a261;
    border-radius: 6px;
    font-size: 0.85rem;
    color: #5a4a3a;
    line-height: 1.5;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.discount-tip strong {
    color: #d97706;
    font-weight: 600;
}

.btn-view-bundle {
    background: none;
    border: none;
    padding: 0.25rem;
    cursor: pointer;
    color: var(--primary);
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    width: 1.75rem;
    height: 1.75rem;
    margin-left: auto;
    flex-shrink: 0;
}

.btn-view-bundle:hover {
    background: rgba(244, 162, 97, 0.15);
    color: var(--secondary);
    transform: scale(1.1);
}

.btn-view-bundle:active {
    transform: scale(0.95);
}

.btn-view-bundle svg {
    width: 1rem;
    height: 1rem;
}
```

## Tính năng

### 1. Icon con mắt
- Hiển thị ở cuối dòng discount-tip
- Nhỏ gọn, không chiếm nhiều không gian
- Có tooltip "Xem bó dâu tằm"
- Accessible với aria-label

### 2. Hành vi cuộn
- **Smooth scroll**: Cuộn mượt mà đến phần bundle/cross-sell
- **Highlight effect**: Phóng to nhẹ (scale 1.02) và thêm shadow/brightness
- **Auto reset**: Hiệu ứng tự động biến mất sau 600ms

### 3. Xử lý lỗi
- Kiểm tra element tồn tại trước khi cuộn
- Kiểm tra bundle section không bị hidden
- Hiển thị toast thông báo nếu chưa sẵn sàng

## UX Improvements

1. **Visual feedback**: Icon có hover effect rõ ràng
2. **Smooth animation**: Cuộn mượt mà, không giật lag
3. **Highlight**: Phần được cuộn đến có hiệu ứng nổi bật
4. **Responsive**: Icon tự động căn phải với margin-left: auto
5. **Accessibility**: Có title và aria-label cho screen readers

## Testing

### Test cases cần kiểm tra:
1. ✅ Click icon trong trang giỏ hàng → cuộn đến bundle section
2. ✅ Click icon trong modal mua ngay → cuộn đến cross-sell section
3. ✅ Hover icon → hiển thị background và scale effect
4. ✅ Bundle section hidden → hiển thị toast thông báo
5. ✅ Responsive trên mobile → icon vẫn hiển thị đúng
6. ✅ Highlight effect → tự động reset sau 600ms

## Notes

- CSS được share giữa trang giỏ hàng và modal (modal import cart.css)
- Icon sử dụng Heroicons eye icon
- Function cuộn khác nhau giữa trang và modal:
  - Trang: `scrollIntoView` trên element
  - Modal: `scrollTo` trong modal body

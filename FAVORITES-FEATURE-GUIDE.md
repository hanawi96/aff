# Product Favorites Feature Guide

## Database Schema

### Cột đã thêm vào bảng `products`
- `favorites_count` (INTEGER, DEFAULT 0) - Số lượt yêu thích của sản phẩm

## API Endpoints cần tạo

### 1. Tăng lượt yêu thích
```javascript
// POST /api/products/:id/favorite
async function addFavorite(productId) {
  const result = await fetch(`/api/products/${productId}/favorite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  
  const data = await result.json();
  return { favorites_count: data.favorites_count };
}
```

### 2. Giảm lượt yêu thích
```javascript
// DELETE /api/products/:id/favorite
async function removeFavorite(productId) {
  const result = await fetch(`/api/products/${productId}/favorite`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' }
  });
  
  const data = await result.json();
  return { favorites_count: data.favorites_count };
}
```

### 3. Lấy sản phẩm được yêu thích nhiều nhất
```javascript
// GET /api/products/most-favorited
async function getMostFavoritedProducts(limit = 10) {
  const result = await fetch(`/api/products/most-favorited?limit=${limit}`);
  const data = await result.json();
  return data.products;
}
```

## Frontend Implementation

### HTML Structure
```html
<div class="product-card" data-product-id="8">
  <h3>Vòng trơn buộc mối</h3>
  <p>26,000 VND</p>
  <div class="favorite-section">
    <button class="favorite-btn" onclick="toggleFavorite(8)">
      <i class="heart-icon">♡</i>
      <span class="favorite-count">0</span>
    </button>
  </div>
</div>
```

### JavaScript Functions
```javascript
async function toggleFavorite(productId) {
  const btn = document.querySelector(`[data-product-id="${productId}"] .favorite-btn`);
  const countSpan = btn.querySelector('.favorite-count');
  const heartIcon = btn.querySelector('.heart-icon');
  
  try {
    const isFavorited = heartIcon.textContent === '♥';
    const endpoint = isFavorited ? 'DELETE' : 'POST';
    
    const response = await fetch(`/api/products/${productId}/favorite`, {
      method: endpoint,
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    
    // Update UI
    countSpan.textContent = data.favorites_count;
    heartIcon.textContent = isFavorited ? '♡' : '♥';
    btn.classList.toggle('favorited', !isFavorited);
    
  } catch (error) {
    console.error('Error toggling favorite:', error);
  }
}

// Load favorites count on page load
async function loadFavoritesCount() {
  const productCards = document.querySelectorAll('.product-card');
  
  for (const card of productCards) {
    const productId = card.dataset.productId;
    try {
      const response = await fetch(`/api/products/${productId}`);
      const product = await response.json();
      
      const countSpan = card.querySelector('.favorite-count');
      countSpan.textContent = product.favorites_count || 0;
    } catch (error) {
      console.error(`Error loading favorites for product ${productId}:`, error);
    }
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', loadFavoritesCount);
```

### CSS Styling
```css
.favorite-btn {
  border: none;
  background: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 20px;
  transition: all 0.3s ease;
}

.favorite-btn:hover {
  background-color: #f0f0f0;
}

.favorite-btn.favorited {
  color: #e74c3c;
}

.heart-icon {
  font-size: 18px;
  transition: transform 0.2s ease;
}

.favorite-btn:active .heart-icon {
  transform: scale(1.2);
}

.favorite-count {
  font-size: 14px;
  font-weight: 500;
}
```

## Database Queries hữu ích

### Thống kê yêu thích
```sql
-- Top 10 sản phẩm được yêu thích nhất
SELECT name, favorites_count 
FROM products 
ORDER BY favorites_count DESC 
LIMIT 10;

-- Tổng số lượt yêu thích
SELECT SUM(favorites_count) as total_favorites 
FROM products;

-- Sản phẩm chưa có lượt yêu thích nào
SELECT COUNT(*) as products_without_favorites 
FROM products 
WHERE favorites_count = 0;
```

### Reset favorites (nếu cần)
```sql
-- Reset tất cả về 0
UPDATE products SET favorites_count = 0;

-- Reset sản phẩm cụ thể
UPDATE products SET favorites_count = 0 WHERE id = ?;
```

## Migration đã chạy
- ✅ Migration 060: Đã thêm cột `favorites_count` vào bảng `products`
- ✅ Tất cả 130 sản phẩm đã có giá trị mặc định `favorites_count = 0`

## Next Steps
1. Tạo API endpoints trong `src/services/products/product-service.js`
2. Thêm routes trong handler files
3. Implement frontend JavaScript
4. Test chức năng trên giao diện
5. Thêm analytics để theo dõi sản phẩm hot
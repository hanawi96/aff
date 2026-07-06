// ShopVD Order Helper - Content Script
// Inject sidebar vào trang pancake.vn

console.log('🚀 ShopVD Order Helper loaded');

// API Configuration
const API_BASE_URL = 'https://ctv-api.yendev96.workers.dev';

// Cache products
let allProductsCache = [];
let allCategoriesCache = [];
let featuredProducts = [];
let productsLoaded = false;
let currentProductTab = 'featured'; // 'featured' or 'all'
let selectedCategoryId = null;

// Cache address data
let addressData = [];
let provinceMap = new Map();
let wardMap = new Map();
let addressLoaded = false;

// Create sidebar HTML
function createSidebar() {
  const sidebar = document.createElement('div');
  sidebar.id = 'shopvd-sidebar';
  sidebar.innerHTML = `
    <div class="shopvd-sidebar-header">
      <h2>📦 Tạo đơn ShopVD</h2>
      <button id="shopvd-toggle" class="shopvd-btn-toggle" title="Thu gọn/Mở rộng">
        ◀
      </button>
    </div>
    
    <div class="shopvd-sidebar-content">
      <!-- Parse từ text được chọn -->
      <div class="shopvd-section">
        <button id="shopvd-parse-btn" class="shopvd-btn shopvd-btn-primary">
          ✨ Lấy thông tin từ text đã chọn
        </button>
        <p class="shopvd-hint">Bôi đen thông tin khách → Click nút trên</p>
      </div>

      <div class="shopvd-divider"></div>

      <!-- Form khách hàng -->
      <form id="shopvd-order-form">
        <div class="shopvd-section">
          <h3>👤 Thông tin khách hàng</h3>
          
          <div class="shopvd-grid-2">
            <div class="shopvd-form-group">
              <label>Tên khách hàng *</label>
              <input type="text" id="customer-name" placeholder="Nguyễn Văn A" required>
            </div>

            <div class="shopvd-form-group">
              <label>Số điện thoại *</label>
              <input type="tel" id="customer-phone" placeholder="0901234567" required>
            </div>
          </div>

          <div class="shopvd-form-group" style="margin-top: 12px;">
            <label>Địa chỉ giao hàng *</label>
            
            <!-- Province/City Dropdown -->
            <select id="customer-province" required>
              <option value="">-- Chọn Tỉnh/Thành phố --</option>
            </select>
            
            <!-- Ward/District Dropdown -->
            <select id="customer-ward" disabled required style="margin-top: 8px;">
              <option value="">-- Chọn Phường/Xã --</option>
            </select>
            
            <!-- Street Address -->
            <input 
              type="text" 
              id="customer-street" 
              placeholder="Số nhà, tên đường" 
              style="margin-top: 8px;"
            >
            
            <!-- Hidden full address -->
            <input type="hidden" id="customer-address">
          </div>
        </div>

        <!-- Sản phẩm -->
        <div class="shopvd-section">
          <h3>🛍️ Sản phẩm</h3>
          
          <!-- Search Products (Global) -->
          <div class="shopvd-product-search-container">
            <div class="shopvd-search-input-wrapper">
              <span class="shopvd-search-icon">🔍</span>
              <input 
                type="text" 
                id="product-search" 
                placeholder="Tìm sản phẩm hoặc thêm tay..."
                autocomplete="off"
              >
            </div>
            <div id="product-search-results" class="shopvd-search-results hidden"></div>
          </div>

          <!-- Product Tabs -->
          <div class="shopvd-product-tabs">
            <button 
              type="button"
              class="shopvd-product-tab active" 
              data-tab="featured"
            >
              🔥 Bán chạy
            </button>
            <button 
              type="button"
              class="shopvd-product-tab" 
              data-tab="all"
            >
              📦 Tất cả
            </button>
          </div>

          <!-- Featured Tab Content -->
          <div id="featured-tab-content" class="shopvd-tab-content active">
            <div id="featured-products-container" class="shopvd-featured-products hidden">
              <div id="featured-products-list"></div>
            </div>
          </div>

          <!-- All Products Tab Content -->
          <div id="all-tab-content" class="shopvd-tab-content hidden">
            <!-- Category Filter -->
            <div class="shopvd-category-filter">
              <select id="category-filter">
                <option value="">🏷️ Tất cả danh mục</option>
              </select>
            </div>
            <!-- All Products Grid -->
            <div id="all-products-grid" class="shopvd-all-products-grid">
              <!-- Products will be rendered here -->
            </div>
          </div>

          <!-- Selected Products List -->
          <div id="products-list" class="shopvd-products-list">
            <!-- Products will be added here -->
          </div>
          
          <!-- Manual Product Form (Collapsible) -->
          <div id="manual-product-form" class="shopvd-manual-form hidden">
            <div class="shopvd-manual-form-header">
              <span class="shopvd-manual-form-title">➕ Thêm sản phẩm tùy chỉnh</span>
              <button type="button" id="close-manual-form" class="shopvd-manual-form-close" title="Đóng">
                ✕
              </button>
            </div>
            <div class="shopvd-manual-form-body">
              <input type="text" id="manual-product-name" placeholder="Tên sản phẩm" class="shopvd-manual-input">
              <div class="shopvd-manual-row">
                <input type="number" id="manual-product-price" placeholder="Giá" min="0" step="1000" class="shopvd-manual-input">
                <input type="number" id="manual-product-quantity" placeholder="SL" min="1" value="1" class="shopvd-manual-input">
              </div>
              <input type="text" id="manual-product-weight" placeholder="Cân nặng (vd: 5kg)" class="shopvd-manual-input">
              <input type="text" id="manual-product-notes" placeholder="Lưu ý..." class="shopvd-manual-input">
              <button type="button" id="add-manual-product-submit" class="shopvd-btn shopvd-btn-success">
                ✅ Thêm vào đơn
              </button>
            </div>
          </div>
          
          <button type="button" id="add-manual-product-btn" class="shopvd-btn shopvd-btn-secondary">
            ➕ Thêm sản phẩm tùy chỉnh
          </button>
        </div>

        <!-- Thanh toán & Phí ship -->
        <div class="shopvd-section">
          <h3>💰 Thanh toán</h3>
          
          <!-- Payment Method Buttons -->
          <div class="shopvd-form-group">
            <label>Phương thức thanh toán</label>
            <div class="shopvd-button-group">
              <button type="button" class="shopvd-payment-btn active" data-payment="cod">
                💵 COD
              </button>
              <button type="button" class="shopvd-payment-btn" data-payment="bank_transfer">
                ✅ Đã CK
              </button>
              <button type="button" class="shopvd-payment-btn" data-payment="deposit">
                💰 Cọc trước
              </button>
            </div>
            <input type="hidden" id="payment-method" value="cod">
          </div>
          
          <!-- Deposit Amount (Hidden by default) -->
          <div class="shopvd-form-group hidden" id="deposit-amount-wrapper">
            <label>Số tiền cọc</label>
            <input type="number" id="deposit-amount" value="0" min="0" step="1000" placeholder="0">
            <small style="color: #64748b; font-size: 11px;">Khách đã cọc — COD chỉ thu phần còn lại</small>
          </div>
          
          <!-- Phí ship & Miễn phí -->
          <div class="shopvd-grid-2">
            <div class="shopvd-form-group">
              <label>PHÍ SHIP (KHÁCH TRẢ)</label>
              <input type="number" id="shipping-fee" value="0" min="0" step="1000">
              <small style="color: #64748b; font-size: 11px;">Số tiền khách thanh toán</small>
            </div>

            <div class="shopvd-form-group">
              <label>CHI PHÍ SHIP (COST)</label>
              <input type="number" id="shipping-cost" value="0" min="0" step="1000">
              <small style="color: #64748b; font-size: 11px;">Chi phí trả đơn vị vận chuyển</small>
            </div>
          </div>
          
          <!-- Free Shipping Checkbox -->
          <div class="shopvd-form-group">
            <label class="shopvd-checkbox-label-simple">
              <input type="checkbox" id="free-shipping">
              <span>Miễn phí ship</span>
            </label>
          </div>

          <div class="shopvd-total">
            <strong>Tổng cộng:</strong>
            <span id="total-amount">0đ</span>
          </div>
        </div>

        <!-- Nguồn khách & Thông tin thêm -->
        <div class="shopvd-section">
          <h3>📋 Thông tin thêm</h3>
          
          <!-- Customer Source Buttons (Required) -->
          <div class="shopvd-form-group">
            <label>Nguồn khách <span style="color: #ef4444;">*</span></label>
            <div class="shopvd-button-group">
              <button type="button" class="shopvd-source-btn" data-source="zalo">
                <span style="color: #0068ff;">●</span> Zalo
              </button>
              <button type="button" class="shopvd-source-btn" data-source="facebook">
                <span style="color: #1877f2;">f</span> Facebook
              </button>
              <button type="button" class="shopvd-source-btn" data-source="tiktok">
                <span style="color: #000;">♪</span> TikTok
              </button>
            </div>
            <input type="hidden" id="customer-source" value="">
          </div>
          
          <div class="shopvd-grid-2">
            <div class="shopvd-form-group">
              <label>Mã CTV</label>
              <input type="text" id="referral-code" placeholder="Mã cộng tác viên">
            </div>

            <div class="shopvd-form-group">
              <label>Mã giảm giá</label>
              <input type="text" id="discount-code" placeholder="GIAMGIA20">
            </div>

            <div class="shopvd-form-group shopvd-col-full">
              <label>Số tiền giảm (đ)</label>
              <input type="number" id="discount-amount" value="0" min="0" step="1000">
            </div>
          </div>
          
          <!-- Priority Order (Yellow Background) -->
          <div class="shopvd-priority-box">
            <label class="shopvd-checkbox-label-special">
              <input type="checkbox" id="is-priority">
              <span>⭐ Đánh dấu đơn ưu tiên</span>
            </label>
            <p class="shopvd-hint">Đơn ưu tiên sẽ hiển thị đầu tiên trong danh sách</p>
          </div>

          <!-- Send Later (Blue Background) -->
          <div class="shopvd-sendlater-box">
            <label class="shopvd-checkbox-label-special">
              <input type="checkbox" id="send-later">
              <span>🕐 Gửi sau</span>
            </label>
            <p class="shopvd-hint">Đơn vào trạng thái «Gửi sau», có ngày dự kiến gửi — chưa tính là đã gửi hàng.</p>
          </div>

          <div id="send-later-fields" class="shopvd-form-group hidden" style="margin-top: 12px;">
            <label>Ngày giờ dự kiến gửi</label>
            <input type="datetime-local" id="planned-send-time">
          </div>
        </div>

        <!-- Ghi chú -->
        <div class="shopvd-section">
          <div class="shopvd-form-group">
            <label>📝 Ghi chú đơn hàng</label>
            <textarea id="order-notes" placeholder="Ghi chú thêm..." rows="2"></textarea>
          </div>
        </div>

        <!-- Submit -->
        <div class="shopvd-section">
          <button type="submit" id="create-order-btn" class="shopvd-btn shopvd-btn-success">
            🚀 Tạo đơn hàng
          </button>
        </div>
      </form>

      <!-- Status message -->
      <div id="shopvd-status" class="shopvd-status hidden"></div>
    </div>
  `;

  document.body.appendChild(sidebar);
  return sidebar;
}

// Initialize products list with one default product
let productsData = [];

// Load products from API
async function loadProducts() {
  if (productsLoaded) return;
  
  try {
    showStatus('⏳ Đang tải danh sách sản phẩm...', 'info');
    
    // Load products and categories in parallel
    const [productsRes, categoriesRes] = await Promise.all([
      fetch(`${API_BASE_URL}?action=getAllProducts`),
      fetch(`${API_BASE_URL}?action=getAllCategories`)
    ]);
    
    const productsData = await productsRes.json();
    const categoriesData = await categoriesRes.json();
    
    if (productsData.success && Array.isArray(productsData.products)) {
      allProductsCache = productsData.products;
      productsLoaded = true;
      
      // Get featured/hot products from API (already sorted by purchases DESC)
      // Backend sorts: ORDER BY p.purchases DESC, p.name ASC
      // So top products = best selling products
      featuredProducts = [...allProductsCache]
        .filter(p => (p.is_active === 1 || p.is_active === true))
        .slice(0, 6);  // Take top 6 best-selling products
      
      console.log('✅ Featured products (hot selling):', featuredProducts.map(p => ({
        name: p.name,
        purchases: p.purchases,
        is_featured: p.is_featured
      })));
      
      // Load categories
      if (categoriesData.success && Array.isArray(categoriesData.categories)) {
        allCategoriesCache = categoriesData.categories;
        renderCategoryFilter();
      }
      
      renderFeaturedProducts();
      showStatus('✅ Đã tải ' + allProductsCache.length + ' sản phẩm!', 'success');
      
      setTimeout(() => {
        const statusEl = document.getElementById('shopvd-status');
        if (statusEl) statusEl.classList.add('hidden');
      }, 2000);
    } else {
      throw new Error('Invalid response format');
    }
  } catch (error) {
    console.error('Error loading products:', error);
    showStatus('⚠️ Không thể tải sản phẩm. Bạn có thể thêm tay.', 'warning');
    productsLoaded = false;
  }
}

// Load address data from tree_2.json
async function loadAddressData() {
  if (addressLoaded) return;
  
  try {
    const response = await fetch('https://shopvd.store/assets/data/tree_2.json');
    const raw = await response.json();
    
    addressData = [];
    
    for (const province of raw) {
      const provinceObj = {
        Id: province.code,
        Name: province.fullName,
        Wards: []
      };
      
      provinceMap.set(province.code, provinceObj);
      
      if (province.wards) {
        for (const ward of province.wards) {
          const shortLabel = ward.fullName.includes(',')
            ? ward.fullName.split(',')[0].trim()
            : ward.fullName;
          const wardObj = {
            Id: ward.code,
            Name: shortLabel,
            ShortName: ward.name,
            Level: ward.type
          };
          
          provinceObj.Wards.push(wardObj);
          
          const wardKey = `${province.code}-${ward.code}`;
          wardMap.set(wardKey, wardObj);
        }
      }
      
      addressData.push(provinceObj);
    }
    
    // Sort: HCM, Hà Nội first
    addressData.sort((a, b) => {
      const pri = (id) => id === '79' ? 0 : id === '01' ? 1 : 2;
      const pa = pri(a.Id), pb = pri(b.Id);
      if (pa !== pb) return pa - pb;
      return a.Name.localeCompare(b.Name, 'vi', { sensitivity: 'base' });
    });
    
    addressLoaded = true;
    console.log('✅ Loaded address data:', {
      provinces: addressData.length,
      wards: wardMap.size
    });
    
    // Render provinces
    renderProvinces();
  } catch (error) {
    console.error('Error loading address data:', error);
    showStatus('⚠️ Không thể tải danh sách địa chỉ', 'warning');
  }
}

// Render provinces dropdown
function renderProvinces() {
  const select = document.getElementById('customer-province');
  if (!select) return;
  
  const optionsHtml = addressData.map(province => 
    `<option value="${province.Id}">${escapeHtml(province.Name)}</option>`
  ).join('');
  
  select.innerHTML = '<option value="">-- Chọn Tỉnh/Thành phố --</option>' + optionsHtml;
}

// Render wards dropdown
function renderWards(provinceId) {
  const select = document.getElementById('customer-ward');
  if (!select) return;
  
  select.innerHTML = '<option value="">-- Chọn Phường/Xã --</option>';
  select.disabled = false;
  
  if (!provinceId) {
    select.disabled = true;
    return;
  }
  
  const province = provinceMap.get(provinceId);
  if (province) {
    const sorted = [...province.Wards].sort((a, b) =>
      a.Name.localeCompare(b.Name, 'vi', { sensitivity: 'base' })
    );
    
    const optionsHtml = sorted.map(ward =>
      `<option value="${ward.Id}">${escapeHtml(ward.Name)}</option>`
    ).join('');
    
    select.innerHTML = '<option value="">-- Chọn Phường/Xã --</option>' + optionsHtml;
  }
}

// Update full address when province/ward/street changes
function updateFullAddress() {
  const provinceSelect = document.getElementById('customer-province');
  const wardSelect = document.getElementById('customer-ward');
  const streetInput = document.getElementById('customer-street');
  const addressInput = document.getElementById('customer-address');
  
  if (!provinceSelect || !wardSelect || !streetInput || !addressInput) return;
  
  const provinceId = provinceSelect.value;
  const wardId = wardSelect.value;
  const street = streetInput.value.trim();
  
  if (!provinceId || !wardId) {
    addressInput.value = '';
    return;
  }
  
  const province = provinceMap.get(provinceId);
  const wardKey = `${provinceId}-${wardId}`;
  const ward = wardMap.get(wardKey);
  
  const parts = [];
  if (street) parts.push(street);
  if (ward) parts.push(ward.Name);
  if (province) parts.push(province.Name);
  
  addressInput.value = parts.join(', ');
}

// Render category filter
function renderCategoryFilter() {
  const select = document.getElementById('category-filter');
  if (!select || allCategoriesCache.length === 0) return;
  
  const optionsHtml = allCategoriesCache.map(cat => 
    `<option value="${cat.id}">${escapeHtml(cat.name)}</option>`
  ).join('');
  
  select.innerHTML = '<option value="">🏷️ Tất cả danh mục</option>' + optionsHtml;
}

// Switch product tab
function switchProductTab(tab) {
  console.log('Switching to tab:', tab);
  currentProductTab = tab;
  
  // Update tab buttons
  document.querySelectorAll('.shopvd-product-tab').forEach(btn => {
    if (btn.dataset.tab === tab) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Update tab content
  const featuredContent = document.getElementById('featured-tab-content');
  const allContent = document.getElementById('all-tab-content');
  
  console.log('Featured content:', featuredContent);
  console.log('All content:', allContent);
  
  if (tab === 'featured') {
    featuredContent?.classList.add('active');
    featuredContent?.classList.remove('hidden');
    allContent?.classList.remove('active');
    allContent?.classList.add('hidden');
  } else {
    featuredContent?.classList.remove('active');
    featuredContent?.classList.add('hidden');
    allContent?.classList.add('active');
    allContent?.classList.remove('hidden');
    
    console.log('Products cache length:', allProductsCache.length);
    
    // Render all products on first view
    if (allProductsCache.length > 0) {
      renderAllProducts();
    } else {
      // Show loading or empty state
      const grid = document.getElementById('all-products-grid');
      if (grid) {
        grid.innerHTML = '<div class="shopvd-empty-products">Đang tải sản phẩm...</div>';
      }
    }
  }
}

// Filter products by category
function filterByCategory(categoryId) {
  selectedCategoryId = categoryId ? parseInt(categoryId) : null;
  renderAllProducts();
}

// Render all products grid
function renderAllProducts() {
  const grid = document.getElementById('all-products-grid');
  
  console.log('renderAllProducts called');
  console.log('Grid element:', grid);
  console.log('Products cache:', allProductsCache.length);
  
  if (!grid) {
    console.error('Grid element not found!');
    return;
  }
  
  if (allProductsCache.length === 0) {
    grid.innerHTML = '<div class="shopvd-empty-products">Chưa có sản phẩm. Đang tải...</div>';
    return;
  }
  
  let products = allProductsCache;
  
  // Filter by category if selected
  if (selectedCategoryId) {
    products = products.filter(p => {
      // Check if product has this category
      if (p.category_id === selectedCategoryId) return true;
      if (Array.isArray(p.categories)) {
        return p.categories.some(c => c.id === selectedCategoryId || c === selectedCategoryId);
      }
      return false;
    });
  }
  
  console.log('Filtered products:', products.length);
  
  if (products.length === 0) {
    grid.innerHTML = '<div class="shopvd-empty-products">Không có sản phẩm nào trong danh mục này</div>';
    return;
  }
  
  // Compact list view with inline inputs when checked
  grid.innerHTML = products.map(product => {
    const purchases = parseInt(product.purchases) || 0;
    return `
    <div class="shopvd-product-list-wrapper" data-product-id="${product.id}">
      <div class="shopvd-product-list-item">
        <input 
          type="checkbox" 
          class="shopvd-product-checkbox" 
          data-product-id="${product.id}"
          data-product-name="${escapeHtml(product.name)}"
          data-product-price="${product.price}"
          data-product-cost="${product.cost_price || 0}"
          data-product-image="${escapeHtml(product.image_url || '')}"
        >
        <div class="shopvd-product-list-content">
          ${product.image_url ? `
            <img 
              src="${escapeHtml(product.image_url)}" 
              alt="${escapeHtml(product.name)}"
              class="shopvd-list-product-thumb"
              onerror="this.style.display='none'"
            >
          ` : '<div class="shopvd-list-product-thumb-placeholder">📦</div>'}
          <div class="shopvd-list-product-info">
            <div class="shopvd-list-product-name">${escapeHtml(product.name)}</div>
            <div class="shopvd-list-product-meta">
              <span class="shopvd-list-product-price">${formatPrice(product.price)} đ</span>
              ${purchases > 0 ? `<span class="shopvd-list-product-sold">• ${purchases} lượt bán</span>` : ''}
            </div>
          </div>
        </div>
      </div>
      
      <!-- Inline form (hidden by default, shown when checked) -->
      <div class="shopvd-inline-form hidden" data-form-id="${product.id}">
        <div class="shopvd-inline-row">
          <div class="shopvd-inline-field">
            <label>SL</label>
            <input 
              type="number" 
              class="shopvd-inline-qty" 
              value="1" 
              min="1"
              data-product-id="${product.id}"
            >
          </div>
          <div class="shopvd-inline-field flex-1">
            <label>Cân nặng</label>
            <input 
              type="text" 
              class="shopvd-inline-weight" 
              placeholder="5kg"
              data-product-id="${product.id}"
            >
          </div>
        </div>
        <div class="shopvd-inline-row">
          <div class="shopvd-inline-field full-width">
            <label>Lưu ý</label>
            <input 
              type="text" 
              class="shopvd-inline-notes" 
              placeholder="Ghi chú cho sản phẩm này..."
              data-product-id="${product.id}"
            >
          </div>
        </div>
      </div>
    </div>
  `}).join('');
  
  // Add floating action button
  const fabContainer = document.createElement('div');
  fabContainer.id = 'fab-container';
  fabContainer.className = 'shopvd-fab-container hidden';
  fabContainer.innerHTML = `
    <button type="button" class="shopvd-fab" id="bulk-add-fab">
      <span class="shopvd-fab-icon">✓</span>
      <span class="shopvd-fab-text">Thêm <strong id="fab-count">0</strong> SP</span>
    </button>
  `;
  
  // Insert FAB after grid
  const gridParent = grid.parentElement;
  const existingFab = document.getElementById('fab-container');
  if (existingFab) {
    existingFab.remove();
  }
  gridParent.insertBefore(fabContainer, grid.nextSibling);
  
  // Attach checkbox event listeners
  document.querySelectorAll('.shopvd-product-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', handleProductSelection);
  });
  
  // Attach FAB event listener
  document.getElementById('bulk-add-fab')?.addEventListener('click', handleBulkAdd);
  
  console.log('Products rendered successfully');
}

// Handle product checkbox selection
function handleProductSelection(e) {
  const checkbox = e.target;
  const productId = checkbox.getAttribute('data-product-id');
  const inlineForm = document.querySelector(`[data-form-id="${productId}"]`);
  
  if (checkbox.checked) {
    inlineForm?.classList.remove('hidden');
  } else {
    inlineForm?.classList.add('hidden');
  }
  
  // Update FAB
  updateFAB();
}

// Update floating action button
function updateFAB() {
  const checkboxes = document.querySelectorAll('.shopvd-product-checkbox:checked');
  const count = checkboxes.length;
  const fab = document.getElementById('fab-container');
  
  if (count > 0) {
    fab?.classList.remove('hidden');
    document.getElementById('fab-count').textContent = count;
  } else {
    fab?.classList.add('hidden');
  }
}

// Handle bulk add
function handleBulkAdd() {
  const checkboxes = document.querySelectorAll('.shopvd-product-checkbox:checked');
  
  if (checkboxes.length === 0) {
    showStatus('⚠️ Vui lòng chọn ít nhất 1 sản phẩm!', 'warning');
    return;
  }
  
  let addedCount = 0;
  
  checkboxes.forEach(checkbox => {
    const productId = checkbox.getAttribute('data-product-id');
    const productName = checkbox.getAttribute('data-product-name');
    const productPrice = parseFloat(checkbox.getAttribute('data-product-price'));
    const productCost = parseFloat(checkbox.getAttribute('data-product-cost')) || 0;
    const productImage = checkbox.getAttribute('data-product-image');
    
    // Get inline form values
    const qtyInput = document.querySelector(`.shopvd-inline-qty[data-product-id="${productId}"]`);
    const weightInput = document.querySelector(`.shopvd-inline-weight[data-product-id="${productId}"]`);
    const notesInput = document.querySelector(`.shopvd-inline-notes[data-product-id="${productId}"]`);
    
    const quantity = parseInt(qtyInput?.value) || 1;
    const weight = weightInput?.value.trim() || '';
    const notes = notesInput?.value.trim() || '';
    
    // Add product
    addProductRow(
      productName,
      productPrice,
      quantity,
      parseInt(productId),
      productCost,
      productImage,
      weight,
      notes
    );
    
    // Reset form
    checkbox.checked = false;
    if (qtyInput) qtyInput.value = '1';
    if (weightInput) weightInput.value = '';
    if (notesInput) notesInput.value = '';
    
    const inlineForm = document.querySelector(`[data-form-id="${productId}"]`);
    inlineForm?.classList.add('hidden');
    
    addedCount++;
  });
  
  // Update FAB
  updateFAB();
  
  // Show success message
  showStatus(`✅ Đã thêm ${addedCount} sản phẩm!`, 'success');
  setTimeout(() => {
    const statusEl = document.getElementById('shopvd-status');
    if (statusEl) statusEl.classList.add('hidden');
  }, 2000);
}

// Render featured products (Hot selling products)
function renderFeaturedProducts() {
  const container = document.getElementById('featured-products-container');
  const list = document.getElementById('featured-products-list');
  
  if (!container || !list || featuredProducts.length === 0) return;
  
  container.classList.remove('hidden');
  
  list.innerHTML = featuredProducts.map(product => `
    <div class="shopvd-hot-product-card" data-product-id="${product.id}">
      <div class="shopvd-hot-product-header">
        <h4 class="shopvd-hot-product-name">${escapeHtml(product.name)}</h4>
        <div class="shopvd-hot-product-meta">
          <span class="shopvd-hot-product-price">${formatPrice(product.price)} đ</span>
          <span class="shopvd-hot-product-sold">• Lượt bán: ${parseInt(product.purchases) || 0}</span>
        </div>
      </div>
      
      <div class="shopvd-hot-product-body">
        <input 
          type="text" 
          class="shopvd-hot-size-input" 
          placeholder="Size/Cân nặng (vd: 5kg)"
          data-field="size"
        >
        
        <div class="shopvd-hot-quantity">
          <button type="button" class="shopvd-hot-qty-btn" data-action="decrease">−</button>
          <input type="number" class="shopvd-hot-qty-input" value="1" min="1" data-field="quantity">
          <button type="button" class="shopvd-hot-qty-btn" data-action="increase">+</button>
          <button type="button" class="shopvd-hot-add-btn" data-action="add">Thêm</button>
        </div>
        
        <div class="shopvd-hot-weight-buttons">
          <button type="button" class="shopvd-hot-weight-btn" data-weight="">chưa có</button>
          ${[3,4,5,6,7,8,9,10,11,12,13,14,15].map(kg => 
            `<button type="button" class="shopvd-hot-weight-btn" data-weight="${kg}kg">${kg}kg</button>`
          ).join('')}
        </div>
      </div>
    </div>
  `).join('');
  
  // Attach event listeners for each product card
  list.querySelectorAll('.shopvd-hot-product-card').forEach(card => {
    const productId = parseInt(card.getAttribute('data-product-id'));
    const product = featuredProducts.find(p => p.id === productId);
    if (!product) return;
    
    const sizeInput = card.querySelector('[data-field="size"]');
    const qtyInput = card.querySelector('[data-field="quantity"]');
    
    // Weight buttons - click to quickly fill input
    card.querySelectorAll('.shopvd-hot-weight-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const weight = btn.getAttribute('data-weight');
        sizeInput.value = weight;
      });
    });
    
    // Quantity controls
    card.querySelector('[data-action="decrease"]')?.addEventListener('click', () => {
      const current = parseInt(qtyInput.value) || 1;
      if (current > 1) qtyInput.value = current - 1;
    });
    
    card.querySelector('[data-action="increase"]')?.addEventListener('click', () => {
      const current = parseInt(qtyInput.value) || 1;
      qtyInput.value = current + 1;
    });
    
    // Add button
    card.querySelector('[data-action="add"]')?.addEventListener('click', () => {
      const quantity = parseInt(qtyInput.value) || 1;
      const sizeOrWeight = sizeInput.value.trim();
      
      // Add product with details
      addProductRow(
        product.name,
        product.price,
        quantity,
        product.id,
        product.cost_price || 0,
        product.image_url || '',
        sizeOrWeight,
        ''
      );
      
      // Reset inputs
      qtyInput.value = 1;
      sizeInput.value = '';
      
      showStatus(`✅ Đã thêm: ${product.name}`, 'success');
      setTimeout(() => {
        const statusEl = document.getElementById('shopvd-status');
        if (statusEl) statusEl.classList.add('hidden');
      }, 2000);
    });
  });
}

// Search products with debounce
let searchTimeout;
function handleProductSearch(query) {
  clearTimeout(searchTimeout);
  
  const resultsDiv = document.getElementById('product-search-results');
  if (!resultsDiv) return;
  
  if (!query || query.trim().length < 2) {
    resultsDiv.classList.add('hidden');
    return;
  }
  
  searchTimeout = setTimeout(() => {
    const results = searchProducts(query);
    renderSearchResults(results);
  }, 300);
}

// Search products by name
function searchProducts(query) {
  if (!allProductsCache || allProductsCache.length === 0) return [];
  
  const q = query.toLowerCase().trim();
  return allProductsCache
    .filter(p => {
      const name = (p.name || '').toLowerCase();
      return name.includes(q);
    })
    .slice(0, 10); // Limit 10 results
}

// Render search results dropdown
function renderSearchResults(results) {
  const resultsDiv = document.getElementById('product-search-results');
  if (!resultsDiv) return;
  
  if (results.length === 0) {
    resultsDiv.innerHTML = '<div class="shopvd-search-empty">Không tìm thấy sản phẩm</div>';
    resultsDiv.classList.remove('hidden');
    return;
  }
  
  resultsDiv.innerHTML = results.map(product => `
    <div 
      class="shopvd-search-result-item"
      data-product-id="${product.id}"
    >
      ${product.image_url ? `
        <img 
          src="${escapeHtml(product.image_url)}" 
          alt="${escapeHtml(product.name)}"
          class="shopvd-search-result-image"
          onerror="this.style.display='none'"
        >
      ` : ''}
      <div class="shopvd-search-result-info">
        <div class="shopvd-search-result-name">${escapeHtml(product.name)}</div>
        <div class="shopvd-search-result-price">${formatPrice(product.price)}đ</div>
      </div>
      <span class="shopvd-search-result-add">+</span>
    </div>
  `).join('');
  
  // Attach event listeners
  resultsDiv.querySelectorAll('.shopvd-search-result-item').forEach(item => {
    item.addEventListener('click', () => {
      const productId = parseInt(item.getAttribute('data-product-id'));
      addProductById(productId);
      resultsDiv.classList.add('hidden');
    });
  });
  
  resultsDiv.classList.remove('hidden');
}

// Add product by ID (from search or featured)
function addProductById(productId) {
  const product = allProductsCache.find(p => p.id === productId);
  if (!product) return;
  
  addProductRow(
    product.name,
    product.price,
    1,
    product.id,
    product.cost_price || 0,
    product.image_url || ''
  );
  
  // Clear search
  const searchInput = document.getElementById('product-search');
  const resultsDiv = document.getElementById('product-search-results');
  if (searchInput) searchInput.value = '';
  if (resultsDiv) resultsDiv.classList.add('hidden');
  
  showStatus(`✅ Đã thêm: ${product.name}`, 'success');
  setTimeout(() => {
    const statusEl = document.getElementById('shopvd-status');
    if (statusEl) statusEl.classList.add('hidden');
  }, 2000);
}

// Helper: Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Helper: Format price
function formatPrice(price) {
  return parseInt(price || 0).toLocaleString('vi-VN');
}

// Add product row (updated signature)
function addProductRow(name = '', price = '', quantity = 1, productId = null, costPrice = 0, imageUrl = '', weight = '', notes = '') {
  const id = Date.now() + Math.floor(Math.random() * 1000);
  productsData.push({ 
    id, 
    name, 
    price, 
    quantity,
    product_id: productId,
    cost_price: costPrice,
    image_url: imageUrl,
    weight: weight,
    notes: notes
  });
  renderProducts();
  calculateTotal();
}

function removeProduct(productId) {
  const beforeCount = productsData.length;
  productsData = productsData.filter(p => p.id !== productId);
  const afterCount = productsData.length;
  
  renderProducts();
  calculateTotal();
  
  // Show feedback
  if (afterCount < beforeCount) {
    showStatus('✅ Đã xóa sản phẩm', 'success');
    setTimeout(() => {
      const statusEl = document.getElementById('shopvd-status');
      if (statusEl) statusEl.classList.add('hidden');
    }, 1500);
  }
}

function updateProduct(productId, field, value) {
  const product = productsData.find(p => p.id === productId);
  if (product) {
    product[field] = value;
    calculateTotal();
  }
}

function renderProducts() {
  const container = document.getElementById('products-list');
  if (!container) return;

  if (productsData.length === 0) {
    container.innerHTML = '<p class="shopvd-empty-products">Chưa có sản phẩm nào. Tìm hoặc thêm tay.</p>';
    return;
  }

  container.innerHTML = productsData.map((product, index) => {
    const totalPrice = parseInt(product.price || 0) * parseInt(product.quantity || 1);
    
    return `
    <div class="shopvd-product-item" data-product-id="${product.id}">
      <div class="shopvd-product-main">
        <span class="shopvd-product-qty-badge">×${product.quantity}</span>
        <div class="shopvd-product-info">
          <h4 class="shopvd-product-title">${escapeHtml(product.name)}</h4>
          <div class="shopvd-product-meta">
            ${product.weight ? `<span class="shopvd-meta-item">● ${escapeHtml(product.weight)}</span>` : ''}
            <span class="shopvd-meta-item">💰 Đơn giá: <strong>${formatPrice(product.price)} đ</strong></span>
          </div>
          ${product.notes ? `<div class="shopvd-product-notes">📝 ${escapeHtml(product.notes)}</div>` : ''}
        </div>
        <div class="shopvd-product-actions">
          <button type="button" class="shopvd-action-btn shopvd-action-edit" data-action="edit" title="Sửa">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button type="button" class="shopvd-action-btn shopvd-action-delete" data-action="remove" title="Xóa">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
        <div class="shopvd-product-total">${formatPrice(totalPrice)} đ</div>
      </div>
      
      <!-- Edit Form (Hidden by default) -->
      <div class="shopvd-product-edit-form hidden" data-edit-form="${product.id}">
        <input type="text" placeholder="Tên sản phẩm" value="${escapeHtml(product.name)}" data-field="name" class="shopvd-edit-input">
        <div class="shopvd-edit-row">
          <input type="number" placeholder="Giá" value="${product.price}" data-field="price" min="0" step="1000" class="shopvd-edit-input">
          <input type="number" placeholder="SL" value="${product.quantity}" data-field="quantity" min="1" class="shopvd-edit-input">
        </div>
        <input type="text" placeholder="Cân nặng (vd: 5kg)" value="${escapeHtml(product.weight || '')}" data-field="weight" class="shopvd-edit-input">
        <input type="text" placeholder="Lưu ý..." value="${escapeHtml(product.notes || '')}" data-field="notes" class="shopvd-edit-input">
        <div class="shopvd-edit-actions">
          <button type="button" class="shopvd-btn-save" data-action="save">💾 Lưu</button>
          <button type="button" class="shopvd-btn-cancel" data-action="cancel">✕ Hủy</button>
        </div>
      </div>
    </div>
  `}).join('');
  
  // Attach event listeners
  container.querySelectorAll('.shopvd-product-item').forEach(row => {
    const productId = parseInt(row.getAttribute('data-product-id'));
    
    if (isNaN(productId)) {
      console.error('❌ Invalid product ID:', row.getAttribute('data-product-id'));
      return;
    }
    
    // Edit button
    const editBtn = row.querySelector('[data-action="edit"]');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Show edit form
        const editForm = row.querySelector(`[data-edit-form="${productId}"]`);
        const mainView = row.querySelector('.shopvd-product-main');
        if (editForm && mainView) {
          mainView.style.display = 'none';
          editForm.classList.remove('hidden');
          // Focus first input
          editForm.querySelector('input')?.focus();
        }
      });
    }
    
    // Remove button
    const removeBtn = row.querySelector('[data-action="remove"]');
    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeProduct(productId);
      });
    }
    
    // Save button
    const saveBtn = row.querySelector('[data-action="save"]');
    if (saveBtn) {
      saveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const editForm = row.querySelector(`[data-edit-form="${productId}"]`);
        const product = productsData.find(p => p.id === productId);
        
        if (editForm && product) {
          // Update product data
          editForm.querySelectorAll('input[data-field]').forEach(input => {
            const field = input.getAttribute('data-field');
            product[field] = input.value;
          });
          
          // Re-render and recalculate
          renderProducts();
          calculateTotal();
          
          showStatus('✅ Đã lưu thay đổi!', 'success');
          setTimeout(() => {
            const statusEl = document.getElementById('shopvd-status');
            if (statusEl) statusEl.classList.add('hidden');
          }, 1500);
        }
      });
    }
    
    // Cancel button
    const cancelBtn = row.querySelector('[data-action="cancel"]');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const editForm = row.querySelector(`[data-edit-form="${productId}"]`);
        const mainView = row.querySelector('.shopvd-product-main');
        if (editForm && mainView) {
          editForm.classList.add('hidden');
          mainView.style.display = 'flex';
        }
      });
    }
  });
}

// Calculate total amount
function calculateTotal() {
  const shippingFee = parseInt(document.getElementById('shipping-fee')?.value || 0);
  const discountAmount = parseInt(document.getElementById('discount-amount')?.value || 0);
  const productsTotal = productsData.reduce((sum, p) => {
    return sum + (parseInt(p.price || 0) * parseInt(p.quantity || 1));
  }, 0);
  
  const total = Math.max(0, productsTotal + shippingFee - discountAmount);
  const totalElement = document.getElementById('total-amount');
  if (totalElement) {
    totalElement.textContent = total.toLocaleString('vi-VN') + 'đ';
  }
}

// Parse customer info from selected text
function parseCustomerInfo(text) {
  if (!text || !text.trim()) {
    return null;
  }

  const info = {
    name: '',
    phone: '',
    address: ''
  };

  // Parse phone number (Vietnamese format)
  const phoneRegex = /(?:0|\+84)[0-9]{9,10}/g;
  const phones = text.match(phoneRegex);
  if (phones && phones.length > 0) {
    info.phone = phones[0].replace(/\+84/, '0').replace(/\s/g, '');
  }

  // Parse name (lines with "Tên:", "Họ tên:", etc.)
  const nameRegex = /(?:tên|họ tên|name)[\s:：]*([^\n\r]+)/gi;
  const nameMatch = text.match(nameRegex);
  if (nameMatch && nameMatch.length > 0) {
    info.name = nameMatch[0].replace(/(?:tên|họ tên|name)[\s:：]*/gi, '').trim();
  }

  // Parse address (lines with "Địa chỉ:", "DC:", "Address:", etc.)
  const addressRegex = /(?:địa chỉ|dc|đ\/c|address|addr)[\s:：]*([^\n\r]+(?:\n[^\n\r]+)*?)(?=\n(?:tên|sđt|phone|$))/gi;
  const addressMatch = text.match(addressRegex);
  if (addressMatch && addressMatch.length > 0) {
    info.address = addressMatch[0].replace(/(?:địa chỉ|dc|đ\/c|address|addr)[\s:：]*/gi, '').trim();
  } else {
    // If no explicit address marker, try to find address-like text
    const lines = text.split(/\n/).filter(l => l.trim());
    for (const line of lines) {
      if (line.length > 20 && !phoneRegex.test(line) && 
          (line.includes('Quận') || line.includes('Huyện') || 
           line.includes('Phường') || line.includes('Xã') ||
           line.includes('Tỉnh') || line.includes('TP'))) {
        info.address = line.trim();
        break;
      }
    }
  }

  // If name not found with marker, try first line
  if (!info.name && text.trim()) {
    const lines = text.trim().split(/\n/).filter(l => l.trim());
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      if (firstLine.length > 3 && firstLine.length < 50 && !phoneRegex.test(firstLine)) {
        info.name = firstLine;
      }
    }
  }

  return info;
}

// Fill form with parsed info
function fillFormWithParsedInfo(info) {
  if (info.name) {
    document.getElementById('customer-name').value = info.name;
  }
  if (info.phone) {
    document.getElementById('customer-phone').value = info.phone;
  }
  if (info.address) {
    document.getElementById('customer-address').value = info.address;
  }

  showStatus('✅ Đã điền thông tin từ text được chọn!', 'success');
}

// Show status message
function showStatus(message, type = 'info') {
  const statusEl = document.getElementById('shopvd-status');
  if (!statusEl) return;

  statusEl.textContent = message;
  statusEl.className = `shopvd-status ${type}`;
  statusEl.classList.remove('hidden');

  setTimeout(() => {
    statusEl.classList.add('hidden');
  }, 5000);
}

// Create order via API
async function createOrder(orderData) {
  try {
    showStatus('⏳ Đang tạo đơn hàng...', 'info');

    const response = await fetch(`${API_BASE_URL}/api/order/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderData)
    });

    const result = await response.json();

    if (result.success) {
      showStatus(`✅ Đã tạo đơn ${result.orderId} thành công!`, 'success');
      
      // Reset form
      document.getElementById('shopvd-order-form').reset();
      document.getElementById('send-later-fields')?.classList.add('hidden');
      document.getElementById('shipping-fee').value = defaultCustomerShippingFee;
      document.getElementById('shipping-cost').value = defaultActualShippingCost;
      document.getElementById('deposit-amount').value = '0';
      document.getElementById('discount-amount').value = '0';
      productsData = [];
      addProductRow(); // Add one default product
      calculateTotal();

      // Open shopvd.store in new tab (optional)
      // window.open(`https://shopvd.store/admin/index.html`, '_blank');
    } else {
      showStatus(`❌ Lỗi: ${result.error || 'Không thể tạo đơn'}`, 'error');
    }
  } catch (error) {
    console.error('Error creating order:', error);
    showStatus(`❌ Lỗi kết nối API: ${error.message}`, 'error');
  }
}

// Setup event listeners
function setupEventListeners() {
  // Toggle sidebar
  document.getElementById('shopvd-toggle')?.addEventListener('click', () => {
    const sidebar = document.getElementById('shopvd-sidebar');
    sidebar.classList.toggle('collapsed');
  });

  // Parse button
  document.getElementById('shopvd-parse-btn')?.addEventListener('click', () => {
    const selectedText = window.getSelection().toString();
    if (!selectedText.trim()) {
      showStatus('⚠️ Vui lòng bôi đen text trước khi click!', 'warning');
      return;
    }

    const info = parseCustomerInfo(selectedText);
    if (info && (info.name || info.phone || info.address)) {
      fillFormWithParsedInfo(info);
    } else {
      showStatus('⚠️ Không tìm thấy thông tin khách hàng trong text được chọn', 'warning');
    }
  });

  // Address selection
  document.getElementById('customer-province')?.addEventListener('change', (e) => {
    renderWards(e.target.value);
    updateFullAddress();
  });
  
  document.getElementById('customer-ward')?.addEventListener('change', () => {
    updateFullAddress();
  });
  
  document.getElementById('customer-street')?.addEventListener('input', () => {
    updateFullAddress();
  });

  // Payment method buttons
  document.querySelectorAll('.shopvd-payment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active from all
      document.querySelectorAll('.shopvd-payment-btn').forEach(b => b.classList.remove('active'));
      // Add active to clicked
      btn.classList.add('active');
      
      // Get payment value
      const paymentValue = btn.getAttribute('data-payment');
      const depositWrapper = document.getElementById('deposit-amount-wrapper');
      const depositInput = document.getElementById('deposit-amount');
      
      // Handle deposit mode
      if (paymentValue === 'deposit') {
        // Show deposit input
        depositWrapper?.classList.remove('hidden');
        // Set payment method to COD (will collect remaining after deposit)
        document.getElementById('payment-method').value = 'cod';
        // Focus deposit input
        setTimeout(() => depositInput?.focus(), 50);
      } else {
        // Hide deposit input
        depositWrapper?.classList.add('hidden');
        // Set payment method normally
        document.getElementById('payment-method').value = paymentValue;
        // Reset deposit to 0
        if (depositInput) depositInput.value = '0';
      }
    });
  });

  // Customer source buttons (Required)
  document.querySelectorAll('.shopvd-source-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Toggle active (allow deselect)
      const wasActive = btn.classList.contains('active');
      // Remove active from all
      document.querySelectorAll('.shopvd-source-btn').forEach(b => b.classList.remove('active'));
      
      if (!wasActive) {
        // Add active to clicked
        btn.classList.add('active');
        // Update hidden input
        const sourceValue = btn.getAttribute('data-source');
        document.getElementById('customer-source').value = sourceValue;
      } else {
        // Deselect
        document.getElementById('customer-source').value = '';
      }
    });
  });

  // Free shipping checkbox
  document.getElementById('free-shipping')?.addEventListener('change', (e) => {
    const shippingFeeInput = document.getElementById('shipping-fee');
    if (e.target.checked) {
      shippingFeeInput.value = 0;
      shippingFeeInput.disabled = true;
    } else {
      shippingFeeInput.value = defaultCustomerShippingFee;
      shippingFeeInput.disabled = false;
    }
    calculateTotal();
  });

  // Add product button - Show manual form
  document.getElementById('add-manual-product-btn')?.addEventListener('click', () => {
    const form = document.getElementById('manual-product-form');
    if (form) {
      form.classList.remove('hidden');
      // Focus on name input
      document.getElementById('manual-product-name')?.focus();
    }
  });

  // Close manual form
  document.getElementById('close-manual-form')?.addEventListener('click', () => {
    const form = document.getElementById('manual-product-form');
    if (form) {
      form.classList.add('hidden');
      // Clear inputs
      document.getElementById('manual-product-name').value = '';
      document.getElementById('manual-product-price').value = '';
      document.getElementById('manual-product-quantity').value = '1';
      document.getElementById('manual-product-weight').value = '';
      document.getElementById('manual-product-notes').value = '';
    }
  });

  // Submit manual product
  document.getElementById('add-manual-product-submit')?.addEventListener('click', () => {
    const name = document.getElementById('manual-product-name').value.trim();
    const price = document.getElementById('manual-product-price').value;
    const quantity = document.getElementById('manual-product-quantity').value || 1;
    const weight = document.getElementById('manual-product-weight').value.trim();
    const notes = document.getElementById('manual-product-notes').value.trim();

    if (!name) {
      showStatus('⚠️ Vui lòng nhập tên sản phẩm!', 'warning');
      return;
    }
    if (!price || price <= 0) {
      showStatus('⚠️ Vui lòng nhập giá hợp lệ!', 'warning');
      return;
    }

    // Add product
    addProductRow(name, price, quantity, null, 0, '', weight, notes);

    // Hide form and clear inputs
    const form = document.getElementById('manual-product-form');
    if (form) {
      form.classList.add('hidden');
      document.getElementById('manual-product-name').value = '';
      document.getElementById('manual-product-price').value = '';
      document.getElementById('manual-product-quantity').value = '1';
      document.getElementById('manual-product-weight').value = '';
      document.getElementById('manual-product-notes').value = '';
    }

    showStatus('✅ Đã thêm sản phẩm!', 'success');
    setTimeout(() => {
      const statusEl = document.getElementById('shopvd-status');
      if (statusEl) statusEl.classList.add('hidden');
    }, 1500);
  });

  // Product search
  document.getElementById('product-search')?.addEventListener('input', (e) => {
    handleProductSearch(e.target.value);
  });

  // Product tabs
  document.querySelectorAll('.shopvd-product-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const tabName = tab.getAttribute('data-tab');
      if (tabName) {
        switchProductTab(tabName);
      }
    });
  });

  // Category filter
  document.getElementById('category-filter')?.addEventListener('change', (e) => {
    filterByCategory(parseInt(e.target.value));
  });

  // Click outside to close search results
  document.addEventListener('click', (e) => {
    const searchContainer = document.querySelector('.shopvd-product-search-container');
    const resultsDiv = document.getElementById('product-search-results');
    if (searchContainer && resultsDiv && !searchContainer.contains(e.target)) {
      resultsDiv.classList.add('hidden');
    }
  });

  // Shipping fee change
  document.getElementById('shipping-fee')?.addEventListener('change', calculateTotal);
  
  // Discount amount change
  document.getElementById('discount-amount')?.addEventListener('change', calculateTotal);

  // Send later toggle
  document.getElementById('send-later')?.addEventListener('change', (e) => {
    const fieldsDiv = document.getElementById('send-later-fields');
    if (e.target.checked) {
      fieldsDiv?.classList.remove('hidden');
      // Set default time to tomorrow 9 AM
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      const dtInput = document.getElementById('planned-send-time');
      if (dtInput) {
        dtInput.value = tomorrow.toISOString().slice(0, 16);
      }
    } else {
      fieldsDiv?.classList.add('hidden');
    }
  });

  // Form submit
  document.getElementById('shopvd-order-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const customerName = document.getElementById('customer-name').value.trim();
    const customerPhone = document.getElementById('customer-phone').value.trim();
    const customerAddress = document.getElementById('customer-address').value.trim();
    const provinceId = document.getElementById('customer-province').value;
    const wardId = document.getElementById('customer-ward').value;
    const streetAddress = document.getElementById('customer-street').value.trim();
    const shippingFee = parseInt(document.getElementById('shipping-fee').value || 0);
    const shippingCost = parseInt(document.getElementById('shipping-cost').value || 0);
    const paymentMethod = document.getElementById('payment-method').value;
    const depositAmount = parseInt(document.getElementById('deposit-amount').value || 0);
    const customerSource = document.getElementById('customer-source').value;
    const referralCode = document.getElementById('referral-code').value.trim();
    const discountCode = document.getElementById('discount-code').value.trim();
    const discountAmount = parseInt(document.getElementById('discount-amount').value || 0);
    const isPriority = document.getElementById('is-priority').checked;
    const sendLater = document.getElementById('send-later').checked;
    const plannedSendTime = document.getElementById('planned-send-time').value;
    const notes = document.getElementById('order-notes').value.trim();

    // Validate
    if (!customerName || !customerPhone || !customerAddress) {
      showStatus('⚠️ Vui lòng điền đầy đủ thông tin khách hàng!', 'warning');
      return;
    }
    
    if (!provinceId || !wardId) {
      showStatus('⚠️ Vui lòng chọn Tỉnh/Thành phố và Phường/Xã!', 'warning');
      return;
    }
    
    if (!customerSource) {
      showStatus('⚠️ Vui lòng chọn Nguồn khách (Zalo/Facebook/TikTok)!', 'warning');
      return;
    }

    if (productsData.length === 0 || !productsData.every(p => p.name && p.price)) {
      showStatus('⚠️ Vui lòng thêm ít nhất 1 sản phẩm hợp lệ!', 'warning');
      return;
    }

    // Build cart
    const cart = productsData.map((p, index) => ({
      id: index + 1,
      product_id: p.product_id || null,
      name: p.name,
      price: parseInt(p.price),
      cost_price: p.cost_price || 0,
      quantity: parseInt(p.quantity),
      image_url: p.image_url || '',
      weight: p.weight || null,
      notes: p.notes || null
    }));

    const productsTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalAmount = productsTotal + shippingFee - discountAmount;

    // Validate deposit amount
    if (depositAmount > 0 && depositAmount >= totalAmount) {
      showStatus('⚠️ Tiền cọc phải nhỏ hơn giá trị đơn hàng!', 'warning');
      return;
    }

    // Handle send later
    let status = 'pending';
    let plannedSendAtUnix = null;
    if (sendLater) {
      if (!plannedSendTime) {
        showStatus('⚠️ Vui lòng chọn ngày giờ dự kiến gửi!', 'warning');
        return;
      }
      status = 'send_later';
      plannedSendAtUnix = new Date(plannedSendTime).getTime();
    }

    // Build order data
    const orderData = {
      orderId: 'DH' + Date.now(),
      orderDate: Date.now(),
      customer: {
        name: customerName,
        phone: customerPhone,
        address: customerAddress
      },
      cart: cart,
      totalAmount: totalAmount,
      paymentMethod: paymentMethod,
      status: status,
      shippingFee: shippingFee,
      shippingCost: shippingCost,
      depositAmount: depositAmount,
      deposit_amount: depositAmount,
      customerSource: customerSource || null,
      customer_source: customerSource || null,
      referralCode: referralCode || null,
      referral_code: referralCode || null,
      discountCode: discountCode || null,
      discount_code: discountCode || null,
      discountAmount: discountAmount,
      discount_amount: discountAmount,
      isPriority: isPriority ? 1 : 0,
      is_priority: isPriority ? 1 : 0,
      plannedSendAtUnix: plannedSendAtUnix,
      planned_send_at_unix: plannedSendAtUnix,
      acknowledgeDuplicate: true, // Bỏ qua check trùng vì đã parse từ chat
      notes: notes || null,
      // Address fields (2-level)
      province_id: parseInt(provinceId),
      ward_id: parseInt(wardId),
      street_address: streetAddress || null
    };

    await createOrder(orderData);
  });
}

// Initialize
// Global shipping fee defaults (loaded from API)
let defaultCustomerShippingFee = 21000;
let defaultActualShippingCost = 0;

// Load shipping fees from API
async function loadShippingFees() {
  try {
    console.log('🔄 Loading shipping fees from API...');
    const response = await fetch('https://ctv-api.yendev96.workers.dev/?action=getShippingFee');
    const data = await response.json();
    
    console.log('📦 API Response:', data);
    
    if (data.success) {
      const customerFee = data.customerShippingFee || data.shippingFee || 21000;
      const actualCost = data.actualShippingCost || 0;
      
      console.log('💰 Parsed values:', { 
        customerFee, 
        actualCost,
        raw: { 
          customerShippingFee: data.customerShippingFee,
          actualShippingCost: data.actualShippingCost,
          shippingFee: data.shippingFee
        }
      });
      
      // Set values in the form
      const shippingFeeInput = document.getElementById('shipping-fee');
      const shippingCostInput = document.getElementById('shipping-cost');
      
      if (shippingFeeInput) {
        shippingFeeInput.value = customerFee;
        console.log('✅ Set shipping-fee to:', customerFee);
      }
      
      if (shippingCostInput) {
        shippingCostInput.value = actualCost;
        console.log('✅ Set shipping-cost to:', actualCost);
      }
      
      // Update global defaults
      defaultCustomerShippingFee = customerFee;
      defaultActualShippingCost = actualCost;
      
      console.log('✅ Loaded shipping fees from API:', { customerFee, actualCost });
      
      // Recalculate total with new shipping fee
      calculateTotal();
    } else {
      console.error('❌ API returned error:', data.error);
    }
  } catch (error) {
    console.error('❌ Failed to load shipping fees:', error);
    // Keep default values if API fails
  }
}

function init() {
  // Check if sidebar already exists
  if (document.getElementById('shopvd-sidebar')) {
    return;
  }

  // Create and inject sidebar
  createSidebar();
  setupEventListeners();
  
  // Load data from API
  loadProducts();
  loadAddressData();
  loadShippingFees();
}

// Wait for page to be fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

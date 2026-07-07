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

// Smart paste state
let smartPasteBusy = false;

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
      <!-- Smart Paste - Dán nhanh thông tin khách hàng -->
      <div class="shopvd-section shopvd-smart-paste-block">
        <div class="shopvd-smart-paste-header">
          <div class="shopvd-smart-paste-title">
            <svg class="shopvd-smart-paste-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"/>
            </svg>
            <span>DÁN NHANH THÔNG TIN KHÁCH HÀNG</span>
          </div>
          <span class="shopvd-smart-paste-subtitle">Tên, SĐT, Địa chỉ</span>
        </div>
        <textarea 
          id="shopvd-smart-paste-input" 
          rows="3" 
          placeholder="Dán toàn bộ thông tin (Địa chỉ, SĐT, Tên) — hệ thống tự phân tích ngay&#10;&#10;Ví dụ:&#10;198/8 nguyễn bình khiêm, phường vĩnh quang, tp Rạch Giá, kiên giang&#10;0375323573"
          class="shopvd-smart-paste-textarea"
        ></textarea>
        <div class="shopvd-smart-paste-actions">
          <button type="button" id="shopvd-smart-paste-btn" class="shopvd-btn shopvd-btn-primary">
            <svg class="shopvd-smart-paste-btn-icon" id="shopvd-smart-paste-btn-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>
            </svg>
            <span id="shopvd-smart-paste-btn-text">Phân tích lại</span>
          </button>
          <div id="shopvd-smart-paste-status" class="shopvd-smart-paste-status hidden"></div>
        </div>
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

          <!-- Địa chỉ giao hàng (Custom Combobox với Search - đồng bộ 100% từ m.html) -->
          <div class="shopvd-address-section">
            <div class="shopvd-address-box">
              <label class="shopvd-address-label">Địa chỉ giao hàng <span class="shopvd-required">*</span></label>
              
              <div class="shopvd-address-fields">
                <!-- Province Combobox (hiển thị ngay) -->
                <div class="shopvd-combobox-wrapper">
                  <button type="button" id="province-combobox-btn" class="shopvd-combobox-button">
                    <span class="shopvd-combobox-icon">📍</span>
                    <span id="province-combobox-text" class="shopvd-combobox-text">Chọn tỉnh/thành phố</span>
                  </button>
                  <div id="province-combobox-dropdown" class="shopvd-combobox-dropdown hidden">
                    <input 
                      type="text" 
                      id="province-combobox-search" 
                      class="shopvd-combobox-search" 
                      placeholder="Tìm tỉnh/thành phố..."
                      autocomplete="off"
                    >
                    <div class="shopvd-combobox-list-header">CHỌN TỈNH/THÀNH PHỐ</div>
                    <div id="province-combobox-list" class="shopvd-combobox-list"></div>
                  </div>
                </div>

                <!-- Ward Combobox (ẩn, hiện sau khi chọn tỉnh) -->
                <div id="ward-combobox-wrapper" class="shopvd-combobox-wrapper hidden">
                  <button type="button" id="ward-combobox-btn" class="shopvd-combobox-button">
                    <span class="shopvd-combobox-icon">📍</span>
                    <span id="ward-combobox-text" class="shopvd-combobox-text">Chọn phường/xã</span>
                  </button>
                  <div id="ward-combobox-dropdown" class="shopvd-combobox-dropdown hidden">
                    <input 
                      type="text" 
                      id="ward-combobox-search" 
                      class="shopvd-combobox-search" 
                      placeholder="Tìm phường/xã..."
                      autocomplete="off"
                    >
                    <div class="shopvd-combobox-list-header">CHỌN PHƯỜNG/XÃ</div>
                    <div id="ward-combobox-list" class="shopvd-combobox-list"></div>
                  </div>
                </div>

                <!-- Hidden selects for form submission -->
                <select id="customer-province" required class="shopvd-hidden">
                  <option value="">-- Chọn Tỉnh/TP --</option>
                </select>
                <select id="customer-ward" disabled required class="shopvd-hidden">
                  <option value="">-- Chọn Phường/Xã --</option>
                </select>

                <!-- Street Address (ẩn, hiện sau khi chọn phường/xã) -->
                <input
                  type="text"
                  id="customer-street"
                  placeholder="Số nhà, tên đường"
                  class="shopvd-address-input hidden"
                >

                <!-- Address Preview -->
                <p id="customer-address-preview" class="shopvd-address-preview"></p>

                <!-- Hidden full address -->
                <input type="hidden" id="customer-address">
              </div>
            </div>
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
            <small id="freeship-hint" style="color: #10b981; font-size: 11px; margin-top: 4px; display: none;"></small>
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
              <input type="hidden" id="discount-amount" value="0">
            </div>

            <div class="shopvd-form-group shopvd-col-full">
              <button type="button" id="open-discount-modal" class="shopvd-discount-trigger-btn">
                <span class="shopvd-discount-icon">🏷️</span>
                <span class="shopvd-discount-text">
                  <span class="shopvd-discount-label">Chọn ưu đãi</span>
                  <span class="shopvd-discount-value" id="discount-display">Chưa áp dụng</span>
                </span>
                <span class="shopvd-discount-arrow">›</span>
              </button>
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

    <!-- Discount Modal -->
    <div id="discount-modal" class="shopvd-dm hidden">
      <div class="shopvd-dm-overlay"></div>
      <div class="shopvd-dm-content">

        <!-- Header -->
        <div class="shopvd-dm-header">
          <div class="shopvd-dm-header-left">
            <div class="shopvd-dm-header-icon">🎁</div>
            <div>
              <div class="shopvd-dm-title">Chọn ưu đãi</div>
              <div class="shopvd-dm-subtitle">Áp dụng giảm giá cho đơn hàng</div>
            </div>
          </div>
          <button type="button" class="shopvd-dm-close" id="close-discount-modal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- Tabs -->
        <div class="shopvd-dm-tabs">
          <button type="button" class="shopvd-tab-btn active" data-tab="custom">⚡ Tùy chỉnh</button>
          <button type="button" class="shopvd-tab-btn" data-tab="code">🏷️ Mã giảm giá</button>
        </div>

        <!-- Body -->
        <div class="shopvd-dm-body">

          <!-- Tab Tùy chỉnh -->
          <div class="shopvd-tab-content active" data-tab-content="custom">

            <!-- Badge xóa giảm giá hiện tại -->
            <div class="shopvd-dm-active-discount hidden" id="current-discount-badge">
              <div class="shopvd-dm-active-discount-info">
                <span class="shopvd-dm-active-discount-dot"></span>
                <span>Đang giảm: <strong id="discount-badge-amount">0đ</strong></span>
              </div>
              <button type="button" class="shopvd-dm-active-discount-remove" id="remove-discount-badge-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                Xóa giảm giá
              </button>
            </div>

            <!-- Giảm nhanh theo % -->
            <div class="shopvd-dm-section">
              <div class="shopvd-dm-section-label">
                <span>Giảm nhanh theo %</span>
                <button type="button" class="shopvd-dm-refresh" id="refresh-discount-presets" title="Tính lại">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M1 4v6h6M23 20v-6h-6"/>
                    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                  </svg>
                </button>
              </div>
              <div class="shopvd-dm-presets">
                <button type="button" class="shopvd-dm-preset" data-type="percent" data-value="5">-5%</button>
                <button type="button" class="shopvd-dm-preset" data-type="percent" data-value="10">-10%</button>
                <button type="button" class="shopvd-dm-preset" data-type="percent" data-value="15">-15%</button>
              </div>
            </div>

            <!-- Gợi ý chẵn nghìn -->
            <div class="shopvd-dm-section">
              <div class="shopvd-dm-section-label">Gợi ý chẵn chục nghìn</div>
              <div class="shopvd-dm-presets" id="amount-presets"></div>
            </div>

            <!-- Nhập tùy ý -->
            <div class="shopvd-dm-section">
              <div class="shopvd-dm-section-label">Nhập theo ý bạn</div>
              <div class="shopvd-dm-custom-row">
                <div class="shopvd-dm-unit-toggle">
                  <button type="button" class="shopvd-toggle-btn active" data-unit="percent">%</button>
                  <button type="button" class="shopvd-toggle-btn" data-unit="amount">đ</button>
                </div>
                <input type="number" id="custom-discount-value" placeholder="Nhập số..." min="0" step="1000" class="shopvd-dm-custom-input">
              </div>
            </div>

            <!-- Tổng đơn -->
            <div class="shopvd-dm-total-row">
              <span class="shopvd-dm-total-label">Tổng đơn</span>
              <strong class="shopvd-dm-total-value" id="discount-modal-total">0 đ</strong>
            </div>

          </div>

          <!-- Tab Mã giảm giá -->
          <div class="shopvd-tab-content" data-tab-content="code">
            <div class="shopvd-dm-section">
              <div class="shopvd-dm-section-label">Nhập mã giảm giá</div>
              <div class="shopvd-dm-code-row">
                <input type="text" id="discount-code-input" placeholder="Nhập mã..." class="shopvd-dm-code-input">
                <button type="button" id="apply-discount-code-btn" class="shopvd-dm-code-btn">Áp dụng</button>
              </div>
              <p class="shopvd-dm-code-hint">Nhập mã và bấm Áp dụng để kiểm tra.</p>
            </div>
          </div>

        </div>

        <!-- Footer -->
        <div class="shopvd-dm-footer">
          <button type="button" class="shopvd-dm-btn-secondary" id="close-discount-modal-footer">Đóng</button>
          <button type="button" class="shopvd-dm-btn-primary" id="apply-discount-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Áp dụng giảm giá
          </button>
        </div>

      </div>
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

    // Set up global addressSelector for smart paste compatibility
    setupAddressSelectorGlobal();

    // Render provinces
    renderProvinces();
  } catch (error) {
    console.error('Error loading address data:', error);
    showStatus('⚠️ Không thể tải danh sách địa chỉ', 'warning');
  }
}

// Set up global addressSelector object for smart paste script compatibility
function setupAddressSelectorGlobal() {
  if (!window.addressSelector) {
    window.addressSelector = {
      data: addressData,
      provinceMap: provinceMap,
      wardMap: wardMap,
      loaded: true,
      renderWards: (selectElement, provinceId) => {
        if (!selectElement) return;
        const province = provinceMap.get(provinceId);
        if (!province || !province.Wards) {
          selectElement.innerHTML = '<option value="">-- Chọn Phường/Xã --</option>';
          return;
        }
        const sorted = province.Wards.sort((a, b) => {
          const aNum = /^\d+$/.test(a.Name);
          const bNum = /^\d+$/.test(b.Name);
          if (aNum && bNum) return parseInt(a.Name) - parseInt(b.Name);
          if (aNum) return -1;
          if (bNum) return 1;
          return a.Name.localeCompare(b.Name, 'vi', { sensitivity: 'base' });
        });
        const optionsHtml = sorted.map(ward =>
          `<option value="${ward.Id}">${escapeHtml(ward.Name)}</option>`
        ).join('');
        selectElement.innerHTML = '<option value="">-- Chọn Phường/Xã --</option>' + optionsHtml;
      },
      generateFullAddress: (street, provinceId, wardId) => {
        const province = provinceMap.get(provinceId);
        const wardKey = `${provinceId}-${wardId}`;
        const ward = wardMap.get(wardKey);
        const parts = [];
        if (street) parts.push(street);
        if (ward) parts.push(ward.Name);
        if (province) parts.push(province.Name);
        return parts.join(', ');
      }
    };
  }
  
}

// Render provinces dropdown
function renderProvinces() {
  const select = document.getElementById('customer-province');
  if (!select) return;

  const optionsHtml = addressData.map(province =>
    `<option value="${province.Id}">${escapeHtml(province.Name)}</option>`
  ).join('');

  select.innerHTML = '<option value="">-- Chọn Tỉnh/TP --</option>' + optionsHtml;
  
  // Also render combobox list
  renderProvinceCombobox();
}

// Render province combobox list
function renderProvinceCombobox() {
  const list = document.getElementById('province-combobox-list');
  if (!list || !addressData.length) return;

  const itemsHtml = addressData.map(province =>
    `<div class="shopvd-combobox-item" data-province-id="${province.Id}">${escapeHtml(province.Name)}</div>`
  ).join('');

  list.innerHTML = itemsHtml;
}

// Filter province combobox by search
function filterProvinceCombobox(searchText) {
  const list = document.getElementById('province-combobox-list');
  if (!list) return;

  const normalized = searchText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  const items = list.querySelectorAll('.shopvd-combobox-item');
  items.forEach(item => {
    const text = item.textContent.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (text.includes(normalized)) {
      item.style.display = 'block';
    } else {
      item.style.display = 'none';
    }
  });
}

// Select province from combobox
function selectProvinceFromCombobox(provinceId) {
  const province = provinceMap.get(provinceId);
  if (!province) return;

  // Update hidden select
  const select = document.getElementById('customer-province');
  if (select) select.value = provinceId;

  // Update button UI
  const btn = document.getElementById('province-combobox-btn');
  const text = document.getElementById('province-combobox-text');
  if (btn && text) {
    btn.classList.add('selected');
    text.textContent = province.Name;
  }

  // Close dropdown
  closeProvinceCombobox();

  // Render wards
  renderWards(provinceId);
  renderWardCombobox(provinceId);

  // Show ward combobox (progressive disclosure)
  const wardWrapper = document.getElementById('ward-combobox-wrapper');
  if (wardWrapper) wardWrapper.classList.remove('hidden');

  const wardBtn = document.getElementById('ward-combobox-btn');
  if (wardBtn) wardBtn.disabled = false;

  // Auto-open ward dropdown for smooth UX
  setTimeout(() => {
    toggleWardCombobox();
  }, 100);

  // Hide street input until ward is selected
  const streetInput = document.getElementById('customer-street');
  if (streetInput) streetInput.classList.add('hidden');

  // Update address
  updateFullAddress();
}

// Open/close province combobox
function toggleProvinceCombobox() {
  const dropdown = document.getElementById('province-combobox-dropdown');
  const search = document.getElementById('province-combobox-search');
  
  if (!dropdown) return;

  const isHidden = dropdown.classList.contains('hidden');
  
  // Close all dropdowns first
  closeAllComboboxes();
  
  if (isHidden) {
    dropdown.classList.remove('hidden');
    if (search) {
      search.value = '';
      search.focus();
    }
    filterProvinceCombobox('');
  }
}

function closeProvinceCombobox() {
  const dropdown = document.getElementById('province-combobox-dropdown');
  if (dropdown) dropdown.classList.add('hidden');
}

// Ward combobox functions
function renderWardCombobox(provinceId) {
  const list = document.getElementById('ward-combobox-list');
  if (!list) return;

  const province = provinceMap.get(provinceId);
  if (!province || !province.Wards) {
    list.innerHTML = '';
    return;
  }

  const sorted = [...province.Wards].sort((a, b) =>
    a.Name.localeCompare(b.Name, 'vi', { sensitivity: 'base' })
  );

  const itemsHtml = sorted.map(ward =>
    `<div class="shopvd-combobox-item" data-ward-id="${ward.Id}">${escapeHtml(ward.Name)}</div>`
  ).join('');

  list.innerHTML = itemsHtml;
}

function filterWardCombobox(searchText) {
  const list = document.getElementById('ward-combobox-list');
  if (!list) return;

  const normalized = searchText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  const items = list.querySelectorAll('.shopvd-combobox-item');
  items.forEach(item => {
    const text = item.textContent.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (text.includes(normalized)) {
      item.style.display = 'block';
    } else {
      item.style.display = 'none';
    }
  });
}

function selectWardFromCombobox(wardId, provinceId) {
  const wardKey = `${provinceId}-${wardId}`;
  const ward = wardMap.get(wardKey);
  if (!ward) return;

  // Update hidden select
  const select = document.getElementById('customer-ward');
  if (select) select.value = wardId;

  // Update button UI
  const btn = document.getElementById('ward-combobox-btn');
  const text = document.getElementById('ward-combobox-text');
  if (btn && text) {
    btn.classList.add('selected');
    text.textContent = ward.Name;
  }

  // Close dropdown
  closeWardCombobox();

  // Show street input (progressive disclosure)
  const streetInput = document.getElementById('customer-street');
  if (streetInput) {
    streetInput.classList.remove('hidden');
    streetInput.focus(); // Auto-focus for better UX
  }

  // Update address
  updateFullAddress();
}

function toggleWardCombobox() {
  const dropdown = document.getElementById('ward-combobox-dropdown');
  const search = document.getElementById('ward-combobox-search');
  
  if (!dropdown) return;

  const isHidden = dropdown.classList.contains('hidden');
  
  // Close all dropdowns first
  closeAllComboboxes();
  
  if (isHidden) {
    dropdown.classList.remove('hidden');
    if (search) {
      search.value = '';
      search.focus();
    }
    filterWardCombobox('');
  }
}

function closeWardCombobox() {
  const dropdown = document.getElementById('ward-combobox-dropdown');
  if (dropdown) dropdown.classList.add('hidden');
}

function closeAllComboboxes() {
  closeProvinceCombobox();
  closeWardCombobox();
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
  const previewEl = document.getElementById('customer-address-preview');

  if (!provinceSelect || !wardSelect || !streetInput || !addressInput) return;

  const provinceId = provinceSelect.value;
  const wardId = wardSelect.value;
  const street = streetInput.value.trim();

  if (!provinceId || !wardId) {
    addressInput.value = '';
    if (previewEl) previewEl.textContent = '';
    return;
  }

  const province = provinceMap.get(provinceId);
  const wardKey = `${provinceId}-${wardId}`;
  const ward = wardMap.get(wardKey);

  const parts = [];
  if (street) parts.push(street);
  if (ward) parts.push(ward.Name);
  if (province) parts.push(province.Name);

  const fullAddress = parts.join(', ');
  addressInput.value = fullAddress;
  
  // Update preview (sync with m.html)
  if (previewEl) {
    previewEl.textContent = fullAddress;
  }
}

// === SMART PASTE FUNCTIONALITY ===
// smart-paste.js is bundled with the extension and loaded via manifest.json
// Functions available: smartParseCustomerInfo(), parseAddress(), etc.

// Set smart paste button loading state
function setSmartPasteLoading(loading) {
  const btn = document.getElementById('shopvd-smart-paste-btn');
  const btnText = document.getElementById('shopvd-smart-paste-btn-text');
  const btnIcon = document.getElementById('shopvd-smart-paste-btn-icon');
  const statusEl = document.getElementById('shopvd-smart-paste-status');
  
  if (btn) btn.disabled = loading;
  if (btnText) btnText.textContent = loading ? 'Đang phân tích...' : 'Phân tích lại';
  if (btnIcon) {
    btnIcon.classList.toggle('animate-spin', loading);
  }
  if (loading && statusEl) {
    statusEl.className = 'shopvd-smart-paste-status';
    statusEl.style.color = '#e0e7ff';
    statusEl.style.background = '#667eea';
    statusEl.textContent = 'Đang phân tích...';
    statusEl.classList.remove('hidden');
  }
}

// Show smart paste result
function showSmartPasteResult(parsedData) {
  const statusEl = document.getElementById('shopvd-smart-paste-status');
  if (!statusEl) return;
  
  if (!parsedData?.success) {
    statusEl.className = 'shopvd-smart-paste-status';
    statusEl.style.color = '#fee2e2';
    statusEl.style.background = '#ef4444';
    statusEl.textContent = parsedData?.error || 'Không thể phân tích';
    statusEl.classList.remove('hidden');
    return;
  }
  
  const d = parsedData.data || {};
  const parts = [];
  if (d.name) parts.push('Tên');
  if (d.phone) parts.push('SĐT');
  if (d.address?.province) parts.push('Địa chỉ');
  
  const conf = parsedData.confidence;
  
  statusEl.className = 'shopvd-smart-paste-status';
  
  if (conf === 'high') {
    statusEl.style.color = '#d1fae5';
    statusEl.style.background = '#10b981';
  } else if (conf === 'medium') {
    statusEl.style.color = '#fef3c7';
    statusEl.style.background = '#f59e0b';
  } else {
    statusEl.style.color = '#fee2e2';
    statusEl.style.background = '#ef4444';
  }
  
  statusEl.textContent = parts.length 
    ? `✓ Đã điền: ${parts.join(', ')}` 
    : 'Không nhận diện được thông tin';
  statusEl.classList.remove('hidden');
}

// Apply parsed data to extension form
async function applyParsedDataToExtensionForm(parsedData) {
  if (!parsedData?.success) return;
  
  const { data } = parsedData;
  const addr = data.address;
  
  console.log('📋 Extension smart paste result:', {
    phone: data.phone || '(none)',
    name: data.name || '(none)',
    province: addr?.province?.Name || '(no province)',
    ward: addr?.ward?.Name || '(no ward)',
    wardId: addr?.ward?.Id || '',
    street: addr?.street || '(empty)',
    confidence: parsedData.confidence
  });
  
  // Apply phone
  if (data.phone) {
    const phoneInput = document.getElementById('customer-phone');
    if (phoneInput) phoneInput.value = data.phone;
  }
  
  // Apply name
  if (data.name) {
    const nameInput = document.getElementById('customer-name');
    if (nameInput) nameInput.value = data.name;
  }
  
  // Apply address
  if (addr?.province) {
    const provinceSelect = document.getElementById('customer-province');
    const wardSelect = document.getElementById('customer-ward');
    const streetInput = document.getElementById('customer-street');
    
    if (provinceSelect && wardSelect && streetInput) {
      // Set province
      provinceSelect.value = addr.province.Id;
      
      // Update province combobox UI
      const provinceBtn = document.getElementById('province-combobox-btn');
      const provinceText = document.getElementById('province-combobox-text');
      if (provinceBtn && provinceText) {
        provinceBtn.classList.add('selected');
        provinceText.textContent = addr.province.Name;
      }
      
      // Render wards for selected province
      renderWards(addr.province.Id);
      renderWardCombobox(addr.province.Id);
      
      // Show ward combobox (progressive disclosure)
      const wardWrapper = document.getElementById('ward-combobox-wrapper');
      if (wardWrapper) wardWrapper.classList.remove('hidden');
      
      const wardBtn = document.getElementById('ward-combobox-btn');
      if (wardBtn) wardBtn.disabled = false;
      
      // Set ward if available
      if (addr.ward) {
        // Wait a bit for ward options to render
        await new Promise(resolve => setTimeout(resolve, 100));
        wardSelect.value = addr.ward.Id;
        
        // Update ward combobox UI
        const wardText = document.getElementById('ward-combobox-text');
        if (wardBtn && wardText) {
          wardBtn.classList.add('selected');
          wardText.textContent = addr.ward.Name;
        }
        
        if (wardSelect.value !== addr.ward.Id) {
          console.warn('⚠️ Ward not found in dropdown:', addr.ward.Name, addr.ward.Id);
        }
      }
      
      // Set street
      if (addr.street) {
        streetInput.value = addr.street;
      }
      
      // Show street input if ward is selected (progressive disclosure)
      if (addr.ward) {
        streetInput.classList.remove('hidden');
      }
      
      // Update full address
      updateFullAddress();
    }
  }
}

// Handle smart paste button click
async function handleSmartPaste(options = {}) {
  const silentEmpty = options.silentEmpty === true;
  const textarea = document.getElementById('shopvd-smart-paste-input');
  const text = (textarea?.value || '').trim();
  
  if (!text) {
    if (!silentEmpty) {
      showStatus('⚠️ Vui lòng dán thông tin khách hàng vào khung trên!', 'warning');
    }
    return { ok: false, reason: 'empty' };
  }
  
  if (text.length < 8) {
    if (!silentEmpty) {
      showStatus('⚠️ Nội dung quá ngắn để phân tích!', 'warning');
    }
    return { ok: false, reason: 'short' };
  }
  
  if (smartPasteBusy) return { ok: false, reason: 'busy' };
  
  // Ensure address data is loaded before parsing
  if (!addressLoaded) {
    showStatus('⏳ Đang tải dữ liệu địa chỉ...', 'info');
    await loadAddressData();
    if (!addressLoaded) {
      showStatus('⚠️ Không thể tải dữ liệu địa chỉ. Vui lòng thử lại.', 'warning');
      return { ok: false, reason: 'address_data_not_loaded' };
    }
  }
  
  // smartParseCustomerInfo is loaded from smart-paste.js via manifest
  if (typeof smartParseCustomerInfo !== 'function') {
    showStatus('⚠️ Module phân tích chưa sẵn sàng. Vui lòng reload extension.', 'warning');
    return { ok: false, reason: 'function_not_available' };
  }
  
  smartPasteBusy = true;
  setSmartPasteLoading(true);
  
  try {
    const parsedData = await smartParseCustomerInfo(text);
    
    if (!parsedData?.success) {
      showSmartPasteResult(parsedData);
      return { ok: false, data: parsedData };
    }
    
    await applyParsedDataToExtensionForm(parsedData);
    showSmartPasteResult(parsedData);
    
    return { ok: true, data: parsedData };
  } catch (error) {
    console.error('Smart paste error:', error);
    showSmartPasteResult({ 
      success: false, 
      error: error.message || 'Lỗi phân tích' 
    });
    return { ok: false, error };
  } finally {
    smartPasteBusy = false;
    setSmartPasteLoading(false);
  }
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
  
  // Find category_id from cache if product exists
  let categoryId = null;
  let categoryIds = null;
  if (productId) {
    const cachedProduct = allProductsCache.find(p => p.id === productId);
    if (cachedProduct) {
      categoryId = cachedProduct.category_id || null;
      categoryIds = cachedProduct.category_ids || null;
    }
  }
  
  productsData.push({ 
    id, 
    name, 
    price, 
    quantity,
    product_id: productId,
    cost_price: costPrice,
    image_url: imageUrl,
    weight: weight,
    notes: notes,
    category_id: categoryId,
    category_ids: categoryIds
  });
  renderProducts();
  calculateTotal();
  autoUpdateFreeshipCheckbox();
}

function removeProduct(productId) {
  const beforeCount = productsData.length;
  productsData = productsData.filter(p => p.id !== productId);
  const afterCount = productsData.length;

  renderProducts();
  calculateTotal();
  autoUpdateFreeshipCheckbox();

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
    autoUpdateFreeshipCheckbox();
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
          <div class="shopvd-product-title-row">
            <h4 class="shopvd-product-title">${escapeHtml(product.name)}</h4>
            <div class="shopvd-product-actions">
              <button type="button" class="shopvd-action-btn shopvd-action-edit" data-action="edit" title="Sửa">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button type="button" class="shopvd-action-btn shopvd-action-delete" data-action="remove" title="Xóa">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
          <div class="shopvd-product-bottom-row">
            <div class="shopvd-product-meta">
              ${product.weight ? `<span class="shopvd-meta-item">● ${escapeHtml(product.weight)}</span>` : ''}
              ${product.notes ? `<span class="shopvd-meta-item">📝 ${escapeHtml(product.notes)}</span>` : ''}
            </div>
            <div class="shopvd-product-total">${formatPrice(totalPrice)} đ</div>
          </div>
        </div>
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
          autoUpdateFreeshipCheckbox();
          
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

  // Smart paste button
  document.getElementById('shopvd-smart-paste-btn')?.addEventListener('click', () => {
    handleSmartPaste({ silentEmpty: false });
  });

  // Smart paste - auto trigger on paste
  const smartPasteTextarea = document.getElementById('shopvd-smart-paste-input');
  if (smartPasteTextarea) {
    smartPasteTextarea.addEventListener('paste', () => {
      setTimeout(() => {
        handleSmartPaste({ silentEmpty: true });
      }, 100);
    });
  }

  // Province combobox
  document.getElementById('province-combobox-btn')?.addEventListener('click', toggleProvinceCombobox);
  
  document.getElementById('province-combobox-search')?.addEventListener('input', (e) => {
    filterProvinceCombobox(e.target.value);
  });

  document.getElementById('province-combobox-list')?.addEventListener('click', (e) => {
    const item = e.target.closest('.shopvd-combobox-item');
    if (item) {
      const provinceId = item.dataset.provinceId;
      if (provinceId) selectProvinceFromCombobox(provinceId);
    }
  });

  // Ward combobox
  document.getElementById('ward-combobox-btn')?.addEventListener('click', toggleWardCombobox);
  
  document.getElementById('ward-combobox-search')?.addEventListener('input', (e) => {
    filterWardCombobox(e.target.value);
  });

  document.getElementById('ward-combobox-list')?.addEventListener('click', (e) => {
    const item = e.target.closest('.shopvd-combobox-item');
    if (item) {
      const wardId = item.dataset.wardId;
      const provinceId = document.getElementById('customer-province')?.value;
      if (wardId && provinceId) selectWardFromCombobox(wardId, provinceId);
    }
  });

  // Close comboboxes when clicking outside
  document.addEventListener('click', (e) => {
    const provinceWrapper = document.querySelector('#province-combobox-btn')?.closest('.shopvd-combobox-wrapper');
    const wardWrapper = document.querySelector('#ward-combobox-btn')?.closest('.shopvd-combobox-wrapper');
    
    if (provinceWrapper && !provinceWrapper.contains(e.target)) {
      closeProvinceCombobox();
    }
    if (wardWrapper && !wardWrapper.contains(e.target)) {
      closeWardCombobox();
    }
  });

  // Address selection (old select handlers - keep for compatibility)
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

  // Discount Modal
  let currentDiscountUnit = 'percent'; // 'percent' or 'amount'
  let currentDiscountValue = 0;

  // Open discount modal
  document.getElementById('open-discount-modal')?.addEventListener('click', () => {
    const modal = document.getElementById('discount-modal');
    modal?.classList.remove('hidden');
    updateDiscountModalTotal();
    generateAmountPresets();
    
    // Update badge to show current discount
    const currentDiscount = parseInt(document.getElementById('discount-amount')?.value || '0');
    updateDiscountBadge(currentDiscount);
  });

  // Close discount modal
  document.getElementById('close-discount-modal')?.addEventListener('click', closeDiscountModal);
  document.getElementById('close-discount-modal-footer')?.addEventListener('click', closeDiscountModal);
  document.querySelector('.shopvd-dm-overlay')?.addEventListener('click', closeDiscountModal);

  function closeDiscountModal() {
    document.getElementById('discount-modal')?.classList.add('hidden');
  }

  // Tab switching
  document.querySelectorAll('.shopvd-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      
      // Update tabs
      document.querySelectorAll('.shopvd-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Update content
      document.querySelectorAll('.shopvd-tab-content').forEach(content => {
        content.classList.remove('active');
      });
      document.querySelector(`[data-tab-content="${tab}"]`)?.classList.add('active');
    });
  });

  // Unit toggle (% or đ)
  document.querySelectorAll('.shopvd-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const unit = btn.getAttribute('data-unit');
      currentDiscountUnit = unit;
      
      // Update buttons
      document.querySelectorAll('.shopvd-toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Clear custom input
      document.getElementById('custom-discount-value').value = '';
    });
  });

  // Preset discount buttons
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('shopvd-dm-preset')) {
      // Skip if button is disabled
      if (e.target.disabled) {
        showStatus('⚠️ Chọn mức nhỏ hơn tổng đơn', 'warning');
        setTimeout(() => {
          const statusEl = document.getElementById('shopvd-status');
          if (statusEl) statusEl.classList.add('hidden');
        }, 2000);
        return;
      }
      
      const type = e.target.getAttribute('data-type');
      const value = parseFloat(e.target.getAttribute('data-value'));
      
      // Remove active from all presets
      document.querySelectorAll('.shopvd-dm-preset').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      
      // Set discount
      currentDiscountUnit = type;
      currentDiscountValue = value;
      
      // Clear custom input
      document.getElementById('custom-discount-value').value = '';
      
      // Update unit toggle buttons
      document.querySelectorAll('.shopvd-toggle-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-unit') === type);
      });
      
      updateDiscountModalTotal();
    }
  });

  // Custom discount input
  document.getElementById('custom-discount-value')?.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value) || 0;
    currentDiscountValue = value;
    
    // Remove active from preset buttons
    document.querySelectorAll('.shopvd-dm-preset').forEach(b => b.classList.remove('active'));
    
    updateDiscountModalTotal();
  });

  // Refresh presets
  document.getElementById('refresh-discount-presets')?.addEventListener('click', () => {
    generateAmountPresets();
  });

  // Apply discount
  document.getElementById('apply-discount-btn')?.addEventListener('click', () => {
    applyDiscount();
    closeDiscountModal();
  });

  // Remove discount via badge
  document.getElementById('remove-discount-badge-btn')?.addEventListener('click', () => {
    // Reset discount hidden input (dùng bởi calculateTotal)
    const discountAmountInput = document.getElementById('discount-amount');
    if (discountAmountInput) discountAmountInput.value = '0';

    // Reset discount display text
    const discountDisplay = document.getElementById('discount-display');
    if (discountDisplay) discountDisplay.textContent = 'Chưa áp dụng';

    // Reset currentDiscountValue để modal đồng bộ
    currentDiscountValue = 0;

    // Clear discount code
    const discountCodeInput = document.getElementById('discount-code');
    if (discountCodeInput) discountCodeInput.value = '';

    const discountCodeModalInput = document.getElementById('discount-code-input');
    if (discountCodeModalInput) discountCodeModalInput.value = '';

    // Clear custom input
    const customInput = document.getElementById('custom-discount-input');
    if (customInput) customInput.value = '';

    // Hide badge
    const badge = document.getElementById('current-discount-badge');
    if (badge) badge.classList.add('hidden');

    // Recalculate total (sidebar)
    calculateTotal();

    // Update modal total display
    updateDiscountModalTotal();
    
    // Show notification
    showStatus('✅ Đã xóa giảm giá', 'success');
    setTimeout(() => {
      const statusEl = document.getElementById('shopvd-status');
      if (statusEl) statusEl.classList.add('hidden');
    }, 2000);
  });

  // Apply discount code
  document.getElementById('apply-discount-code-btn')?.addEventListener('click', () => {
    const code = document.getElementById('discount-code-input').value.trim();
    if (code) {
      document.getElementById('discount-code').value = code;
      // For now, just set the code - you can add validation logic here
      showStatus('✅ Đã áp dụng mã: ' + code, 'success');
      setTimeout(() => {
        const statusEl = document.getElementById('shopvd-status');
        if (statusEl) statusEl.classList.add('hidden');
      }, 2000);
    }
  });

  function calculateCartTotal() {
    const total = productsData.reduce((sum, p) => sum + (p.price * p.quantity), 0);
    return total;
  }

  function generateAmountPresets() {
    const cartTotal = calculateCartTotal();
    const shippingFee = parseInt(document.getElementById('shipping-fee')?.value || 0);
    const container = document.getElementById('amount-presets');
    if (!container) return;

    // Desktop algorithm: dDiscComputeCashSuggestDiscounts
    // Base = products + shipping (đúng với "Tổng đơn" hiển thị trong modal)
    const base = Math.max(0, Math.round(cartTotal + shippingFee));
    
    if (base < 1000) {
      container.innerHTML = '<p style="font-size: 12px; color: #9ca3af;">Thêm sản phẩm để xem gợi ý</p>';
      return;
    }
    
    // Calculate k = last digit of thousands place
    const k = Math.floor(base / 1000) % 10;
    const n0 = k === 0 ? 10 : k;
    
    // Generate 3 suggestions: [n0, n0+10, n0+20] * 1000
    const suggestions = [n0, n0 + 10, n0 + 20].map(n => n * 1000);
    
    container.innerHTML = suggestions.map(amount => {
      // Disable if amount >= base (would result in negative or zero total)
      const disabled = amount >= base;
      const disabledClass = disabled ? ' opacity-40 cursor-not-allowed' : '';
      const disabledAttr = disabled ? ' disabled' : '';
      
      return `<button 
        type="button" 
        class="shopvd-dm-preset${disabledClass}" 
        data-type="amount" 
        data-value="${amount}"
        ${disabledAttr}
      >-${formatPrice(amount)} đ</button>`;
    }).join('');
  }

  function updateDiscountModalTotal() {
    const cartTotal = calculateCartTotal();
    const shippingFee = parseInt(document.getElementById('shipping-fee')?.value || 0);
    let discountAmount = 0;
    
    if (currentDiscountValue > 0) {
      if (currentDiscountUnit === 'percent') {
        discountAmount = Math.round(cartTotal * currentDiscountValue / 100);
      } else {
        discountAmount = currentDiscountValue;
      }
    }
    
    const total = Math.max(0, cartTotal + shippingFee - discountAmount);
    document.getElementById('discount-modal-total').textContent = formatPrice(total) + ' đ';
  }

  function applyDiscount() {
    const cartTotal = calculateCartTotal();
    let discountAmount = 0;
    let displayText = 'Chưa áp dụng';
    
    if (currentDiscountValue > 0) {
      if (currentDiscountUnit === 'percent') {
        discountAmount = Math.round(cartTotal * currentDiscountValue / 100);
        displayText = `-${currentDiscountValue}% (${formatPrice(discountAmount)} đ)`;
      } else {
        discountAmount = currentDiscountValue;
        displayText = `-${formatPrice(discountAmount)} đ`;
      }
    }
    
    // Update hidden discount amount
    document.getElementById('discount-amount').value = discountAmount;
    
    // Update display
    document.getElementById('discount-display').textContent = displayText;
    
    // Update badge
    updateDiscountBadge(discountAmount);
    
    // Recalculate total
    calculateTotal();
    
    showStatus('✅ Đã áp dụng giảm giá!', 'success');
    setTimeout(() => {
      const statusEl = document.getElementById('shopvd-status');
      if (statusEl) statusEl.classList.add('hidden');
    }, 2000);
  }

  function updateDiscountBadge(amount) {
    const badge = document.getElementById('current-discount-badge');
    const badgeAmount = document.getElementById('discount-badge-amount');
    
    if (!badge || !badgeAmount) return;
    
    if (amount > 0) {
      badgeAmount.textContent = `-${formatPrice(amount)}đ`;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

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

// Free shipping constants (sync with desktop m.html)
const PRICE_THRESHOLD = 120000;  // 120k threshold for high-value products
const FREESHIP_CAT = 23;  // Sản phẩm bán kèm
const BI_CHARM_CAT = 24;  // Bi, charm bạc

// Helper: Check if product belongs to a category
function productInCategory(product, categoryId) {
  if (!product) return false;
  const targetCat = parseInt(categoryId, 10);
  
  // Check direct category_id
  if (parseInt(product.category_id, 10) === targetCat) return true;
  
  // Check category_ids array
  if (Array.isArray(product.category_ids)) {
    return product.category_ids.some(id => parseInt(id, 10) === targetCat);
  }
  
  // Find in cache by product_id
  if (product.id || product.product_id) {
    const pid = product.id || product.product_id;
    const cached = allProductsCache.find(p => p.id === pid);
    if (cached) {
      if (parseInt(cached.category_id, 10) === targetCat) return true;
      if (Array.isArray(cached.category_ids)) {
        return cached.category_ids.some(id => parseInt(id, 10) === targetCat);
      }
    }
  }
  
  return false;
}

// Auto-update free shipping checkbox based on cart (sync with desktop logic)
function autoUpdateFreeshipCheckbox() {
  const checkbox = document.getElementById('free-shipping');
  const shippingFeeInput = document.getElementById('shipping-fee');
  const hintElement = document.getElementById('freeship-hint');
  
  if (!checkbox || !shippingFeeInput) return;
  
  // If no products, uncheck and enable input
  if (productsData.length === 0) {
    if (checkbox.checked) {
      checkbox.checked = false;
      shippingFeeInput.value = defaultCustomerShippingFee;
      shippingFeeInput.disabled = false;
      if (hintElement) {
        hintElement.style.display = 'none';
        hintElement.textContent = '';
      }
      calculateTotal();
    }
    return;
  }
  
  // Analyze cart
  let totalQty = 0;
  let has23 = false;  // Has bundle products (cat 23)
  let has24 = false;  // Has bi/charm (cat 24)
  let qtyOtherMain = 0;  // Qty of products not in cat23 and not in cat24
  let non23Qty = 0;  // Qty of products not in cat23
  let hasHighValue = false;  // Has product (not cat23) with price > 120k
  let onlyAllCat24 = true;  // All products are cat24
  let highValueProductName = '';  // Name of first high-value product
  
  for (const product of productsData) {
    const qty = parseInt(product.quantity, 10) || 1;
    totalQty += qty;
    
    const in23 = productInCategory(product, FREESHIP_CAT);
    const in24 = productInCategory(product, BI_CHARM_CAT);
    
    if (in23) has23 = true;
    if (in24) has24 = true;
    
    if (!in23 && !in24) qtyOtherMain += qty;
    if (!in24) onlyAllCat24 = false;
    
    if (!in23) {
      non23Qty += qty;
      const price = parseFloat(product.price) || 0;
      if (price > PRICE_THRESHOLD && !hasHighValue) {
        hasHighValue = true;
        highValueProductName = product.name;
      }
    }
  }
  
  // Check if blocked (should NOT get free shipping)
  const blocked = (onlyAllCat24 && has24 && !has23) || (has24 && has23 && qtyOtherMain === 0);
  
  // Calculate if should have free shipping
  const should = !blocked && (
    (totalQty >= 2 && !(has23 && non23Qty === 0)) ||
    (has23 && non23Qty >= 1) ||
    hasHighValue
  );
  
  // Determine reason for free shipping
  let reason = '';
  if (should) {
    if (hasHighValue) {
      reason = '✓ Tự động (SP ≥ 120k)';
    } else if (has23 && non23Qty >= 1) {
      reason = '✓ Tự động (Mua kèm)';
    } else if (totalQty >= 2) {
      reason = '✓ Tự động (Mua từ 2+)';
    }
  }
  
  // Update checkbox if changed
  if (checkbox.checked !== should) {
    checkbox.checked = should;
    
    if (should) {
      shippingFeeInput.value = 0;
      shippingFeeInput.disabled = true;
      if (hintElement) {
        hintElement.textContent = reason;
        hintElement.style.display = 'block';
      }
    } else {
      shippingFeeInput.value = defaultCustomerShippingFee;
      shippingFeeInput.disabled = false;
      if (hintElement) {
        hintElement.style.display = 'none';
        hintElement.textContent = '';
      }
    }
    
    calculateTotal();
  } else if (should && hintElement) {
    // Update hint even if checkbox state didn't change
    hintElement.textContent = reason;
    hintElement.style.display = 'block';
  }
}

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

// ShopVD Order Helper - Content Script
// Inject sidebar chỉ trên https://pancake.vn/vongdautambyvui

function getShopvdExtensionVersion() {
  try {
    return chrome.runtime?.getManifest?.()?.version || 'dev';
  } catch (_) {
    return 'invalid-context';
  }
}

const SHOPVD_EXT_VERSION = getShopvdExtensionVersion();
console.warn('[ShopVD] content.js loaded', { version: SHOPVD_EXT_VERSION, url: location.href });

const ALLOWED_PAGE_PATH = '/vongdautambyvui';

/** Bật log debug kiểm tra DB — xem Console (F12) filter [ShopVD DbCheck] */
const SHOPVD_DEBUG_DB = true;
let shopvdCoreHandlersBound = false;
let shopvdPancakeClickBound = false;
let shopvdUnsavedSystemBound = false;

function shopvdDbLog(step, data) {
  if (!SHOPVD_DEBUG_DB) return;
  const msg = `[ShopVD DbCheck] ${step}`;
  if (data === undefined) console.warn(msg);
  else console.warn(msg, data);
}

function isAllowedPage() {
  const { hostname, pathname } = window.location;
  return hostname === 'pancake.vn'
    && (pathname === ALLOWED_PAGE_PATH || pathname.startsWith(`${ALLOWED_PAGE_PATH}/`));
}

function removeSidebarIfPresent() {
  document.getElementById('shopvd-sidebar')?.remove();
  document.getElementById('shopvd-expand-rail')?.remove();
  shopvdCoreHandlersBound = false;
  shopvdPancakeClickBound = false;
  shopvdUnsavedSystemBound = false;
  if (shopvdHeaderOffsetRaf) {
    cancelAnimationFrame(shopvdHeaderOffsetRaf);
    shopvdHeaderOffsetRaf = 0;
  }
}

/** Offset dưới header Pancake để sidebar không đè lên nav/profile */
let shopvdHeaderOffsetRaf = 0;
let shopvdHeaderOffsetBound = false;

function measurePancakeTopHeaderOffset() {
  const fallback = 56;
  try {
    let best = 0;
    // Quét vài điểm ngang mép trên (tránh vùng sidebar bên phải)
    const probeXs = [
      Math.floor(window.innerWidth * 0.2),
      Math.floor(window.innerWidth * 0.45),
      Math.floor(window.innerWidth * 0.55),
    ];
    for (const x of probeXs) {
      const stack = document.elementsFromPoint(Math.max(8, x), 4) || [];
      for (const el of stack) {
        if (!el || el.id === 'shopvd-sidebar' || el.id === 'shopvd-expand-rail') continue;
        if (el.closest?.('#shopvd-sidebar, #shopvd-expand-rail')) continue;
        const style = window.getComputedStyle(el);
        const pos = style.position;
        if (pos !== 'fixed' && pos !== 'sticky') continue;
        const rect = el.getBoundingClientRect();
        if (rect.top > 4 || rect.height < 36 || rect.height > 96) continue;
        if (rect.width < window.innerWidth * 0.35) continue;
        best = Math.max(best, Math.round(rect.bottom));
      }
    }
    // Clamp hợp lý: header Pancake thường ~48–64px
    if (best < 40 || best > 96) return fallback;
    return best;
  } catch (_) {
    return fallback;
  }
}

function applyPancakeHeaderOffset() {
  const offset = measurePancakeTopHeaderOffset();
  document.documentElement.style.setProperty('--shopvd-pancake-header-offset', `${offset}px`);
}

function schedulePancakeHeaderOffsetSync() {
  if (shopvdHeaderOffsetRaf) cancelAnimationFrame(shopvdHeaderOffsetRaf);
  shopvdHeaderOffsetRaf = requestAnimationFrame(() => {
    shopvdHeaderOffsetRaf = 0;
    applyPancakeHeaderOffset();
  });
}

function bindPancakeHeaderOffsetSync() {
  if (shopvdHeaderOffsetBound) {
    schedulePancakeHeaderOffsetSync();
    return;
  }
  shopvdHeaderOffsetBound = true;
  applyPancakeHeaderOffset();
  window.addEventListener('resize', schedulePancakeHeaderOffsetSync, { passive: true });
  // Pancake đôi khi render header chậm / đổi layout
  setTimeout(schedulePancakeHeaderOffsetSync, 300);
  setTimeout(schedulePancakeHeaderOffsetSync, 1200);
}

function syncSidebarWithPageUrl() {
  if (!isAllowedPage()) {
    removeSidebarIfPresent();
    return;
  }
  try {
    init();
  } catch (err) {
    console.error('[ShopVD] init failed', err);
  }
}

function watchPageUrlChanges() {
  let lastHref = window.location.href;

  const check = () => {
    if (window.location.href === lastHref) return;
    lastHref = window.location.href;
    syncSidebarWithPageUrl();
    schedulePancakeCustomerNameSync();
  };

  window.addEventListener('popstate', check);

  const pushState = history.pushState;
  history.pushState = function (...args) {
    pushState.apply(this, args);
    check();
  };

  const replaceState = history.replaceState;
  history.replaceState = function (...args) {
    replaceState.apply(this, args);
    check();
  };
}

if (isAllowedPage()) {
  console.log('🚀 ShopVD Order Helper loaded');
} else {
  console.log('ShopVD Order Helper: skipped — not on allowed page');
}

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

// Cache discounts (active codes for order form)
let allDiscountsCache = [];
let discountCodeValidating = false;

// Smart paste state
let smartPasteBusy = false;

// Create sidebar HTML
function createSidebar() {
  const sidebar = document.createElement('div');
  sidebar.id = 'shopvd-sidebar';
  sidebar.dataset.shopvdVersion = SHOPVD_EXT_VERSION;
  sidebar.innerHTML = `
    <div class="shopvd-top-sticky">
      <div class="shopvd-top-bar">
        <div class="shopvd-top-brand">
          <span class="shopvd-top-title">ShopVD</span>
          <span class="shopvd-top-sub">Tạo đơn · v${SHOPVD_EXT_VERSION}</span>
        </div>
        <div class="shopvd-top-actions">
          <button type="button" id="shopvd-unsaved-badge" class="shopvd-unsaved-badge hidden" title="Các chat đã lấy thông tin nhưng chưa tạo đơn">
            <span id="shopvd-unsaved-count" class="shopvd-unsaved-count">0</span>
            <span class="shopvd-unsaved-label">chưa lưu</span>
          </button>
          <button type="button" id="shopvd-ship-status-refresh" class="shopvd-ship-refresh hidden" title="Kiểm tra lại đã lưu DB" aria-label="Kiểm tra lại đã lưu DB">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/></svg>
          </button>
          <button id="shopvd-toggle" class="shopvd-btn-toggle" title="Thu gọn sidebar" aria-label="Thu gọn sidebar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        </div>
      </div>

      <div id="shopvd-ship-status" class="shopvd-ship-strip" aria-live="polite">
        <div id="shopvd-ship-status-body" class="shopvd-ship-strip-body">
          <span class="shopvd-ship-idle">Bấm vào chat để kiểm tra đã lưu đơn chưa</span>
        </div>
      </div>

      <div id="shopvd-unsaved-panel" class="shopvd-unsaved-panel hidden" aria-live="polite">
        <div class="shopvd-unsaved-panel-head">
          <strong>Đơn chưa lưu</strong>
          <span class="shopvd-unsaved-panel-hint">SĐT từ Pancake · chưa có đơn Chưa gửi hàng</span>
        </div>
        <div id="shopvd-unsaved-list" class="shopvd-unsaved-list"></div>
      </div>
    </div>
    
    <div class="shopvd-sidebar-content">
      <!-- Smart Paste - Dán nhanh thông tin khách hàng -->
      <div class="shopvd-section shopvd-smart-paste-block">
        <div class="shopvd-smart-paste-header">
          <div class="shopvd-smart-paste-icon-wrap" aria-hidden="true">
            <svg class="shopvd-smart-paste-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09z M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456z"/>
            </svg>
          </div>
          <h3 class="shopvd-smart-paste-title">Lấy thông tin khách hàng</h3>
        </div>
        <div class="shopvd-smart-paste-body">
          <div class="shopvd-grab-actions">
            <button type="button" id="shopvd-grab-selection-btn" class="shopvd-grab-btn shopvd-grab-btn-primary" title="Bôi đen tin khách trên Pancake rồi bấm (Ctrl+Shift+G)">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a4 4 0 0 0-4 4v1"/>
              </svg>
              Lấy từ tin đã chọn
            </button>
            <button type="button" id="shopvd-grab-latest-btn" class="shopvd-grab-btn shopvd-grab-btn-secondary" title="Tự tìm tin địa chỉ/SĐT gần nhất của khách">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
              </svg>
              Tin gần nhất
            </button>
          </div>
          <p class="shopvd-grab-hint">Khách gửi SĐT + địa chỉ → tự báo <strong>chưa lưu</strong> · Nút <strong>→ ShopVD</strong> chỉ hiện khi rê chuột · Không che tin nhắn</p>

          <details class="shopvd-grab-manual" open>
            <summary>Dán thủ công</summary>
            <textarea 
              id="shopvd-smart-paste-input" 
              rows="3" 
              placeholder="Dán toàn bộ thông tin khách hàng vào đây…&#10;&#10;Ví dụ:&#10;198/8 Nguyễn Bình Khiêm, Phường Vĩnh Quang, TP Rạch Giá, Kiên Giang&#10;0375323573 Nguyễn Văn A"
              class="shopvd-smart-paste-textarea"
            ></textarea>
          </details>

          <div class="shopvd-smart-paste-actions">
            <button type="button" id="shopvd-smart-paste-btn" class="shopvd-smart-paste-btn">
              <svg class="shopvd-smart-paste-btn-icon" id="shopvd-smart-paste-btn-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09z"/>
              </svg>
              <span id="shopvd-smart-paste-btn-text">Phân tích &amp; điền form</span>
            </button>
            <div id="shopvd-smart-paste-status" class="shopvd-smart-paste-status hidden"></div>
          </div>
        </div>
      </div>

      <div class="shopvd-divider"></div>

      <!-- Form khách hàng -->
      <form id="shopvd-order-form" novalidate>
        <div class="shopvd-section">
          <h3>👤 Thông tin khách hàng</h3>
          
          <div class="shopvd-grid-2">
            <div class="shopvd-form-group" data-validate-wrap="customer-name">
              <label>Tên khách hàng *</label>
              <input type="text" id="customer-name" placeholder="Nguyễn Văn A" required autocomplete="name">
              <p class="shopvd-pancake-name-hint hidden" id="customer-name-pancake-hint">Tự lấy từ Pancake</p>
              <p class="shopvd-field-error" id="validate-error-customer-name" hidden role="alert"></p>
            </div>

            <div class="shopvd-form-group" data-validate-wrap="customer-phone">
              <label>Số điện thoại *</label>
              <input type="tel" id="customer-phone" placeholder="0901234567" inputmode="numeric" pattern="[0-9]*" autocomplete="tel" required>
              <p class="shopvd-field-error" id="validate-error-customer-phone" hidden role="alert"></p>
            </div>
          </div>

          <!-- Địa chỉ giao hàng -->
          <div class="shopvd-address-section">
            <div class="shopvd-address-box">
              <div class="shopvd-address-header">
                <div class="shopvd-address-icon-wrap" aria-hidden="true">
                  <svg class="shopvd-address-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"/>
                  </svg>
                </div>
                <h4 class="shopvd-address-title">Địa chỉ giao hàng <span class="shopvd-required">*</span></h4>
              </div>

              <div class="shopvd-address-fields">
                <div class="shopvd-address-field" data-validate-wrap="customer-province">
                  <label class="shopvd-address-field-label" for="province-combobox-btn">Tỉnh / Thành phố</label>
                  <div class="shopvd-combobox-wrapper">
                    <button type="button" id="province-combobox-btn" class="shopvd-combobox-button" aria-haspopup="listbox">
                      <span class="shopvd-combobox-lead-icon" aria-hidden="true">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
                          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"/>
                        </svg>
                      </span>
                      <span id="province-combobox-text" class="shopvd-combobox-text">Chọn tỉnh/thành phố</span>
                      <span class="shopvd-combobox-chevron" aria-hidden="true">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6"/>
                        </svg>
                      </span>
                    </button>
                    <div id="province-combobox-dropdown" class="shopvd-combobox-dropdown hidden">
                      <input
                        type="text"
                        id="province-combobox-search"
                        class="shopvd-combobox-search"
                        placeholder="Tìm tỉnh/thành phố..."
                        autocomplete="off"
                      >
                      <div class="shopvd-combobox-list-header">Tỉnh / Thành phố</div>
                      <div id="province-combobox-list" class="shopvd-combobox-list"></div>
                    </div>
                  </div>
                  <p class="shopvd-field-error" id="validate-error-customer-province" hidden role="alert"></p>
                </div>

                <div id="ward-combobox-wrapper" class="shopvd-address-field hidden" data-validate-wrap="customer-ward">
                  <label class="shopvd-address-field-label" for="ward-combobox-btn">Phường / Xã</label>
                  <div class="shopvd-combobox-wrapper">
                    <button type="button" id="ward-combobox-btn" class="shopvd-combobox-button" aria-haspopup="listbox">
                      <span class="shopvd-combobox-lead-icon" aria-hidden="true">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
                          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"/>
                        </svg>
                      </span>
                      <span id="ward-combobox-text" class="shopvd-combobox-text">Chọn phường/xã</span>
                      <span class="shopvd-combobox-chevron" aria-hidden="true">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6"/>
                        </svg>
                      </span>
                    </button>
                    <div id="ward-combobox-dropdown" class="shopvd-combobox-dropdown hidden">
                      <input
                        type="text"
                        id="ward-combobox-search"
                        class="shopvd-combobox-search"
                        placeholder="Tìm phường/xã..."
                        autocomplete="off"
                      >
                      <div class="shopvd-combobox-list-header">Phường / Xã</div>
                      <div id="ward-combobox-list" class="shopvd-combobox-list"></div>
                    </div>
                  </div>
                  <p class="shopvd-field-error" id="validate-error-customer-ward" hidden role="alert"></p>
                </div>

                <select id="customer-province" required class="shopvd-hidden">
                  <option value="">-- Chọn Tỉnh/TP --</option>
                </select>
                <select id="customer-ward" disabled required class="shopvd-hidden">
                  <option value="">-- Chọn Phường/Xã --</option>
                </select>

                <div id="customer-street-field" class="shopvd-address-field hidden" data-validate-wrap="customer-street">
                  <label class="shopvd-address-field-label" for="customer-street">Số nhà, tên đường</label>
                  <input
                    type="text"
                    id="customer-street"
                    placeholder="Ví dụ: 198/8 Nguyễn Bình Khiêm"
                    class="shopvd-address-input"
                  >
                  <p class="shopvd-field-error" id="validate-error-customer-street" hidden role="alert"></p>
                </div>

                <p id="customer-address-preview" class="shopvd-address-preview"></p>

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
              <span class="shopvd-search-icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                  <path fill-rule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" clip-rule="evenodd" />
                </svg>
              </span>
              <input 
                type="text" 
                id="product-search" 
                placeholder="Tìm sản phẩm hoặc thêm tay..."
                autocomplete="off"
              >
              <button type="button" id="product-search-clear" class="shopvd-search-clear hidden" aria-label="Xóa tìm kiếm">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div id="product-search-results" class="shopvd-search-results hidden"></div>
            <div id="product-search-form" class="shopvd-search-form hidden">
              <div class="shopvd-search-form-header">
                <div class="shopvd-search-form-main">
                  <div class="shopvd-search-form-thumb-wrap">
                    <img id="product-search-form-image" class="shopvd-search-form-thumb hidden" alt="">
                    <div id="product-search-form-thumb-fallback" class="shopvd-search-form-thumb shopvd-search-form-thumb-fallback">📦</div>
                  </div>
                  <div class="shopvd-search-form-product">
                    <div id="product-search-form-name" class="shopvd-search-form-name"></div>
                    <div id="product-search-form-price" class="shopvd-search-form-price"></div>
                  </div>
                </div>
                <button type="button" id="product-search-form-close" class="shopvd-search-form-close" aria-label="Đóng">×</button>
              </div>
              <div class="shopvd-search-form-row">
                <div class="shopvd-search-form-field">
                  <label for="product-search-qty">SL</label>
                  <input type="number" id="product-search-qty" class="shopvd-search-form-input shopvd-search-form-qty" value="1" min="1">
                </div>
                <div id="product-search-form-weight-field" class="shopvd-search-form-field shopvd-search-form-field-weight">
                  <label for="product-search-weight">Cân nặng</label>
                  <input type="text" id="product-search-weight" class="shopvd-search-form-input" placeholder="5kg">
                </div>
                <div class="shopvd-search-form-field shopvd-search-form-field-notes">
                  <label for="product-search-notes">Lưu ý</label>
                  <input type="text" id="product-search-notes" class="shopvd-search-form-input" placeholder="Ghi chú...">
                </div>
              </div>
              <button type="button" id="product-search-add-btn" class="shopvd-search-form-add-btn">Thêm vào đơn</button>
            </div>
          </div>

          <!-- Product Tabs -->
          <div class="shopvd-product-tabs">
            <button 
              type="button"
              class="shopvd-product-tab active" 
              data-tab="featured"
            >
              <svg class="shopvd-btn-dot" viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="4" fill="#f97316"/></svg>
              Bán chạy
            </button>
            <button 
              type="button"
              class="shopvd-product-tab" 
              data-tab="all"
            >
              <svg class="shopvd-btn-dot" viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="4" fill="#6366f1"/></svg>
              Tất cả
            </button>
            <button 
              type="button"
              class="shopvd-product-tab" 
              data-tab="manual"
            >
              <svg class="shopvd-btn-dot" viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="4" fill="#10b981"/></svg>
              Tùy chỉnh
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
              <div id="category-filter-buttons" class="shopvd-category-buttons">
                <button type="button" class="shopvd-category-btn active" data-category-id="">Tất cả</button>
              </div>
            </div>
            <!-- All Products Panel -->
            <div class="shopvd-all-panel">
              <div id="all-products-grid" class="shopvd-all-products-grid">
                <!-- Products will be rendered here -->
              </div>
              <div id="fab-container" class="shopvd-bulk-bar hidden">
                <div class="shopvd-bulk-bar-info">
                  <span class="shopvd-bulk-bar-count" id="fab-count">0</span>
                  <span class="shopvd-bulk-bar-label">sản phẩm đã chọn</span>
                </div>
                <button type="button" class="shopvd-bulk-bar-btn" id="bulk-add-fab">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Thêm vào đơn
                </button>
              </div>
            </div>
          </div>

          <!-- Manual Product Tab Content -->
          <div id="manual-tab-content" class="shopvd-tab-content hidden">
            <div class="shopvd-manual-form">
              <div class="shopvd-manual-form-label">Thêm sản phẩm tùy chỉnh</div>
              <input type="text" id="manual-product-name" placeholder="Tên sản phẩm" class="shopvd-edit-input">
              <div class="shopvd-edit-row shopvd-edit-row-prices">
                <input type="number" id="manual-product-price" placeholder="Giá bán" min="0" step="1000" class="shopvd-edit-input">
                <input type="number" id="manual-product-cost" placeholder="Giá vốn" min="0" step="1" class="shopvd-edit-input">
                <input type="text" id="manual-product-weight" placeholder="Cân nặng" class="shopvd-edit-input">
              </div>
              <div class="shopvd-edit-row shopvd-edit-row-meta shopvd-edit-row-meta-manual">
                <div class="shopvd-manual-qty-stepper">
                  <button type="button" id="manual-product-qty-minus" class="shopvd-manual-qty-btn" aria-label="Giảm số lượng">−</button>
                  <input type="number" id="manual-product-quantity" placeholder="SL" min="1" value="1" class="shopvd-manual-qty-input">
                  <button type="button" id="manual-product-qty-plus" class="shopvd-manual-qty-btn" aria-label="Tăng số lượng">+</button>
                </div>
                <input type="text" id="manual-product-notes" placeholder="Lưu ý..." class="shopvd-edit-input">
              </div>
              <div class="shopvd-edit-actions">
                <button type="button" id="add-manual-product-submit" class="shopvd-btn-save">Thêm vào đơn</button>
              </div>
            </div>
          </div>

          <!-- Selected Products — Order Cart -->
          <div class="shopvd-order-cart" id="shopvd-order-cart" data-validate-wrap="order-products">
            <div class="shopvd-order-cart-header">
              <div class="shopvd-order-cart-header-left">
                <span class="shopvd-order-cart-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                  </svg>
                </span>
                <span class="shopvd-order-cart-title">Sản phẩm trong đơn</span>
              </div>
              <span class="shopvd-order-cart-count" id="order-cart-count">0</span>
            </div>
            <p class="shopvd-field-error shopvd-field-error-cart" id="validate-error-order-products" hidden role="alert"></p>
            <div id="products-list" class="shopvd-products-list">
              <!-- Products will be added here -->
            </div>
          </div>
        </div>

        <!-- Thanh toán & Phí ship -->
        <div class="shopvd-section">
          <h3>💰 Thanh toán</h3>
          
          <!-- Payment Method Buttons -->
          <div class="shopvd-form-group">
            <label>Phương thức thanh toán</label>
            <div class="shopvd-button-group">
              <button type="button" class="shopvd-payment-btn active" data-payment="cod">
                <svg class="shopvd-btn-dot" viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="4" fill="#059669"/></svg>
                COD
              </button>
              <button type="button" class="shopvd-payment-btn" data-payment="bank_transfer">
                <svg class="shopvd-btn-dot" viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="4" fill="#2563eb"/></svg>
                Đã CK
              </button>
              <button type="button" class="shopvd-payment-btn" data-payment="deposit">
                <svg class="shopvd-btn-dot" viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="4" fill="#d97706"/></svg>
                Cọc trước
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
          
          <!-- Phí ship (badge) & Miễn phí -->
          <div class="shopvd-shipping-row">
            <div class="shopvd-shipping-row-head">
              <span class="shopvd-shipping-row-icon" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="1" y="3" width="15" height="13"/>
                  <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
                  <circle cx="5.5" cy="18.5" r="2.5"/>
                  <circle cx="18.5" cy="18.5" r="2.5"/>
                </svg>
              </span>
              <span class="shopvd-shipping-row-title">Phí ship</span>
            </div>
            <div class="shopvd-shipping-badges">
              <button type="button" class="shopvd-shipping-badge" id="shipping-fee-badge" data-shipping-field="fee" title="Phí ship khách trả — bấm để sửa">
                <span class="shopvd-shipping-badge-kicker">Khách trả</span>
                <span class="shopvd-shipping-badge-value" id="shipping-fee-display">0đ</span>
              </button>
              <button type="button" class="shopvd-shipping-badge shopvd-shipping-badge-cost" id="shipping-cost-badge" data-shipping-field="cost" title="Chi phí ship thực tế — bấm để sửa">
                <span class="shopvd-shipping-badge-kicker">Cost</span>
                <span class="shopvd-shipping-badge-value" id="shipping-cost-display">0đ</span>
              </button>
            </div>
            <div id="shipping-edit-popover" class="shopvd-shipping-popover hidden" role="dialog" aria-modal="true" aria-labelledby="shipping-edit-label">
              <label id="shipping-edit-label" for="shipping-edit-input">Phí ship khách trả</label>
              <input type="number" id="shipping-edit-input" min="0" step="1000" inputmode="numeric">
              <div class="shopvd-shipping-popover-actions">
                <button type="button" class="shopvd-shipping-popover-cancel" id="shipping-edit-cancel">Hủy</button>
                <button type="button" class="shopvd-shipping-popover-save" id="shipping-edit-save">Lưu</button>
              </div>
            </div>
            <input type="hidden" id="shipping-fee" value="0">
            <input type="hidden" id="shipping-cost" value="0">
          </div>
          
          <!-- Free Shipping -->
          <label class="shopvd-option-card shopvd-option-card-freeship">
            <span class="shopvd-option-icon shopvd-option-icon-freeship" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="1" y="3" width="15" height="13"/>
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
                <circle cx="5.5" cy="18.5" r="2.5"/>
                <circle cx="18.5" cy="18.5" r="2.5"/>
              </svg>
            </span>
            <span class="shopvd-option-body">
              <span class="shopvd-option-title">Miễn phí ship</span>
              <span class="shopvd-option-desc" id="freeship-hint">Khách không trả phí vận chuyển</span>
            </span>
            <input type="checkbox" id="free-shipping" class="shopvd-option-checkbox-input">
          </label>
        </div>

        <!-- Nguồn khách & Thông tin thêm -->
        <div class="shopvd-section">
          <h3>📋 Thông tin thêm</h3>
          
          <!-- Customer Source Buttons (Required) -->
          <div class="shopvd-form-group" data-validate-wrap="customer-source">
            <label>Nguồn khách <span style="color: #ef4444;">*</span></label>
            <div class="shopvd-button-group" id="customer-source-group">
              <button type="button" class="shopvd-source-btn" data-source="zalo">
                <svg class="shopvd-btn-dot" viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="4" fill="#0068ff"/></svg>
                Zalo
              </button>
              <button type="button" class="shopvd-source-btn" data-source="facebook">
                <svg class="shopvd-btn-dot" viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="4" fill="#1877f2"/></svg>
                Facebook
              </button>
              <button type="button" class="shopvd-source-btn" data-source="tiktok">
                <svg class="shopvd-btn-dot" viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="4" fill="#111827"/></svg>
                TikTok
              </button>
            </div>
            <input type="hidden" id="customer-source" value="">
            <p class="shopvd-field-error" id="validate-error-customer-source" hidden role="alert"></p>
          </div>
          
          <div class="shopvd-form-group">
            <label>Mã CTV</label>
            <input type="text" id="referral-code" placeholder="Mã cộng tác viên">
          </div>

          <div class="shopvd-discount-panel" id="shopvd-discount-panel">
            <div class="shopvd-discount-panel-head">
              <span class="shopvd-discount-panel-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                  <line x1="7" y1="7" x2="7.01" y2="7"/>
                </svg>
              </span>
              <span class="shopvd-discount-panel-title">Ưu đãi & giảm giá</span>
            </div>

            <div id="discount-applied-bar" class="shopvd-discount-applied hidden">
              <div class="shopvd-discount-applied-main">
                <span class="shopvd-discount-applied-dot" aria-hidden="true"></span>
                <span class="shopvd-discount-applied-text">
                  <span id="discount-display">Chưa áp dụng</span>
                  <strong id="discount-applied-amount"></strong>
                </span>
              </div>
              <button type="button" class="shopvd-discount-applied-remove" id="discount-applied-remove" title="Xóa giảm giá" aria-label="Xóa giảm giá">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div id="discount-entry" class="shopvd-discount-entry">
              <div class="shopvd-discount-code-row">
                <input type="text" id="discount-code-quick" placeholder="Nhập mã giảm giá" autocomplete="off" spellcheck="false">
                <button type="button" id="discount-code-quick-apply" class="shopvd-discount-code-apply">Áp dụng</button>
              </div>
              <p id="discount-quick-status" class="shopvd-discount-quick-status hidden" role="status"></p>

              <div class="shopvd-discount-quick-actions">
                <div class="shopvd-discount-inline-presets" id="discount-inline-presets">
                  <span class="shopvd-discount-inline-empty">Thêm SP để gợi ý giảm</span>
                </div>
                <button type="button" id="open-discount-modal" class="shopvd-discount-more-btn" data-open-tab="custom">
                  Thêm tùy chọn
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
                <button type="button" class="shopvd-discount-more-btn shopvd-discount-codes-btn" id="open-discount-codes" data-open-tab="code">
                  Danh sách mã
                </button>
              </div>
            </div>

            <input type="hidden" id="discount-code">
            <input type="hidden" id="discount-amount" value="0">
          </div>

          <div class="shopvd-options-stack">
            <label class="shopvd-option-card shopvd-option-card-priority">
              <span class="shopvd-option-icon shopvd-option-icon-priority" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </span>
              <span class="shopvd-option-body">
                <span class="shopvd-option-title">Đánh dấu đơn ưu tiên</span>
                <span class="shopvd-option-desc">Đơn ưu tiên sẽ hiển thị đầu tiên trong danh sách</span>
              </span>
              <input type="checkbox" id="is-priority" class="shopvd-option-checkbox-input">
            </label>

            <label class="shopvd-option-card shopvd-option-card-sendlater">
              <span class="shopvd-option-icon shopvd-option-icon-sendlater" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </span>
              <span class="shopvd-option-body">
                <span class="shopvd-option-title">Gửi sau</span>
                <span class="shopvd-option-desc">Đơn vào trạng thái «Gửi sau», có ngày dự kiến gửi — chưa tính là đã gửi hàng.</span>
              </span>
              <input type="checkbox" id="send-later" class="shopvd-option-checkbox-input">
            </label>
          </div>

          <div id="send-later-fields" class="shopvd-form-group shopvd-sendlater-fields hidden">
            <label>Ngày giờ dự kiến gửi</label>
            <input type="datetime-local" id="planned-send-time">
          </div>
        </div>

        <!-- Ghi chú -->
        <div class="shopvd-section">
          <div class="shopvd-form-group">
            <label class="shopvd-label-with-icon">
              <svg class="shopvd-label-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"/>
              </svg>
              <span class="shopvd-label-text">Ghi chú đơn hàng</span>
            </label>
            <textarea id="order-notes" placeholder="Ghi chú thêm..." rows="2"></textarea>
          </div>
        </div>
      </form>

      <!-- Status message -->
      <div id="shopvd-status" class="shopvd-status hidden"></div>
    </div>

    <!-- Sticky footer: Tạo đơn -->
    <div class="shopvd-sticky-footer">
      <div class="shopvd-sticky-footer-left">
        <span class="shopvd-sticky-footer-label">Tổng đơn</span>
        <strong id="sticky-total-amount" class="shopvd-sticky-footer-total">0đ</strong>
      </div>
      <button type="submit" form="shopvd-order-form" id="create-order-btn" class="shopvd-sticky-create-btn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
        </svg>
        Tạo đơn hàng
      </button>
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
            <p class="shopvd-dm-code-browse-hint">Nhập mã ở ô trên form đơn, hoặc chọn trực tiếp từ danh sách:</p>

            <div class="shopvd-dm-section shopvd-dm-codes-section">
              <div class="shopvd-dm-section-label">Mã đang hoạt động</div>
              <input type="search" id="discount-code-search" placeholder="Tìm mã, tên..." class="shopvd-dm-code-search">
              <div id="discount-codes-list" class="shopvd-dm-codes-list">
                <p class="shopvd-dm-codes-empty">Đang tải danh sách mã…</p>
              </div>
            </div>

            <p id="discount-code-status" class="shopvd-dm-code-status hidden"></p>
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

    <!-- Order success toast (auto-hide, không chặn thao tác) -->
    <div id="shopvd-order-success-toast" class="shopvd-ost hidden" role="status" aria-live="polite">
      <div class="shopvd-ost-icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <div class="shopvd-ost-body">
        <div class="shopvd-ost-row">
          <strong class="shopvd-ost-title">Đã tạo đơn</strong>
          <button type="button" id="ost-order-id" class="shopvd-ost-order-id" title="Bấm để copy mã đơn">—</button>
        </div>
        <p id="ost-summary" class="shopvd-ost-summary"></p>
      </div>
      <button type="button" id="shopvd-ost-close" class="shopvd-ost-close" title="Đóng" aria-label="Đóng thông báo">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `;

  document.body.appendChild(sidebar);

  const expandRail = document.createElement('button');
  expandRail.id = 'shopvd-expand-rail';
  expandRail.type = 'button';
  expandRail.className = 'shopvd-expand-rail hidden';
  expandRail.title = 'Mở sidebar ShopVD';
  expandRail.setAttribute('aria-label', 'Mở sidebar ShopVD');
  expandRail.innerHTML = `
    <span class="shopvd-rail-grip" aria-hidden="true"></span>
    <span class="shopvd-rail-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    </span>
    <span class="shopvd-rail-label">ShopVD</span>
    <span class="shopvd-rail-chevron" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
    </span>
  `;
  document.body.appendChild(expandRail);

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
        .slice(0, 10);  // Take top 10 best-selling products
      
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
  const streetField = document.getElementById('customer-street-field');
  if (streetField) streetField.classList.add('hidden');

  // Update address
  updateFullAddress();
  revalidateFieldIfActive('customer-province');
  revalidateFieldIfActive('customer-ward');
  onCustomerInfoChangedForProductScroll(80);
}
function toggleProvinceCombobox() {
  const dropdown = document.getElementById('province-combobox-dropdown');
  const search = document.getElementById('province-combobox-search');
  
  if (!dropdown) return;

  const isHidden = dropdown.classList.contains('hidden');
  
  // Close all dropdowns first
  closeAllComboboxes();
  
  if (isHidden) {
    dropdown.classList.remove('hidden');
    setComboboxOpen('province-combobox-btn', true);
    if (search) {
      search.value = '';
      search.focus();
    }
    filterProvinceCombobox('');
  }
}

function setComboboxOpen(btnId, isOpen) {
  const btn = document.getElementById(btnId);
  if (btn) btn.classList.toggle('is-open', isOpen);
}

function closeProvinceCombobox() {
  const dropdown = document.getElementById('province-combobox-dropdown');
  if (dropdown) dropdown.classList.add('hidden');
  setComboboxOpen('province-combobox-btn', false);
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
  const streetField = document.getElementById('customer-street-field');
  const streetInput = document.getElementById('customer-street');
  if (streetField) streetField.classList.remove('hidden');
  if (streetInput) streetInput.focus();

  // Update address
  updateFullAddress();
  revalidateFieldIfActive('customer-ward');
  revalidateFieldIfActive('customer-street');
  onCustomerInfoChangedForProductScroll(180);
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
    setComboboxOpen('ward-combobox-btn', true);
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
  setComboboxOpen('ward-combobox-btn', false);
}

function closeAllComboboxes() {
  closeProvinceCombobox();
  closeWardCombobox();
}

function resetCustomerAddressForm() {
  closeAllComboboxes();
  resetProductSectionScrollGate();

  const provinceSelect = document.getElementById('customer-province');
  const wardSelect = document.getElementById('customer-ward');
  const streetInput = document.getElementById('customer-street');
  const addressInput = document.getElementById('customer-address');
  const previewEl = document.getElementById('customer-address-preview');

  if (provinceSelect) provinceSelect.value = '';
  if (wardSelect) {
    wardSelect.value = '';
    wardSelect.disabled = true;
    wardSelect.innerHTML = '<option value="">-- Chọn Phường/Xã --</option>';
  }
  if (streetInput) streetInput.value = '';
  if (addressInput) addressInput.value = '';
  if (previewEl) previewEl.textContent = '';

  const provinceSearch = document.getElementById('province-combobox-search');
  const wardSearch = document.getElementById('ward-combobox-search');
  if (provinceSearch) provinceSearch.value = '';
  if (wardSearch) wardSearch.value = '';

  const provinceBtn = document.getElementById('province-combobox-btn');
  const provinceText = document.getElementById('province-combobox-text');
  if (provinceBtn) provinceBtn.classList.remove('selected', 'is-open');
  if (provinceText) provinceText.textContent = 'Chọn tỉnh/thành phố';

  document.getElementById('ward-combobox-wrapper')?.classList.add('hidden');
  document.getElementById('customer-street-field')?.classList.add('hidden');

  const wardBtn = document.getElementById('ward-combobox-btn');
  const wardText = document.getElementById('ward-combobox-text');
  const wardList = document.getElementById('ward-combobox-list');
  if (wardBtn) {
    wardBtn.classList.remove('selected', 'is-open');
    wardBtn.disabled = false;
  }
  if (wardText) wardText.textContent = 'Chọn phường/xã';
  if (wardList) wardList.innerHTML = '';

  filterProvinceCombobox('');
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
    scheduleMarkCurrentDraftFromForm(200);
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

  scheduleMarkCurrentDraftFromForm(250);
}

// === SMART PASTE FUNCTIONALITY ===
// smart-paste.js is bundled with the extension and loaded via manifest.json
// Functions available: smartParseCustomerInfo(), parseAddress(), etc.

// Set smart paste button loading state
function setSmartPasteStatus(type, message) {
  const statusEl = document.getElementById('shopvd-smart-paste-status');
  if (!statusEl) return;

  statusEl.className = 'shopvd-smart-paste-status';
  if (type) statusEl.classList.add(`is-${type}`);
  statusEl.textContent = message || '';
  statusEl.classList.toggle('hidden', !message);
}

function setSmartPasteLoading(loading) {
  const btn = document.getElementById('shopvd-smart-paste-btn');
  const btnText = document.getElementById('shopvd-smart-paste-btn-text');
  const btnIcon = document.getElementById('shopvd-smart-paste-btn-icon');
  const grabSelectionBtn = document.getElementById('shopvd-grab-selection-btn');
  const grabLatestBtn = document.getElementById('shopvd-grab-latest-btn');
  
  if (btn) btn.disabled = loading;
  if (grabSelectionBtn) grabSelectionBtn.disabled = loading;
  if (grabLatestBtn) grabLatestBtn.disabled = loading;
  if (btnText) btnText.textContent = loading ? 'Đang phân tích…' : 'Phân tích & điền form';
  if (btnIcon) {
    btnIcon.classList.toggle('animate-spin', loading);
  }
  if (loading) {
    setSmartPasteStatus('loading', 'Đang phân tích thông tin khách hàng…');
  }
}

// Show smart paste result
function showSmartPasteResult(parsedData) {
  if (!parsedData?.success) {
    setSmartPasteStatus('error', parsedData?.error || 'Không thể phân tích');
    return;
  }
  
  const d = parsedData.data || {};
  const parts = [];
  if (d.name) parts.push('Tên');
  if (d.phone) parts.push('SĐT');
  if (d.address?.province) parts.push('Địa chỉ');
  
  const conf = parsedData.confidence;
  const message = parts.length
    ? `Đã điền: ${parts.join(', ')}`
    : 'Không nhận diện được thông tin';

  if (conf === 'high') {
    setSmartPasteStatus('success', message);
  } else if (conf === 'medium') {
    setSmartPasteStatus('warning', message);
  } else {
    setSmartPasteStatus('error', message);
  }
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
    if (phoneInput) phoneInput.value = sanitizePhoneDigits(data.phone);
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
        document.getElementById('customer-street-field')?.classList.remove('hidden');
      }
      
      // Update full address
      updateFullAddress();
    }
  }

  applyPancakeNameIfEmpty();
  // Đủ thông tin khách → nhảy sang chọn SP; chưa đủ thì vẫn đưa mắt tới địa chỉ
  if (!maybeScrollToProductSectionAfterCustomerReady({ focus: true })) {
    scrollToCustomerInfoSection();
  }
}

function applyPancakeNameIfEmpty() {
  const nameInput = document.getElementById('customer-name');
  if (!nameInput || nameInput.value.trim()) return;

  const pancakeName = extractPancakeCustomerName();
  if (!pancakeName) return;

  nameInput.value = pancakeName;
  lastAutoFilledCustomerName = pancakeName;
  customerNameUserEdited = false;
  updatePancakeNameHint(true);
  clearValidationFieldError('customer-name');
  revalidateFieldIfActive('customer-name');
}

function scrollToCustomerInfoSection() {
  document.querySelector('.shopvd-address-section')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/** Chỉ scroll 1 lần khi form khách vừa đủ → sang phần sản phẩm */
let shopvdScrolledToProductsForCustomer = false;
let shopvdProductScrollTimer = 0;

function isCustomerInfoCompleteForProductScroll() {
  const name = document.getElementById('customer-name')?.value.trim() || '';
  const phone = sanitizePhoneDigits(document.getElementById('customer-phone')?.value);
  const provinceId = document.getElementById('customer-province')?.value;
  const wardId = document.getElementById('customer-ward')?.value;
  const street = document.getElementById('customer-street')?.value.trim() || '';
  return Boolean(name && isValidCustomerPhone(phone) && provinceId && wardId && street);
}

function isAddressComboboxOpen() {
  return Boolean(
    document.querySelector('#province-combobox-dropdown:not(.hidden), #ward-combobox-dropdown:not(.hidden)')
  );
}

function isProductSearchComfortablyVisible() {
  const search = document.getElementById('product-search');
  const sidebar = document.getElementById('shopvd-sidebar');
  if (!search || !sidebar) return false;
  const er = search.getBoundingClientRect();
  const sr = sidebar.getBoundingClientRect();
  return er.top >= sr.top + 48 && er.bottom <= sr.bottom - 24;
}

function resetProductSectionScrollGate() {
  shopvdScrolledToProductsForCustomer = false;
  clearTimeout(shopvdProductScrollTimer);
  shopvdProductScrollTimer = 0;
}

function scrollToProductSection({ focus = true } = {}) {
  const search = document.getElementById('product-search');
  const target = search?.closest('.shopvd-section')
    || document.querySelector('.shopvd-product-search-container')
    || search;
  if (!target) return;

  target.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (!focus || !search) return;
  setTimeout(() => {
    if (document.activeElement === search) return;
    const active = document.activeElement;
    // Đang gõ field khách / combobox → chỉ scroll, không cướp focus
    if (active?.closest?.('#shopvd-order-form') && (
      active.id === 'customer-name'
      || active.id === 'customer-phone'
      || active.id === 'customer-street'
      || active.closest?.('.shopvd-combobox-wrapper')
    )) return;
    if (active?.closest?.('.shopvd-product-search-container, #products-list, .shopvd-order-cart')) return;
    if (isAddressComboboxOpen()) return;
    search.focus({ preventScroll: true });
  }, 280);
}

/**
 * Khi thông tin khách vừa đủ → scroll tới tìm SP (1 lần / chu kỳ đủ form).
 * Trả true nếu đã scroll (hoặc đã đánh dấu bỏ qua vì đang nhìn thấy).
 */
function maybeScrollToProductSectionAfterCustomerReady(options = {}) {
  if (shopvdScrolledToProductsForCustomer) return false;
  if (shopvdRestoringDraft && !options.allowDuringRestore) return false;
  if (!isCustomerInfoCompleteForProductScroll()) return false;
  if (isAddressComboboxOpen()) return false;

  shopvdScrolledToProductsForCustomer = true;

  if (isProductSearchComfortablyVisible() && document.activeElement?.id === 'product-search') {
    return true;
  }

  scrollToProductSection({ focus: options.focus !== false });
  return true;
}

function scheduleMaybeScrollToProductSection(delayMs = 140) {
  clearTimeout(shopvdProductScrollTimer);
  shopvdProductScrollTimer = setTimeout(() => {
    shopvdProductScrollTimer = 0;
    maybeScrollToProductSectionAfterCustomerReady();
  }, delayMs);
}

/** Gọi khi field khách đổi: thiếu → mở lại gate; đủ → schedule scroll. */
function onCustomerInfoChangedForProductScroll(delayMs = 140) {
  if (!isCustomerInfoCompleteForProductScroll()) {
    resetProductSectionScrollGate();
    return;
  }
  scheduleMaybeScrollToProductSection(delayMs);
}

const PANCAKE_MSG_ROOT_SELECTOR = '.inbox-message-ele, [id^="message_m_"], [id^="message_"]';
/** Tin khách Pancake thật: inbox-message-ele + media-current-customer / media-message-from-customer */
const PANCAKE_CUSTOMER_INBOX_SELECTOR = '.inbox-message-ele.media-current-customer, .inbox-message-ele[id^="message_m_"]';
const PANCAKE_CUSTOMER_MSG_SELECTOR = '.media-message-from-customer, .client-message, .media-current-customer, .media-body-text.media-message-from-customer';
const PANCAKE_SHOP_MSG_SELECTOR = '.media-message-from-page, .message-from-page, .media-message-from-shop, .media-current-page';

const PANCAKE_MESSAGE_SELECTOR = [
  '.inbox-message-ele',
  '[id^="message_m_"]',
  '.media-message-from-customer',
  '.client-message',
  '[class*="message-item"]',
  '[class*="MessageItem"]',
  '[class*="chat-message"]',
  '[class*="ChatMessage"]',
  '[class*="message-bubble"]',
  '[class*="MessageBubble"]',
  '[class*="bubble-content"]',
  '[class*="msg-content"]',
  '[class*="MsgContent"]',
  '[class*="conversation-message"]',
  '[class*="ConversationMessage"]',
  '[class*="message-content"]',
  '[class*="MessageContent"]',
  '[class*="msg-row"]',
  '[class*="MsgRow"]',
  '[class*="text-msg"]',
  '[class*="content-message"]',
  '[data-message-id]',
  '[data-msg-id]',
].join(',');

const PANCAKE_CHAT_PANEL_SELECTOR = [
  '[class*="conversation-detail"]',
  '[class*="ConversationDetail"]',
  '[class*="message-list"]',
  '[class*="MessageList"]',
  '[class*="messages-wrapper"]',
  '[class*="MessagesWrapper"]',
  '[class*="chat-box"]',
  '[class*="ChatBox"]',
  '[class*="inbox-conversation"]',
  '[class*="conv-content"]',
  '[class*="messages-container"]',
  '[class*="MessagesContainer"]',
].join(',');

const PANCAKE_CONV_ITEM_SELECTOR = [
  '[class*="conversation-item"]',
  '[class*="ConversationItem"]',
  '[class*="thread-item"]',
  '[class*="inbox-item"]',
  '[class*="InboxItem"]',
  '[class*="conv-item"]',
  '[class*="ConvItem"]',
].join(',');

const PANCAKE_MESSAGE_CLASS_HINT = /message|bubble|msg-item|MsgItem|comment-item|text-content|TextContent|chat-item|ChatItem|msg-row|MsgRow/i;
const PANCAKE_GRAB_EXCLUDE_SELECTOR = [
  '[class*="conversation-header"]',
  '[class*="ConversationHeader"]',
  '[class*="chat-header"]',
  '[class*="ChatHeader"]',
  '[class*="conv-header"]',
  '[class*="header-info"]',
  '[class*="customer-info"]',
  '[class*="toolbar"]',
  '[class*="composer"]',
  '[class*="reply-box"]',
  '[class*="input-box"]',
  '[class*="InputBox"]',
  '#shopvd-sidebar',
  '#shopvd-expand-rail',
].join(',');

const PANCAKE_OUTBOUND_PATTERN = /outbound|sent-by-page|from-page|from-shop|merchant|staff|page-message|message-out|message-sent|is-sent|is-out|msg-out|MsgOut|from_me|from-me|is-me|is_me/i;
const PANCAKE_INBOUND_PATTERN = /inbound|from-customer|customer-message|message-in|message-received|is-received|is-in|user-message|msg-in|MsgIn|from_customer|from-customer|is-customer|is_customer|media-message-from-customer|media-current-customer|client-message|inbox-message-ele|phone-tag|phone-lag/i;
// Có dấu + không dấu (khách hay gõ telex/không dấu trên chat)
const PANCAKE_ADDRESS_HINT_PATTERN = /xã|xa\b|phường|phuong|huyện|huyen|tỉnh|tinh\b|thành phố|thanh pho|tp\.|quận|quan\b|đường|duong|thôn|thon\b|ấp|ap\b|khu\s*vực|khu\s*vuc|phố|pho\b|phường|p\.|h\.|tx\.|tt\.|\bHN\b|\bHCM\b|\bTP\.?HCM\b|cần thơ|can tho|ô môn|o mon|onmon|thanh xuân|thanh xuan|bình thạnh|binh thanh|thủ đức|thu duc|gò vấp|go vap|tân bình|tan binh|đống đa|dong da|cầu giấy|cau giay|long biên|long bien|hoàng mai|hoang mai|hà nội|ha noi|sài gòn|sai gon|đà nẵng|da nang|hải phòng|hai phong|biên hòa|bien hoa|vũng tàu|vung tau|nha trang|buôn ma|buon ma|pleiku|rạch giá|rach gia|mỹ tho|my tho|cà mau|ca mau|an giang|kiên giang|kien giang|bạc liêu|bac lieu|sóc trăng|soc trang|trà vinh|tra vinh|vĩnh long|vinh long|đồng tháp|dong thap|tiền giang|tien giang|bến tre|ben tre|hậu giang|hau giang|phước|phuoc|khánh|khanh|thới|thoi|địa chỉ|dia chi/i;
const PANCAKE_PHONE_PATTERN = /(?:\+84|0)[35789]\d{8}|(?<!\d)[35789]\d{8}(?!\d)/;
/** SĐT mẫu trong placeholder form — không dùng khi quét chat */
const SHOPVD_PLACEHOLDER_PHONES = new Set(['0901234567', '0123456789', '0912345678']);
/** Pancake bọc SĐT: .phone-tag / .phone-tag-trusted (đôi khi class phone-lag) */
const PANCAKE_PHONE_TAG_SELECTOR = '.phone-tag, .phone-tag-trusted, .phone-lag, .phone-lag-trusted, [class*="phone-tag"], [class*="phone-lag"]';
const PANCAKE_CLIENT_TEXT_SELECTOR = '.message-text-ele.client-message, .client-message, .message-text-field, .message-text';
/** Số tin khách liền kề để ghép SĐT + địa chỉ (2 tin tách) */
const PANCAKE_SPLIT_INTENT_WINDOW = 6;

function isPlaceholderDraftPhone(phone) {
  return SHOPVD_PLACEHOLDER_PHONES.has(normalizeDraftPhone(phone));
}

/** Bỏ khoảng trắng giữa các chữ số (036 9426912 → 0369426912) rồi tìm SĐT. */
function extractAllPhonesFromText(text) {
  const compact = String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/(\d)[\s.\-]+(?=\d)/g, '$1');
  const phones = [];
  const re = /(?:\+84|0)[35789]\d{8}|(?<!\d)[35789]\d{8}(?!\d)/g;
  let m;
  while ((m = re.exec(compact)) !== null) {
    const p = sanitizePhoneDigits(m[0]);
    if (isValidDraftPhone(p) && !isPlaceholderDraftPhone(p)) phones.push(p);
  }
  return phones;
}

function textHasCustomerPhone(text) {
  return extractAllPhonesFromText(text).length > 0
    || PANCAKE_PHONE_PATTERN.test(String(text || '').replace(/(\d)[\s.\-]+(?=\d)/g, '$1'));
}

function textHasAddressHint(text) {
  return PANCAKE_ADDRESS_HINT_PATTERN.test(String(text || ''));
}

function looksLikeFreeformAddress(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (value.length < 10) return false;
  if (value.includes(',') && /[a-zA-ZÀ-ỹ0-9]/.test(value)) return true;
  if (/\b(HN|HCM|SG|TP\.?\s*HCM|Hà Nội|Thành phố)\b/i.test(value)) return true;
  // Địa chỉ chat không dấu, không dấu phẩy: "khu vuc binh khanh phuoc thoi onmon can tho"
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length >= 4 && /[a-zA-ZÀ-ỹ]/.test(value) && textHasAddressHint(value)) return true;
  if (words.length >= 5 && /[a-zA-ZÀ-ỹ]/.test(value) && !/^[\d\s+().-]+$/.test(value)) return true;
  return false;
}

/** Chuẩn hoá text địa chỉ hiển thị (bỏ nhãn SĐT/Địa chỉ, gọn khoảng trắng). */
function normalizeDetectedAddressText(raw) {
  let value = String(raw || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!value) return '';

  value = value
    .replace(/^(?:sđt|sdt|đt|dt|phone|tel)\s*[:：-]?\s*/i, '')
    .replace(/^(?:địa\s*chỉ|dia\s*chi|dc|addr|address)\s*[:：-]?\s*/i, '')
    .replace(/\b(?:sđt|sdt|đt|dt)\s*[:：-]?\s*(?:\+84|0)?[35789]\d{8}\b/gi, ' ')
    .replace(PANCAKE_PHONE_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[,:：\-–—.\s]+/, '')
    .replace(/[,:：\-–—.\s]+$/, '')
    .trim();

  return value.slice(0, 220);
}

function isUsableDetectedAddress(text) {
  const value = normalizeDetectedAddressText(text);
  if (!value || value.length < 8) return false;
  if (isJunkPendingAddress(value)) return false;
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length < 3 && !textHasAddressHint(value)) return false;
  return textHasAddressHint(value) || looksLikeFreeformAddress(value) || words.length >= 4;
}

/** Text preview Facebook / list — không coi là đơn chốt thật. */
function isJunkPendingAddress(address, source = '') {
  const a = String(address || '').trim().toLowerCase();
  if (!a) return true;
  if (a.startsWith('sđt từ list') || a.startsWith('sdt tu list')) return true;

  const junkPatterns = [
    /bạn đang phản hồi/,
    /bình luận của người dùng/,
    /bài viết trên trang/,
    /trên trang của/,
    /trang của mì/,
    /facebook/,
    /messenger/,
    /instagram/,
    /đã xem tin/,
    /seen at/,
    /preview:/,
    /^\s*sđt\s*[:：]/,
    /^\s*sdt\s*[:：]/,
  ];
  if (junkPatterns.some((re) => re.test(a))) return true;

  const src = String(source || '').trim();
  if (src === 'auto-detect' || src === 'extension') {
    const hasGeoHint = /(phường|xã|quận|huyện|tỉnh|thành phố|tp\.|đường|ấp|thôn|sn |số |khu phố|tổ dân)/i.test(a);
    const words = a.split(/\s+/).filter(Boolean);
    if (!hasGeoHint && words.length < 4) return true;
  }
  return false;
}

function draftSnapshotFromDraft(draft) {
  return {
    phone: draft?.phone || '',
    address: draft?.address || '',
    provinceId: draft?.provinceId || '',
    wardId: draft?.wardId || '',
    street: draft?.street || '',
    source: draft?.source || '',
  };
}

function isDraftEligibleForUnsavedList(draft) {
  if (!draft || !isValidDraftPhone(draft.phone)) return false;
  if (isPhoneKnownOrdered(draft.phone)) return false;
  if (isPhoneDismissed(draft.phone)) return false;
  return isCustomerSnapshotWorthy(draftSnapshotFromDraft(draft));
}

function pruneInvalidDraftsFromMap() {
  let changed = false;
  for (const [key, draft] of shopvdDraftMap) {
    if (!isDraftEligibleForUnsavedList(draft)) {
      shopvdDraftMap.delete(key);
      changed = true;
    }
  }
  if (changed) {
    schedulePersistDrafts(80);
    scheduleUnsavedDraftUi(40);
  }
  return changed;
}

/** Lấy text địa chỉ từ DOM tin Pancake (bỏ phone-tag / copy). */
function extractAddressTextFromMessageBubble(bubble) {
  if (!bubble) return '';
  const root = resolvePancakeMessageRoot(bubble) || bubble;
  const textRoot = root.querySelector(PANCAKE_CLIENT_TEXT_SELECTOR) || root;
  const clone = textRoot.cloneNode(true);
  clone.querySelectorAll(
    `${PANCAKE_PHONE_TAG_SELECTOR}, copy, a[href^="tel:"], script, style, .message-time, .msg-time`
  ).forEach((el) => el.remove());

  // Giữ xuống dòng giữa SĐT và địa chỉ (Pancake dùng <br>)
  clone.querySelectorAll('br').forEach((br) => {
    br.replaceWith(document.createTextNode('\n'));
  });

  const raw = String(clone.innerText || clone.textContent || '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim();

  return normalizeDetectedAddressText(raw);
}

function messageHasPhoneTag(el) {
  const root = resolvePancakeMessageRoot(el) || el;
  return !!root?.querySelector?.(PANCAKE_PHONE_TAG_SELECTOR)
    || !!root?.querySelector?.('a[href^="tel:"]');
}

function collectCustomerMessageRootsInOrder() {
  const seen = new Set();
  const roots = [];
  const scope = getActiveChatMessageQueryRoot();

  const push = (el) => {
    const root = resolvePancakeMessageRoot(el) || el;
    if (!root || seen.has(root)) return;
    if (!isInboxMessageInActiveChatScroller(root) && !isInActiveChatDetailColumn(root)) return;
    if (isGrabExcludedTarget(root) || isPancakeShopMessage(root)) return;
    if (!isPancakeCustomerMessage(root) && !isCustomerSideMessage(root)) return;
    seen.add(root);
    roots.push(root);
  };

  if (!scope) return roots;

  const queryRoot = scope;
  queryRoot.querySelectorAll(PANCAKE_CUSTOMER_INBOX_SELECTOR).forEach(push);
  queryRoot.querySelectorAll(PANCAKE_MSG_ROOT_SELECTOR).forEach(push);
  queryRoot.querySelectorAll('.chat-message.customer, .mock-pancake-customer-message').forEach(push);

  if (roots.length === 0) {
    queryRoot.querySelectorAll(PANCAKE_CUSTOMER_MSG_SELECTOR).forEach(push);
  }

  // Giữ đúng thứ tự DOM (cũ → mới) khi gộp nhiều selector
  roots.sort((a, b) => {
    if (a === b) return 0;
    const pos = a.compareDocumentPosition(b);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });

  return roots;
}

function resolvePancakeMessageRoot(el) {
  if (!el) return null;

  const mock = el.closest('.chat-message.customer, .mock-pancake-customer-message');
  if (mock) return mock;

  return el.closest(PANCAKE_MSG_ROOT_SELECTOR)
    || el.closest('.inbox-message-ele')
    || el.closest(PANCAKE_MESSAGE_SELECTOR);
}

function resolvePancakeGrabAnchor(el) {
  const root = resolvePancakeMessageRoot(el) || el;
  return root.querySelector('.media-body')
    || root.querySelector('.message-text-field')
    || root.querySelector('.client-message')
    || root;
}

function isPancakeShopMessage(el) {
  const root = resolvePancakeMessageRoot(el) || el;
  if (root.matches?.(PANCAKE_SHOP_MSG_SELECTOR)) return true;
  if (root.querySelector?.(PANCAKE_SHOP_MSG_SELECTOR)) return true;
  return /media-message-from-page|message-from-page|media-current-page|from-page/i.test(String(root.className || ''));
}

function isPancakeCustomerMessage(el) {
  const root = resolvePancakeMessageRoot(el) || el;
  if (isPancakeShopMessage(root)) return false;
  if (root.matches?.(PANCAKE_CUSTOMER_MSG_SELECTOR)) return true;
  if (root.querySelector?.(PANCAKE_CUSTOMER_MSG_SELECTOR)) return true;
  if (root.classList?.contains('media-current-customer')) return true;
  if (root.querySelector?.(PANCAKE_PHONE_TAG_SELECTOR)) return true;
  return false;
}

function getSelectionTextOutsideSidebar() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return '';

  const text = String(selection.toString() || '').trim();
  if (!text) return '';

  const anchor = selection.anchorNode;
  const focus = selection.focusNode;
  if (isInsideShopvdSidebar(anchor) || isInsideShopvdSidebar(focus)) {
    return '';
  }

  return text;
}

function findPancakeMessageBubble(target) {
  if (!target || isInsideShopvdSidebar(target)) return null;

  const mock = target.closest('.chat-message.customer, .mock-pancake-customer-message');
  if (mock && isGrabWorthyMessage(mock)) return mock;

  const root = target.closest(PANCAKE_MSG_ROOT_SELECTOR);
  if (root && isGrabWorthyMessage(root)) return root;

  const inner = target.closest(PANCAKE_CUSTOMER_MSG_SELECTOR);
  if (inner) {
    const resolved = resolvePancakeMessageRoot(inner);
    if (resolved && isGrabWorthyMessage(resolved)) return resolved;
  }

  return findMessageBubbleFromTarget(target);
}

function isGrabExcludedTarget(el) {
  if (!el) return true;
  if (isInsideShopvdSidebar(el) || isInsideConversationList(el)) return true;
  if (el.closest(PANCAKE_GRAB_EXCLUDE_SELECTOR)) return true;
  if (el.closest('textarea, input, button, select, [contenteditable="true"], [role="textbox"]')) return true;
  return false;
}

function getShopvdSidebarLeftEdge() {
  const sidebar = document.getElementById('shopvd-sidebar');
  return sidebar?.getBoundingClientRect().left ?? (window.innerWidth - 380);
}

function getPancakeListRightEdge() {
  const list = document.querySelector(PANCAKE_LIST_SELECTOR);
  if (list) {
    const r = list.getBoundingClientRect();
    if (r.width > 40 && r.height > 80) return r.right;
  }
  return 280;
}

/** Tin nhắn / tag nằm trong cột chat đang mở (giữa list trái và sidebar ShopVD). */
function isInActiveChatDetailColumn(el) {
  if (!el || isInsideShopvdSidebar(el) || isInsideConversationList(el)) return false;

  const rect = el.getBoundingClientRect();
  if (rect.width < 3 || rect.height < 3) return false;

  const st = window.getComputedStyle(el);
  if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return false;

  const cx = rect.left + rect.width / 2;
  const listRight = getPancakeListRightEdge();
  const sidebarLeft = getShopvdSidebarLeftEdge();
  if (cx < listRight + 16) return false;
  if (cx > sidebarLeft - 16) return false;

  return true;
}

const PANCAKE_CHAT_DETAIL_SELECTOR = [
  '[class*="conversation-detail"]',
  '[class*="ConversationDetail"]',
  '[class*="inbox-conversation"]',
  '[class*="conv-content"]',
  '[class*="messages-wrapper"]',
  '[class*="MessagesWrapper"]',
  '[class*="chat-box"]',
  '[class*="ChatBox"]',
  '[class*="messages-container"]',
  '[class*="MessagesContainer"]',
].join(',');

/** Vùng DOM của box chat đang mở — không gồm list hội thoại bên trái. */
function getActivePancakeChatDetailRoot() {
  let best = null;
  let bestArea = 0;

  document.querySelectorAll(PANCAKE_CHAT_DETAIL_SELECTOR).forEach((node) => {
    if (!isInActiveChatDetailColumn(node)) return;
    const r = node.getBoundingClientRect();
    if (r.width < 180 || r.height < 120) return;
    const area = r.width * r.height;
    if (area > bestArea) {
      bestArea = area;
      best = node;
    }
  });

  if (best) return best;

  const scroller = findPancakeChatScrollRoot({ scoped: false });
  if (scroller && isInActiveChatDetailColumn(scroller)) {
    return scroller.closest(PANCAKE_CHAT_DETAIL_SELECTOR) || scroller;
  }

  return null;
}

function isInPancakeChatPanel(el) {
  if (!el || isGrabExcludedTarget(el)) return false;

  const rect = el.getBoundingClientRect();
  if (!rect.width && !rect.height) return false;

  const sidebar = document.getElementById('shopvd-sidebar');
  const sidebarRect = sidebar?.getBoundingClientRect();
  const sidebarLeft = sidebarRect?.left ?? (window.innerWidth - 380);

  if (rect.right > sidebarLeft - 8) return false;
  if (rect.left < 260) return false;

  if (el.closest(PANCAKE_CHAT_PANEL_SELECTOR)) return true;

  return rect.left >= 260 && rect.right <= sidebarLeft - 12;
}

function isLikelyShopMessage(el, text) {
  if (isPancakeShopMessage(el)) return true;

  const combined = `${String(el.className || '')} ${JSON.stringify(el.dataset || {})}`;
  if (PANCAKE_OUTBOUND_PATTERN.test(combined)) return true;

  const alignRoot = el.closest(PANCAKE_CHAT_PANEL_SELECTOR) || el.parentElement;
  if (!alignRoot) return false;

  const rootRect = alignRoot.getBoundingClientRect();
  const rect = el.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const isRightSide = centerX > rootRect.left + rootRect.width * 0.62;

  if (isRightSide && !textHasCustomerPhone(text) && !textHasAddressHint(text)) {
    return true;
  }

  return false;
}

function scoreMessageBubble(el) {
  if (isGrabExcludedTarget(el)) return -1;

  const text = (el.innerText || el.textContent || '').trim();
  if (!text || text.length < 2 || text.length > 4000) return -1;

  const rect = el.getBoundingClientRect();
  if (rect.width < 28 || rect.height < 16) return -1;
  if (rect.width > window.innerWidth * 0.72 || rect.height > window.innerHeight * 0.55) return -1;
  if (!isInPancakeChatPanel(el)) return -1;

  let score = 0;
  const cls = String(el.className || '');

  if (el.matches?.(PANCAKE_MSG_ROOT_SELECTOR) || el.matches?.('.inbox-message-ele')) score += 40;
  if (el.querySelector?.(PANCAKE_PHONE_TAG_SELECTOR)) score += 45;
  if (isPancakeCustomerMessage(el)) score += 35;
  if (el.matches?.(PANCAKE_MESSAGE_SELECTOR)) score += 34;
  if (textHasCustomerPhone(text)) score += 42;
  if (textHasAddressHint(text)) score += 36;
  if (PANCAKE_INBOUND_PATTERN.test(cls)) score += 24;
  if (rect.height >= 20 && rect.height <= 420) score += 8;
  if (el.querySelector?.('a[href^="tel:"]')) score += 20;

  if (isLikelyShopMessage(el, text)) score -= 55;
  if (el.children.length > 10 && rect.height > 480) score -= 35;

  return score;
}

function isCustomerSideMessage(el) {
  if (!el) return false;
  if (isPancakeShopMessage(el)) return false;
  if (isPancakeCustomerMessage(el)) return true;

  const alignRoot = el.closest(PANCAKE_CHAT_PANEL_SELECTOR);
  const rect = el.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;

  if (alignRoot) {
    const rootRect = alignRoot.getBoundingClientRect();
    return centerX < rootRect.left + rootRect.width * 0.52;
  }

  return centerX < window.innerWidth * 0.46;
}

function isGrabWorthyMessage(el) {
  const root = resolvePancakeMessageRoot(el) || el;
  if (!root || isGrabExcludedTarget(root)) return false;
  if (isPancakeShopMessage(root)) return false;
  if (!isPancakeCustomerMessage(root) && !isCustomerSideMessage(root)) return false;

  const text = extractTextFromMessageBubble(root);
  const hasPhone = textHasCustomerPhone(text) || messageHasPhoneTag(root);
  const addressOnly = extractAddressTextFromMessageBubble(root);
  const hasAddress = isUsableDetectedAddress(addressOnly)
    || textHasAddressHint(text)
    || looksLikeFreeformAddress(text);

  if (!hasPhone && !hasAddress) return false;
  if (text.length < 6 && !hasPhone) return false;
  if (isLikelyShopMessage(root, text)) return false;

  if (isPancakeCustomerMessage(root) && (hasPhone || hasAddress)) return true;
  return scoreMessageBubble(root) >= 30;
}

function findMessageBubbleFromTarget(target) {
  if (!target || isInsideShopvdSidebar(target)) return null;

  const pancakeRoot = target.closest(PANCAKE_MSG_ROOT_SELECTOR);
  if (pancakeRoot && isGrabWorthyMessage(pancakeRoot)) {
    return pancakeRoot;
  }

  let node = target.nodeType === Node.ELEMENT_NODE ? target : target.parentElement;
  let best = null;
  let bestScore = 0;

  while (node && node !== document.body) {
    if (isGrabExcludedTarget(node)) break;

    const score = scoreMessageBubble(node);
    if (score > bestScore) {
      bestScore = score;
      best = node;
    }

    node = node.parentElement;
  }

  if (!best || bestScore < 30) return null;
  const root = resolvePancakeMessageRoot(best) || best;
  return isGrabWorthyMessage(root) ? root : null;
}

function isLikelyCustomerMessage(el) {
  return isGrabWorthyMessage(el);
}

function collectCandidateMessageBubbles() {
  const results = new Set();
  const addIfWorthy = (el) => {
    const root = resolvePancakeMessageRoot(el) || el;
    if (isGrabWorthyMessage(root)) {
      results.add(root);
    }
  };

  document.querySelectorAll(PANCAKE_MSG_ROOT_SELECTOR).forEach(addIfWorthy);
  document.querySelectorAll('.chat-message.customer, .mock-pancake-customer-message').forEach(addIfWorthy);

  if (results.size === 0) {
    document.querySelectorAll(`${PANCAKE_MESSAGE_SELECTOR}, [data-message-id], [data-msg-id]`)
      .forEach(addIfWorthy);
  }

  const panel = document.querySelector(PANCAKE_CHAT_PANEL_SELECTOR);
  if (panel && results.size < 3) {
    panel.querySelectorAll('div, li, article').forEach(addIfWorthy);
  }

  return [...results];
}

function extractTextFromMessageBubble(bubble) {
  if (!bubble) return '';

  const root = resolvePancakeMessageRoot(bubble) || bubble;
  const lines = [];
  const seen = new Set();

  const pushLine = (value) => {
    const line = String(value || '').replace(/\s+/g, ' ').trim();
    if (!line || seen.has(line.toLowerCase())) return;
    seen.add(line.toLowerCase());
    lines.push(line);
  };

  const textField = root.querySelector(PANCAKE_CLIENT_TEXT_SELECTOR);
  if (textField) {
    textField.querySelectorAll('a[href^="tel:"]').forEach((link) => {
      pushLine(link.textContent || link.getAttribute('href')?.replace(/^tel:/i, ''));
    });

    textField.querySelectorAll(PANCAKE_PHONE_TAG_SELECTOR).forEach((el) => {
      pushLine(el.textContent);
    });

    String(textField.innerText || textField.textContent || '')
      .split('\n')
      .forEach((line) => pushLine(line));
  }

  root.querySelectorAll('a[href^="tel:"]').forEach((link) => {
    pushLine(link.textContent || link.getAttribute('href')?.replace(/^tel:/i, ''));
  });

  root.querySelectorAll(PANCAKE_PHONE_TAG_SELECTOR).forEach((el) => {
    pushLine(el.textContent);
  });

  root.querySelectorAll('[class*="phone"], [class*="Phone"]').forEach((el) => {
    if (el.closest(PANCAKE_PHONE_TAG_SELECTOR)) return;
    pushLine(el.textContent);
  });

  if (lines.length === 0) {
    String(root.innerText || root.textContent || '')
      .split('\n')
      .forEach((line) => pushLine(line));
  }

  return lines.join('\n').trim();
}

function findLatestGrabableCustomerMessage() {
  const pancakeRoots = [...document.querySelectorAll(PANCAKE_MSG_ROOT_SELECTOR)];
  if (pancakeRoots.length > 0) {
    for (let i = pancakeRoots.length - 1; i >= 0; i -= 1) {
      if (isGrabWorthyMessage(pancakeRoots[i])) {
        return pancakeRoots[i];
      }
    }
  }

  const candidates = collectCandidateMessageBubbles();

  for (let i = candidates.length - 1; i >= 0; i -= 1) {
    const text = extractTextFromMessageBubble(candidates[i]);
    if (text.length >= 4 && (textHasCustomerPhone(text) || textHasAddressHint(text) || looksLikeFreeformAddress(text))) {
      return candidates[i];
    }
  }

  return candidates.length ? candidates[candidates.length - 1] : null;
}

/** Tin khách có ĐỦ SĐT + địa chỉ trong CÙNG bubble. */
function isOrderIntentMessage(el) {
  const root = resolvePancakeMessageRoot(el) || el;
  if (!root || isGrabExcludedTarget(root)) return false;
  if (isPancakeShopMessage(root)) return false;
  if (!isPancakeCustomerMessage(root) && !isCustomerSideMessage(root)) return false;

  const hasPhoneTag = messageHasPhoneTag(root);
  const text = extractTextFromMessageBubble(root);
  const addressOnly = extractAddressTextFromMessageBubble(root);
  const hasPhone = hasPhoneTag || textHasCustomerPhone(text);
  const hasAddress = isUsableDetectedAddress(addressOnly);

  // Pancake thật: .phone-tag + dòng địa chỉ cùng .client-message
  if (hasPhone && hasAddress) {
    return !isLikelyShopMessage(root, text);
  }

  return false;
}

function extractFirstPhoneFromText(text) {
  const all = extractAllPhonesFromText(text);
  return all.length ? all[all.length - 1] : '';
}

function extractPhoneFromPancakeSpanId(el) {
  let node = el;
  while (node && node !== document.body) {
    const id = String(node.id || '');
    const m = id.match(/_((?:\+84|0)?[35789]\d{8})$/i) || id.match(/_(\d{9,11})$/);
    if (m) {
      const p = sanitizePhoneDigits(m[1]);
      if (isValidDraftPhone(p) && !isPlaceholderDraftPhone(p)) return normalizeDraftPhone(p);
    }
    node = node.parentElement;
  }
  return '';
}

function isPancakeCustomerPhoneTag(tag) {
  if (!tag) return false;
  const inbox = tag.closest('.inbox-message-ele');
  if (inbox) {
    if (isPancakeShopMessage(inbox)) return false;
    if (inbox.classList.contains('media-current-customer')) return true;
  }
  if (tag.closest('.media-message-from-customer, .media-body-text.media-message-from-customer')) return true;
  if (tag.closest('.message-text-ele.client-message')) return true;
  return false;
}

/**
 * Lấy SĐT mới nhất từ tin khách Pancake.
 * Dạng 1: địa chỉ + SĐT cùng tin (.client-message + .phone-tag)
 * Dạng 2: SĐT riêng 1 tin, địa chỉ tin khác — lấy tin có .phone-tag mới nhất.
 */
function extractLatestCustomerPhoneFromInboxMessages() {
  const queryRoot = getActiveChatMessageQueryRoot();
  if (!queryRoot) return '';

  const inboxes = [...queryRoot.querySelectorAll(PANCAKE_CUSTOMER_INBOX_SELECTOR)]
    .filter((el) => isInboxMessageInActiveChatScroller(el));

  inboxes.sort((a, b) => {
    if (a === b) return 0;
    const pos = a.compareDocumentPosition(b);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });

  for (let i = inboxes.length - 1; i >= 0; i -= 1) {
    const inbox = inboxes[i];
    const clientMsg = inbox.querySelector('.message-text-ele.client-message')
      || inbox.querySelector(PANCAKE_CLIENT_TEXT_SELECTOR)
      || inbox;

    const tags = clientMsg.querySelectorAll(PANCAKE_PHONE_TAG_SELECTOR);
    if (tags.length) {
      const tag = tags[tags.length - 1];
      const fromTag = sanitizePhoneDigits(tag.textContent || '');
      if (isValidDraftPhone(fromTag) && !isPlaceholderDraftPhone(fromTag)) {
        return normalizeDraftPhone(fromTag);
      }
      const fromId = extractPhoneFromPancakeSpanId(tag);
      if (fromId) return fromId;
    }

    const fromBubble = extractPhoneFromMessageBubble(inbox);
    if (isValidDraftPhone(fromBubble) && !isPlaceholderDraftPhone(fromBubble)) {
      return normalizeDraftPhone(fromBubble);
    }
  }

  return '';
}

function extractPhoneFromCustomerMessagesOnly() {
  const fromInbox = extractLatestCustomerPhoneFromInboxMessages();
  if (fromInbox) return fromInbox;

  const roots = collectCustomerMessageRootsInOrder();
  for (let i = roots.length - 1; i >= 0; i -= 1) {
    const p = extractPhoneFromMessageBubble(roots[i]);
    if (isValidDraftPhone(p) && !isPlaceholderDraftPhone(p)) {
      return normalizeDraftPhone(p);
    }
  }
  return '';
}

/** SĐT từ .phone-tag trong tin khách (Pancake bọc SĐT — hỗ trợ cả tin gộp & tin tách). */
function extractPhoneFromVisiblePhoneTagsInChat() {
  const fromInbox = extractLatestCustomerPhoneFromInboxMessages();
  if (fromInbox) return fromInbox;

  const scope = getActivePancakeChatDetailRoot();
  const queryRoot = scope || document.body;
  const hits = [];

  queryRoot.querySelectorAll(PANCAKE_PHONE_TAG_SELECTOR).forEach((tag) => {
    if (!isInActiveChatDetailColumn(tag)) return;
    if (!isPancakeCustomerPhoneTag(tag)) return;

    const p = sanitizePhoneDigits(tag.textContent || '');
    if (!isValidDraftPhone(p) || isPlaceholderDraftPhone(p)) {
      const fromId = extractPhoneFromPancakeSpanId(tag);
      if (fromId) hits.push({ tag, phone: fromId });
      return;
    }
    hits.push({ tag, phone: normalizeDraftPhone(p) });
  });

  if (!hits.length) return '';

  hits.sort((a, b) => {
    const pos = a.tag.compareDocumentPosition(b.tag);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });

  return hits[hits.length - 1].phone;
}

function extractBestPhoneFromOpenChatDom() {
  return extractPhoneFromVisiblePhoneTagsInChat() || extractPhoneFromCustomerMessagesOnly();
}

function shopvdDumpPhoneDebug() {
  const scope = getActivePancakeChatDetailRoot();
  const convKey = getPancakeConversationKey();
  const fromInbox = extractLatestCustomerPhoneFromInboxMessages();
  const fromTags = extractPhoneFromVisiblePhoneTagsInChat();
  const fromMsgs = extractPhoneFromCustomerMessagesOnly();
  const tagDetails = scope
    ? [...scope.querySelectorAll(PANCAKE_PHONE_TAG_SELECTOR)].map((t) => ({
      phone: sanitizePhoneDigits(t.textContent || ''),
      visible: isInActiveChatDetailColumn(t),
      isCustomer: isPancakeCustomerPhoneTag(t),
      parent: (t.closest('.inbox-message-ele') || t.parentElement)?.className?.slice(0, 100) || '',
    }))
    : [];
  const report = {
    convKey,
    chosen: fromInbox || fromTags || fromMsgs || '(none)',
    fromInbox: fromInbox || '(none)',
    fromTags: fromTags || '(none)',
    fromMsgs: fromMsgs || '(none)',
    scope: scope?.className?.slice(0, 120) || '(none)',
    scrollRoot: getActiveChatMessageQueryRoot()?.className?.slice(0, 80) || '(none)',
    inboxMsgs: scope ? scope.querySelectorAll(PANCAKE_CUSTOMER_INBOX_SELECTOR).length : 0,
    inboxInScroller: getActiveChatMessageQueryRoot()
      ? getActiveChatMessageQueryRoot().querySelectorAll(PANCAKE_CUSTOMER_INBOX_SELECTOR).length
      : 0,
    prevConvPhone: shopvdPrevConvPhone,
    msgRoots: collectCustomerMessageRootsInOrder().length,
    tags: tagDetails,
    cached: shopvdConvPhoneCache.get(convKey) || '(none)',
  };
  console.warn('[ShopVD PhoneDebug]', report);
  return report;
}

const shopvdConvPhoneCache = new Map();
let shopvdPhoneDiscovery = null;
let shopvdPhoneScanConvKey = '';
let shopvdLastDbCheckConvKey = '';
let shopvdPrevConvPhone = { key: '', phone: '' };

function clearAllConversationPhoneCache() {
  shopvdConvPhoneCache.clear();
}

function clearConversationPhoneCache(conversationKey) {
  if (conversationKey) shopvdConvPhoneCache.delete(conversationKey);
}

function noteResolvedConvPhone(conversationKey, phone) {
  const key = conversationKey || getPancakeConversationKey();
  const p = normalizeDraftPhone(phone);
  if (key && p) shopvdPrevConvPhone = { key, phone: p };
}

function isLikelyStalePhoneFromPrevChat(conversationKey, phone) {
  if (!conversationKey || !phone) return false;
  if (!shopvdPrevConvPhone.phone || shopvdPrevConvPhone.key === conversationKey) return false;
  return normalizeDraftPhone(phone) === shopvdPrevConvPhone.phone;
}

/** Chỉ quét tin trong vùng scroll của chat đang mở — tránh tin chat cũ còn trong DOM. */
function getActiveChatMessageQueryRoot() {
  const scroller = findPancakeChatScrollRoot();
  if (scroller) return scroller;
  return getActivePancakeChatDetailRoot();
}

function isInboxMessageInActiveChatScroller(inbox) {
  if (!inbox || isPancakeShopMessage(inbox)) return false;

  const scroller = findPancakeChatScrollRoot();
  if (scroller) {
    if (!scroller.contains(inbox)) return false;
  } else if (!isInActiveChatDetailColumn(inbox)) {
    return false;
  }

  const st = window.getComputedStyle(inbox);
  if (st.display === 'none' || st.visibility === 'hidden') return false;
  const rect = inbox.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 6) return false;
  return true;
}

function resetDbCheckStateForConversationSwitch(nextConvKey) {
  if (!nextConvKey || nextConvKey === shopvdLastDbCheckConvKey) return false;

  shopvdDbLog('conv:switch-reset', {
    from: shopvdLastDbCheckConvKey || '(none)',
    to: nextConvKey,
    prevPhone: shopvdPrevConvPhone.phone || '(none)',
  });

  shopvdLastDbCheckConvKey = nextConvKey;
  shopvdPhoneScanConvKey = nextConvKey;
  clearAllConversationPhoneCache();
  clearDbStatusSettled();
  shopvdOpenChatCheckKey = '';
  shopvdDbCheckGeneration += 1;
  return true;
}

/** SĐT mới nhất trong chat đang mở — chỉ từ tin khách trong box chat (không list/header/cache). */
function extractLatestPhoneFromOpenChat() {
  const convKey = getPancakeConversationKey();

  const fromTags = extractPhoneFromVisiblePhoneTagsInChat();
  if (fromTags && !isLikelyStalePhoneFromPrevChat(convKey, fromTags)) {
    rememberConversationPhone(convKey, fromTags);
    shopvdDbLog('phone:from-tag', { phone: fromTags, convKey });
    return fromTags;
  }

  const fromMessages = extractPhoneFromCustomerMessagesOnly();
  if (fromMessages && !isLikelyStalePhoneFromPrevChat(convKey, fromMessages)) {
    rememberConversationPhone(convKey, fromMessages);
    shopvdDbLog('phone:from-msg', { phone: fromMessages, convKey, roots: collectCustomerMessageRootsInOrder().length });
    return fromMessages;
  }

  if (fromTags || fromMessages) {
    shopvdDbLog('phone:rejected-stale', {
      convKey,
      candidate: fromTags || fromMessages,
      prevKey: shopvdPrevConvPhone.key,
      prevPhone: shopvdPrevConvPhone.phone,
    });
  } else {
    shopvdDbLog('phone:none', {
      convKey,
      scrollRoot: !!getActiveChatMessageQueryRoot(),
      msgRoots: collectCustomerMessageRootsInOrder().length,
    });
  }

  return '';
}

function rememberConversationPhone(conversationKey, phone) {
  const key = conversationKey || getPancakeConversationKey();
  const p = normalizeDraftPhone(phone);
  if (!key || !isValidDraftPhone(p) || isPlaceholderDraftPhone(p)) return;
  if (isLikelyStalePhoneFromPrevChat(key, p)) {
    shopvdDbLog('phone:skip-cache-stale', { key, phone: p, prevKey: shopvdPrevConvPhone.key });
    return;
  }
  shopvdConvPhoneCache.set(key, p);
}

function findPancakeChatScrollRoot(options = {}) {
  const { scoped = true } = options;
  const detailRoot = scoped ? getActivePancakeChatDetailRoot() : null;
  const candidates = [];

  const consider = (el) => {
    if (!el || isInsideShopvdSidebar(el) || isInsideConversationList(el)) return;
    if (detailRoot && !detailRoot.contains(el) && el !== detailRoot) return;
    if (scoped && !isInActiveChatDetailColumn(el)) return;
    const st = window.getComputedStyle(el);
    if (st.overflowY !== 'auto' && st.overflowY !== 'scroll' && st.overflow !== 'auto') return;
    if (el.scrollHeight <= el.clientHeight + 40) return;
    candidates.push(el);
  };

  if (detailRoot) {
    detailRoot.querySelectorAll('div, section, main, ul').forEach(consider);
    consider(detailRoot);
  } else {
    document.querySelectorAll(PANCAKE_CHAT_DETAIL_SELECTOR).forEach((panel) => {
      if (!isInActiveChatDetailColumn(panel)) return;
      panel.querySelectorAll('div, section, main, ul').forEach(consider);
      consider(panel);
    });
  }

  candidates.sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight));
  return candidates[0] || null;
}

function stopChatPhoneDiscovery() {
  if (!shopvdPhoneDiscovery) return;
  shopvdPhoneDiscovery.cleanup?.();
  clearTimeout(shopvdPhoneDiscovery.timeoutId);
  shopvdPhoneDiscovery = null;
}

/** Cuộn lên đầu chat để Pancake lazy-load tin cũ có SĐT, rồi trả về đáy chat. */
async function prefetchPancakeChatHistoryForPhone() {
  const scroller = findPancakeChatScrollRoot();
  if (!scroller) return '';

  shopvdDbLog('prefetch:start', { scrollHeight: scroller.scrollHeight, clientHeight: scroller.clientHeight });
  scroller.scrollTop = 0;
  await new Promise((r) => setTimeout(r, 280));
  scroller.scrollTop = 0;
  await new Promise((r) => setTimeout(r, 420));

  const phone = extractLatestPhoneFromOpenChat();
  scroller.scrollTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  shopvdDbLog('prefetch:done', { phone: phone || '(none)' });
  return phone;
}

const SHOPVD_PHONE_DISCOVERY_MAX_MS = 50000;

function startChatPhoneDiscovery(conversationKey, gen) {
  stopChatPhoneDiscovery();

  const state = {
    key: conversationKey,
    gen,
    timeoutId: null,
    cleanup: null,
  };
  shopvdPhoneDiscovery = state;

  const tryFind = async () => {
    if (!shopvdPhoneDiscovery || shopvdPhoneDiscovery.gen !== gen) return false;
    if (getPancakeConversationKey() !== conversationKey) {
      stopChatPhoneDiscovery();
      return false;
    }

    let phone = extractLatestPhoneFromOpenChat();
    if (!phone) phone = await prefetchPancakeChatHistoryForPhone();
    if (!phone) return false;

    rememberConversationPhone(conversationKey, phone);
    stopChatPhoneDiscovery();
    if (isDbStatusSettledFor(conversationKey, phone)) return true;
    refreshDbSaveStatusForOpenChat(phone).catch(() => {});
    scheduleScanChatForUnsavedOrderIntent(350);
    return true;
  };

  const debouncedTry = (() => {
    let t = null;
    return () => {
      clearTimeout(t);
      t = setTimeout(() => { tryFind().catch(() => {}); }, 180);
    };
  })();

  tryFind().catch(() => {});

  const scroller = findPancakeChatScrollRoot();
  const onScroll = () => debouncedTry();
  if (scroller) scroller.addEventListener('scroll', onScroll, { passive: true });

  const observeRoot = document.querySelector(PANCAKE_CHAT_PANEL_SELECTOR) || scroller || document.body;
  const observer = new MutationObserver(() => debouncedTry());
  observer.observe(observeRoot, { childList: true, subtree: true });

  state.cleanup = () => {
    if (scroller) scroller.removeEventListener('scroll', onScroll);
    observer.disconnect();
  };

  state.timeoutId = setTimeout(() => {
    if (shopvdPhoneDiscovery?.gen !== gen) return;
    stopChatPhoneDiscovery();
    if (getPancakeConversationKey() === conversationKey && !extractLatestPhoneFromOpenChat()) {
      renderDbSaveStatusCard({ state: 'no_phone' });
    }
  }, SHOPVD_PHONE_DISCOVERY_MAX_MS);
}

const SHOPVD_ORDER_STATUS_VI = {
  pending: 'Chưa gửi hàng',
  processing: 'Đang xử lý',
  send_later: 'Gửi sau',
  awaiting_reship: 'Chờ gửi lại',
  shipped: 'Đã gửi hàng',
  in_transit: 'Đang vận chuyển',
  delivered: 'Đã giao',
  failed: 'Giao thất bại',
  cancelled: 'Đã hủy',
};

const SHOPVD_STATUS_TONE = {
  pending: 'wait',
  processing: 'wait',
  send_later: 'later',
  awaiting_reship: 'warn',
  shipped: 'ship',
  in_transit: 'ship',
  delivered: 'done',
  failed: 'bad',
  cancelled: 'bad',
};

function shopvdFormatStatusDate(ts) {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return '';
  try {
    const d = new Date(n);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    return `${hh}:${mm} · ${dd}/${mo}`;
  } catch (_) {
    return '';
  }
}

function shopvdNormalizeStatusSlug(status) {
  const s = String(status || 'pending').toLowerCase().trim();
  const map = {
    'mới': 'pending',
    'chờ xử lý': 'pending',
    'chưa gửi hàng': 'pending',
    'chờ gửi lại': 'awaiting_reship',
    'gửi sau': 'send_later',
    'đã gửi hàng': 'shipped',
    'đang vận chuyển': 'in_transit',
    'đã giao hàng': 'delivered',
    'giao hàng thất bại': 'failed',
  };
  return map[s] || s;
}

function shopvdStatusLabel(status) {
  const slug = shopvdNormalizeStatusSlug(status);
  return SHOPVD_ORDER_STATUS_VI[slug] || SHOPVD_ORDER_STATUS_VI[status] || status || 'Không rõ';
}

function shopvdStatusTone(status) {
  const slug = shopvdNormalizeStatusSlug(status);
  return SHOPVD_STATUS_TONE[slug] || 'neutral';
}

function shopvdResolveShipTime(order) {
  if (!order) return '';
  const slug = shopvdNormalizeStatusSlug(order.status);
  if (slug === 'send_later' && order.planned_send_at_unix) {
    return shopvdFormatStatusDate(order.planned_send_at_unix);
  }
  if (['shipped', 'in_transit', 'delivered'].includes(slug) && order.shipped_at_unix) {
    return shopvdFormatStatusDate(order.shipped_at_unix);
  }
  if (order.shipped_at_unix) return shopvdFormatStatusDate(order.shipped_at_unix);
  return shopvdFormatStatusDate(order.created_at_unix);
}

function shopvdShipTimeLabel(order) {
  const slug = shopvdNormalizeStatusSlug(order?.status);
  if (slug === 'send_later') return 'Gửi dự kiến';
  if (['shipped', 'in_transit', 'delivered'].includes(slug)) return 'Đã gửi lúc';
  if (slug === 'pending' || slug === 'processing' || slug === 'awaiting_reship') return 'Tạo lúc';
  return 'Cập nhật';
}

function shopvdFormatStatusMoney(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat('vi-VN').format(n) + 'đ';
}

function renderDbSaveStatusCard(payload = {}) {
  const strip = document.getElementById('shopvd-ship-status');
  const body = document.getElementById('shopvd-ship-status-body');
  const refreshBtn = document.getElementById('shopvd-ship-status-refresh');
  if (!strip || !body) return;

  const convKey = payload.convKey || getPancakeConversationKey() || shopvdOpenChatCheckKey || '';
  const transient = payload.state === 'loading' || payload.state === 'scanning' || payload.state === 'idle';
  if (transient && isDbStatusSettledFor(convKey, payload.phone || shopvdDbStatusSettled.phone)) {
    shopvdDbLog('ui:skip-flicker', { to: payload.state, settled: shopvdDbStatusSettled.state });
    return;
  }

  strip.className = 'shopvd-ship-strip';
  ['wait', 'later', 'warn', 'ship', 'done', 'bad', 'neutral', 'loading', 'empty', 'idle', 'saved', 'not-saved'].forEach((t) => {
    strip.classList.remove(`is-${t}`);
  });

  if (payload.state === 'idle') {
    strip.classList.add('is-idle');
    body.innerHTML = '<span class="shopvd-ship-idle">Bấm vào chat để kiểm tra đã lưu đơn chưa</span>';
    refreshBtn?.classList.add('hidden');
    return;
  }

  if (payload.state === 'no_phone') {
    strip.classList.add('is-idle');
    body.innerHTML = '<span class="shopvd-ship-idle">Chưa thấy SĐT — cuộn lên tin cũ hoặc bấm ↻</span>';
    refreshBtn?.classList.remove('hidden');
    return;
  }

  if (payload.state === 'scanning') {
    strip.classList.add('is-loading');
    body.innerHTML = '<span class="shopvd-ship-idle">Đang tìm SĐT trong tin cũ (Pancake tải lịch sử chat)…</span>';
    refreshBtn?.classList.add('hidden');
    return;
  }

  if (payload.state === 'loading') {
    strip.classList.add('is-loading');
    body.innerHTML = `<span class="shopvd-ship-idle">Đang kiểm tra DB <strong>${payload.phone || ''}</strong>…</span>`;
    refreshBtn?.classList.add('hidden');
    return;
  }

  if (payload.state === 'error') {
    strip.classList.add('is-idle');
    body.innerHTML = '<span class="shopvd-ship-idle">Không kiểm tra được — bấm ↻ thử lại</span>';
    refreshBtn?.classList.remove('hidden');
    return;
  }

  refreshBtn?.classList.remove('hidden');
  const phone = payload.phone || '';

  if (payload.state === 'not_saved') {
    strip.classList.add('is-not-saved');
    body.innerHTML = `
      <div class="shopvd-ship-main">
        <span class="shopvd-ship-badge is-warn">Chưa lưu DB</span>
        <span class="shopvd-ship-phone-inline">${phone}</span>
      </div>
      <div class="shopvd-ship-detail">Chưa có đơn trên hệ thống — cần tạo đơn</div>`;
    shopvdDbStatusSettled = { convKey, phone, state: 'not_saved' };
    noteResolvedConvPhone(convKey, phone);
    shopvdDbLog('ui:render', payload);
    return;
  }

  if (payload.state === 'saved') {
    const count = Number(payload.orderCount) || Number(payload.totalOrders) || 0;
    const o = payload.order;

    if (o) {
      const tone = shopvdStatusTone(o.status);
      strip.classList.add('is-saved', `is-${tone}`);
      const statusLabel = shopvdStatusLabel(o.status);
      const shipTime = shopvdResolveShipTime(o);
      const timeLabel = shopvdShipTimeLabel(o);
      const amount = o.total_amount ? shopvdFormatStatusMoney(o.total_amount) : '';
      const preview = o.products_preview || '';
      const multiNote = payload.isActive && count > 1
        ? `<span class="shopvd-ship-multi">${count} đơn · xem đơn chưa gửi mới nhất</span>`
        : (count > 1 ? `<span class="shopvd-ship-multi">${count} đơn trên hệ thống</span>` : '');

      body.innerHTML = `
        <div class="shopvd-ship-main">
          <span class="shopvd-ship-badge is-done">Đã lưu DB</span>
          <span class="shopvd-ship-badge is-${tone}">${statusLabel}</span>
          ${shipTime ? `<span class="shopvd-ship-time"><span class="shopvd-ship-time-label">${timeLabel}</span><strong>${shipTime}</strong></span>` : ''}
          <span class="shopvd-ship-phone-inline">${phone}</span>
        </div>
        <div class="shopvd-ship-detail">
          ${amount ? `<span class="shopvd-ship-amount">${amount}</span>` : ''}
          ${amount && preview ? '<span class="shopvd-ship-sep">·</span>' : ''}
          ${preview ? `<span class="shopvd-ship-preview">${preview}</span>` : ''}
          ${multiNote}
        </div>`;
    } else {
      strip.classList.add('is-saved');
      const detail = count > 1
        ? `Đã có ${count} đơn trên hệ thống`
        : 'Đã có đơn trên hệ thống';
      body.innerHTML = `
        <div class="shopvd-ship-main">
          <span class="shopvd-ship-badge is-done">Đã lưu DB</span>
          <span class="shopvd-ship-phone-inline">${phone}</span>
        </div>
        <div class="shopvd-ship-detail">${detail}</div>`;
    }
    shopvdDbStatusSettled = { convKey, phone, state: 'saved' };
    noteResolvedConvPhone(convKey, phone);
    shopvdDbLog('ui:render', payload);
    return;
  }

  shopvdDbLog('ui:render', payload);
}

let shopvdLastClickedConvItem = null;
let shopvdLastClickedConvAt = 0;

function rememberClickedConversationItem(item) {
  if (!item) return;
  shopvdLastClickedConvItem = item;
  shopvdLastClickedConvAt = Date.now();
  shopvdDbLog('click:remember-conv', {
    className: item.className,
    dataId: item.getAttribute('data-id'),
    text: (item.textContent || '').trim().slice(0, 50),
  });
}

function findActiveConversationItemInDom() {
  const items = document.querySelectorAll(PANCAKE_CONV_ITEM_SELECTOR);
  for (const item of items) {
    if (!item.closest(PANCAKE_LIST_SELECTOR) && !isInsideConversationList(item)) continue;
    const cls = String(item.className || '');
    if (
      item.matches?.('[class*="active"], [class*="selected"], [class*="current"], [aria-selected="true"], [aria-current="true"]')
      || item.classList?.contains('selected')
      || item.classList?.contains('active')
      || /\bactive\b|\bselected\b|\bcurrent\b/i.test(cls)
    ) {
      return item;
    }
  }
  return document.querySelector(
    '[class*="conversation-item"][class*="active"], '
    + '[class*="conversation-item"].selected, '
    + '[class*="ConversationItem"][aria-selected="true"], '
    + '[class*="thread-item"][class*="active"]'
  );
}

function getActivePancakeConversationItem() {
  const active = findActiveConversationItemInDom();
  if (active) return active;

  if (shopvdLastClickedConvItem && (Date.now() - shopvdLastClickedConvAt) < 4000) {
    shopvdDbLog('conv:fallback-clicked', {
      className: shopvdLastClickedConvItem.className,
      ageMs: Date.now() - shopvdLastClickedConvAt,
    });
    return shopvdLastClickedConvItem;
  }
  return null;
}

function diagnoseConversationDom(reason) {
  const items = document.querySelectorAll(PANCAKE_CONV_ITEM_SELECTOR);
  shopvdDbLog(`diagnose:${reason}`, {
    convItemCount: items.length,
    samples: [...items].slice(0, 6).map((el) => ({
      className: el.className,
      dataId: el.getAttribute('data-id'),
      ariaSelected: el.getAttribute('aria-selected'),
      text: (el.textContent || '').trim().slice(0, 45),
    })),
    activeDom: findActiveConversationItemInDom()?.className || null,
    lastClicked: shopvdLastClickedConvItem?.className || null,
    chatPanel: !!document.querySelector(PANCAKE_CHAT_PANEL_SELECTOR),
    msgRoots: collectCustomerMessageRootsInOrder().length,
    handlersBound: shopvdCoreHandlersBound,
    pancakeClickBound: shopvdPancakeClickBound,
  });
}

/** Chỉ true khi user đã chọn/mở một hội thoại trên Pancake. */
function isPancakeChatOpen() {
  return !!getActivePancakeConversationItem();
}

let shopvdOpenChatCheckKey = '';
let shopvdDbSaveCheckAbort = null;
let shopvdDbCheckTimer = null;
let shopvdDbCheckGeneration = 0;
const SHOPVD_DB_CHECK_RETRY_MS = [0, 150, 320, 550, 900, 1400, 2000];

async function fetchCustomerOrderStatus(phone, { signal } = {}) {
  const url = `${API_BASE_URL}/?action=getCustomerShippingStatus&phone=${encodeURIComponent(phone)}`;
  shopvdDbLog('api:order-status', { phone, url });
  const response = await fetch(url, signal ? { signal } : undefined);
  const data = await response.json();
  shopvdDbLog('api:order-status-response', { phone, ok: response.ok, data });
  return data;
}

async function fetchCustomerDbState(phone, { signal } = {}) {
  const url = `${API_BASE_URL}/?action=checkCustomer&phone=${encodeURIComponent(phone)}`;
  shopvdDbLog('api:request', { phone, url });
  const response = await fetch(url, signal ? { signal } : undefined);
  const data = await response.json();
  shopvdDbLog('api:response', { phone, ok: response.ok, status: response.status, data });
  return data;
}

/** Xóa draft chưa lưu nếu SĐT đã có đơn trên DB (dọn đơn ảo / stale). */
async function reconcileUnsavedDraftsWithDb(phones = null) {
  const targets = (phones || [...shopvdDraftMap.keys()])
    .map(normalizeDraftPhone)
    .filter((p) => isValidDraftPhone(p) && !isPhoneKnownOrdered(p));

  if (!targets.length) return;

  shopvdDbLog('reconcile:start', { targets, draftCount: shopvdDraftMap.size });

  let changed = false;
  for (const phone of targets) {
    try {
      const data = await fetchCustomerDbState(phone);
      if (data?.success && !data.isNew) {
        shopvdDbLog('reconcile:remove-ordered', { phone, orderCount: data.orderCount });
        markPhoneAsOrdered(phone);
        changed = true;
      } else {
        shopvdDbLog('reconcile:keep-draft', { phone, isNew: data?.isNew, success: data?.success });
      }
    } catch (err) {
      shopvdDbLog('reconcile:error', { phone, error: err?.message || String(err) });
    }
  }
  if (changed) scheduleUnsavedDraftUi(40);
}

let shopvdDbSaveReqSeq = 0;
/** Trạng thái UI đã chốt — tránh nhấp nháy loading ↔ saved */
let shopvdDbStatusSettled = { convKey: '', phone: '', state: '' };
let shopvdDbCheckLastRun = { key: '', at: 0 };

function clearDbStatusSettled() {
  shopvdDbStatusSettled = { convKey: '', phone: '', state: '' };
}

function isDbStatusSettledFor(convKey, phone = '') {
  if (!convKey || shopvdDbStatusSettled.convKey !== convKey) return false;
  if (phone && shopvdDbStatusSettled.phone !== normalizeDraftPhone(phone)) return false;
  return shopvdDbStatusSettled.state === 'saved' || shopvdDbStatusSettled.state === 'not_saved';
}

/**
 * Kiểm tra SĐT trong chat đang mở đã có đơn trên DB chưa.
 */
async function refreshDbSaveStatusForOpenChat(knownPhone = '', { force = false } = {}) {
  const convKey = getPancakeConversationKey() || shopvdOpenChatCheckKey || '';

  if (!isPancakeChatOpen()) {
    if (isDbStatusSettledFor(convKey)) return;
    renderDbSaveStatusCard({ state: 'idle' });
    return;
  }

  let phone = extractLatestPhoneFromOpenChat();
  if (phone && convKey && isLikelyStalePhoneFromPrevChat(convKey, phone)) {
    shopvdDbLog('refresh:stale-prev-chat', { convKey, phone, prevKey: shopvdPrevConvPhone.key });
    phone = '';
  }
  if (!phone && isValidDraftPhone(knownPhone) && !isPlaceholderDraftPhone(knownPhone)) {
    phone = knownPhone;
  }
  if (!isValidDraftPhone(phone)) {
    if (isDbStatusSettledFor(convKey)) return;
    renderDbSaveStatusCard({ state: 'no_phone' });
    return;
  }

  if (!force && isDbStatusSettledFor(convKey, phone)) {
    const domPhone = extractBestPhoneFromOpenChatDom();
    if (domPhone && domPhone !== normalizeDraftPhone(phone)) {
      shopvdDbLog('refresh:phone-changed', { convKey, was: phone, now: domPhone });
      clearDbStatusSettled();
      phone = domPhone;
    } else {
      shopvdDbLog('refresh:skip-settled', { convKey, phone });
      return;
    }
  }

  const reqSeq = ++shopvdDbSaveReqSeq;
  renderDbSaveStatusCard({ state: 'loading', phone, convKey });

  try {
    const data = await fetchCustomerOrderStatus(phone);

    if (reqSeq !== shopvdDbSaveReqSeq) return;

    if (!data?.success) {
      renderDbSaveStatusCard({ state: 'error', phone, convKey });
      return;
    }

    if (!data.hasOrders) {
      renderDbSaveStatusCard({ state: 'not_saved', phone, convKey });
      return;
    }

    markPhoneAsOrdered(phone);
    removeUnsavedDraft(phone);
    stopChatPhoneDiscovery();
    renderDbSaveStatusCard({
      state: 'saved',
      phone,
      convKey,
      orderCount: data.totalOrders || 0,
      totalOrders: data.totalOrders || 0,
      isActive: data.isActive,
      order: data.order,
    });
  } catch (err) {
    if (reqSeq !== shopvdDbSaveReqSeq) return;
    shopvdDbLog('check:fetch-error', { phone, error: err?.message || String(err) });
    renderDbSaveStatusCard({ state: 'error', phone, convKey });
  }
}

/**
 * Bấm mở chat → đợi Pancake cập nhật DOM (active + tin nhắn) rồi mới kiểm tra DB.
 * Nguyên nhân lỗi cũ: gọi đồng bộ ngay khi click khiến isPancakeChatOpen() = false → idle.
 */
function handlePancakeChatDbSaveCheck(force = true, options = {}) {
  if (!isAllowedPage()) return;

  const convKey = getPancakeConversationKey() || '';
  const forceRefresh = options.forceRefresh === true;

  const switched = resetDbCheckStateForConversationSwitch(convKey);
  if (switched) {
    renderDbSaveStatusCard({ state: 'loading', convKey });
  }

  if (forceRefresh) {
    clearDbStatusSettled();
    clearAllConversationPhoneCache();
  } else if (convKey && isDbStatusSettledFor(convKey)) {
    const domPhone = extractBestPhoneFromOpenChatDom();
    if (!domPhone || domPhone === normalizeDraftPhone(shopvdDbStatusSettled.phone)) {
      shopvdDbLog('check:skip-settled', { convKey, state: shopvdDbStatusSettled.state });
      return;
    }
    shopvdDbLog('check:skip-settled-overridden', { convKey, was: shopvdDbStatusSettled.phone, now: domPhone });
    clearDbStatusSettled();
  } else if (force && convKey && shopvdDbCheckLastRun.key === convKey
    && Date.now() - shopvdDbCheckLastRun.at < 4000
    && isDbStatusSettledFor(convKey)) {
    shopvdDbLog('check:skip-recent', { convKey });
    return;
  }

  if (convKey && shopvdDbStatusSettled.convKey && shopvdDbStatusSettled.convKey !== convKey) {
    clearDbStatusSettled();
  }

  stopChatPhoneDiscovery();
  const gen = ++shopvdDbCheckGeneration;
  clearTimeout(shopvdDbCheckTimer);
  if (convKey) shopvdDbCheckLastRun = { key: convKey, at: Date.now() };
  shopvdDbLog('check:start', { gen, force, convKey, handlersBound: shopvdCoreHandlersBound });

  const runAttempt = (tryIndex) => {
    if (gen !== shopvdDbCheckGeneration) {
      shopvdDbLog('check:cancelled', { gen, tryIndex });
      return;
    }

    const chatOpen = isPancakeChatOpen();
    const key = chatOpen ? getPancakeConversationKey() : '';
    if (key && isDbStatusSettledFor(key)) {
      const domPhone = extractBestPhoneFromOpenChatDom();
      const settledPhone = normalizeDraftPhone(shopvdDbStatusSettled.phone);
      if (!domPhone || domPhone === settledPhone) {
        shopvdDbLog('check:skip-settled-attempt', { tryIndex, key, state: shopvdDbStatusSettled.state });
        return;
      }
      shopvdDbLog('check:phone-changed-attempt', { tryIndex, key, was: settledPhone, now: domPhone });
      clearDbStatusSettled();
    }

    let phone = chatOpen ? extractLatestPhoneFromOpenChat() : '';

    if (phone && key && isLikelyStalePhoneFromPrevChat(key, phone)) {
      shopvdDbLog('phone:stale-prev-chat', {
        tryIndex,
        key,
        phone,
        prevKey: shopvdPrevConvPhone.key,
      });
      phone = '';
    }

    shopvdDbLog('check:attempt', {
      gen,
      tryIndex,
      chatOpen,
      key: key || '(none)',
      phone: phone || '(none)',
      delayNext: SHOPVD_DB_CHECK_RETRY_MS[tryIndex + 1] ?? null,
    });

    if (!chatOpen || !key) {
      if (tryIndex < SHOPVD_DB_CHECK_RETRY_MS.length - 1) {
        if (tryIndex >= 1) {
          renderDbSaveStatusCard({ state: 'loading', phone: '…', convKey: key });
        }
        shopvdDbCheckTimer = setTimeout(() => runAttempt(tryIndex + 1), SHOPVD_DB_CHECK_RETRY_MS[tryIndex + 1]);
        return;
      }
      diagnoseConversationDom('no-chat-open');
      renderDbSaveStatusCard({ state: 'idle' });
      return;
    }

    if (!force && key === shopvdOpenChatCheckKey) {
      shopvdDbLog('check:skip-duplicate', { key });
      return;
    }
    shopvdOpenChatCheckKey = key;
    shopvdAutoDetectDone.delete(key);

    if (!isValidDraftPhone(phone) || isPlaceholderDraftPhone(phone)) {
      if (tryIndex === 2) {
        prefetchPancakeChatHistoryForPhone().then((p) => {
          if (!p || gen !== shopvdDbCheckGeneration) return;
          if (getPancakeConversationKey() !== key) return;
          if (isDbStatusSettledFor(key, p)) {
            const domPhone = extractBestPhoneFromOpenChatDom();
            if (domPhone && domPhone !== normalizeDraftPhone(p)) {
              clearDbStatusSettled();
            } else {
              return;
            }
          }
          refreshDbSaveStatusForOpenChat(p).catch(() => {});
        }).catch(() => {});
      }
      if (tryIndex < SHOPVD_DB_CHECK_RETRY_MS.length - 1) {
        renderDbSaveStatusCard({ state: 'scanning', convKey: key });
        shopvdDbCheckTimer = setTimeout(() => runAttempt(tryIndex + 1), SHOPVD_DB_CHECK_RETRY_MS[tryIndex + 1]);
        return;
      }
      diagnoseConversationDom('no-phone');
      renderDbSaveStatusCard({ state: 'scanning', convKey: key });
      startChatPhoneDiscovery(key, gen);
      scheduleScanChatForUnsavedOrderIntent(400);
      return;
    }

    refreshDbSaveStatusForOpenChat(phone)
      .then(() => scheduleScanChatForUnsavedOrderIntent(350))
      .catch((err) => shopvdDbLog('check:refresh-error', { error: err?.message || String(err) }));
  };

  runAttempt(0);
}

function setupDbSaveStatusCard() {
  document.getElementById('shopvd-ship-status-refresh')?.addEventListener('click', () => {
    handlePancakeChatDbSaveCheck(true, { forceRefresh: true });
  });
  renderDbSaveStatusCard({ state: 'idle' });
}

function extractPhoneFromMessageBubble(bubble) {
  if (!bubble) return '';
  const root = resolvePancakeMessageRoot(bubble) || bubble;
  const clientMsg = root.querySelector('.message-text-ele.client-message') || root;

  const tags = clientMsg.querySelectorAll(PANCAKE_PHONE_TAG_SELECTOR);
  if (tags.length) {
    const tag = tags[tags.length - 1];
    const fromTag = sanitizePhoneDigits(tag.textContent || '');
    if (isValidDraftPhone(fromTag) && !isPlaceholderDraftPhone(fromTag)) return fromTag;
    const fromId = extractPhoneFromPancakeSpanId(tag);
    if (fromId) return fromId;
  }

  const tel = root.querySelector('a[href^="tel:"]');
  if (tel) {
    const fromTel = sanitizePhoneDigits(tel.textContent || tel.getAttribute('href')?.replace(/^tel:/i, '') || '');
    if (isValidDraftPhone(fromTel)) return fromTel;
  }
  return extractFirstPhoneFromText(extractTextFromMessageBubble(root));
}

function buildAddressHintFromMessageText(text) {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const addressLines = lines.filter((line) => {
    if (textHasCustomerPhone(line) && line.replace(PANCAKE_PHONE_PATTERN, '').trim().length < 8) return false;
    return textHasAddressHint(line) || looksLikeFreeformAddress(line) || line.includes(',') || line.split(/\s+/).length >= 4;
  });

  const joined = (addressLines.length ? addressLines : lines).join(', ').trim();
  return normalizeDetectedAddressText(joined);
}

/**
 * Tìm intent đặt hàng mới nhất trong chat đang mở.
 * Dạng 1: SĐT + địa chỉ cùng 1 tin (.phone-tag + text địa chỉ).
 * Dạng 2: SĐT 1 tin, địa chỉ tin liền kề (trong cửa sổ vài tin khách).
 */
function findLatestOrderIntentInOpenChat() {
  const roots = collectCustomerMessageRootsInOrder();
  if (!roots.length) return null;

  const findNearbyAddress = (phoneIndex, preferAfter = true) => {
    const tryRange = (from, to, step) => {
      for (let j = from; step > 0 ? j <= to : j >= to; j += step) {
        const other = roots[j];
        if (messageHasPhoneTag(other) || isValidDraftPhone(extractPhoneFromMessageBubble(other))) continue;
        const address = extractAddressTextFromMessageBubble(other);
        if (isUsableDetectedAddress(address)) {
          return { address, addressRoot: other };
        }
      }
      return null;
    };

    const afterEnd = Math.min(roots.length - 1, phoneIndex + PANCAKE_SPLIT_INTENT_WINDOW);
    const beforeStart = Math.max(0, phoneIndex - PANCAKE_SPLIT_INTENT_WINDOW);

    if (preferAfter) {
      return tryRange(phoneIndex + 1, afterEnd, 1) || tryRange(phoneIndex - 1, beforeStart, -1);
    }
    return tryRange(phoneIndex - 1, beforeStart, -1) || tryRange(phoneIndex + 1, afterEnd, 1);
  };

  // Ưu tiên tin mới nhất
  for (let i = roots.length - 1; i >= 0; i -= 1) {
    const root = roots[i];

    // Dạng 1: cùng bubble
    if (isOrderIntentMessage(root)) {
      const phone = extractPhoneFromMessageBubble(root);
      const address = extractAddressTextFromMessageBubble(root)
        || normalizeDetectedAddressText(buildAddressHintFromMessageText(extractTextFromMessageBubble(root)));
      if (isValidDraftPhone(phone) && isUsableDetectedAddress(address)) {
        return { phone, address, root, mode: 'same-bubble' };
      }
    }

    // Dạng 2: tin có SĐT (không đủ địa chỉ) → ghép địa chỉ gần nhất
    const phoneHere = extractPhoneFromMessageBubble(root);
    if (isValidDraftPhone(phoneHere) && !isUsableDetectedAddress(extractAddressTextFromMessageBubble(root))) {
      const nearby = findNearbyAddress(i, true);
      if (nearby) {
        return {
          phone: phoneHere,
          address: nearby.address,
          root,
          addressRoot: nearby.addressRoot,
          mode: 'split',
        };
      }
    }
  }

  return null;
}

/** Ghép text SĐT + địa chỉ để parse/điền form (cùng tin hoặc 2 tin tách). */
function buildOrderIntentTextForGrab(bubble) {
  const root = resolvePancakeMessageRoot(bubble) || bubble;
  const phone = extractPhoneFromMessageBubble(root);
  const addressHere = extractAddressTextFromMessageBubble(root);

  if (isValidDraftPhone(phone) && isUsableDetectedAddress(addressHere)) {
    return `SĐT: ${phone}\nĐịa chỉ: ${addressHere}`;
  }

  const intent = findLatestOrderIntentInOpenChat();
  if (intent && isValidDraftPhone(intent.phone) && isUsableDetectedAddress(intent.address)) {
    // Chỉ dùng intent ghép nếu bubble đang grab là một nửa của cặp đó
    if (root === intent.root || root === intent.addressRoot) {
      return `SĐT: ${intent.phone}\nĐịa chỉ: ${intent.address}`;
    }
  }

  // Bubble chỉ có địa chỉ → tìm SĐT gần đó
  if (isUsableDetectedAddress(addressHere) && !isValidDraftPhone(phone)) {
    const roots = collectCustomerMessageRootsInOrder();
    const idx = roots.indexOf(root);
    if (idx >= 0) {
      const start = Math.max(0, idx - PANCAKE_SPLIT_INTENT_WINDOW);
      const end = Math.min(roots.length - 1, idx + PANCAKE_SPLIT_INTENT_WINDOW);
      for (let j = idx - 1; j >= start; j -= 1) {
        const p = extractPhoneFromMessageBubble(roots[j]);
        if (isValidDraftPhone(p) && !isOrderIntentMessage(roots[j])) {
          return `SĐT: ${p}\nĐịa chỉ: ${addressHere}`;
        }
      }
      for (let j = idx + 1; j <= end; j += 1) {
        const p = extractPhoneFromMessageBubble(roots[j]);
        if (isValidDraftPhone(p) && !isOrderIntentMessage(roots[j])) {
          return `SĐT: ${p}\nĐịa chỉ: ${addressHere}`;
        }
      }
    }
  }

  // Bubble chỉ có SĐT → tìm địa chỉ gần đó
  if (isValidDraftPhone(phone) && !isUsableDetectedAddress(addressHere)) {
    const roots = collectCustomerMessageRootsInOrder();
    const idx = roots.indexOf(root);
    if (idx >= 0) {
      const nearby = (() => {
        const end = Math.min(roots.length - 1, idx + PANCAKE_SPLIT_INTENT_WINDOW);
        const start = Math.max(0, idx - PANCAKE_SPLIT_INTENT_WINDOW);
        for (let j = idx + 1; j <= end; j += 1) {
          const a = extractAddressTextFromMessageBubble(roots[j]);
          if (isUsableDetectedAddress(a) && !isValidDraftPhone(extractPhoneFromMessageBubble(roots[j]))) {
            return a;
          }
        }
        for (let j = idx - 1; j >= start; j -= 1) {
          const a = extractAddressTextFromMessageBubble(roots[j]);
          if (isUsableDetectedAddress(a) && !isValidDraftPhone(extractPhoneFromMessageBubble(roots[j]))) {
            return a;
          }
        }
        return '';
      })();
      if (nearby) return `SĐT: ${phone}\nĐịa chỉ: ${nearby}`;
    }
  }

  return extractTextFromMessageBubble(root);
}

/**
 * Quét tin trong chat đang mở: nếu khách đã gửi SĐT+địa chỉ → đánh dấu chưa lưu ngay.
 * Không điền form (chỉ badge). Bỏ qua SĐT đã có đơn / đã scan.
 */
function scanChatForUnsavedOrderIntent() {
  if (!isAllowedPage() || shopvdRestoringDraft) return false;
  if (!isPancakeChatOpen()) return false;
  if (shopvdPendingPullInFlight || shopvdPendingPushInFlight) return false;

  const conversationKey = getPancakeConversationKey();
  if (!conversationKey) return false;

  // Đã xử lý chat này rồi → không quét lại (tránh badge nhấp nháy)
  if (shopvdAutoDetectDone.has(conversationKey)) return true;

  const intent = findLatestOrderIntentInOpenChat();
  if (!intent) return false;

  const { phone, address } = intent;
  if (!isValidDraftPhone(phone) || !isUsableDetectedAddress(address)) return false;

  if (isPhoneKnownOrdered(phone)) {
    shopvdAutoDetectDone.set(conversationKey, phone);
    return true;
  }
  if (isPhoneDismissed(phone)) {
    shopvdAutoDetectDone.set(conversationKey, phone);
    return true;
  }

  const existing = shopvdDraftMap.get(phone);
  if (existing) {
    // Bổ sung địa chỉ nếu draft cũ thiếu / ngắn hơn
    const prevAddr = String(existing.address || '').trim();
    if (address.length > prevAddr.length + 4) {
      upsertUnsavedDraft(conversationKey, {
        ...existing,
        name: existing.name || extractPancakeCustomerName() || '',
        phone,
        address,
      }, 'auto-detect');
    }
    shopvdAutoDetectDone.set(conversationKey, phone);
    return true;
  }

  const name = extractPancakeCustomerName() || '';
  const ok = upsertUnsavedDraft(conversationKey, {
    name,
    phone,
    address,
    street: '',
    provinceId: '',
    provinceName: '',
    wardId: '',
    wardName: '',
  }, 'auto-detect');

  if (ok || isPhoneKnownOrdered(phone)) {
    shopvdAutoDetectDone.set(conversationKey, phone);
    return true;
  }
  return false;
}

let shopvdAutoDetectTimer = null;

function scheduleScanChatForUnsavedOrderIntent(delayMs = 800) {
  clearTimeout(shopvdAutoDetectTimer);
  shopvdAutoDetectTimer = setTimeout(() => {
    if (!isPancakeChatOpen()) return;
    try {
      scanChatForUnsavedOrderIntent();
    } catch (err) {
      console.warn('[ShopVD] Auto-detect unsaved failed:', err);
    }
  }, delayMs);
}

async function parseAndApplyCustomerText(rawText, options = {}) {
  const silentEmpty = options.silentEmpty === true;
  const text = String(rawText || '').trim();

  if (!text) {
    if (!silentEmpty) {
      showStatus('⚠️ Không có nội dung để phân tích!', 'warning');
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

  const textarea = document.getElementById('shopvd-smart-paste-input');
  if (textarea) textarea.value = text;

  if (!addressLoaded) {
    showStatus('⏳ Đang tải dữ liệu địa chỉ...', 'info');
    await loadAddressData();
    if (!addressLoaded) {
      showStatus('⚠️ Không thể tải dữ liệu địa chỉ. Vui lòng thử lại.', 'warning');
      return { ok: false, reason: 'address_data_not_loaded' };
    }
  }

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
    showStatus('✅ Đã lấy thông tin khách từ tin nhắn', 'success', 2500);
    markCurrentChatAsUnsavedDraft('grab');

    return { ok: true, data: parsedData };
  } catch (error) {
    console.error('Smart paste error:', error);
    showSmartPasteResult({
      success: false,
      error: error.message || 'Lỗi phân tích',
    });
    return { ok: false, error };
  } finally {
    smartPasteBusy = false;
    setSmartPasteLoading(false);
  }
}

async function handleGrabFromSelection() {
  const text = getSelectionTextOutsideSidebar();
  if (!text) {
    showStatus('⚠️ Bôi đen tin nhắn khách trên Pancake trước', 'warning');
    return { ok: false, reason: 'no_selection' };
  }
  return parseAndApplyCustomerText(text);
}

async function handleGrabFromMessage(bubble) {
  const root = resolvePancakeMessageRoot(bubble) || bubble;
  const text = buildOrderIntentTextForGrab(root);
  if (!text) {
    showStatus('⚠️ Không đọc được nội dung tin nhắn', 'warning');
    return { ok: false, reason: 'empty_message' };
  }
  setGrabBubbleHighlight(root);
  setTimeout(() => clearGrabBubbleHighlight(), 900);
  return parseAndApplyCustomerText(text);
}

async function handleGrabFromLatestMessage() {
  const bubble = findLatestGrabableCustomerMessage();
  if (!bubble) {
    showStatus('⚠️ Không tìm thấy tin địa chỉ/SĐT gần nhất', 'warning');
    return { ok: false, reason: 'no_message' };
  }
  return handleGrabFromMessage(bubble);
}

let shopvdFloatGrabBtn = null;
let shopvdFloatGrabBubble = null;
let shopvdFloatHideTimer = null;
let shopvdGrabHighlightBubble = null;

function removeAllInlineGrabButtons() {
  document.querySelectorAll('.shopvd-pancake-grab-btn').forEach((btn) => btn.remove());
  document.querySelectorAll('.shopvd-pancake-msg-wrap').forEach((el) => {
    el.classList.remove('shopvd-pancake-msg-wrap');
  });
}

function setGrabBubbleHighlight(bubble) {
  clearGrabBubbleHighlight();
  if (!bubble) return;
  const root = resolvePancakeMessageRoot(bubble) || bubble;
  root.classList.add('shopvd-pancake-msg-hover');
  shopvdGrabHighlightBubble = root;
}

function clearGrabBubbleHighlight() {
  shopvdGrabHighlightBubble?.classList.remove('shopvd-pancake-msg-hover');
  shopvdGrabHighlightBubble = null;
}

function getOrCreateFloatGrabButton() {
  if (shopvdFloatGrabBtn) return shopvdFloatGrabBtn;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'shopvd-pancake-grab-float';
  btn.title = 'Lấy SĐT & địa chỉ sang ShopVD';
  btn.innerHTML = '<span class="shopvd-pancake-grab-float-icon" aria-hidden="true">→</span><span>ShopVD</span>';
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (shopvdFloatGrabBubble) {
      handleGrabFromMessage(resolvePancakeMessageRoot(shopvdFloatGrabBubble) || shopvdFloatGrabBubble);
    }
    hideFloatGrabButton();
  });
  btn.addEventListener('mouseenter', () => {
    clearTimeout(shopvdFloatHideTimer);
  });
  btn.addEventListener('mouseleave', () => {
    hideFloatGrabButton(180);
  });

  document.documentElement.appendChild(btn);
  shopvdFloatGrabBtn = btn;
  return btn;
}

function showFloatGrabButton(bubble) {
  if (!bubble) return;

  const root = resolvePancakeMessageRoot(bubble) || bubble;
  const anchor = resolvePancakeGrabAnchor(root);
  const btn = getOrCreateFloatGrabButton();
  const rect = anchor.getBoundingClientRect();
  if (!rect.width && !rect.height) return;

  shopvdFloatGrabBubble = root;
  setGrabBubbleHighlight(root);

  // Đo size thật (nút có thể đang ẩn → force layout nhẹ)
  btn.classList.add('is-visible');
  const btnRect = btn.getBoundingClientRect();
  const btnWidth = btnRect.width || 78;
  const btnHeight = btnRect.height || 28;
  const gap = 8;
  const edgePad = 8;

  const sidebar = document.getElementById('shopvd-sidebar');
  const sidebarLeft = sidebar && !sidebar.classList.contains('collapsed')
    ? (sidebar.getBoundingClientRect().left || window.innerWidth)
    : window.innerWidth;
  const maxLeft = Math.max(edgePad, sidebarLeft - btnWidth - edgePad);
  const minTop = edgePad;
  const maxTop = window.innerHeight - btnHeight - edgePad;

  // Ưu tiên: góc trên-phải bubble (không đè tin sau)
  // Fallback: bên phải giữa bubble → trên bubble → trong bubble
  const candidates = [
    {
      // Góc trên-phải, hơi nhô ra ngoài cạnh phải
      left: rect.right - btnWidth * 0.15,
      top: rect.top - btnHeight - 4,
      mode: 'above',
    },
    {
      // Bên phải, căn mép trên bubble
      left: rect.right + gap,
      top: rect.top,
      mode: 'side',
    },
    {
      // Bên phải, giữa bubble
      left: rect.right + gap,
      top: rect.top + (rect.height - btnHeight) / 2,
      mode: 'side',
    },
    {
      // Trong bubble, góc trên-phải (khi sát sidebar)
      left: rect.right - btnWidth - 6,
      top: rect.top + 4,
      mode: 'inside',
    },
    {
      // Trên bubble, căn trái (tin hẹp)
      left: rect.left,
      top: rect.top - btnHeight - 4,
      mode: 'above',
    },
  ];

  const fits = (c) => {
    const left = Math.max(edgePad, Math.min(maxLeft, c.left));
    const top = Math.max(minTop, Math.min(maxTop, c.top));
    // Không lệch quá xa so với bubble theo trục X
    if (left + btnWidth < rect.left - 4) return false;
    if (left > rect.right + gap + 4 && c.mode === 'side') return false;
    // Không đè quá sâu vào tin kế dưới
    if (c.mode !== 'above' && top >= rect.bottom - 4) return false;
    return { left, top };
  };

  let placed = null;
  let mode = 'above';
  for (const c of candidates) {
    const ok = fits(c);
    if (!ok) continue;
    placed = ok;
    mode = c.mode;
    break;
  }

  if (!placed) {
    placed = {
      left: Math.max(edgePad, Math.min(maxLeft, rect.right - btnWidth)),
      top: Math.max(minTop, Math.min(maxTop, rect.top - btnHeight - 4)),
    };
    mode = 'above';
  }

  btn.style.top = `${placed.top}px`;
  btn.style.left = `${placed.left}px`;
  btn.classList.remove('is-below');
  btn.classList.toggle('is-above', mode === 'above');
  btn.classList.toggle('is-inside', mode === 'inside');
  btn.classList.add('is-visible');
}

function hideFloatGrabButton(delayMs = 0) {
  clearTimeout(shopvdFloatHideTimer);
  shopvdFloatHideTimer = setTimeout(() => {
    shopvdFloatGrabBtn?.classList.remove('is-visible', 'is-below', 'is-above', 'is-inside');
    shopvdFloatGrabBubble = null;
    clearGrabBubbleHighlight();
  }, delayMs);
}

function setupPancakeHoverGrabButton() {
  document.addEventListener('mouseover', (e) => {
    if (!isAllowedPage()) return;
    if (isInsideShopvdSidebar(e.target)) return;
    if (shopvdFloatGrabBtn?.contains(e.target)) return;

    const bubble = findPancakeMessageBubble(e.target);
    if (!bubble) {
      hideFloatGrabButton(140);
      return;
    }

    if (bubble === shopvdFloatGrabBubble) {
      clearTimeout(shopvdFloatHideTimer);
      return;
    }

    clearTimeout(shopvdFloatHideTimer);
    showFloatGrabButton(bubble);
  }, true);

  document.addEventListener('scroll', () => {
    if (shopvdFloatGrabBubble) {
      showFloatGrabButton(shopvdFloatGrabBubble);
    }
  }, true);

  window.addEventListener('resize', () => hideFloatGrabButton());
}

function setupPancakeMessageGrab() {
  removeAllInlineGrabButtons();

  if (window.__shopvdPancakeGrabObserver) {
    window.__shopvdPancakeGrabObserver.disconnect();
    window.__shopvdPancakeGrabObserver = null;
  }

  document.getElementById('shopvd-grab-selection-btn')?.addEventListener('click', () => {
    handleGrabFromSelection();
  });

  document.getElementById('shopvd-grab-latest-btn')?.addEventListener('click', () => {
    handleGrabFromLatestMessage();
  });

  document.addEventListener('keydown', (e) => {
    if (!isAllowedPage()) return;
    if (!(e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'g')) return;
    if (isInsideShopvdSidebar(document.activeElement)) return;

    e.preventDefault();
    handleGrabFromSelection();
  });

  setupPancakeHoverGrabButton();
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

  return parseAndApplyCustomerText(text, { silentEmpty });
}

// Render category filter
function renderCategoryFilter() {
  const container = document.getElementById('category-filter-buttons');
  if (!container) return;

  const categoryButtons = allCategoriesCache.map(cat =>
    `<button type="button" class="shopvd-category-btn" data-category-id="${cat.id}">${escapeHtml(cat.name)}</button>`
  ).join('');

  container.innerHTML =
    `<button type="button" class="shopvd-category-btn${selectedCategoryId ? '' : ' active'}" data-category-id="">Tất cả</button>` +
    categoryButtons;

  container.querySelectorAll('.shopvd-category-btn').forEach(btn => {
    const id = btn.getAttribute('data-category-id');
    const isActive = selectedCategoryId === null
      ? id === ''
      : parseInt(id) === selectedCategoryId;
    btn.classList.toggle('active', isActive);
  });
}

// Switch product tab
function switchProductTab(tab) {
  currentProductTab = tab;

  document.querySelectorAll('.shopvd-product-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  const featuredContent = document.getElementById('featured-tab-content');
  const allContent = document.getElementById('all-tab-content');
  const manualContent = document.getElementById('manual-tab-content');

  featuredContent?.classList.toggle('active', tab === 'featured');
  featuredContent?.classList.toggle('hidden', tab !== 'featured');

  allContent?.classList.toggle('active', tab === 'all');
  allContent?.classList.toggle('hidden', tab !== 'all');

  manualContent?.classList.toggle('active', tab === 'manual');
  manualContent?.classList.toggle('hidden', tab !== 'manual');

  if (tab === 'all') {
    if (allProductsCache.length > 0) {
      renderAllProducts();
    } else {
      const grid = document.getElementById('all-products-grid');
      if (grid) {
        grid.innerHTML = '<div class="shopvd-empty-products">Đang tải sản phẩm...</div>';
      }
    }
  }

  if (tab === 'manual') {
    document.getElementById('manual-product-name')?.focus();
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
    const skipsWeight = catalogProductSkipsWeight(product);
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
        <div class="shopvd-inline-row${skipsWeight ? ' shopvd-inline-row-no-weight' : ''}">
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
          ${skipsWeight ? '' : `
          <div class="shopvd-inline-field shopvd-inline-field-weight">
            <label>Cân nặng</label>
            <input 
              type="text" 
              class="shopvd-inline-weight" 
              placeholder="5kg"
              data-product-id="${product.id}"
            >
          </div>
          `}
          <div class="shopvd-inline-field shopvd-inline-field-notes">
            <label>Lưu ý</label>
            <input 
              type="text" 
              class="shopvd-inline-notes" 
              placeholder="Ghi chú..."
              data-product-id="${product.id}"
            >
          </div>
        </div>
        <button type="button" class="shopvd-inline-add-btn" data-product-id="${product.id}">
          Thêm vào đơn
        </button>
      </div>
    </div>
  `}).join('');
  
  // Attach checkbox event listeners
  document.querySelectorAll('.shopvd-product-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', handleProductSelection);
  });

  document.querySelectorAll('.shopvd-product-list-item').forEach(item => {
    item.addEventListener('click', handleAllProductItemClick);
  });

  document.querySelectorAll('.shopvd-inline-add-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const productId = btn.getAttribute('data-product-id');
      if (!productId) return;

      const checkbox = document.querySelector(`.shopvd-product-checkbox[data-product-id="${productId}"]`);
      if (!checkbox) return;

      if (!checkbox.checked) {
        checkbox.checked = true;
        handleProductSelection({ target: checkbox });
      }

      const added = addCheckedAllTabProduct(checkbox);
      if (added) {
        showStatus('✅ Đã thêm vào đơn', 'success');
        setTimeout(() => {
          document.getElementById('shopvd-status')?.classList.add('hidden');
        }, 2000);
      }
    });
  });
  
  console.log('Products rendered successfully');
}

function handleAllProductItemClick(e) {
  if (e.target.closest('.shopvd-product-checkbox')) return;

  const checkbox = e.currentTarget.querySelector('.shopvd-product-checkbox');
  if (!checkbox || checkbox.checked) return;

  checkbox.checked = true;
  handleProductSelection({ target: checkbox });
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

// Add one checked product from the "Tất cả" tab inline form
function addCheckedAllTabProduct(checkbox, options = {}) {
  const productId = checkbox.getAttribute('data-product-id');
  const productName = checkbox.getAttribute('data-product-name');
  const productPrice = parseFloat(checkbox.getAttribute('data-product-price'));
  const productCost = parseFloat(checkbox.getAttribute('data-product-cost')) || 0;
  const productImage = checkbox.getAttribute('data-product-image');

  const qtyInput = document.querySelector(`.shopvd-inline-qty[data-product-id="${productId}"]`);
  const weightInput = document.querySelector(`.shopvd-inline-weight[data-product-id="${productId}"]`);
  const notesInput = document.querySelector(`.shopvd-inline-notes[data-product-id="${productId}"]`);

  const quantity = parseInt(qtyInput?.value) || 1;
  const weight = weightInput?.value.trim() || '';
  const notes = notesInput?.value.trim() || '';

  const added = addProductRow(
    productName,
    productPrice,
    quantity,
    parseInt(productId),
    productCost,
    productImage,
    weight,
    notes,
    {
      silentWarning: options.silentWarning === true,
      focusWeightEl: weightInput,
    }
  );

  if (!added) return false;

  checkbox.checked = false;
  if (qtyInput) qtyInput.value = '1';
  if (weightInput) weightInput.value = '';
  if (notesInput) notesInput.value = '';

  document.querySelector(`[data-form-id="${productId}"]`)?.classList.add('hidden');
  updateFAB();
  return true;
}

// Handle bulk add
function handleBulkAdd() {
  const checkboxes = document.querySelectorAll('.shopvd-product-checkbox:checked');
  
  if (checkboxes.length === 0) {
    showStatus('⚠️ Vui lòng chọn ít nhất 1 sản phẩm!', 'warning');
    return;
  }
  
  let addedCount = 0;
  let missingWeightCount = 0;
  
  checkboxes.forEach(checkbox => {
    if (addCheckedAllTabProduct(checkbox, { silentWarning: true })) {
      addedCount++;
    } else {
      missingWeightCount++;
    }
  });

  updateFAB();
  
  if (missingWeightCount > 0 && addedCount === 0) {
    showStatus('⚠️ Vui lòng nhập cân nặng cho sản phẩm đã chọn!', 'warning');
    return;
  }

  if (missingWeightCount > 0) {
    showStatus(`✅ Đã thêm ${addedCount} sản phẩm. ${missingWeightCount} sản phẩm thiếu cân nặng nên chưa thêm.`, 'warning');
    return;
  }

  if (addedCount === 0) return;

  // Show success message
  showStatus(`✅ Đã thêm ${addedCount} sản phẩm!`, 'success');
  setTimeout(() => {
    const statusEl = document.getElementById('shopvd-status');
    if (statusEl) statusEl.classList.add('hidden');
  }, 2000);
}

// Toggle featured/hot product card expand
function toggleFeaturedCard(card, list, headerBtn, sizeInput) {
  const wasSelected = card.classList.contains('selected');
  list.querySelectorAll('.shopvd-hot-product-card').forEach(c => {
    c.classList.remove('selected');
    c.querySelector('.shopvd-hot-product-header')?.setAttribute('aria-expanded', 'false');
  });

  if (!wasSelected) {
    card.classList.add('selected');
    headerBtn?.setAttribute('aria-expanded', 'true');
    setTimeout(() => sizeInput?.focus(), 50);
  }
}

// Render featured products (Hot selling products)
function renderFeaturedProducts() {
  const container = document.getElementById('featured-products-container');
  const list = document.getElementById('featured-products-list');
  
  if (!container || !list || featuredProducts.length === 0) return;
  
  container.classList.remove('hidden');
  
  list.innerHTML = featuredProducts.map(product => {
    const skipsWeight = catalogProductSkipsWeight(product);
    return `
    <div class="shopvd-hot-product-card${skipsWeight ? ' shopvd-hot-no-weight' : ''}" data-product-id="${product.id}">
      <div class="shopvd-hot-product-header" role="button" tabindex="0" aria-expanded="false">
        <div class="shopvd-hot-product-thumb-wrap">
          ${product.image_url ? `
            <img
              src="${escapeHtml(product.image_url)}"
              alt="${escapeHtml(product.name)}"
              class="shopvd-hot-product-thumb"
              onerror="this.classList.add('hidden'); this.parentElement.querySelector('.shopvd-hot-product-thumb-fallback')?.classList.remove('hidden')"
            >
          ` : ''}
          <div class="shopvd-hot-product-thumb shopvd-hot-product-thumb-placeholder shopvd-hot-product-thumb-fallback${product.image_url ? ' hidden' : ''}">📦</div>
        </div>
        <div class="shopvd-hot-product-info">
          <h4 class="shopvd-hot-product-name">${escapeHtml(product.name)}</h4>
          <div class="shopvd-hot-product-meta">
            <span class="shopvd-hot-product-price">${formatPrice(product.price)} đ</span>
            <span class="shopvd-hot-product-sold">Lượt bán ${parseInt(product.purchases) || 0}</span>
          </div>
        </div>
        <span class="shopvd-hot-expand-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </span>
      </div>
      
      <div class="shopvd-hot-product-details">
        <div class="shopvd-hot-product-body">
        ${skipsWeight ? '' : `
        <div class="shopvd-hot-input-row">
          <input 
            type="text" 
            class="shopvd-hot-size-input" 
            placeholder="Cân nặng (5kg)"
            data-field="size"
          >
          <input
            type="text"
            class="shopvd-hot-notes-input"
            placeholder="Lưu ý sản phẩm..."
            data-field="notes"
          >
        </div>

        <div class="shopvd-hot-weight-buttons">
          <button type="button" class="shopvd-hot-weight-btn" data-weight="">—</button>
          ${[3,4,5,6,7,8,9,10,11,12,13,14,15].map(kg => 
            `<button type="button" class="shopvd-hot-weight-btn" data-weight="${kg}kg">${kg}kg</button>`
          ).join('')}
        </div>
        `}
        ${skipsWeight ? `
        <div class="shopvd-hot-input-row shopvd-hot-input-row-notes-only">
          <input
            type="text"
            class="shopvd-hot-notes-input"
            placeholder="Lưu ý sản phẩm..."
            data-field="notes"
          >
        </div>
        ` : ''}
      </div>

      <div class="shopvd-hot-product-footer">
        <div class="shopvd-hot-quantity">
          <button type="button" class="shopvd-hot-qty-btn" data-action="decrease">−</button>
          <input type="number" class="shopvd-hot-qty-input" value="1" min="1" data-field="quantity">
          <button type="button" class="shopvd-hot-qty-btn" data-action="increase">+</button>
        </div>
        <button type="button" class="shopvd-hot-add-btn" data-action="add">Thêm vào đơn</button>
      </div>
      </div>
    </div>
  `;
  }).join('');
  
  // Attach event listeners for each product card
  list.querySelectorAll('.shopvd-hot-product-card').forEach(card => {
    const productId = parseInt(card.getAttribute('data-product-id'));
    const product = featuredProducts.find(p => p.id === productId);
    if (!product) return;
    
    const sizeInput = card.querySelector('[data-field="size"]');
    const qtyInput = card.querySelector('[data-field="quantity"]');
    const notesInput = card.querySelector('[data-field="notes"]');
    const headerBtn = card.querySelector('.shopvd-hot-product-header');

    const skipsWeight = catalogProductSkipsWeight(product);
    const focusEl = skipsWeight ? notesInput : sizeInput;

    headerBtn?.addEventListener('click', () => {
      toggleFeaturedCard(card, list, headerBtn, focusEl);
    });

    headerBtn?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleFeaturedCard(card, list, headerBtn, focusEl);
      }
    });
    
    // Weight buttons - click to quickly fill input
    if (sizeInput) {
      card.querySelectorAll('.shopvd-hot-weight-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const weight = btn.getAttribute('data-weight');
          sizeInput.value = weight;
        });
      });
    }
    
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
      const sizeOrWeight = sizeInput?.value.trim() || '';
      const notes = notesInput?.value.trim() || '';
      
      const added = addProductRow(
        product.name,
        product.price,
        quantity,
        product.id,
        product.cost_price || 0,
        product.image_url || '',
        sizeOrWeight,
        notes,
        { focusWeightEl: sizeInput || undefined }
      );

      if (!added) return;
      
      card.classList.remove('selected');
      headerBtn?.setAttribute('aria-expanded', 'false');
      
      qtyInput.value = 1;
      if (sizeInput) sizeInput.value = '';
      if (notesInput) notesInput.value = '';
      
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
let selectedSearchProduct = null;

function handleProductSearch(query) {
  clearTimeout(searchTimeout);
  
  const resultsDiv = document.getElementById('product-search-results');
  if (!resultsDiv) return;
  
  if (!query || query.trim().length < 2) {
    resultsDiv.classList.add('hidden');
    hideSearchProductForm();
    return;
  }

  hideSearchProductForm();
  
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
      <span class="shopvd-search-result-add">
        <svg class="shopvd-search-result-add-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5"/>
        </svg>
        Chọn
      </span>
    </div>
  `).join('');
  
  resultsDiv.querySelectorAll('.shopvd-search-result-item').forEach(item => {
    item.addEventListener('click', () => {
      const productId = parseInt(item.getAttribute('data-product-id'));
      const product = allProductsCache.find(p => p.id === productId);
      if (product) showSearchProductForm(product);
    });
  });
  
  resultsDiv.classList.remove('hidden');
}

function showSearchProductForm(product) {
  selectedSearchProduct = product;

  document.getElementById('product-search-results')?.classList.add('hidden');

  const form = document.getElementById('product-search-form');
  if (!form) return;

  const skipsWeight = catalogProductSkipsWeight(product);
  const nameEl = document.getElementById('product-search-form-name');
  const priceEl = document.getElementById('product-search-form-price');
  const imageEl = document.getElementById('product-search-form-image');
  const fallbackEl = document.getElementById('product-search-form-thumb-fallback');
  const weightField = document.getElementById('product-search-form-weight-field');
  const qtyInput = document.getElementById('product-search-qty');
  const weightInput = document.getElementById('product-search-weight');
  const notesInput = document.getElementById('product-search-notes');

  if (nameEl) nameEl.textContent = product.name;
  if (priceEl) priceEl.textContent = `${formatPrice(product.price)} đ`;

  if (product.image_url && imageEl) {
    imageEl.src = product.image_url;
    imageEl.alt = product.name;
    imageEl.classList.remove('hidden');
    fallbackEl?.classList.add('hidden');
    imageEl.onerror = () => {
      imageEl.classList.add('hidden');
      fallbackEl?.classList.remove('hidden');
    };
  } else {
    if (imageEl) {
      imageEl.removeAttribute('src');
      imageEl.classList.add('hidden');
    }
    fallbackEl?.classList.remove('hidden');
  }

  weightField?.classList.toggle('hidden', skipsWeight);

  if (qtyInput) qtyInput.value = '1';
  if (weightInput) weightInput.value = '';
  if (notesInput) notesInput.value = '';

  form.classList.remove('hidden');

  setTimeout(() => {
    if (skipsWeight) {
      notesInput?.focus();
    } else {
      weightInput?.focus();
    }
  }, 50);
}

function restoreSearchResultsIfQuery() {
  const searchInput = document.getElementById('product-search');
  if (!searchInput) return;

  const query = searchInput.value.trim();
  if (query.length < 2) return;

  renderSearchResults(searchProducts(query));
}

function updateProductSearchClearBtn() {
  const input = document.getElementById('product-search');
  const btn = document.getElementById('product-search-clear');
  if (!input || !btn) return;
  btn.classList.toggle('hidden', !input.value.trim());
}

function clearProductSearch() {
  const input = document.getElementById('product-search');
  if (input) input.value = '';
  document.getElementById('product-search-results')?.classList.add('hidden');
  hideSearchProductForm();
  updateProductSearchClearBtn();
  input?.focus();
}

function hideSearchProductForm(options = {}) {
  selectedSearchProduct = null;
  document.getElementById('product-search-form')?.classList.add('hidden');
  if (options.restoreResults) {
    restoreSearchResultsIfQuery();
  }
}

function addSearchProductToOrder() {
  if (!selectedSearchProduct) return;

  const product = selectedSearchProduct;
  const qtyInput = document.getElementById('product-search-qty');
  const weightInput = document.getElementById('product-search-weight');
  const notesInput = document.getElementById('product-search-notes');

  const quantity = parseInt(qtyInput?.value) || 1;
  const weight = weightInput?.value.trim() || '';
  const notes = notesInput?.value.trim() || '';

  const added = addProductRow(
    product.name,
    product.price,
    quantity,
    product.id,
    product.cost_price || 0,
    product.image_url || '',
    weight,
    notes,
    { focusWeightEl: weightInput || undefined }
  );

  if (!added) return;

  showStatus(`✅ Đã thêm: ${product.name}`, 'success');
  setTimeout(() => {
    document.getElementById('shopvd-status')?.classList.add('hidden');
  }, 2000);

  const searchInput = document.getElementById('product-search');
  if (searchInput) searchInput.value = '';
  updateProductSearchClearBtn();
  hideSearchProductForm();
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

function getCartProductsTotal() {
  return getValidCartProducts().reduce((sum, p) => {
    return sum + (parseInt(p.price || 0, 10) * parseInt(p.quantity || 1, 10));
  }, 0);
}

function getValidCartProducts() {
  return productsData.filter((p) => {
    const name = String(p.name || '').trim();
    const price = parseInt(p.price, 10);
    return name && Number.isFinite(price) && price > 0;
  });
}

function validateProductCostVsPrice(price, costPrice) {
  const priceNum = parseInt(price, 10) || 0;
  const costNum = parseInt(costPrice, 10) || 0;
  if (costNum > 0 && priceNum > 0 && costNum >= priceNum) {
    return 'Giá vốn phải thấp hơn giá bán';
  }
  return null;
}

function getDiscountOrderBaseTotal() {
  const shippingFee = parseInt(document.getElementById('shipping-fee')?.value || 0, 10);
  return getCartProductsTotal() + shippingFee;
}

function calcExtensionDiscountAmount(d, orderTotal, shipFee) {
  if (!d) return 0;
  if (d.type === 'fixed') return Math.min(d.discount_value || 0, orderTotal);
  if (d.type === 'percentage') {
    const amt = Math.round((d.discount_value || 0) / 100 * orderTotal);
    return d.max_discount_amount ? Math.min(amt, d.max_discount_amount) : amt;
  }
  if (d.type === 'freeship') return shipFee || 0;
  if (d.type === 'gift') return 0;
  return 0;
}

function getCachedDiscountByCode(code) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) return null;
  return allDiscountsCache.find((d) => String(d.code || '').trim().toUpperCase() === normalized) || null;
}

function validateDiscountLocally(discount, orderAmount) {
  if (!discount) return null;

  const now = new Date();
  if (discount.expiry_date && new Date(discount.expiry_date) < now) {
    return 'Mã giảm giá đã hết hạn';
  }
  if (discount.start_date && new Date(discount.start_date) > now) {
    return 'Mã giảm giá chưa có hiệu lực';
  }
  if (discount.min_order_amount && orderAmount < discount.min_order_amount) {
    return `Đơn hàng tối thiểu ${formatPrice(discount.min_order_amount)}đ`;
  }

  return null;
}

async function fetchJsonWithTimeout(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    let data = {};

    if (text) {
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('[ShopVD Extension] Invalid discount API response:', text.slice(0, 200));
        throw new Error('Invalid JSON response');
      }
    }

    return { response, data };
  } finally {
    clearTimeout(timer);
  }
}

function getExtensionDiscountValueText(d) {
  if (!d) return '';
  if (d.type === 'fixed') return `-${formatPrice(d.discount_value)} đ`;
  if (d.type === 'percentage') {
    let text = `-${d.discount_value}%`;
    if (d.max_discount_amount) {
      text += ` (max ${formatPrice(d.max_discount_amount)} đ)`;
    }
    return text;
  }
  if (d.type === 'freeship') return 'Miễn ship';
  if (d.type === 'gift') return 'Quà tặng';
  return '';
}

function getExtensionDiscountBadgeClass(type) {
  return (
    {
      fixed: 'shopvd-dm-code-badge-fixed',
      percentage: 'shopvd-dm-code-badge-percent',
      freeship: 'shopvd-dm-code-badge-freeship',
      gift: 'shopvd-dm-code-badge-gift',
    }[type] || 'shopvd-dm-code-badge-default'
  );
}

async function loadActiveDiscounts(forceReload = false) {
  if (!forceReload && allDiscountsCache.length > 0) {
    return allDiscountsCache;
  }

  try {
    const response = await fetch(`${API_BASE_URL}?action=getAllDiscounts&timestamp=${Date.now()}`);
    const data = await response.json();

    if (data.success && data.discounts) {
      const now = new Date();
      allDiscountsCache = data.discounts.filter((d) => {
        if (!d.active) return false;
        if (d.expiry_date && new Date(d.expiry_date) < now) return false;
        if (d.start_date && new Date(d.start_date) > now) return false;
        return true;
      });
    } else {
      allDiscountsCache = [];
    }
  } catch (error) {
    console.error('[ShopVD Extension] Error loading discounts:', error);
    allDiscountsCache = [];
  }

  return allDiscountsCache;
}

// Đồng bộ với desktop: số thuần → tự thêm "kg" (vd: 3 → 3kg)
function formatWeightSize(value) {
  if (!value) return '';
  let str = String(value).trim();
  const lower = str.toLowerCase();
  if (lower === 'chưa có' || lower === 'chua co' || lower === 'chua có') return '';

  str = str.replace(/\s+/g, '');

  if (/^\d+(\.\d+)?$/.test(str)) {
    return str + 'kg';
  }

  str = str
    .replace(/^(\d+(\.\d+)?)g$/i, '$1g')
    .replace(/^(\d+(\.\d+)?)kg$/i, '$1kg')
    .replace(/^(\d+(\.\d+)?)cm$/i, '$1cm')
    .replace(/^(\d+(\.\d+)?)mm$/i, '$1mm')
    .replace(/gram$/i, 'g')
    .replace(/kilogram$/i, 'kg');

  return str;
}

// Đồng bộ desktop orders-utils.js — chuẩn hóa cân/size trước khi gửi API
function normalizeOrderItemSizeClient(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (s === '') return null;
  const lower = s.toLowerCase();
  if (lower === 'chưa có' || lower === 'chua co' || lower === 'chua có') return null;
  return s;
}

// Đồng bộ desktop orders-submit.js — sanitize từng dòng cart trước khi tạo đơn
function sanitizeCartItemForSubmit(product) {
  const item = {
    name: product.name,
    quantity: parseInt(product.quantity) || 1,
    price: parseInt(product.price) || 0,
    cost_price: parseInt(product.cost_price) || 0,
  };

  if (product.product_id) {
    item.product_id = product.product_id;
  }
  if (product.image_url) {
    item.image_url = product.image_url;
  }

  const sizeRaw = formatWeightSize(product.size || product.weight || '');
  const size = normalizeOrderItemSizeClient(sizeRaw);
  if (size) item.size = size;

  const noteText = (product.notes || '').trim();
  if (noteText) item.notes = noteText;

  return item;
}

// Danh mục SP không cần cân nặng (đồng bộ admin orders-utils.js)
const NO_WEIGHT_CATEGORY_IDS = [14, 24, 23];
const NO_WEIGHT_CATEGORY_KEYWORDS = ['bán kèm', 'charm bạc'];

function getNoWeightCategoryIdSet() {
  const set = new Set(
    NO_WEIGHT_CATEGORY_IDS.map((id) => parseInt(String(id), 10)).filter((n) => !Number.isNaN(n))
  );
  for (const cat of allCategoriesCache) {
    const name = String(cat?.name || '').trim().toLowerCase();
    if (!name) continue;
    if (NO_WEIGHT_CATEGORY_KEYWORDS.some((kw) => name.includes(kw))) {
      const id = parseInt(String(cat.id), 10);
      if (!Number.isNaN(id)) set.add(id);
    }
  }
  return set;
}

function catalogProductSkipsWeight(product) {
  if (!product) return false;
  const set = getNoWeightCategoryIdSet();
  if (set.size === 0) return false;

  const ids = [];
  if (Array.isArray(product.category_ids) && product.category_ids.length) {
    ids.push(...product.category_ids);
  }
  if (product.category_id != null && product.category_id !== '') {
    ids.push(product.category_id);
  }
  if (Array.isArray(product.categories) && product.categories.length) {
    for (const c of product.categories) {
      if (c != null && typeof c === 'object' && c.id != null) ids.push(c.id);
      else if (c != null) ids.push(c);
    }
  }

  return ids.some((id) => set.has(parseInt(String(id), 10)));
}

function resolveCatalogProductForCartItem(item) {
  if (!item || typeof item !== 'object') return null;
  if (Array.isArray(item.category_ids) && item.category_ids.length) return item;
  if (item.category_id != null && item.category_id !== '') return item;
  const pid = item.product_id != null ? item.product_id : item.id;
  if (pid != null && pid !== '') {
    const n = parseInt(String(pid), 10);
    if (!Number.isNaN(n)) {
      const found = allProductsCache.find((p) => parseInt(String(p.id), 10) === n);
      if (found) return found;
    }
  }
  return null;
}

function cartItemSkipsWeight(item) {
  return catalogProductSkipsWeight(resolveCatalogProductForCartItem(item));
}

// Add product row (updated signature)
function addProductRow(name = '', price = '', quantity = 1, productId = null, costPrice = 0, imageUrl = '', weight = '', notes = '', options = {}) {
  const normalizedWeight = formatWeightSize(weight);
  const normalizedNotes = (notes || '').trim();

  let categoryId = null;
  let categoryIds = null;
  let cachedProduct = null;
  if (productId) {
    cachedProduct = allProductsCache.find(p => p.id === productId);
    if (cachedProduct) {
      categoryId = cachedProduct.category_id || null;
      categoryIds = cachedProduct.category_ids || null;
      if (!categoryIds && Array.isArray(cachedProduct.categories) && cachedProduct.categories.length) {
        categoryIds = cachedProduct.categories.map((c) => (typeof c === 'object' ? c.id : c)).filter((id) => id != null);
      }
      if (!categoryId && Array.isArray(categoryIds) && categoryIds.length) {
        categoryId = categoryIds[0];
      }
    }
  }

  const skipsWeight = catalogProductSkipsWeight(cachedProduct || { category_id: categoryId, category_ids: categoryIds });

  const priceNum = parseInt(price, 10) || 0;
  const costNum = parseInt(costPrice, 10) || 0;
  if (!productId) {
    const costError = validateProductCostVsPrice(priceNum, costNum);
    if (costError) {
      if (!options.silentWarning) {
        showStatus('⚠️ ' + costError, 'warning');
      }
      return false;
    }
  }

  if (name && !normalizedWeight && !skipsWeight) {
    if (!options.silentWarning) {
      showStatus('⚠️ Vui lòng nhập cân nặng trước khi thêm sản phẩm!', 'warning');
    }
    options.focusWeightEl?.focus();
    return false;
  }
  
  const id = Date.now() + Math.floor(Math.random() * 1000);
  
  productsData.push({
    id, 
    name: String(name || '').trim(), 
    price: priceNum,
    quantity: Math.max(1, parseInt(quantity, 10) || 1),
    product_id: productId,
    cost_price: costNum,
    image_url: imageUrl,
    weight: normalizedWeight,
    notes: normalizedNotes,
    category_id: categoryId,
    category_ids: categoryIds
  });
  console.log('[ShopVD Extension] Thêm SP vào đơn:', {
    name,
    weight: normalizedWeight,
    notes: normalizedNotes || '(trống)',
    product_id: productId,
  });
  renderProducts();
  calculateTotal();
  autoUpdateFreeshipCheckbox();
  return true;
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

function updateOrderCartUI() {
  const countEl = document.getElementById('order-cart-count');
  const cartEl = document.getElementById('shopvd-order-cart');
  const validCount = getValidCartProducts().length;

  if (countEl) countEl.textContent = String(validCount);
  cartEl?.classList.toggle('shopvd-order-cart-empty', validCount === 0);
  revalidateFieldIfActive('order-products');
}

function renderProducts() {
  const container = document.getElementById('products-list');
  if (!container) return;

  const validProducts = getValidCartProducts();

  if (validProducts.length === 0) {
    container.innerHTML = '<p class="shopvd-empty-products">Chưa có sản phẩm nào trong đơn.<br><span class="shopvd-empty-products-hint">Chọn sản phẩm ở tab trên và bấm «Thêm vào đơn»</span></p>';
    updateOrderCartUI();
    return;
  }

  container.innerHTML = validProducts.map((product) => {
    const totalPrice = parseInt(product.price || 0) * parseInt(product.quantity || 1);
    const skipsWeight = cartItemSkipsWeight(product);
    
    return `
    <div class="shopvd-product-item" data-product-id="${product.id}">
      <div class="shopvd-product-main">
        <div class="shopvd-product-thumb-wrap">
          ${product.image_url ? `
            <img
              src="${escapeHtml(product.image_url)}"
              alt="${escapeHtml(product.name)}"
              class="shopvd-product-thumb"
              onerror="this.classList.add('hidden'); this.parentElement.querySelector('.shopvd-product-thumb-fallback')?.classList.remove('hidden')"
            >
          ` : ''}
          <div class="shopvd-product-thumb shopvd-product-thumb-placeholder shopvd-product-thumb-fallback${product.image_url ? ' hidden' : ''}">📦</div>
        </div>
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
              ${product.weight ? `<span class="shopvd-meta-item">● ${escapeHtml(formatWeightSize(product.weight))}</span>` : ''}
              <span class="shopvd-product-qty-badge">×${product.quantity}</span>
              ${product.notes ? `<span class="shopvd-meta-item shopvd-meta-notes"><svg class="shopvd-meta-notes-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"/></svg>${escapeHtml(product.notes)}</span>` : ''}
            </div>
            <div class="shopvd-product-total">${formatPrice(totalPrice)} đ</div>
          </div>
        </div>
      </div>
      
      <!-- Edit Form (Hidden by default) -->
      <div class="shopvd-product-edit-form hidden" data-edit-form="${product.id}">
        <input type="text" placeholder="Tên sản phẩm" value="${escapeHtml(product.name)}" data-field="name" class="shopvd-edit-input">
        <div class="shopvd-edit-row shopvd-edit-row-prices">
          <input type="number" placeholder="Giá bán" value="${product.price}" data-field="price" min="0" step="1000" class="shopvd-edit-input">
          <input type="number" placeholder="Giá vốn" value="${product.cost_price || 0}" data-field="cost_price" min="0" step="1" class="shopvd-edit-input">
          <input type="number" placeholder="SL" value="${product.quantity}" data-field="quantity" min="1" class="shopvd-edit-input">
        </div>
        ${skipsWeight
          ? `<input type="text" placeholder="Lưu ý..." value="${escapeHtml(product.notes || '')}" data-field="notes" class="shopvd-edit-input">`
          : `<div class="shopvd-edit-row shopvd-edit-row-meta">
          <input type="text" placeholder="Cân nặng" value="${escapeHtml(product.weight || '')}" data-field="weight" class="shopvd-edit-input">
          <input type="text" placeholder="Lưu ý..." value="${escapeHtml(product.notes || '')}" data-field="notes" class="shopvd-edit-input">
        </div>`}
        <div class="shopvd-edit-actions">
          <button type="button" class="shopvd-btn-save" data-action="save">Lưu</button>
          <button type="button" class="shopvd-btn-cancel" data-action="cancel">Hủy</button>
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
          const skipsWeight = cartItemSkipsWeight(product);
          const weightInput = editForm.querySelector('input[data-field="weight"]');
          const weightValue = formatWeightSize(weightInput?.value || '');

          if (!skipsWeight && !weightValue) {
            showStatus('⚠️ Vui lòng nhập cân nặng cho sản phẩm!', 'warning');
            weightInput?.focus();
            return;
          }

          // Update product data
          editForm.querySelectorAll('input[data-field]').forEach(input => {
            const field = input.getAttribute('data-field');
            let value = input.value;
            if (field === 'weight') {
              value = weightValue;
              product.weight = value;
              delete product.size;
            } else if (field === 'notes') {
              const noteText = value.trim();
              if (noteText) product.notes = noteText;
              else delete product.notes;
            } else if (field === 'price' || field === 'cost_price') {
              product[field] = parseInt(value, 10) || 0;
            } else if (field === 'quantity') {
              product[field] = Math.max(1, parseInt(value, 10) || 1);
            } else {
              product[field] = value;
            }
          });

          if (skipsWeight) {
            product.weight = '';
            delete product.size;
          }

          const costError = validateProductCostVsPrice(product.price, product.cost_price);
          if (costError) {
            showStatus('⚠️ ' + costError, 'warning');
            return;
          }
          
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

  updateOrderCartUI();
}

function computeCashDiscountSuggestions(base) {
  const rounded = Math.max(0, Math.round(base));
  if (rounded < 1000) return [];

  const k = Math.floor(rounded / 1000) % 10;
  const n0 = k === 0 ? 10 : k;
  return [n0, n0 + 10, n0 + 20].map((n) => n * 1000);
}

function renderInlineDiscountPresets() {
  const container = document.getElementById('discount-inline-presets');
  if (!container) return;

  const productsTotal = getCartProductsTotal();
  const shippingFee = parseInt(document.getElementById('shipping-fee')?.value || 0, 10);
  const base = Math.max(0, Math.round(productsTotal + shippingFee));
  const suggestions = computeCashDiscountSuggestions(base);
  const appliedAmount = parseInt(document.getElementById('discount-amount')?.value || '0', 10);

  if (!suggestions.length) {
    container.innerHTML = '<span class="shopvd-discount-inline-empty">Thêm SP để gợi ý giảm</span>';
    return;
  }

  container.innerHTML = suggestions.map((amount) => {
    const disabled = amount >= base;
    const isActive = !disabled && appliedAmount === amount;
    return `<button type="button" class="shopvd-discount-inline-preset${isActive ? ' active' : ''}${disabled ? ' is-disabled' : ''}" data-type="amount" data-value="${amount}"${disabled ? ' disabled' : ''}>-${formatPrice(amount)}đ</button>`;
  }).join('');
}

// Calculate total amount
function calculateTotal() {
  const shippingFee = parseInt(document.getElementById('shipping-fee')?.value || 0);
  const discountAmount = parseInt(document.getElementById('discount-amount')?.value || 0);
  const productsTotal = getCartProductsTotal();
  
  const total = Math.max(0, productsTotal + shippingFee - discountAmount);
  const totalText = total.toLocaleString('vi-VN') + 'đ';
  const stickyTotal = document.getElementById('sticky-total-amount');
  if (stickyTotal) {
    stickyTotal.textContent = totalText;
  }

  renderInlineDiscountPresets();
}

// Show status message
function showStatus(message, type = 'info', autoHideMs = 5000) {
  const statusEl = document.getElementById('shopvd-status');
  if (!statusEl) return;

  statusEl.textContent = message;
  statusEl.className = `shopvd-status ${type}`;
  statusEl.classList.remove('hidden');

  if (autoHideMs <= 0) return;

  setTimeout(() => {
    statusEl.classList.add('hidden');
  }, autoHideMs);
}

// === Order form validation (Phase 1) ===
let orderFormValidationActive = false;

const VALIDATION_TARGETS = {
  'customer-name': () => document.getElementById('customer-name'),
  'customer-phone': () => document.getElementById('customer-phone'),
  'customer-province': () => document.getElementById('province-combobox-btn'),
  'customer-ward': () => document.getElementById('ward-combobox-btn'),
  'customer-street': () => document.getElementById('customer-street'),
  'order-products': () => document.getElementById('shopvd-order-cart'),
};

const VALIDATION_FOCUS = {
  'customer-name': () => document.getElementById('customer-name'),
  'customer-phone': () => document.getElementById('customer-phone'),
  'customer-province': () => document.getElementById('province-combobox-btn'),
  'customer-ward': () => document.getElementById('ward-combobox-btn'),
  'customer-street': () => document.getElementById('customer-street'),
  'customer-source': () => document.querySelector('.shopvd-source-btn'),
  'order-products': () => document.getElementById('shopvd-order-cart'),
};

const VALIDATION_INPUT_KEYS = new Set([
  'customer-name',
  'customer-phone',
  'customer-street',
]);

function isValidCustomerPhone(phone) {
  return /^0\d{8,10}$/.test(phone);
}

function collectOrderFormValidationErrors() {
  const errors = [];
  const push = (key, message) => {
    errors.push({ key, message });
  };

  const customerName = document.getElementById('customer-name')?.value.trim() || '';
  if (!customerName) {
    push('customer-name', 'Vui lòng nhập tên khách hàng');
  }

  const customerPhone = sanitizePhoneDigits(document.getElementById('customer-phone')?.value);
  if (!customerPhone) {
    push('customer-phone', 'Vui lòng nhập số điện thoại');
  } else if (!isValidCustomerPhone(customerPhone)) {
    push('customer-phone', 'Số điện thoại không hợp lệ');
  }

  const provinceId = document.getElementById('customer-province')?.value;
  if (!provinceId) {
    push('customer-province', 'Vui lòng chọn tỉnh/thành phố');
  }

  const wardId = document.getElementById('customer-ward')?.value;
  if (!wardId) {
    push('customer-ward', 'Vui lòng chọn phường/xã');
  }

  const streetAddress = document.getElementById('customer-street')?.value.trim() || '';
  if (!streetAddress) {
    push('customer-street', 'Vui lòng nhập số nhà, tên đường');
  }

  const customerSource = document.getElementById('customer-source')?.value;
  if (!customerSource) {
    push('customer-source', 'Vui lòng chọn nguồn khách');
  }

  const validCartProducts = getValidCartProducts();
  if (validCartProducts.length === 0) {
    push('order-products', 'Vui lòng thêm ít nhất 1 sản phẩm');
  } else {
    const missingWeight = validCartProducts.filter(
      (p) => !cartItemSkipsWeight(p) && !formatWeightSize(p.weight)
    );
    if (missingWeight.length > 0) {
      const names = missingWeight.slice(0, 2).map((p) => p.name).join(', ');
      const suffix = missingWeight.length > 2 ? '…' : '';
      push(
        'order-products',
        `Còn ${missingWeight.length} sản phẩm chưa có cân nặng${names ? `: ${names}${suffix}` : ''}`
      );
    }
  }

  return errors;
}

function setValidationFieldError(key, message) {
  const errorEl = document.getElementById(`validate-error-${key}`);
  const hasError = Boolean(message);

  if (errorEl) {
    errorEl.textContent = message;
    errorEl.hidden = !hasError;
  }

  if (key === 'customer-source') {
    document.querySelectorAll('.shopvd-source-btn').forEach((btn) => {
      btn.classList.toggle('is-invalid', hasError);
    });
    return;
  }

  VALIDATION_TARGETS[key]?.()?.classList.toggle('is-invalid', hasError);
}

function clearValidationFieldError(key) {
  setValidationFieldError(key, '');
}

function clearOrderFormValidationUI() {
  [...Object.keys(VALIDATION_TARGETS), 'customer-source'].forEach(clearValidationFieldError);
  document.querySelector('.shopvd-sticky-footer')?.classList.remove('is-validation-shake');
}

function scrollToValidationField(key) {
  const focusEl = VALIDATION_FOCUS[key]?.();
  if (!focusEl) return;

  focusEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (typeof focusEl.focus === 'function') {
    focusEl.focus({ preventScroll: true });
  }
}

function focusFirstValidationError(errors) {
  if (!errors.length) return;
  scrollToValidationField(errors[0].key);
}

function applyOrderFormValidation(errors) {
  orderFormValidationActive = true;
  clearOrderFormValidationUI();
  errors.forEach((err) => setValidationFieldError(err.key, err.message));
  focusFirstValidationError(errors);
  document.querySelector('.shopvd-sticky-footer')?.classList.add('is-validation-shake');
}

function revalidateFieldIfActive(key) {
  if (!orderFormValidationActive) return;
  const errors = collectOrderFormValidationErrors();
  const fieldError = errors.find((err) => err.key === key);
  if (fieldError) {
    setValidationFieldError(key, fieldError.message);
  } else {
    clearValidationFieldError(key);
  }
  if (errors.length === 0) {
    orderFormValidationActive = false;
    clearOrderFormValidationUI();
  }
}

function bindOrderFormValidationListeners() {
  const form = document.getElementById('shopvd-order-form');
  if (!form || form.dataset.validationBound === '1') return;
  form.dataset.validationBound = '1';

  form.addEventListener('input', (e) => {
    const id = e.target.id;
    if (VALIDATION_INPUT_KEYS.has(id)) {
      revalidateFieldIfActive(id);
    }
    if (id === 'customer-name' || id === 'customer-phone' || id === 'customer-street') {
      // Street: debounce dài hơn để khỏi nhảy khi đang gõ
      onCustomerInfoChangedForProductScroll(id === 'customer-street' ? 420 : 160);
    }
  });

  document.getElementById('customer-street')?.addEventListener('blur', () => {
    maybeScrollToProductSectionAfterCustomerReady({ focus: true });
  });

  document.getElementById('customer-street')?.addEventListener('input', () => {
    revalidateFieldIfActive('customer-street');
  });
}

function resetCustomerSourceSelection() {
  document.querySelectorAll('.shopvd-source-btn').forEach((btn) => btn.classList.remove('active'));
  const sourceInput = document.getElementById('customer-source');
  if (sourceInput) sourceInput.value = '';
}

function resetPaymentMethodSelection() {
  document.querySelectorAll('.shopvd-payment-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-payment') === 'cod');
  });
  const paymentInput = document.getElementById('payment-method');
  if (paymentInput) paymentInput.value = 'cod';
  document.getElementById('deposit-amount-wrapper')?.classList.add('hidden');
  const depositInput = document.getElementById('deposit-amount');
  if (depositInput) depositInput.value = '0';
}

function clearOrderFormValidationOnReset() {
  orderFormValidationActive = false;
  clearOrderFormValidationUI();
}

const PAYMENT_METHOD_LABELS = {
  cod: 'COD',
  bank_transfer: 'CK',
  deposit: 'Cọc',
};

const SHOPVD_OST_AUTO_HIDE_MS = 3200;
let shopvdOstHideTimer = 0;
let shopvdOstFadeTimer = 0;

function hideOrderSuccessToast(immediate = false) {
  const toast = document.getElementById('shopvd-order-success-toast');
  if (!toast) return;

  clearTimeout(shopvdOstHideTimer);
  clearTimeout(shopvdOstFadeTimer);
  shopvdOstHideTimer = 0;
  shopvdOstFadeTimer = 0;

  if (immediate || toast.classList.contains('hidden')) {
    toast.classList.add('hidden');
    toast.classList.remove('is-leaving');
    return;
  }

  toast.classList.add('is-leaving');
  shopvdOstFadeTimer = setTimeout(() => {
    toast.classList.add('hidden');
    toast.classList.remove('is-leaving');
    shopvdOstFadeTimer = 0;
  }, 220);
}

function closeOrderSuccessModal() {
  hideOrderSuccessToast(true);
}

function showOrderSuccessToast(summary = {}) {
  const toast = document.getElementById('shopvd-order-success-toast');
  if (!toast) return;

  const orderId = String(summary.orderId || '—').trim() || '—';
  const phone = String(summary.customerPhone || '').trim();
  const name = String(summary.customerName || '').trim();
  const pay = PAYMENT_METHOD_LABELS[summary.paymentMethod] || summary.paymentMethod || '';
  const total = `${formatPrice(summary.totalAmount)} đ`;
  const parts = [
    phone || name || null,
    summary.productCount ? `${summary.productCount} SP` : null,
    pay || null,
    total,
  ].filter(Boolean);

  const idBtn = document.getElementById('ost-order-id');
  if (idBtn) {
    idBtn.textContent = orderId;
    idBtn.dataset.orderId = orderId;
  }
  const summaryEl = document.getElementById('ost-summary');
  if (summaryEl) summaryEl.textContent = parts.join(' · ');

  document.getElementById('shopvd-status')?.classList.add('hidden');

  clearTimeout(shopvdOstHideTimer);
  clearTimeout(shopvdOstFadeTimer);
  toast.classList.remove('hidden', 'is-leaving');
  // Restart enter animation if toast already visible
  toast.classList.remove('is-enter');
  void toast.offsetWidth;
  toast.classList.add('is-enter');

  shopvdOstHideTimer = setTimeout(() => {
    hideOrderSuccessToast(false);
  }, SHOPVD_OST_AUTO_HIDE_MS);
}

function showOrderSuccessModal(summary) {
  showOrderSuccessToast(summary);
}

async function copyOrderSuccessId() {
  const idBtn = document.getElementById('ost-order-id');
  const orderId = idBtn?.dataset?.orderId || idBtn?.textContent || '';
  if (!orderId || orderId === '—') return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(orderId);
    } else {
      const ta = document.createElement('textarea');
      ta.value = orderId;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    idBtn?.classList.add('is-copied');
    setTimeout(() => idBtn?.classList.remove('is-copied'), 900);
  } catch (_) { /* ignore */ }
}

function setCreateOrderLoading(isLoading) {
  const createBtn = document.getElementById('create-order-btn');
  if (!createBtn) return;

  if (isLoading) {
    createBtn.disabled = true;
    createBtn.dataset.originalHtml = createBtn.innerHTML;
    createBtn.innerHTML = `
      <svg class="shopvd-btn-spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="12" cy="12" r="9" stroke-opacity="0.25"/>
        <path d="M12 3a9 9 0 0 1 9 9" stroke-linecap="round"/>
      </svg>
      Đang tạo đơn
    `;
    return;
  }

  createBtn.disabled = false;
  if (createBtn.dataset.originalHtml) {
    createBtn.innerHTML = createBtn.dataset.originalHtml;
    delete createBtn.dataset.originalHtml;
  }
}

// Create order via API
async function createOrder(orderData) {
  try {
    setCreateOrderLoading(true);

    console.group('[ShopVD Extension] POST /api/order/create');
    console.log('Payload gửi API:', JSON.parse(JSON.stringify(orderData)));
    console.log('Cart — lưu ý từng SP:', (orderData.cart || []).map((item, i) => ({
      index: i,
      name: item.name,
      product_id: item.product_id ?? null,
      size: item.size ?? null,
      notes: item.notes ?? '(không có)',
    })));
    console.log('Ghi chú đơn hàng (orders.notes):', orderData.notes ?? '(không có)');

    const response = await fetch(`${API_BASE_URL}/api/order/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderData)
    });

    const result = await response.json();

    console.log('HTTP status:', response.status);
    console.log('Response:', result);

    if (result.success && result.order) {
      console.log('orderDbId:', result.orderDbId);
      console.log('order.products (raw DB):', result.order.products);
      try {
        const savedProducts = JSON.parse(result.order.products || '[]');
        console.log('order.products (parsed):', savedProducts);
        console.log('Lưu ý SP đã lưu trong DB:', savedProducts.map((p, i) => ({
          index: i,
          name: p.name,
          notes: p.notes ?? '(không có)',
          size: p.size ?? p.weight ?? null,
        })));
      } catch (parseErr) {
        console.warn('Không parse được order.products:', parseErr);
      }
    }
    console.groupEnd();

    if (result.success) {
      const savedPhone = sanitizePhoneDigits(orderData.customer?.phone || '');
      if (savedPhone) {
        markPhoneAsOrdered(savedPhone);
        removeUnsavedDraft(savedPhone);
        handlePancakeChatDbSaveCheck(true, { forceRefresh: true });
      }
      schedulePullPendingFromServer(500);

      showOrderSuccessModal({
        orderId: result.orderId || orderData.orderId,
        customerName: orderData.customer?.name,
        customerPhone: orderData.customer?.phone,
        totalAmount: orderData.totalAmount,
        productCount: (orderData.cart || []).length,
        paymentMethod: orderData.paymentMethod,
      });
      
      // Reset form
      document.getElementById('shopvd-order-form').reset();
      resetCustomerAddressForm();
      resetCustomerSourceSelection();
      resetPaymentMethodSelection();
      const smartPasteInput = document.getElementById('shopvd-smart-paste-input');
      if (smartPasteInput) smartPasteInput.value = '';
      document.getElementById('shopvd-smart-paste-status')?.classList.add('hidden');
      document.getElementById('product-search') && (document.getElementById('product-search').value = '');
      updateProductSearchClearBtn();
      hideSearchProductForm();
      document.getElementById('product-search-results')?.classList.add('hidden');
      document.getElementById('send-later-fields')?.classList.add('hidden');
      setShippingFeeValue(defaultCustomerShippingFee, { recalc: false });
      setShippingCostValue(defaultActualShippingCost, { recalc: false });
      document.getElementById('deposit-amount').value = '0';
      document.getElementById('discount-amount').value = '0';
      document.getElementById('discount-code').value = '';
      const discountQuickInput = document.getElementById('discount-code-quick');
      if (discountQuickInput) discountQuickInput.value = '';
      const discountDisplay = document.getElementById('discount-display');
      if (discountDisplay) discountDisplay.textContent = 'Chưa áp dụng';
      document.getElementById('discount-applied-bar')?.classList.add('hidden');
      document.getElementById('discount-entry')?.classList.remove('hidden');
      document.getElementById('shopvd-discount-panel')?.classList.remove('is-applied');
      document.getElementById('discount-quick-status')?.classList.add('hidden');
      document.getElementById('current-discount-badge')?.classList.add('hidden');
      productsData = [];
      renderProducts();
      calculateTotal();
      clearOrderFormValidationOnReset();

      lastPancakeConversationKey = '';
      customerNameUserEdited = false;
      scheduleUnsavedDraftUi(80);
      schedulePancakeCustomerNameSync(300);

      // Open shopvd.store in new tab (optional)
      // window.open(`https://shopvd.store/admin/index.html`, '_blank');
    } else {
      console.warn('[ShopVD Extension] Tạo đơn thất bại:', result.error || result);
      showStatus(`❌ Lỗi: ${result.error || 'Không thể tạo đơn'}`, 'error');
    }
  } catch (error) {
    console.error('[ShopVD Extension] Lỗi kết nối API:', error);
    showStatus(`❌ Lỗi kết nối API: ${error.message}`, 'error');
  } finally {
    setCreateOrderLoading(false);
  }
}

function sanitizePhoneDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function bindPhoneNumericInput() {
  const phoneInput = document.getElementById('customer-phone');
  if (!phoneInput) return;

  const applySanitize = () => {
    const sanitized = sanitizePhoneDigits(phoneInput.value);
    if (phoneInput.value !== sanitized) {
      phoneInput.value = sanitized;
    }
  };

  phoneInput.addEventListener('input', applySanitize);
  phoneInput.addEventListener('paste', (e) => {
    e.preventDefault();
    const pasted = sanitizePhoneDigits((e.clipboardData || window.clipboardData)?.getData('text') || '');
    if (!pasted) return;

    const start = phoneInput.selectionStart ?? phoneInput.value.length;
    const end = phoneInput.selectionEnd ?? phoneInput.value.length;
    phoneInput.value = phoneInput.value.slice(0, start) + pasted + phoneInput.value.slice(end);
    const pos = start + pasted.length;
    phoneInput.setSelectionRange(pos, pos);
  });
}

function setSidebarCollapsed(collapsed) {
  const sidebar = document.getElementById('shopvd-sidebar');
  const rail = document.getElementById('shopvd-expand-rail');
  if (!sidebar) return;

  sidebar.classList.toggle('collapsed', collapsed);
  rail?.classList.toggle('hidden', !collapsed);

  const toggleBtn = document.getElementById('shopvd-toggle');
  if (toggleBtn) {
    toggleBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  }

  if (collapsed) {
    document.getElementById('discount-modal')?.classList.add('hidden');
    closeOrderSuccessModal();
  }
}

// Setup event listeners
function setupEventListeners() {
  bindOrderFormValidationListeners();

  document.getElementById('shopvd-toggle')?.addEventListener('click', () => {
    setSidebarCollapsed(true);
  });

  document.getElementById('shopvd-expand-rail')?.addEventListener('click', () => {
    setSidebarCollapsed(false);
  });

  bindPhoneNumericInput();

  document.getElementById('shopvd-ost-close')?.addEventListener('click', () => hideOrderSuccessToast(true));
  document.getElementById('ost-order-id')?.addEventListener('click', (e) => {
    e.preventDefault();
    copyOrderSuccessId();
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
      revalidateFieldIfActive('customer-source');
    });
  });

  // Free shipping checkbox
  document.getElementById('free-shipping')?.addEventListener('change', (e) => {
    if (e.target.checked) {
      setShippingFeeValue(0);
    } else {
      setShippingFeeValue(defaultCustomerShippingFee);
    }
  });

  setupShippingBadgeListeners();

  // Manual product quantity stepper
  const manualQtyInput = document.getElementById('manual-product-quantity');
  const stepManualQty = (delta) => {
    if (!manualQtyInput) return;
    const next = Math.max(1, (parseInt(manualQtyInput.value, 10) || 1) + delta);
    manualQtyInput.value = String(next);
  };
  document.getElementById('manual-product-qty-minus')?.addEventListener('click', () => stepManualQty(-1));
  document.getElementById('manual-product-qty-plus')?.addEventListener('click', () => stepManualQty(1));

  // Submit manual product
  document.getElementById('add-manual-product-submit')?.addEventListener('click', () => {
    const name = document.getElementById('manual-product-name').value.trim();
    const price = document.getElementById('manual-product-price').value;
    const costPrice = document.getElementById('manual-product-cost').value;
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
    if (!formatWeightSize(weight)) {
      showStatus('⚠️ Vui lòng nhập cân nặng trước khi thêm sản phẩm!', 'warning');
      document.getElementById('manual-product-weight')?.focus();
      return;
    }

    const costError = validateProductCostVsPrice(price, costPrice);
    if (costError) {
      showStatus('⚠️ ' + costError, 'warning');
      document.getElementById('manual-product-cost')?.focus();
      return;
    }

    const added = addProductRow(name, price, quantity, null, parseInt(costPrice, 10) || 0, '', weight, notes);
    if (!added) return;

    document.getElementById('manual-product-name').value = '';
    document.getElementById('manual-product-price').value = '';
    document.getElementById('manual-product-cost').value = '';
    document.getElementById('manual-product-quantity').value = '1';
    document.getElementById('manual-product-weight').value = '';
    document.getElementById('manual-product-notes').value = '';
    document.getElementById('manual-product-name')?.focus();

    showStatus('✅ Đã thêm sản phẩm!', 'success');
    setTimeout(() => {
      const statusEl = document.getElementById('shopvd-status');
      if (statusEl) statusEl.classList.add('hidden');
    }, 1500);
  });

  // Discount Modal
  let currentDiscountUnit = 'percent'; // 'percent' or 'amount'
  let currentDiscountValue = 0;

  function getSelectedDiscountAmount() {
    if (currentDiscountValue <= 0) return 0;
    const cartTotal = calculateCartTotal();
    if (currentDiscountUnit === 'percent') {
      return Math.round(cartTotal * currentDiscountValue / 100);
    }
    return currentDiscountValue;
  }

  function syncDiscountCodeInputs(code) {
    const normalized = String(code || '').trim().toUpperCase();
    const hiddenInput = document.getElementById('discount-code');
    const quickInput = document.getElementById('discount-code-quick');
    if (hiddenInput) hiddenInput.value = normalized;
    if (quickInput) quickInput.value = normalized;
  }

  function setDiscountQuickStatus(message, type = 'info') {
    const statusEl = document.getElementById('discount-quick-status');
    if (!statusEl) return;

    if (!message) {
      statusEl.textContent = '';
      statusEl.classList.add('hidden');
      statusEl.classList.remove('is-error', 'is-success');
      return;
    }

    statusEl.textContent = message;
    statusEl.classList.remove('hidden', 'is-error', 'is-success');
    if (type === 'error') {
      statusEl.classList.add('is-error');
    } else if (type === 'success') {
      statusEl.classList.add('is-success');
    }
  }

  function updateDiscountPanelUI() {
    const amount = parseInt(document.getElementById('discount-amount')?.value || '0', 10);
    const appliedBar = document.getElementById('discount-applied-bar');
    const entry = document.getElementById('discount-entry');
    const panel = document.getElementById('shopvd-discount-panel');
    const amountEl = document.getElementById('discount-applied-amount');

    if (amount > 0) {
      appliedBar?.classList.remove('hidden');
      entry?.classList.add('hidden');
      panel?.classList.add('is-applied');
      if (amountEl) amountEl.textContent = `-${formatPrice(amount)}đ`;
    } else {
      appliedBar?.classList.add('hidden');
      entry?.classList.remove('hidden');
      panel?.classList.remove('is-applied');
      if (amountEl) amountEl.textContent = '';
    }
  }

  function updateDiscountModalFooter() {
    const activeTab = document.querySelector('#discount-modal .shopvd-tab-btn.active')?.getAttribute('data-tab');
    const applyBtn = document.getElementById('apply-discount-btn');
    if (applyBtn) {
      applyBtn.classList.toggle('hidden', activeTab === 'code');
    }
  }

  function openDiscountModal(preferredTab = 'custom') {
    const modal = document.getElementById('discount-modal');
    modal?.classList.remove('hidden');
    generateAmountPresets();

    const tab = preferredTab === 'code' ? 'code' : 'custom';
    document.querySelectorAll('#discount-modal .shopvd-tab-btn').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-tab') === tab);
    });
    document.querySelectorAll('#discount-modal .shopvd-tab-content').forEach((content) => {
      content.classList.toggle('active', content.getAttribute('data-tab-content') === tab);
    });
    if (tab === 'code') {
      loadAndRenderDiscountCodes();
    }
    updateDiscountModalFooter();

    // Khôi phục lựa chọn từ giảm giá đã áp dụng
    const appliedAmount = parseInt(document.getElementById('discount-amount')?.value || '0', 10);
    currentDiscountValue = 0;
    document.querySelectorAll('.shopvd-dm-preset').forEach(b => b.classList.remove('active'));

    if (appliedAmount > 0) {
      const cartTotal = calculateCartTotal();
      let matched = false;

      document.querySelectorAll('.shopvd-dm-preset').forEach(btn => {
        const type = btn.getAttribute('data-type');
        const value = parseFloat(btn.getAttribute('data-value'));
        let btnAmount = 0;

        if (type === 'percent') {
          btnAmount = Math.round(cartTotal * value / 100);
        } else {
          btnAmount = value;
        }

        if (btnAmount === appliedAmount) {
          btn.classList.add('active');
          currentDiscountUnit = type;
          currentDiscountValue = value;
          matched = true;
        }
      });

      if (!matched) {
        currentDiscountUnit = 'amount';
        currentDiscountValue = appliedAmount;
        const customInput = document.getElementById('custom-discount-value');
        if (customInput) customInput.value = appliedAmount;
        document.querySelectorAll('.shopvd-toggle-btn').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-unit') === 'amount');
        });
      }
    }

    updateDiscountSelectionUI();
  }

  function applyInlineDiscountPreset(type, value) {
    const cartTotal = calculateCartTotal();
    const shippingFee = parseInt(document.getElementById('shipping-fee')?.value || 0, 10);
    const orderBase = cartTotal + shippingFee;

    if (orderBase <= 0) {
      setDiscountQuickStatus('Thêm sản phẩm trước khi giảm giá', 'error');
      showStatus('⚠️ Thêm sản phẩm trước khi giảm giá', 'warning');
      return;
    }

    let discountAmount = 0;
    if (type === 'percent') {
      discountAmount = Math.round(cartTotal * value / 100);
    } else {
      discountAmount = value;
    }

    if (discountAmount <= 0 || discountAmount >= orderBase) {
      setDiscountQuickStatus('Chọn mức giảm nhỏ hơn tổng đơn', 'error');
      showStatus('⚠️ Chọn mức giảm nhỏ hơn tổng đơn', 'warning');
      return;
    }

    currentDiscountUnit = type;
    currentDiscountValue = value;
    applyDiscount();
    setDiscountQuickStatus('');
  }

  function clearDiscountSelection() {
    currentDiscountValue = 0;

    document.querySelectorAll('.shopvd-dm-preset').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.shopvd-discount-inline-preset').forEach(b => b.classList.remove('active'));

    const customInput = document.getElementById('custom-discount-value');
    if (customInput) customInput.value = '';

    const discountAmountInput = document.getElementById('discount-amount');
    if (discountAmountInput) discountAmountInput.value = '0';

    const discountDisplay = document.getElementById('discount-display');
    if (discountDisplay) discountDisplay.textContent = 'Chưa áp dụng';

    syncDiscountCodeInputs('');
    setDiscountCodeStatus('');
    setDiscountQuickStatus('');

    updateDiscountBadge(0);
    updateDiscountPanelUI();
    updateDiscountModalTotal();
    calculateTotal();
  }

  function updateDiscountSelectionUI() {
    const previewAmount = getSelectedDiscountAmount();
    const appliedAmount = parseInt(document.getElementById('discount-amount')?.value || '0', 10);
    updateDiscountBadge(previewAmount > 0 ? previewAmount : appliedAmount);
    updateDiscountModalTotal();
  }

  // Open discount modal
  document.getElementById('open-discount-modal')?.addEventListener('click', (e) => {
    const tab = e.currentTarget?.getAttribute('data-open-tab') || 'custom';
    openDiscountModal(tab);
  });

  document.getElementById('open-discount-codes')?.addEventListener('click', () => {
    openDiscountModal('code');
  });

  document.getElementById('discount-applied-remove')?.addEventListener('click', () => {
    clearDiscountSelection();
    showStatus('✅ Đã xóa giảm giá', 'success');
    setTimeout(() => {
      const statusEl = document.getElementById('shopvd-status');
      if (statusEl) statusEl.classList.add('hidden');
    }, 2000);
  });

  document.getElementById('discount-code-quick-apply')?.addEventListener('click', async () => {
    const code = document.getElementById('discount-code-quick')?.value || '';
    await applyExtensionDiscountCode(code);
  });

  document.getElementById('discount-code-quick')?.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const code = e.target.value || '';
    await applyExtensionDiscountCode(code);
  });

  document.getElementById('discount-inline-presets')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.shopvd-discount-inline-preset');
    if (!btn || btn.disabled) return;

    const type = btn.getAttribute('data-type');
    const value = parseFloat(btn.getAttribute('data-value'));
    const appliedAmount = parseInt(document.getElementById('discount-amount')?.value || '0', 10);

    if (btn.classList.contains('active') && appliedAmount > 0) {
      clearDiscountSelection();
      return;
    }

    applyInlineDiscountPreset(type, value);
  });

  // Close discount modal
  document.getElementById('close-discount-modal')?.addEventListener('click', closeDiscountModal);
  document.getElementById('close-discount-modal-footer')?.addEventListener('click', closeDiscountModal);
  document.querySelector('.shopvd-dm-overlay')?.addEventListener('click', closeDiscountModal);

  function closeDiscountModal() {
    document.getElementById('discount-modal')?.classList.add('hidden');
  }

  // Tab switching (scoped to discount modal — tránh ảnh hưởng tab sản phẩm Bán chạy/Tất cả)
  document.querySelectorAll('#discount-modal .shopvd-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      
      // Update tabs
      document.querySelectorAll('#discount-modal .shopvd-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Update content
      document.querySelectorAll('#discount-modal .shopvd-tab-content').forEach(content => {
        content.classList.remove('active');
      });
      document.querySelector(`#discount-modal [data-tab-content="${tab}"]`)?.classList.add('active');

      if (tab === 'code') {
        loadAndRenderDiscountCodes();
      }
      updateDiscountModalFooter();
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

      // Bấm lại nút đang chọn → bỏ chọn
      if (e.target.classList.contains('active')) {
        clearDiscountSelection();
        return;
      }

      // Chọn preset mới
      document.querySelectorAll('.shopvd-dm-preset').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');

      currentDiscountUnit = type;
      currentDiscountValue = value;

      const customInput = document.getElementById('custom-discount-value');
      if (customInput) customInput.value = '';

      document.querySelectorAll('.shopvd-toggle-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-unit') === type);
      });

      updateDiscountSelectionUI();
    }
  });

  // Custom discount input
  document.getElementById('custom-discount-value')?.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value) || 0;
    currentDiscountValue = value;

    document.querySelectorAll('.shopvd-dm-preset').forEach(b => b.classList.remove('active'));

    if (value > 0) {
      const activeUnitBtn = document.querySelector('.shopvd-toggle-btn.active');
      currentDiscountUnit = activeUnitBtn?.getAttribute('data-unit') || 'amount';
    }

    updateDiscountSelectionUI();
  });

  // Refresh presets
  document.getElementById('refresh-discount-presets')?.addEventListener('click', () => {
    generateAmountPresets();
  });

  // Apply discount
  document.getElementById('apply-discount-btn')?.addEventListener('click', async () => {
    const activeTab = document.querySelector('#discount-modal .shopvd-tab-btn.active')?.getAttribute('data-tab');
    if (activeTab === 'code') {
      closeDiscountModal();
      return;
    }

    applyDiscount();
    closeDiscountModal();
  });

  // Remove discount via badge (xóa ngay cả khi mới chọn, chưa áp dụng)
  document.getElementById('remove-discount-badge-btn')?.addEventListener('click', () => {
    clearDiscountSelection();

    showStatus('✅ Đã xóa giảm giá', 'success');
    setTimeout(() => {
      const statusEl = document.getElementById('shopvd-status');
      if (statusEl) statusEl.classList.add('hidden');
    }, 2000);
  });

  function setDiscountCodeStatus(message, type = 'info') {
    const statusEl = document.getElementById('discount-code-status');
    if (!statusEl) return;

    if (!message) {
      statusEl.textContent = '';
      statusEl.classList.add('hidden');
      statusEl.classList.remove('is-error', 'is-success');
      return;
    }

    statusEl.textContent = message;
    statusEl.classList.remove('hidden', 'is-error', 'is-success');
    if (type === 'error') {
      statusEl.classList.add('is-error');
    } else if (type === 'success') {
      statusEl.classList.add('is-success');
    }
  }

  function renderDiscountCodesList() {
    const list = document.getElementById('discount-codes-list');
    if (!list) return;

    const query = (document.getElementById('discount-code-search')?.value || '').trim().toLowerCase();
    let items = allDiscountsCache;

    if (query) {
      items = items.filter((d) => {
        return (d.code || '').toLowerCase().includes(query) ||
          (d.title || '').toLowerCase().includes(query);
      });
    }

    if (!items.length) {
      list.innerHTML = `<p class="shopvd-dm-codes-empty">${query ? 'Không tìm thấy mã phù hợp.' : 'Chưa có mã giảm giá hoạt động.'}</p>`;
      return;
    }

    list.innerHTML = items.map((d) => {
      const badgeClass = getExtensionDiscountBadgeClass(d.type);
      const valTxt = getExtensionDiscountValueText(d);
      const minTxt = d.min_order_amount ? `Tối thiểu ${formatPrice(d.min_order_amount)} đ` : '';
      const useTxt = d.max_total_uses
        ? `Còn ${Math.max(0, d.max_total_uses - (d.usage_count || 0))} lượt`
        : '';
      const meta = [minTxt, useTxt].filter(Boolean).join(' · ');

      return `
        <button type="button" class="shopvd-dm-code-item" data-code="${escapeHtml(d.code || '')}">
          <span class="shopvd-dm-code-item-icon ${badgeClass}" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z"/>
            </svg>
          </span>
          <span class="shopvd-dm-code-item-body">
            <span class="shopvd-dm-code-item-top">
              <span class="shopvd-dm-code-item-code">${escapeHtml(d.code || '')}</span>
              <span class="shopvd-dm-code-item-badge ${badgeClass}">${escapeHtml(valTxt)}</span>
            </span>
            ${d.title ? `<span class="shopvd-dm-code-item-title">${escapeHtml(d.title)}</span>` : ''}
            ${meta ? `<span class="shopvd-dm-code-item-meta">${escapeHtml(meta)}</span>` : ''}
          </span>
        </button>
      `;
    }).join('');
  }

  async function loadAndRenderDiscountCodes() {
    const list = document.getElementById('discount-codes-list');
    if (!list) return;

    if (allDiscountsCache.length === 0) {
      list.innerHTML = '<p class="shopvd-dm-codes-empty">Đang tải danh sách mã…</p>';
      await loadActiveDiscounts();
    }

    if (allDiscountsCache.length === 0) {
      list.innerHTML = '<p class="shopvd-dm-codes-empty">Không tải được danh sách mã. Thử lại sau.</p>';
      return;
    }

    renderDiscountCodesList();
  }

  function applyValidatedDiscountToForm(discount, orderAmount, shippingFee) {
    const discountAmount = calcExtensionDiscountAmount(discount, orderAmount, shippingFee);

    currentDiscountValue = 0;
    currentDiscountUnit = 'percent';
    document.querySelectorAll('.shopvd-dm-preset').forEach((b) => b.classList.remove('active'));

    const customInput = document.getElementById('custom-discount-value');
    if (customInput) customInput.value = '';

    syncDiscountCodeInputs(discount.code);

    const discountAmountInput = document.getElementById('discount-amount');
    if (discountAmountInput) discountAmountInput.value = discountAmount;

    let displayText = discount.code;
    if (discount.type === 'percentage') {
      displayText = `${discount.code} (-${discount.discount_value}%)`;
    } else if (discount.type === 'fixed') {
      displayText = `${discount.code} (-${formatPrice(discountAmount)} đ)`;
    } else if (discount.type === 'freeship') {
      displayText = `${discount.code} (Miễn ship)`;
    } else if (discount.type === 'gift') {
      displayText = `${discount.code} (Quà tặng)`;
    }

    const discountDisplay = document.getElementById('discount-display');
    if (discountDisplay) discountDisplay.textContent = displayText;

    document.querySelectorAll('.shopvd-discount-inline-preset').forEach(b => b.classList.remove('active'));

    updateDiscountBadge(discountAmount);
    updateDiscountPanelUI();
    calculateTotal();
    return discountAmount;
  }

  async function applyExtensionDiscountCode(rawCode) {
    const code = String(rawCode || '').trim().toUpperCase();
    if (!code) {
      setDiscountQuickStatus('Vui lòng nhập mã giảm giá', 'error');
      setDiscountCodeStatus('Vui lòng nhập mã giảm giá', 'error');
      showStatus('⚠️ Vui lòng nhập mã giảm giá', 'warning');
      return false;
    }

    if (discountCodeValidating) {
      return false;
    }

    const cartTotal = getCartProductsTotal();
    const shippingFee = parseInt(document.getElementById('shipping-fee')?.value || 0, 10);
    const orderAmount = cartTotal + shippingFee;

    if (orderAmount <= 0) {
      setDiscountQuickStatus('Thêm sản phẩm trước khi áp dụng mã', 'error');
      setDiscountCodeStatus('Thêm sản phẩm trước khi áp dụng mã', 'error');
      showStatus('⚠️ Thêm sản phẩm trước khi áp dụng mã', 'warning');
      return false;
    }

    const cachedDiscount = getCachedDiscountByCode(code);
    const localError = validateDiscountLocally(cachedDiscount, orderAmount);
    if (localError) {
      setDiscountQuickStatus(localError, 'error');
      setDiscountCodeStatus(localError, 'error');
      showStatus('⚠️ ' + localError, 'warning');
      return false;
    }

    const quickApplyBtn = document.getElementById('discount-code-quick-apply');
    discountCodeValidating = true;
    if (quickApplyBtn) {
      quickApplyBtn.disabled = true;
      quickApplyBtn.textContent = 'Đang kiểm tra…';
    }
    setDiscountQuickStatus('Đang kiểm tra mã…');
    setDiscountCodeStatus('Đang kiểm tra mã…');

    try {
      const customerPhone = sanitizePhoneDigits(document.getElementById('customer-phone')?.value || '');
      const validateUrl = `${API_BASE_URL}?action=validateDiscount&code=${encodeURIComponent(code)}&customerPhone=${encodeURIComponent(customerPhone)}&orderAmount=${orderAmount}&timestamp=${Date.now()}`;
      const { response, data } = await fetchJsonWithTimeout(validateUrl);

      if (!response.ok || !data.success) {
        const errorMessage = data.error || 'Mã giảm giá không hợp lệ';
        setDiscountQuickStatus(errorMessage, 'error');
        setDiscountCodeStatus(errorMessage, 'error');
        showStatus('⚠️ ' + errorMessage, 'warning');
        return false;
      }

      const discount = data.discount;
      if (!discount) {
        setDiscountQuickStatus('Mã giảm giá không hợp lệ', 'error');
        setDiscountCodeStatus('Mã giảm giá không hợp lệ', 'error');
        showStatus('⚠️ Mã giảm giá không hợp lệ', 'warning');
        return false;
      }

      applyValidatedDiscountToForm(discount, orderAmount, shippingFee);
      setDiscountQuickStatus(`Đã áp dụng mã ${discount.code}`, 'success');
      setDiscountCodeStatus(`Đã áp dụng mã ${discount.code}`, 'success');

      showStatus(`✅ Áp dụng mã ${discount.code} thành công`, 'success');
      setTimeout(() => {
        const statusEl = document.getElementById('shopvd-status');
        if (statusEl) statusEl.classList.add('hidden');
      }, 2000);

      return true;
    } catch (error) {
      console.error('[ShopVD Extension] Error validating discount:', error);
      const errorMessage = error?.name === 'AbortError'
        ? 'Kiểm tra mã quá lâu. Vui lòng thử lại.'
        : 'Lỗi kết nối. Vui lòng thử lại.';
      setDiscountQuickStatus(errorMessage, 'error');
      setDiscountCodeStatus(errorMessage, 'error');
      showStatus('⚠️ ' + errorMessage, 'warning');
      return false;
    } finally {
      discountCodeValidating = false;
      if (quickApplyBtn) {
        quickApplyBtn.disabled = false;
        quickApplyBtn.textContent = 'Áp dụng';
      }
    }
  }

  document.getElementById('discount-code-search')?.addEventListener('input', () => {
    renderDiscountCodesList();
  });

  document.getElementById('discount-codes-list')?.addEventListener('click', async (e) => {
    const item = e.target.closest('.shopvd-dm-code-item');
    if (!item) return;

    e.preventDefault();
    e.stopPropagation();

    const code = item.getAttribute('data-code');
    syncDiscountCodeInputs(code || '');

    const ok = await applyExtensionDiscountCode(code);
    if (ok) closeDiscountModal();
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

    const base = Math.max(0, Math.round(cartTotal + shippingFee));
    const suggestions = computeCashDiscountSuggestions(base);

    if (!suggestions.length) {
      container.innerHTML = '<p style="font-size: 12px; color: #9ca3af;">Thêm sản phẩm để xem gợi ý</p>';
      return;
    }

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

    syncDiscountCodeInputs('');
    setDiscountCodeStatus('');
    setDiscountQuickStatus('');
    
    // Update hidden discount amount
    document.getElementById('discount-amount').value = discountAmount;
    
    // Update display
    document.getElementById('discount-display').textContent = displayText;
    
    // Update badge
    updateDiscountBadge(discountAmount);
    updateDiscountPanelUI();
    
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
    updateProductSearchClearBtn();
  });

  document.getElementById('product-search')?.addEventListener('focus', () => {
    const form = document.getElementById('product-search-form');
    if (!form?.classList.contains('hidden')) return;
    restoreSearchResultsIfQuery();
  });

  document.getElementById('product-search-clear')?.addEventListener('click', (e) => {
    e.stopPropagation();
    clearProductSearch();
  });

  document.getElementById('product-search-form-close')?.addEventListener('click', () => {
    hideSearchProductForm({ restoreResults: true });
  });
  document.getElementById('product-search-add-btn')?.addEventListener('click', addSearchProductToOrder);

  // Product tabs
  document.querySelectorAll('.shopvd-product-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const tabName = tab.getAttribute('data-tab');
      if (tabName) {
        switchProductTab(tabName);
      }
    });
  });

  // Category filter buttons
  document.getElementById('category-filter-buttons')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.shopvd-category-btn');
    if (!btn) return;

    document.querySelectorAll('.shopvd-category-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const id = btn.getAttribute('data-category-id');
    filterByCategory(id ? parseInt(id) : null);
  });

  // Bulk add selected products
  document.getElementById('bulk-add-fab')?.addEventListener('click', handleBulkAdd);

  // Click outside to close search results
  document.addEventListener('click', (e) => {
    const searchContainer = document.querySelector('.shopvd-product-search-container');
    const resultsDiv = document.getElementById('product-search-results');
    if (searchContainer && resultsDiv && !searchContainer.contains(e.target)) {
      resultsDiv.classList.add('hidden');
      hideSearchProductForm();
    }
  });

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
    const customerPhone = sanitizePhoneDigits(document.getElementById('customer-phone')?.value);
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

    // Validate — thu thập tất cả lỗi, hiển thị inline + summary
    const validationErrors = collectOrderFormValidationErrors();
    if (validationErrors.length > 0) {
      applyOrderFormValidation(validationErrors);
      return;
    }
    clearOrderFormValidationOnReset();

    const validCartProducts = getValidCartProducts();

    // Build cart — đồng bộ format desktop (size + notes, không dùng id giả)
    const cart = validCartProducts.map(p => sanitizeCartItemForSubmit(p));

    console.group('[ShopVD Extension] Chuẩn bị tạo đơn');
    console.log('validCartProducts:', JSON.parse(JSON.stringify(validCartProducts)));
    console.log('cart (sau sanitize):', JSON.parse(JSON.stringify(cart)));
    console.log('Kiểm tra lưu ý SP:', validCartProducts.map((p, i) => ({
      index: i,
      name: p.name,
      notes_local: p.notes ?? '(trống)',
      notes_cart: cart[i]?.notes ?? '(không gửi)',
    })));
    console.groupEnd();

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

    // Giữ ID dạng string tree_2 ("01", "00329") — không parseInt (tránh 1.0 / 329.0)
    const provinceIdStr = String(provinceId || '').trim();
    const wardIdStr = String(wardId || '').trim();
    const provinceObj = provinceMap.get(provinceIdStr);
    const wardObj = wardMap.get(`${provinceIdStr}-${wardIdStr}`);
    const provinceName = provinceObj?.Name || null;
    const wardName = wardObj?.Name || null;

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
      // Address 2 cấp — ID string + tên (export SPX / báo cáo không phụ thuộc tree client)
      province_id: provinceIdStr || null,
      province_name: provinceName,
      ward_id: wardIdStr || null,
      ward_name: wardName,
      street_address: streetAddress || null
    };

    await createOrder(orderData);
  });
}

// Initialize
// Global shipping fee defaults (loaded from API)
let defaultCustomerShippingFee = 21000;
let defaultActualShippingCost = 0;
let shippingEditTarget = null;

function getShippingFeeValue() {
  return parseInt(document.getElementById('shipping-fee')?.value || 0, 10);
}

function getShippingCostValue() {
  return parseInt(document.getElementById('shipping-cost')?.value || 0, 10);
}

function setShippingFeeValue(value, options = {}) {
  const input = document.getElementById('shipping-fee');
  if (!input) return;
  input.value = String(Math.max(0, parseInt(value, 10) || 0));
  updateShippingBadgeDisplay();
  if (options.recalc !== false) {
    calculateTotal();
  }
}

function setShippingCostValue(value, options = {}) {
  const input = document.getElementById('shipping-cost');
  if (!input) return;
  input.value = String(Math.max(0, parseInt(value, 10) || 0));
  updateShippingBadgeDisplay();
  if (options.recalc !== false) {
    calculateTotal();
  }
}

function updateShippingBadgeDisplay() {
  const feeDisplay = document.getElementById('shipping-fee-display');
  const costDisplay = document.getElementById('shipping-cost-display');
  const feeBadge = document.getElementById('shipping-fee-badge');
  const isFreeShip = document.getElementById('free-shipping')?.checked;

  if (feeDisplay) feeDisplay.textContent = `${formatPrice(getShippingFeeValue())}đ`;
  if (costDisplay) costDisplay.textContent = `${formatPrice(getShippingCostValue())}đ`;

  if (feeBadge) {
    feeBadge.classList.toggle('is-disabled', !!isFreeShip);
    feeBadge.classList.toggle('is-free', !!isFreeShip);
  }
}

function closeShippingEditPopover() {
  document.getElementById('shipping-edit-popover')?.classList.add('hidden');
  shippingEditTarget = null;
}

function openShippingEditPopover(target) {
  if (target === 'fee' && document.getElementById('free-shipping')?.checked) {
    return;
  }

  const popover = document.getElementById('shipping-edit-popover');
  const input = document.getElementById('shipping-edit-input');
  const label = document.getElementById('shipping-edit-label');
  if (!popover || !input || !label) return;

  shippingEditTarget = target;
  if (target === 'fee') {
    label.textContent = 'Phí ship khách trả';
    input.value = String(getShippingFeeValue());
  } else {
    label.textContent = 'Chi phí ship thực tế';
    input.value = String(getShippingCostValue());
  }

  popover.classList.remove('hidden');
  input.focus();
  input.select();
}

function saveShippingEditPopover() {
  const input = document.getElementById('shipping-edit-input');
  const value = parseInt(input?.value || 0, 10);

  if (shippingEditTarget === 'fee') {
    setShippingFeeValue(value);
  } else if (shippingEditTarget === 'cost') {
    setShippingCostValue(value);
  }

  closeShippingEditPopover();
}

function setupShippingBadgeListeners() {
  document.getElementById('shipping-fee-badge')?.addEventListener('click', () => {
    openShippingEditPopover('fee');
  });

  document.getElementById('shipping-cost-badge')?.addEventListener('click', () => {
    openShippingEditPopover('cost');
  });

  document.getElementById('shipping-edit-save')?.addEventListener('click', saveShippingEditPopover);
  document.getElementById('shipping-edit-cancel')?.addEventListener('click', closeShippingEditPopover);

  document.getElementById('shipping-edit-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveShippingEditPopover();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeShippingEditPopover();
    }
  });

  document.addEventListener('click', (e) => {
    const popover = document.getElementById('shipping-edit-popover');
    if (!popover || popover.classList.contains('hidden')) return;
    if (popover.contains(e.target) || e.target.closest('.shopvd-shipping-badge')) return;
    closeShippingEditPopover();
  });
}

// Free shipping constants (sync with desktop m.html)
const PRICE_THRESHOLD = 120000;  // 120k threshold for high-value products
const FREESHIP_CAT = 23;  // Sản phẩm bán kèm
const BI_CHARM_CAT = 24;  // Bi, charm bạc
const FREESHIP_HINT_DEFAULT = 'Khách không trả phí vận chuyển';

function setFreeshipHintText(hintElement, reason) {
  if (!hintElement) return;
  hintElement.textContent = reason || FREESHIP_HINT_DEFAULT;
}

// Helper: Check if product belongs to a category
function productInCategory(product, categoryId) {
  if (!product) return false;
  const targetCat = parseInt(categoryId, 10);
  const catalog = resolveCatalogProductForCartItem(product) || product;

  const ids = [];
  if (Array.isArray(catalog.category_ids) && catalog.category_ids.length) {
    ids.push(...catalog.category_ids);
  }
  if (catalog.category_id != null && catalog.category_id !== '') {
    ids.push(catalog.category_id);
  }
  if (Array.isArray(catalog.categories) && catalog.categories.length) {
    for (const c of catalog.categories) {
      if (c != null && typeof c === 'object' && c.id != null) ids.push(c.id);
      else if (c != null) ids.push(c);
    }
  }

  return ids.some((id) => parseInt(String(id), 10) === targetCat);
}

function isMainProductForFreeship(product) {
  return !catalogProductSkipsWeight(resolveCatalogProductForCartItem(product) || product);
}

// Auto-update free shipping checkbox based on cart (sync with desktop logic)
function autoUpdateFreeshipCheckbox() {
  const checkbox = document.getElementById('free-shipping');
  const hintElement = document.getElementById('freeship-hint');
  
  if (!checkbox) return;
  
  // If no products, uncheck and enable input
  if (productsData.length === 0) {
    if (checkbox.checked) {
      checkbox.checked = false;
      setShippingFeeValue(defaultCustomerShippingFee);
      if (hintElement) {
        setFreeshipHintText(hintElement, '');
      }
    } else {
      updateShippingBadgeDisplay();
    }
    return;
  }
  
  // Analyze cart — DM 14/23/24 (phụ kiện) không tính vào điều kiện "mua từ 2+"
  let mainQty = 0;
  let has23 = false;  // Has bundle products (cat 23)
  let has24 = false;  // Has bi/charm (cat 24)
  let qtyOtherMain = 0;  // Qty SP chính (không thuộc 14/23/24), ngoài cat 23 & 24
  let onlyAllCat24 = true;  // All products are cat24
  let hasHighValue = false;  // Has main product (not accessory) with price > 120k
  let highValueProductName = '';  // Name of first high-value product
  
  for (const product of productsData) {
    const qty = parseInt(product.quantity, 10) || 1;
    const isMain = isMainProductForFreeship(product);
    const in23 = productInCategory(product, FREESHIP_CAT);
    const in24 = productInCategory(product, BI_CHARM_CAT);
    
    if (in23) has23 = true;
    if (in24) has24 = true;
    if (!in24) onlyAllCat24 = false;

    if (isMain) {
      mainQty += qty;
      if (!in23 && !in24) qtyOtherMain += qty;
      if (!in23) {
        const price = parseFloat(product.price) || 0;
        if (price > PRICE_THRESHOLD && !hasHighValue) {
          hasHighValue = true;
          highValueProductName = product.name;
        }
      }
    }
  }
  
  // Check if blocked (should NOT get free shipping)
  const blocked = (onlyAllCat24 && has24 && !has23) || (has24 && has23 && qtyOtherMain === 0);
  
  // Calculate if should have free shipping
  const should = !blocked && (
    mainQty >= 2 ||
    (has23 && mainQty >= 1) ||
    hasHighValue
  );
  
  // Determine reason for free shipping
  let reason = '';
  if (should) {
    if (hasHighValue) {
      reason = '✓ Tự động (SP ≥ 120k)';
    } else if (has23 && mainQty >= 1) {
      reason = '✓ Tự động (Mua kèm)';
    } else if (mainQty >= 2) {
      reason = '✓ Tự động (Mua từ 2+)';
    }
  }
  
  // Update checkbox if changed
  if (checkbox.checked !== should) {
    checkbox.checked = should;
    
    if (should) {
      setShippingFeeValue(0, { recalc: false });
      if (hintElement) {
        setFreeshipHintText(hintElement, reason);
      }
    } else {
      setShippingFeeValue(defaultCustomerShippingFee, { recalc: false });
      if (hintElement) {
        setFreeshipHintText(hintElement, '');
      }
    }
    
    calculateTotal();
  } else if (should && hintElement) {
    setFreeshipHintText(hintElement, reason);
  } else if (!should && hintElement) {
    setFreeshipHintText(hintElement, '');
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
      
      setShippingFeeValue(customerFee, { recalc: false });
      setShippingCostValue(actualCost, { recalc: false });
      
      console.log('✅ Set shipping-fee to:', customerFee);
      console.log('✅ Set shipping-cost to:', actualCost);
      
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

// === Unsaved order drafts — local cache + ShopVD DB (source of truth) ===
const SHOPVD_DRAFT_STORAGE_KEY = 'shopvdUnsavedDrafts';
const SHOPVD_DRAFT_MAX = 40;
const SHOPVD_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SHOPVD_PENDING_SYNC_MS = 450;
const SHOPVD_PENDING_PULL_MS = 45_000;

let shopvdDraftMap = new Map(); // key = phone
let shopvdDraftReady = false;
let shopvdDraftPersistTimer = null;
let shopvdDraftUiTimer = null;
let shopvdDraftFormTimer = null;
let shopvdDraftServerTimer = null;
let shopvdDraftPullTimer = null;
let shopvdDraftListObserver = null;
let shopvdUnsavedPanelOpen = false;
let shopvdRestoringDraft = false;
let shopvdLeavingUnsavedKey = '';
let shopvdPendingPullInFlight = false;
let shopvdPendingPushInFlight = false;
let shopvdLastBadgeFingerprint = '';
/** SĐT đã có đơn thật — không auto-detect / không tạo pending lại */
const shopvdKnownOrderedPhones = new Set();
/** SĐT user đã bấm × — không auto-detect tạo lại trong phiên */
const shopvdDismissedPhones = new Set();
/** conversationKey → phone đã scan thành công (tránh quét lặp) */
const shopvdAutoDetectDone = new Map();

function markPhoneAsOrdered(phone) {
  const p = normalizeDraftPhone(phone);
  if (!isValidDraftPhone(p)) return;
  shopvdKnownOrderedPhones.add(p);
  shopvdDismissedPhones.delete(p);
  if (shopvdDraftMap.has(p)) {
    shopvdDraftMap.delete(p);
    schedulePersistDrafts(80);
  }
}

function markPhoneAsDismissed(phone) {
  const p = normalizeDraftPhone(phone);
  if (!isValidDraftPhone(p)) return;
  shopvdDismissedPhones.add(p);
  if (shopvdDraftMap.has(p)) {
    shopvdDraftMap.delete(p);
    schedulePersistDrafts(80);
  }
}

function isPhoneKnownOrdered(phone) {
  return shopvdKnownOrderedPhones.has(normalizeDraftPhone(phone));
}

function isPhoneDismissed(phone) {
  return shopvdDismissedPhones.has(normalizeDraftPhone(phone));
}

function isValidDraftPhone(phone) {
  const digits = sanitizePhoneDigits(phone || '');
  return /^0\d{8,10}$/.test(digits);
}

function normalizeDraftPhone(phone) {
  return sanitizePhoneDigits(phone || '');
}

function isCustomerSnapshotWorthy(snap) {
  if (!snap || !isValidDraftPhone(snap.phone)) return false;
  if (isPhoneKnownOrdered(snap.phone)) return false;
  if (snap.provinceId && snap.wardId) {
    return !isJunkPendingAddress(snap.address, snap.source);
  }
  const address = String(snap.address || '').trim();
  if (isJunkPendingAddress(address, snap.source)) return false;
  if (address.length >= 10 && isUsableDetectedAddress(address)) return true;
  const street = String(snap.street || '').trim();
  return street.length >= 8 && Boolean(snap.provinceId);
}

function getCurrentCustomerSnapshot() {
  const provinceSelect = document.getElementById('customer-province');
  const wardSelect = document.getElementById('customer-ward');
  const provinceId = provinceSelect?.value || '';
  const wardId = wardSelect?.value || '';
  const province = provinceId ? provinceMap.get(provinceId) : null;
  const ward = province?.Wards?.find((w) => String(w.Id) === String(wardId));

  return {
    name: document.getElementById('customer-name')?.value.trim() || '',
    phone: normalizeDraftPhone(document.getElementById('customer-phone')?.value || ''),
    provinceId,
    provinceName: province?.Name || document.getElementById('province-combobox-text')?.textContent || '',
    wardId,
    wardName: ward?.Name || document.getElementById('ward-combobox-text')?.textContent || '',
    street: document.getElementById('customer-street')?.value.trim() || '',
    address: document.getElementById('customer-address')?.value.trim() || '',
  };
}

function draftMapKey(phoneOrDraft) {
  if (!phoneOrDraft) return '';
  if (typeof phoneOrDraft === 'string') return normalizeDraftPhone(phoneOrDraft);
  return normalizeDraftPhone(phoneOrDraft.phone || '');
}

function findDraftByConversationKey(conversationKey) {
  if (!conversationKey) return null;
  for (const draft of shopvdDraftMap.values()) {
    if (draft?.conversationKey === conversationKey) return draft;
  }
  return null;
}

function pruneExpiredDrafts(map = shopvdDraftMap) {
  const now = Date.now();
  for (const [key, draft] of map) {
    if (!draft?.updatedAt || now - draft.updatedAt > SHOPVD_DRAFT_TTL_MS) {
      map.delete(key);
    }
  }
  while (map.size > SHOPVD_DRAFT_MAX) {
    let oldestKey = null;
    let oldestAt = Infinity;
    for (const [key, draft] of map) {
      const ts = draft?.updatedAt || 0;
      if (ts < oldestAt) {
        oldestAt = ts;
        oldestKey = key;
      }
    }
    if (!oldestKey) break;
    map.delete(oldestKey);
  }
}

function isExtensionContextAlive() {
  try {
    return typeof chrome !== 'undefined'
      && !!chrome.runtime?.id
      && !!chrome.storage?.local;
  } catch (_) {
    return false;
  }
}

function isExtensionContextError(err) {
  const msg = String(err?.message || err || '');
  return /Extension context invalidated|context invalidated/i.test(msg);
}

function writeDraftsToLocalStorage(payload) {
  localStorage.setItem(SHOPVD_DRAFT_STORAGE_KEY, JSON.stringify(payload));
}

function schedulePersistDrafts(delayMs = 250) {
  clearTimeout(shopvdDraftPersistTimer);
  shopvdDraftPersistTimer = setTimeout(() => {
    persistDraftsNow();
  }, delayMs);
}

function persistDraftsNow() {
  pruneExpiredDrafts();
  const payload = Object.fromEntries(shopvdDraftMap);
  try {
    if (isExtensionContextAlive()) {
      try {
        chrome.storage.local.set({ [SHOPVD_DRAFT_STORAGE_KEY]: payload });
        return;
      } catch (err) {
        // Reload extension khi tab còn mở → chrome.storage chết; fallback localStorage
        if (!isExtensionContextError(err)) throw err;
      }
    }
    writeDraftsToLocalStorage(payload);
  } catch (err) {
    if (!isExtensionContextError(err)) {
      console.warn('[ShopVD] Không lưu được draft chưa chốt:', err);
    }
  }
}

function applyServerPendingItems(items) {
  const next = new Map();
  (items || []).forEach((item) => {
    const phone = normalizeDraftPhone(item.phone || item.customer_phone);
    if (!isValidDraftPhone(phone)) return;
    if (isPhoneKnownOrdered(phone)) return;
    const draft = {
      key: phone,
      phone,
      serverId: item.id || null,
      name: item.name || '',
      conversationKey: item.conversationKey || '',
      provinceId: item.provinceId || '',
      provinceName: item.provinceName || '',
      wardId: item.wardId || '',
      wardName: item.wardName || '',
      street: item.street || '',
      address: item.address || '',
      source: item.source || 'extension',
      updatedAt: item.updatedAt || Date.now(),
    };
    if (!isDraftEligibleForUnsavedList(draft)) return;
    next.set(phone, draft);
  });

  // Phones that were local but not on server → likely already ordered / dismissed
  for (const [phone] of shopvdDraftMap) {
    if (!next.has(phone) && !shopvdPendingPushInFlight) {
      // Keep only if still pushing; otherwise drop (server is truth)
    }
  }

  const nextFp = [...next.keys()].sort().join('|');
  const prevFp = [...shopvdDraftMap.keys()].sort().join('|');
  shopvdDraftMap = next;
  pruneExpiredDrafts();
  persistDraftsNow();
  if (nextFp !== prevFp) {
    scheduleUnsavedDraftUi(40);
  }
}

async function pullPendingFromServer() {
  if (shopvdPendingPullInFlight || shopvdPendingPushInFlight) return;
  shopvdPendingPullInFlight = true;
  try {
    const res = await fetch(`${API_BASE_URL}?action=getPendingUnsavedOrders&timestamp=${Date.now()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const data = await res.json();
    if (data?.success && Array.isArray(data.items)) {
      shopvdDbLog('pending:pull', { count: data.items.length, items: data.items.map((i) => i.phone) });
      applyServerPendingItems(data.items);
      reconcileUnsavedDraftsWithDb().catch(() => {});
    }
  } catch (err) {
    console.warn('[ShopVD] Không tải được pending từ server:', err);
  } finally {
    shopvdPendingPullInFlight = false;
    shopvdDraftReady = true;
  }
}

function schedulePullPendingFromServer(delayMs = 0) {
  clearTimeout(shopvdDraftPullTimer);
  shopvdDraftPullTimer = setTimeout(() => {
    pullPendingFromServer();
  }, delayMs);
}

async function pushPendingToServer(draft) {
  if (!draft || !isValidDraftPhone(draft.phone)) return null;
  if (isPhoneKnownOrdered(draft.phone)) {
    shopvdDraftMap.delete(draftMapKey(draft.phone));
    schedulePersistDrafts(80);
    scheduleUnsavedDraftUi();
    return { alreadyOrdered: true };
  }

  shopvdPendingPushInFlight = true;
  try {
    const res = await fetch(`${API_BASE_URL}/api/order/pending-unsaved/upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        phone: draft.phone,
        name: draft.name || '',
        conversationKey: draft.conversationKey || '',
        address: draft.address || '',
        provinceId: draft.provinceId || '',
        provinceName: draft.provinceName || '',
        wardId: draft.wardId || '',
        wardName: draft.wardName || '',
        street: draft.street || '',
        source: draft.source || 'extension',
      }),
    });
    const data = await res.json();
    if (data?.alreadyOrdered) {
      markPhoneAsOrdered(draft.phone);
      scheduleUnsavedDraftUi();
      return data;
    }
    if (data?.dismissed) {
      markPhoneAsDismissed(draft.phone);
      scheduleUnsavedDraftUi();
      return data;
    }
    if (!data?.success) {
      if (draft.source === 'auto-detect' || isJunkPendingAddress(draft.address, draft.source)) {
        shopvdDraftMap.delete(normalizeDraftPhone(draft.phone));
        schedulePersistDrafts(80);
        scheduleUnsavedDraftUi(40);
      }
      return data;
    }
    if (data?.success && data.pending) {
      const phone = normalizeDraftPhone(data.pending.phone);
      if (isPhoneKnownOrdered(phone)) {
        shopvdDraftMap.delete(phone);
      } else {
        const prev = shopvdDraftMap.get(phone) || draft;
        const merged = {
          ...prev,
          ...draft,
          phone,
          serverId: data.pending.id,
          updatedAt: data.pending.updatedAt || Date.now(),
        };
        if (isDraftEligibleForUnsavedList(merged)) {
          shopvdDraftMap.set(phone, merged);
        } else {
          shopvdDraftMap.delete(phone);
        }
      }
      schedulePersistDrafts(80);
      scheduleUnsavedDraftUi();
    }
    return data;
  } catch (err) {
    console.warn('[ShopVD] Sync pending lên server thất bại (giữ local):', err);
    return null;
  } finally {
    shopvdPendingPushInFlight = false;
  }
}

function schedulePushPendingToServer(draft, delayMs = SHOPVD_PENDING_SYNC_MS) {
  clearTimeout(shopvdDraftServerTimer);
  shopvdDraftServerTimer = setTimeout(() => {
    pushPendingToServer(draft);
  }, delayMs);
}

async function dismissPendingOnServer(draft) {
  if (!draft) return;
  try {
    await fetch(`${API_BASE_URL}/api/order/pending-unsaved/dismiss`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        id: draft.serverId || undefined,
        phone: draft.phone,
      }),
    });
  } catch (err) {
    console.warn('[ShopVD] Dismiss pending trên server thất bại:', err);
  }
}

async function loadDraftsFromStorage() {
  try {
    let raw = null;
    if (isExtensionContextAlive()) {
      try {
        const data = await chrome.storage.local.get(SHOPVD_DRAFT_STORAGE_KEY);
        raw = data?.[SHOPVD_DRAFT_STORAGE_KEY] || null;
      } catch (err) {
        if (!isExtensionContextError(err)) throw err;
        raw = JSON.parse(localStorage.getItem(SHOPVD_DRAFT_STORAGE_KEY) || 'null');
      }
    } else {
      raw = JSON.parse(localStorage.getItem(SHOPVD_DRAFT_STORAGE_KEY) || 'null');
    }

    shopvdDraftMap = new Map();
    if (raw && typeof raw === 'object') {
      Object.entries(raw).forEach(([key, draft]) => {
        const phone = normalizeDraftPhone(draft?.phone || key);
        if (phone && draft && isValidDraftPhone(phone)) {
          shopvdDraftMap.set(phone, { ...draft, phone, key: phone });
        }
      });
    }
    pruneExpiredDrafts();
    pruneInvalidDraftsFromMap();
  } catch (err) {
    if (!isExtensionContextError(err)) {
      console.warn('[ShopVD] Không đọc được draft chưa chốt:', err);
    }
    shopvdDraftMap = new Map();
  } finally {
    shopvdDraftReady = true;
    pruneInvalidDraftsFromMap();
    scheduleUnsavedDraftUi();
    reconcileUnsavedDraftsWithDb().catch(() => {});
  }
}

function getUnsavedDraftCount() {
  pruneExpiredDrafts();
  return getUnsavedDraftEntries().length;
}

function getUnsavedDraftEntries() {
  pruneExpiredDrafts();
  pruneInvalidDraftsFromMap();
  return [...shopvdDraftMap.values()]
    .filter((draft) => isDraftEligibleForUnsavedList(draft))
    .map((draft) => ({
      key: draft.phone,
      ...draft,
    }))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

function upsertUnsavedDraft(conversationKey, snapshot, source = 'form') {
  if (!isCustomerSnapshotWorthy(snapshot)) return false;
  const phone = normalizeDraftPhone(snapshot.phone);
  if (!phone || isPhoneKnownOrdered(phone)) return false;

  // Bấm × rồi: auto-detect không tạo lại; grab/form vẫn được
  if (source === 'auto-detect' && isPhoneDismissed(phone)) return false;

  if (source !== 'auto-detect') {
    shopvdDismissedPhones.delete(phone);
  }

  const prev = shopvdDraftMap.get(phone);
  if (
    prev
    && prev.phone === phone
    && prev.address === (snapshot.address || '')
    && prev.conversationKey === (conversationKey || prev.conversationKey || '')
    && prev.serverId
  ) {
    return true;
  }

  const draft = {
    ...prev,
    key: phone,
    phone,
    serverId: prev?.serverId || null,
    name: snapshot.name || prev?.name || '',
    conversationKey: conversationKey || prev?.conversationKey || '',
    provinceId: snapshot.provinceId || '',
    provinceName: snapshot.provinceName || '',
    wardId: snapshot.wardId || '',
    wardName: snapshot.wardName || '',
    street: snapshot.street || '',
    address: snapshot.address || '',
    source,
    updatedAt: Date.now(),
  };

  // auto-detect: chỉ hiện badge sau khi server xác nhận chưa có đơn (tránh nhấp nháy)
  if (source === 'auto-detect') {
    schedulePushPendingToServer(draft, 200);
    return true;
  }

  shopvdDraftMap.set(phone, draft);
  schedulePersistDrafts();
  scheduleUnsavedDraftUi();
  schedulePushPendingToServer(draft);
  return true;
}

function removeUnsavedDraft(phoneOrKey) {
  const phone = normalizeDraftPhone(phoneOrKey);
  let draft = phone ? shopvdDraftMap.get(phone) : null;
  if (!draft && phoneOrKey) {
    draft = findDraftByConversationKey(phoneOrKey);
  }
  if (!draft) return false;

  markPhoneAsDismissed(draft.phone);
  shopvdDraftMap.delete(draft.phone);
  schedulePersistDrafts(80);
  scheduleUnsavedDraftUi();
  dismissPendingOnServer(draft);
  return true;
}

function markCurrentChatAsUnsavedDraft(source = 'form') {
  if (shopvdRestoringDraft) return false;
  const key = getPancakeConversationKey();
  return upsertUnsavedDraft(key, getCurrentCustomerSnapshot(), source);
}

function scheduleMarkCurrentDraftFromForm(delayMs = 400) {
  clearTimeout(shopvdDraftFormTimer);
  shopvdDraftFormTimer = setTimeout(() => {
    const snap = getCurrentCustomerSnapshot();
    const key = getPancakeConversationKey();

    if (isCustomerSnapshotWorthy(snap)) {
      upsertUnsavedDraft(key, snap, 'form');
    } else if (isValidDraftPhone(snap.phone) === false) {
      // Phone cleared — drop any draft for previous phone is hard; only drop if current empty
      // Keep server truth via next pull
    }
  }, delayMs);
}

async function restoreDraftToForm(draft) {
  if (!draft || shopvdRestoringDraft) return false;
  shopvdRestoringDraft = true;

  try {
    const nameInput = document.getElementById('customer-name');
    const phoneInput = document.getElementById('customer-phone');
    if (nameInput && draft.name) nameInput.value = draft.name;
    if (phoneInput && draft.phone) phoneInput.value = sanitizePhoneDigits(draft.phone);

    if (draft.provinceId) {
      if (!addressLoaded) {
        await loadAddressData();
      }

      const provinceSelect = document.getElementById('customer-province');
      const wardSelect = document.getElementById('customer-ward');
      const streetInput = document.getElementById('customer-street');
      if (provinceSelect && wardSelect) {
        provinceSelect.value = draft.provinceId;

        const provinceBtn = document.getElementById('province-combobox-btn');
        const provinceText = document.getElementById('province-combobox-text');
        if (provinceBtn && provinceText) {
          provinceBtn.classList.add('selected');
          provinceText.textContent = draft.provinceName || provinceMap.get(draft.provinceId)?.Name || 'Đã chọn';
        }

        renderWards(draft.provinceId);
        renderWardCombobox(draft.provinceId);
        document.getElementById('ward-combobox-wrapper')?.classList.remove('hidden');

        const wardBtn = document.getElementById('ward-combobox-btn');
        if (wardBtn) wardBtn.disabled = false;

        if (draft.wardId) {
          await new Promise((r) => setTimeout(r, 40));
          wardSelect.value = draft.wardId;
          const wardText = document.getElementById('ward-combobox-text');
          if (wardBtn && wardText) {
            wardBtn.classList.add('selected');
            wardText.textContent = draft.wardName || 'Đã chọn';
          }
          document.getElementById('customer-street-field')?.classList.remove('hidden');
        }

        if (streetInput && draft.street) {
          streetInput.value = draft.street;
        }
        updateFullAddress();
      }
    }

    clearValidationFieldError('customer-name');
    clearValidationFieldError('customer-phone');
    updatePancakeNameHint(Boolean(draft.name));
    lastAutoFilledCustomerName = draft.name || '';
    customerNameUserEdited = false;

    // Mở draft đủ thông tin → đưa thẳng tới chọn SP
    maybeScrollToProductSectionAfterCustomerReady({ allowDuringRestore: true, focus: true });
    return true;
  } finally {
    shopvdRestoringDraft = false;
  }
}

function formatDraftRelativeTime(ts) {
  if (!ts) return '';
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

function scheduleUnsavedDraftUi(delayMs = 120) {
  clearTimeout(shopvdDraftUiTimer);
  shopvdDraftUiTimer = setTimeout(() => {
    updateUnsavedBadgeUI();
    paintConversationListBadges();
  }, delayMs);
}

function updateUnsavedBadgeUI() {
  const badge = document.getElementById('shopvd-unsaved-badge');
  const countEl = document.getElementById('shopvd-unsaved-count');
  const panel = document.getElementById('shopvd-unsaved-panel');
  const list = document.getElementById('shopvd-unsaved-list');
  if (!badge || !countEl) return;

  const entries = getUnsavedDraftEntries().filter((d) => !isPhoneKnownOrdered(d.phone));
  const count = entries.length;
  const fingerprint = `${count}|${entries.map((d) => d.phone).join(',')}|${shopvdUnsavedPanelOpen ? 1 : 0}`;
  if (fingerprint === shopvdLastBadgeFingerprint && countEl.textContent === String(count)) {
    return;
  }
  shopvdLastBadgeFingerprint = fingerprint;

  countEl.textContent = String(count);
  badge.classList.toggle('hidden', count === 0);
  badge.classList.toggle('is-active', shopvdUnsavedPanelOpen && count > 0);

  if (!panel || !list) return;

  if (count === 0) {
    shopvdUnsavedPanelOpen = false;
    panel.classList.add('hidden');
    list.innerHTML = '';
    return;
  }

  panel.classList.toggle('hidden', !shopvdUnsavedPanelOpen);
  if (!shopvdUnsavedPanelOpen) return;

  const currentKey = getPancakeConversationKey();
  const copyIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  const checkIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';

  list.innerHTML = entries.map((d) => {
    const title = escapeHtml(d.name || d.phone || 'Khách chưa tên');
    const phone = escapeHtml(d.phone || '');
    const addr = escapeHtml((d.address || [d.street, d.wardName, d.provinceName].filter(Boolean).join(', ')).slice(0, 72));
    const time = escapeHtml(formatDraftRelativeTime(d.updatedAt));
    const isCurrent = (d.conversationKey && d.conversationKey === currentKey)
      || d.phone === normalizeDraftPhone(document.getElementById('customer-phone')?.value || '');
    return `
      <div class="shopvd-unsaved-item${isCurrent ? ' is-current' : ''}" data-draft-key="${escapeHtml(d.key)}">
        <div class="shopvd-unsaved-item-main">
          <div class="shopvd-unsaved-item-title">${title}</div>
          <div class="shopvd-unsaved-phone-row">
            <span class="shopvd-unsaved-phone">${phone}</span>
            <button type="button" class="shopvd-unsaved-copy-btn" data-phone="${phone}" title="Copy SĐT" aria-label="Copy số điện thoại ${phone}">
              ${copyIcon}
            </button>
          </div>
          ${addr ? `<div class="shopvd-unsaved-item-meta">${addr}</div>` : ''}
          <div class="shopvd-unsaved-item-time">${time}${isCurrent ? ' · đang mở' : ''}</div>
        </div>
        <div class="shopvd-unsaved-item-actions">
          <button type="button" class="shopvd-unsaved-open-btn" data-draft-key="${escapeHtml(d.key)}" title="Khôi phục form">Mở</button>
          <button type="button" class="shopvd-unsaved-dismiss-btn" data-draft-key="${escapeHtml(d.key)}" title="Bỏ đánh dấu">×</button>
        </div>
      </div>
    `;
  }).join('');

  // stash icons for copy feedback (avoid re-querying constants in handler)
  list.dataset.copyIcon = copyIcon;
  list.dataset.checkIcon = checkIcon;
}

function getConversationItemKey(item) {
  if (!item) return '';
  return item.getAttribute('data-id')
    || item.getAttribute('data-conversation-id')
    || item.getAttribute('id')
    || '';
}

function conversationItemMatchesDraft(item, draftKey, draft) {
  const itemKey = getConversationItemKey(item);
  if (itemKey && draft?.conversationKey && itemKey === draft.conversationKey) return true;
  if (itemKey && draftKey && itemKey === draftKey) return true;

  const text = normalizePancakeCustomerName(item.textContent || '').toLowerCase();
  if (!text) return false;

  if (draft?.phone && text.includes(String(draft.phone))) return true;
  if (draft?.name) {
    const name = normalizePancakeCustomerName(draft.name).toLowerCase();
    if (name.length >= 3 && text.includes(name)) return true;
  }
  return false;
}

function paintConversationListBadges() {
  const roots = [];
  document.querySelectorAll(PANCAKE_LIST_SELECTOR).forEach((el) => roots.push(el));
  if (!roots.length) {
    document.querySelectorAll('[class*="conversation-item"], [class*="ConversationItem"], [class*="thread-item"]')
      .forEach((el) => {
        if (isInsideConversationList(el)) roots.push(el.parentElement);
      });
  }

  const scoped = roots.length
    ? roots
    : [document.body];

  const items = new Set();
  scoped.forEach((root) => {
    root?.querySelectorAll?.('[class*="conversation-item"], [class*="ConversationItem"], [class*="thread-item"]')
      ?.forEach((el) => items.add(el));
  });

  const drafts = getUnsavedDraftEntries();
  items.forEach((item) => {
    if (isInsideShopvdSidebar(item)) return;

    const matched = drafts.find((d) => conversationItemMatchesDraft(item, d.key, d));
    let badge = item.querySelector('.shopvd-conv-unsaved-dot');

    if (!matched) {
      badge?.remove();
      item.classList.remove('shopvd-conv-has-unsaved');
      return;
    }

    item.classList.add('shopvd-conv-has-unsaved');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'shopvd-conv-unsaved-dot';
      badge.title = 'Chưa lưu đơn ShopVD';
      badge.setAttribute('aria-label', 'Chưa lưu đơn ShopVD');
      item.appendChild(badge);
    }
  });
}

async function handleConversationSwitch(fromKey, toKey, options = {}) {
  const warn = options.warn !== false;

  if (fromKey && fromKey !== toKey) {
    const snap = getCurrentCustomerSnapshot();
    if (isCustomerSnapshotWorthy(snap)) {
      upsertUnsavedDraft(fromKey, snap, 'form');
      if (warn && shopvdLeavingUnsavedKey !== fromKey) {
        shopvdLeavingUnsavedKey = fromKey;
        showStatus('⚠️ Chat trước chưa tạo đơn — đã giữ lại trong “chưa lưu”', 'warning', 3200);
      }
    }
  }

  if (toKey) {
    const draft = findDraftByConversationKey(toKey);
    if (draft) {
      await restoreDraftToForm(draft);
      applyPancakeNameIfEmpty();
      showStatus('📋 Đã khôi phục thông tin chưa lưu của chat này', 'info', 2200);
      return true;
    }
  }

  return false;
}

function setupUnsavedDraftSystem() {
  if (!shopvdUnsavedSystemBound) {
    shopvdUnsavedSystemBound = true;

    document.getElementById('shopvd-unsaved-badge')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      shopvdUnsavedPanelOpen = !shopvdUnsavedPanelOpen;
      updateUnsavedBadgeUI();
      if (shopvdUnsavedPanelOpen) {
        schedulePullPendingFromServer(0);
      }
    });

    document.getElementById('shopvd-unsaved-list')?.addEventListener('click', async (e) => {
    const copyBtn = e.target.closest('.shopvd-unsaved-copy-btn');
    if (copyBtn) {
      e.preventDefault();
      e.stopPropagation();
      const phone = copyBtn.getAttribute('data-phone') || '';
      if (!phone) return;

      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(phone);
        } else {
          const ta = document.createElement('textarea');
          ta.value = phone;
          ta.style.cssText = 'position:fixed;left:-9999px;top:0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }

        const list = document.getElementById('shopvd-unsaved-list');
        const checkIcon = list?.dataset.checkIcon
          || '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
        const copyIcon = list?.dataset.copyIcon
          || '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

        copyBtn.classList.add('is-copied');
        copyBtn.innerHTML = checkIcon;
        copyBtn.title = 'Đã copy';
        showStatus(`📋 Đã copy ${phone}`, 'success', 1400);
        setTimeout(() => {
          copyBtn.classList.remove('is-copied');
          copyBtn.innerHTML = copyIcon;
          copyBtn.title = 'Copy SĐT';
        }, 1400);
      } catch (err) {
        showStatus('⚠️ Không copy được SĐT', 'warning', 2000);
      }
      return;
    }

    const dismissBtn = e.target.closest('.shopvd-unsaved-dismiss-btn');
    if (dismissBtn) {
      e.preventDefault();
      removeUnsavedDraft(dismissBtn.getAttribute('data-draft-key'));
      return;
    }

    const openBtn = e.target.closest('.shopvd-unsaved-open-btn');
    if (!openBtn) return;

    e.preventDefault();
    const key = openBtn.getAttribute('data-draft-key');
    const draft = key ? (shopvdDraftMap.get(normalizeDraftPhone(key)) || findDraftByConversationKey(key)) : null;
    if (!draft) return;

    await restoreDraftToForm(draft);
    shopvdUnsavedPanelOpen = false;
    updateUnsavedBadgeUI();
    if (!shopvdScrolledToProductsForCustomer) {
      scrollToCustomerInfoSection();
    }
    showStatus('📋 Đã mở lại thông tin chưa lưu', 'success', 2000);
  });

  ['customer-name', 'customer-phone', 'customer-street'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', () => scheduleMarkCurrentDraftFromForm());
    document.getElementById(id)?.addEventListener('change', () => scheduleMarkCurrentDraftFromForm());
  });

  document.getElementById('customer-province')?.addEventListener('change', () => scheduleMarkCurrentDraftFromForm(200));
  document.getElementById('customer-ward')?.addEventListener('change', () => scheduleMarkCurrentDraftFromForm(200));

  if (!shopvdDraftListObserver) {
    let scheduled = false;
    shopvdDraftListObserver = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        paintConversationListBadges();
      });
    });
    shopvdDraftListObserver.observe(document.body, { childList: true, subtree: true });
  }

  window.addEventListener('beforeunload', () => {
    const key = getPancakeConversationKey();
    const snap = getCurrentCustomerSnapshot();
    if (isCustomerSnapshotWorthy(snap)) {
      upsertUnsavedDraft(key, snap, 'form');
      persistDraftsNow();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && shopvdUnsavedPanelOpen) {
      schedulePullPendingFromServer(100);
    }
  });

  scheduleUnsavedDraftUi(500);
  }

  loadDraftsFromStorage().then(() => {
    pruneInvalidDraftsFromMap();
    schedulePullPendingFromServer(500);
    shopvdDbLog('drafts:loaded', {
      count: shopvdDraftMap.size,
      phones: [...shopvdDraftMap.keys()],
    });
  });
}

let shopvdPancakeSyncTimer = 0;

function triggerPancakeUnsavedSync(delayMs = 0) {
  clearTimeout(shopvdPancakeSyncTimer);
  shopvdPancakeSyncTimer = setTimeout(() => {
    fetch(`${API_BASE_URL}?action=syncPancakeUnsavedOrders&hours=48&pages=3&timestamp=${Date.now()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
      .then(() => schedulePullPendingFromServer(350))
      .catch(() => {});
  }, delayMs);
}

// === Pancake: auto-sync customer name from active chat header ===
let lastPancakeConversationKey = '';
let lastAutoFilledCustomerName = '';
let customerNameUserEdited = false;
let pancakeNameSyncTimer = null;
let pancakeNameObserver = null;

const PANCAKE_NAME_META_PATTERN = /đã xem|thành phố|tỉnh|tp\.|hội thoại|inbox|facebook|zalo|tiktok|instagram|shopee|\d{2}\/\d{2}\/\d{4}|\d{1,2}:\d{2}/i;
const PANCAKE_HEADER_SELECTOR = [
  '[class*="conversation-header"]',
  '[class*="ConversationHeader"]',
  '[class*="message-header"]',
  '[class*="MessageHeader"]',
  '[class*="chat-header"]',
  '[class*="ChatHeader"]',
  '[class*="conv-header"]',
  '[class*="header-info"]',
  '[class*="customer-info"]',
  '[class*="CustomerInfo"]',
  '[data-pancake-customer-name]',
  '[data-shopvd-pancake-customer-name]',
].join(',');

const PANCAKE_NAME_SELECTOR = [
  '[data-pancake-customer-name]',
  '[data-shopvd-pancake-customer-name]',
  '[class*="customer-name"]',
  '[class*="CustomerName"]',
  '[class*="conv-name"]',
  '[class*="display-name"]',
  '[class*="DisplayName"]',
  '[class*="full-name"]',
  '[class*="FullName"]',
].join(',');

const PANCAKE_LIST_SELECTOR = [
  '[class*="conversation-list"]',
  '[class*="ConversationList"]',
  '[class*="inbox-list"]',
  '[class*="InboxList"]',
  '[class*="sidebar-inbox"]',
  '[class*="thread-list"]',
].join(',');

function isInsideShopvdSidebar(el) {
  if (!el) return false;
  const node = el.nodeType === Node.ELEMENT_NODE ? el : el.parentElement;
  return !!node?.closest('#shopvd-sidebar, #shopvd-expand-rail');
}

function isInsideConversationList(el) {
  if (!el) return false;
  if (el.closest(PANCAKE_LIST_SELECTOR)) return true;

  const rect = el.getBoundingClientRect();
  if (!rect.width && !rect.height) return false;

  // Danh sách hội thoại bên trái — tránh lấy nhầm tên trong list
  return rect.left < 280 && rect.width < 360;
}

function isPlausiblePancakeCustomerName(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (!value || value.length < 2 || value.length > 60) return false;
  if (PANCAKE_NAME_META_PATTERN.test(value)) return false;
  if (/^[\d+\s().-]+$/.test(value)) return false;
  if (!/^[\p{L}\s'.-]+$/u.test(value)) return false;

  const words = value.split(/\s+/).filter(Boolean);
  if (words.length > 6) return false;

  return true;
}

function normalizePancakeCustomerName(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function extractNameFromPancakeHeaderRoot(root) {
  if (!root || isInsideShopvdSidebar(root) || isInsideConversationList(root)) {
    return '';
  }

  const explicit = root.querySelector(PANCAKE_NAME_SELECTOR);
  if (explicit) {
    const explicitName = normalizePancakeCustomerName(
      explicit.getAttribute('data-pancake-customer-name')
      || explicit.getAttribute('data-shopvd-pancake-customer-name')
      || explicit.textContent
    );
    if (isPlausiblePancakeCustomerName(explicitName)) {
      return explicitName;
    }
  }

  const candidates = [];
  root.querySelectorAll('h1, h2, h3, h4, span, div, a, p, strong').forEach((el) => {
    if (isInsideShopvdSidebar(el) || isInsideConversationList(el)) return;
    if (el.closest('[class*="viewed"], [class*="seen"], [class*="meta"], [class*="subtitle"], [class*="location"], [class*="address"]')) {
      return;
    }

    const text = normalizePancakeCustomerName(el.textContent);
    if (!isPlausiblePancakeCustomerName(text)) return;

    const rect = el.getBoundingClientRect();
    if (!rect.width && !rect.height) return;

    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return;

    const fontSize = parseFloat(style.fontSize) || 14;
    const fontWeight = parseInt(style.fontWeight, 10) || 400;
    candidates.push({ text, top: rect.top, fontSize, fontWeight });
  });

  if (!candidates.length) return '';

  candidates.sort((a, b) => {
    if (a.top !== b.top) return a.top - b.top;
    if (a.fontWeight !== b.fontWeight) return b.fontWeight - a.fontWeight;
    return b.fontSize - a.fontSize;
  });

  return candidates[0].text;
}

function extractPancakeCustomerName() {
  const headers = document.querySelectorAll(PANCAKE_HEADER_SELECTOR);
  for (const header of headers) {
    const name = extractNameFromPancakeHeaderRoot(header);
    if (name) return name;
  }

  // Fallback: tìm avatar + tên ở panel chat chính (không nằm trong list trái)
  const avatars = document.querySelectorAll('[class*="avatar"], img[class*="avatar"], [class*="Avatar"]');
  for (const avatar of avatars) {
    if (isInsideShopvdSidebar(avatar) || isInsideConversationList(avatar)) continue;

    const container = avatar.closest('[class*="header"], [class*="Header"], [class*="info"], [class*="Info"]');
    if (!container) continue;

    const name = extractNameFromPancakeHeaderRoot(container);
    if (name) return name;
  }

  return '';
}

function isActivePancakeConversationItem(el) {
  const item = el?.closest?.('[class*="conversation-item"], [class*="ConversationItem"], [class*="thread-item"]');
  if (!item) return false;
  return item.matches?.('[class*="active"], .selected, [aria-selected="true"]') === true
    || item.classList?.contains('selected');
}

function getPancakeConversationKey() {
  const activeItem = getActivePancakeConversationItem();

  if (activeItem) {
    return activeItem.getAttribute('data-id')
      || activeItem.getAttribute('data-conversation-id')
      || activeItem.getAttribute('id')
      || `active:${normalizePancakeCustomerName(activeItem.textContent).slice(0, 80)}`;
  }

  return '';
}

function updatePancakeNameHint(isAutoFilled) {
  const hint = document.getElementById('customer-name-pancake-hint');
  if (!hint) return;
  hint.classList.toggle('hidden', !isAutoFilled);
}

function clearCustomerInfoForm() {
  const nameInput = document.getElementById('customer-name');
  const phoneInput = document.getElementById('customer-phone');

  if (nameInput) nameInput.value = '';
  if (phoneInput) phoneInput.value = '';

  resetCustomerAddressForm();

  const smartPasteInput = document.getElementById('shopvd-smart-paste-input');
  if (smartPasteInput) smartPasteInput.value = '';
  document.getElementById('shopvd-smart-paste-status')?.classList.add('hidden');

  clearValidationFieldError('customer-name');
  clearValidationFieldError('customer-phone');

  lastAutoFilledCustomerName = '';
  updatePancakeNameHint(false);

  hideFloatGrabButton(0);
  clearGrabBubbleHighlight();
}

function syncPancakeCustomerName(force = false) {
  const nameInput = document.getElementById('customer-name');
  if (!nameInput) return;

  const conversationKey = getPancakeConversationKey();
  const extractedName = extractPancakeCustomerName();
  const conversationChanged = lastPancakeConversationKey !== ''
    && conversationKey !== lastPancakeConversationKey;

  if (conversationChanged) {
    const fromKey = lastPancakeConversationKey;
    lastPancakeConversationKey = conversationKey;
    customerNameUserEdited = false;

    // Save outgoing chat draft BEFORE clearing form
    const outgoingSnap = getCurrentCustomerSnapshot();
    if (isCustomerSnapshotWorthy(outgoingSnap)) {
      upsertUnsavedDraft(fromKey, outgoingSnap, 'form');
      if (shopvdLeavingUnsavedKey !== fromKey) {
        shopvdLeavingUnsavedKey = fromKey;
        showStatus('⚠️ Chat trước chưa tạo đơn — đã giữ trong “chưa lưu”', 'warning', 3200);
      }
    }

    clearCustomerInfoForm();
    clearAllConversationPhoneCache();
    clearDbStatusSettled();
    shopvdOpenChatCheckKey = '';
    resetDbCheckStateForConversationSwitch(conversationKey);

    if (conversationKey) {
      const draft = findDraftByConversationKey(conversationKey);
      if (draft) {
        restoreDraftToForm(draft).then((ok) => {
          if (ok) {
            applyPancakeNameIfEmpty();
            showStatus('📋 Đã khôi phục thông tin chưa lưu của chat này', 'info', 2200);
          }
          scheduleUnsavedDraftUi();
        });
        return;
      }
    }
  } else if (lastPancakeConversationKey === '' && conversationKey) {
    lastPancakeConversationKey = conversationKey;
    customerNameUserEdited = false;

    const draft = findDraftByConversationKey(conversationKey);
    if (draft && !getCurrentCustomerSnapshot().phone) {
      restoreDraftToForm(draft).then(() => {
        applyPancakeNameIfEmpty();
        scheduleUnsavedDraftUi();
      });
      return;
    }
  }

  if (!extractedName) {
    updatePancakeNameHint(false);
    return;
  }

  if (customerNameUserEdited && !conversationChanged && !force) {
    updatePancakeNameHint(false);
    return;
  }

  if (nameInput.value.trim() !== extractedName) {
    nameInput.value = extractedName;
    lastAutoFilledCustomerName = extractedName;
    clearValidationFieldError('customer-name');
    revalidateFieldIfActive('customer-name');
  }

  updatePancakeNameHint(true);
}

function schedulePancakeCustomerNameSync(delayMs = 180) {
  clearTimeout(pancakeNameSyncTimer);
  pancakeNameSyncTimer = setTimeout(() => {
    syncPancakeCustomerName();
  }, delayMs);
}

function setupPancakeCustomerNameSync() {
  document.getElementById('customer-name')?.addEventListener('input', () => {
    const value = document.getElementById('customer-name')?.value.trim() || '';
    customerNameUserEdited = Boolean(value && value !== lastAutoFilledCustomerName);
    updatePancakeNameHint(!customerNameUserEdited && value === lastAutoFilledCustomerName);
  });

  if (!shopvdPancakeClickBound) {
    shopvdPancakeClickBound = true;
    if (window.__shopvdPancakeClickHandler) {
      document.removeEventListener('click', window.__shopvdPancakeClickHandler, true);
    }

    window.__shopvdPancakeClickHandler = (e) => {
      if (isInsideShopvdSidebar(e.target)) return;

      const inLeftList = isInsideConversationList(e.target) || !!e.target.closest(PANCAKE_LIST_SELECTOR);
      const inChatPanel = isInPancakeChatPanel(e.target);

      if (!inLeftList && !inChatPanel) return;

      shopvdDbLog('click:pancake-area', {
        inLeftList,
        inChatPanel,
        tag: e.target?.tagName,
        className: String(e.target?.className || '').slice(0, 80),
      });

      if (inLeftList) {
        const convItem = e.target.closest(PANCAKE_CONV_ITEM_SELECTOR)
          || e.target.closest('li, [role="listitem"], [role="option"], [role="row"]')
          || e.target;
        rememberClickedConversationItem(convItem);

        if (!isActivePancakeConversationItem(convItem)) {
          const fromKey = lastPancakeConversationKey || getPancakeConversationKey();
          const snap = getCurrentCustomerSnapshot();
          if (fromKey && isCustomerSnapshotWorthy(snap)) {
            upsertUnsavedDraft(fromKey, snap, 'form');
          }
        }
      }

      schedulePancakeCustomerNameSync(280);
      handlePancakeChatDbSaveCheck(true);
    };

    document.addEventListener('click', window.__shopvdPancakeClickHandler, true);
    shopvdDbLog('bind:pancake-click', { version: SHOPVD_EXT_VERSION });
  }

  if (!pancakeNameObserver) {
    pancakeNameObserver = new MutationObserver(() => {
      if (!isPancakeChatOpen()) return;
      schedulePancakeCustomerNameSync();
    });

    pancakeNameObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }
}

function ensureShopvdCoreHandlers() {
  const sidebar = document.getElementById('shopvd-sidebar');
  const boundVer = sidebar?.dataset?.shopvdBoundVersion || '';
  if (shopvdCoreHandlersBound && boundVer === SHOPVD_EXT_VERSION) {
    shopvdDbLog('init:handlers-already-bound', { version: SHOPVD_EXT_VERSION });
    return;
  }
  shopvdCoreHandlersBound = true;
  shopvdPancakeClickBound = false;
  shopvdUnsavedSystemBound = false;
  if (sidebar) sidebar.dataset.shopvdBoundVersion = SHOPVD_EXT_VERSION;
  shopvdDbLog('init:binding-handlers', { version: SHOPVD_EXT_VERSION });
  setupEventListeners();
  setupUnsavedDraftSystem();
  setupPancakeCustomerNameSync();
  setupDbSaveStatusCard();
  setupPancakeMessageGrab();
}

function init() {
  if (!isAllowedPage()) {
    removeSidebarIfPresent();
    return;
  }

  const existing = document.getElementById('shopvd-sidebar');
  const staleSidebar = existing && existing.dataset.shopvdVersion !== SHOPVD_EXT_VERSION;
  if (staleSidebar) {
    console.warn('[ShopVD] Sidebar cũ — tạo lại sidebar mới', {
      domVersion: existing.dataset.shopvdVersion,
      extVersion: SHOPVD_EXT_VERSION,
    });
    removeSidebarIfPresent();
  }

  shopvdDbLog('init:start', {
    sidebarExists: !!document.getElementById('shopvd-sidebar'),
    extVersion: SHOPVD_EXT_VERSION,
    handlersBound: shopvdCoreHandlersBound,
  });

  if (!document.getElementById('shopvd-sidebar')) {
    createSidebar();
    bindPancakeHeaderOffsetSync();
    renderProducts();
    loadProducts();
    loadAddressData();
    loadShippingFees();
  } else if (existing) {
    existing.dataset.shopvdVersion = SHOPVD_EXT_VERSION;
    const sub = existing.querySelector('.shopvd-top-sub');
    if (sub) sub.textContent = `Tạo đơn · v${SHOPVD_EXT_VERSION}`;
  }

  ensureShopvdCoreHandlers();
  window.__shopvdDumpPhone = shopvdDumpPhoneDebug;

  setTimeout(() => {
    if (!isPancakeChatOpen()) return;
    const key = getPancakeConversationKey();
    if (key && !isDbStatusSettledFor(key)) {
      handlePancakeChatDbSaveCheck(false);
    }
  }, 700);
}

// Wait for page to be fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', syncSidebarWithPageUrl);
} else {
  syncSidebarWithPageUrl();
}

watchPageUrlChanges();

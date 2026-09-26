/* =====================================================================
 * Quick Product-Name Inline Edit (Extension)
 *
 * Hiển thị danh sách sản phẩm dưới strip "Đã lưu DB" trên extension.
 * Click vào tên sản phẩm → sửa ngay trên DOM.
 * Enter → lưu qua API `updateOrderProducts` (chỉ thay đổi name trong
 *   order.products, KHÔNG đụng vào bảng products trong DB).
 * ESC → hủy.
 * Click ra ngoài → tự commit (giống Enter).
 *
 * PHẠM VI: chỉ sửa tên (name) của sản phẩm trong đơn. Không cho phép
 *   sửa giá/SL/size/cost… để tránh làm loạn logic tính tiền / commission.
 * ===================================================================== */

(function shopvdQuickProductEdit() {
  if (window.__shopvdQuickProductEditLoaded) return;
  window.__shopvdQuickProductEditLoaded = true;

  const API_BASE_URL =
    (typeof window.API_BASE_URL === 'string' && window.API_BASE_URL) ||
    'https://ctv-api.yendev96.workers.dev';

  // Cache full order -> products JSON (theo orderDbId) để khỏi fetch lặp lại
  const orderFullCache = new Map();
  // Cache sản phẩm + order dbId đang được edit để phục vụ rollback khi lỗi
  const inflightEdit = new Set();

  const EDITABLE_STATUS_SET = new Set([
    'pending',
    'processing',
    'send_later',
    'awaiting_reship',
  ]);

  function normalizeStatusSlug(s) {
    return String(s || '').toLowerCase().trim();
  }

  function isOrderEditable(status) {
    return EDITABLE_STATUS_SET.has(normalizeStatusSlug(status));
  }

  // -------------------- DOM helpers --------------------

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showToast(msg, type = 'info', ttl = 2200) {
    if (typeof window.showStatus === 'function') {
      try {
        const prefix = type === 'error' ? '❌ ' : type === 'success' ? '✅ ' : '⏳ ';
        window.showStatus(prefix + String(msg || ''), type, ttl);
        return;
      } catch (_) { /* ignore */ }
    }
    if (type === 'error') console.error('[QPE]', msg);
    else console.log('[QPE]', msg);
  }

  function shopvdFetch(url, opts = {}) {
    if (typeof window.shopvdFetch === 'function') return window.shopvdFetch(url, opts);
    return fetch(url, opts);
  }

  // -------------------- Products parsing --------------------

  function parseProducts(products) {
    if (Array.isArray(products)) {
      return products
        .map(normalizeProduct)
        .filter((p) => p && (p.name || typeof p === 'object'));
    }
    if (typeof products === 'string') {
      try {
        const arr = JSON.parse(products);
        if (Array.isArray(arr)) {
          return arr.map(normalizeProduct).filter((p) => p);
        }
      } catch (_) { /* ignore */ }
    }
    return [];
  }

  function normalizeProduct(p) {
    if (!p) return null;
    if (typeof p === 'string') {
      const m = p.match(/^(.+?)\s*[xX×]\s*(\d+)$/);
      return m
        ? { name: m[1].trim(), quantity: parseInt(m[2], 10) || 1 }
        : { name: p.trim(), quantity: 1 };
    }
    const name = String(p.name || p.product_name || '').trim();
    if (!name) return null;
    const qty = Math.max(1, parseInt(p.quantity, 10) || 1);
    return {
      name,
      quantity: qty,
      price: p.price ?? null,
      cost_price: p.cost_price ?? null,
      size: p.size ?? p.weight ?? null,
      notes: p.notes ?? null,
      product_id: p.product_id ?? p.id ?? null,
      _origIndex: typeof p._origIndex === 'number' ? p._origIndex : null,
    };
  }

  // -------------------- Fetch full order --------------------

  async function fetchOrderFull(orderDbId) {
    const id = Number(orderDbId);
    if (!Number.isFinite(id) || id <= 0) return null;
    if (orderFullCache.has(id)) return orderFullCache.get(id);

    try {
      const url = `${API_BASE_URL}/?action=getOrderById&id=${encodeURIComponent(id)}&timestamp=${Date.now()}`;
      const resp = await shopvdFetch(url);
      const data = await resp.json();
      if (!data || !data.success || !data.order) {
        throw new Error((data && data.error) || 'Không tải được đơn');
      }
      const products = parseProducts(data.order.products);
      const packed = { order: data.order, products };
      orderFullCache.set(id, packed);
      return packed;
    } catch (err) {
      console.warn('[QPE] fetchOrderFull failed:', err);
      return null;
    }
  }

  function invalidateOrderCache(orderDbId) {
    const id = Number(orderDbId);
    if (Number.isFinite(id)) orderFullCache.delete(id);
  }

  // -------------------- Render product list --------------------

  function renderProductListHtml(orderDbId, products) {
    const rows = products.map((p, idx) => {
      const safeName = escapeHtml(p.name || '');
      const qty = Number(p.quantity) || 1;
      const price = p.price || p.product_price || 0;
      const priceText = price > 0 ? formatMoney(price) : '';
      const qtyBadge = `<span class="shopvd-qpe-qty">${qty}×</span>`;
      const priceDisplay = priceText ? `<span class="shopvd-qpe-price">${priceText}</span>` : '';
      
      return `
        <button
          type="button"
          class="shopvd-qpe-row"
          data-order-id="${orderDbId}"
          data-index="${idx}"
          data-orig-name="${escapeHtml(p.name || '')}"
          aria-label="Sửa tên: ${safeName}"
          title="Bấm để sửa tên sản phẩm"
        >
          <div class="shopvd-qpe-row-content">
            <span class="shopvd-qpe-row-name">${safeName}</span>
            <div class="shopvd-qpe-row-meta">
              ${qtyBadge}
              ${priceDisplay}
            </div>
          </div>
          <svg class="shopvd-qpe-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
               aria-hidden="true">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
          </svg>
        </button>
      `;
    }).join('');

    return `
      <div class="shopvd-qpe-list" data-order-id="${orderDbId}">
        <div class="shopvd-qpe-list-head">
          <svg class="shopvd-qpe-list-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 7h-9M14 17H5M6 3v4m0 14v-4"/>
            <circle cx="18" cy="7" r="2"/><circle cx="6" cy="11" r="2"/><circle cx="18" cy="17" r="2"/>
          </svg>
          <span class="shopvd-qpe-list-title">Sản phẩm trong đơn (${products.length})</span>
        </div>
        <div class="shopvd-qpe-list-body">${rows || '<div class="shopvd-qpe-empty">Đơn chưa có sản phẩm</div>'}</div>
      </div>
    `;
  }

  function formatMoney(amount) {
    if (!amount) return '0đ';
    return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
  }

  // -------------------- Mount / re-render --------------------

  function getStripEl() {
    return (
      document.querySelector('#shopvd-ship-status.is-saved') ||
      document.querySelector('#shopvd-ship-status-strip.is-saved') ||
      document.querySelector('#shopvd-ship-status-body .is-saved') ||
      document.querySelector('.shopvd-ship-strip.is-saved')
    );
  }

  function findOrderFromStrip(stripEl) {
    if (!stripEl) return null;
    const btn = stripEl.querySelector(
      '.shopvd-edit-order-btn, [data-order-id], [data-order-db-id]'
    );
    if (btn && btn.dataset && btn.dataset.orderId) {
      return { dbId: Number(btn.dataset.orderId) };
    }
    // Fallback: lấy từ lastSavedOrderMeta global nếu có
    if (
      window.shopvdLastSavedOrderMeta &&
      Number(window.shopvdLastSavedOrderMeta.id) > 0
    ) {
      return { dbId: Number(window.shopvdLastSavedOrderMeta.id) };
    }
    return null;
  }

  function getStatusFromStrip(stripEl) {
    // Tìm badge trạng thái — bắt đầu bằng prefix "is-" ở className của strip
    if (!stripEl) return '';
    const toneMatch =
      Array.from(stripEl.classList || []).find((c) => c.startsWith('is-')) || '';
    return toneMatch.replace(/^is-/, '');
  }

  function isEditableStatusFromStrip(stripEl) {
    const s = getStatusFromStrip(stripEl);
    return isOrderEditable(s);
  }

  async function mountProductList(stripEl, orderDbId) {
    if (!stripEl || !Number.isFinite(Number(orderDbId))) return;
    const body = stripEl.querySelector(
      '#shopvd-ship-status-body, .shopvd-ship-strip-body, .shopvd-ship-detail-body'
    );
    if (!body || !body.parentElement) return;

    // Tránh gắn 2 lần
    if (body.parentElement.querySelector('.shopvd-qpe-list')) {
      return;
    }

    if (!isEditableStatusFromStrip(stripEl)) {
      // Đơn không sửa được → không mount danh sách
      return;
    }

    const full = await fetchOrderFull(Number(orderDbId));
    if (!full || !full.products.length) return;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderProductListHtml(Number(orderDbId), full.products);
    const listEl = wrapper.firstElementChild;
    if (!listEl) return;
    body.parentElement.appendChild(listEl);
  }

  // -------------------- Inline edit handlers --------------------

  function enterEdit(rowEl, orderDbId, index) {
    if (!rowEl || rowEl.classList.contains('is-editing')) return;
    const nameEl = rowEl.querySelector('.shopvd-qpe-row-name');
    if (!nameEl) return;

    const originalText = nameEl.textContent || '';
    rowEl.classList.add('is-editing');
    rowEl.dataset.originalName = originalText;

    // Tạo input
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'shopvd-qpe-input';
    input.value = originalText;
    input.setAttribute('aria-label', 'Sửa tên sản phẩm');
    input.placeholder = 'Tên sản phẩm';
    input.autocomplete = 'off';
    input.spellcheck = false;

    nameEl.replaceWith(input);

    // Save / cancel buttons mini bar
    const bar = document.createElement('span');
    bar.className = 'shopvd-qpe-edit-bar';
    bar.innerHTML = `
      <button type="button" class="shopvd-qpe-btn-save" title="Lưu (Enter)" aria-label="Lưu">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </button>
      <button type="button" class="shopvd-qpe-btn-cancel" title="Hủy (ESC)" aria-label="Hủy">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;
    rowEl.appendChild(bar);

    input.focus();
    if (typeof input.setSelectionRange === 'function') {
      const len = input.value.length;
      try { input.setSelectionRange(len, len); } catch (_) { /* ignore */ }
    } else {
      input.select();
    }

    const finish = (mode) => {
      if (mode === 'commit') {
        commitEdit(rowEl, orderDbId, index, input, originalText);
      } else {
        cancelEdit(rowEl, originalText);
      }
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        finish('commit');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        finish('cancel');
      }
    });

    input.addEventListener('blur', () => {
      // Tiny delay để bấm nút Save trên bar không bị blur-commit-then-button-click conflict
      setTimeout(() => {
        if (rowEl.classList.contains('is-editing')) {
          finish('commit');
        }
      }, 80);
    });

    bar.querySelector('.shopvd-qpe-btn-save')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      finish('commit');
    });
    bar.querySelector('.shopvd-qpe-btn-cancel')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      finish('cancel');
    });
  }

  function cancelEdit(rowEl, originalText) {
    if (!rowEl) return;
    rowEl.classList.remove('is-editing');
    const input = rowEl.querySelector('.shopvd-qpe-input');
    const bar = rowEl.querySelector('.shopvd-qpe-edit-bar');
    if (bar) bar.remove();
    if (input) {
      const newName = document.createElement('span');
      newName.className = 'shopvd-qpe-row-name';
      newName.textContent = originalText;
      input.replaceWith(newName);
    }
  }

  async function commitEdit(rowEl, orderDbId, index, inputEl, originalText) {
    const newName = (inputEl?.value || '').trim();
    if (!newName) {
      showToast('Tên sản phẩm không được trống', 'error');
      inputEl?.focus();
      return;
    }
    if (newName === originalText) {
      cancelEdit(rowEl, originalText);
      return;
    }

    const cacheKey = `${orderDbId}:${index}`;
    if (inflightEdit.has(cacheKey)) return;
    inflightEdit.add(cacheKey);

    rowEl.classList.add('is-saving');

    try {
      const full = await fetchOrderFull(Number(orderDbId));
      if (!full) {
        throw new Error('Không tải được đơn');
      }
      const products = full.products;
      const target = products[index];
      if (!target) {
        throw new Error('Không tìm thấy sản phẩm trong đơn');
      }

      // Tạo snapshot rollback
      const oldProductsJson = JSON.stringify(products);
      const prevName = target.name;

      target.name = newName;

      const updatedProductsJson = JSON.stringify(products);

      // Optimistic UI: cập nhật DOM
      cancelEdit(rowEl, newName);

      // Gọi API
      const resp = await shopvdFetch(`${API_BASE_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateOrderProducts',
          orderId: Number(orderDbId),
          products: updatedProductsJson,
        }),
      });
      const data = await resp.json();
      if (!data || !data.success) {
        throw new Error((data && data.error) || 'Không thể cập nhật');
      }

      // Cập nhật cache với products mới (giữ _origIndex để ổn định)
      full.products = products;
      full.order.products = updatedProductsJson;

      showToast(`Đã lưu tên "${newName}"`, 'success', 1800);
    } catch (err) {
      console.warn('[QPE] commitEdit error:', err);
      // Rollback tên trên DOM
      cancelEdit(rowEl, originalText);
      // Rollback cache
      const full = orderFullCache.get(Number(orderDbId));
      if (full && full.products[index]) {
        full.products[index].name = originalText;
      }
      showToast(`Không lưu được: ${err?.message || err}`, 'error', 3200);
    } finally {
      rowEl.classList.remove('is-saving');
      inflightEdit.delete(cacheKey);
    }
  }

  // -------------------- Event delegation --------------------

  // Cần delegation vì list mount async sau khi strip "saved" render
  document.addEventListener(
    'click',
    (e) => {
      const row = e.target.closest?.('.shopvd-qpe-row');
      if (!row) return;
      e.preventDefault();
      e.stopPropagation();
      const orderId = Number(row.dataset.orderId);
      const index = Number(row.dataset.index);
      if (!Number.isFinite(orderId) || !Number.isFinite(index)) return;
      enterEdit(row, orderId, index);
    },
    true
  );

  // -------------------- Auto-mount observer --------------------

  let lastMountedOrderId = 0;

  async function tryAutoMount() {
    const stripEl = getStripEl();
    if (!stripEl) return;
    if (!isEditableStatusFromStrip(stripEl)) return;

    const orderInfo = findOrderFromStrip(stripEl);
    if (!orderInfo || !orderInfo.dbId) return;
    if (orderInfo.dbId === lastMountedOrderId) {
      // Đã mount cho đơn này rồi — chỉ refresh nếu cache bị invalidate
      return;
    }
    // Nếu cache bị invalidate (do save trước) thì re-mount
    invalidateOrderCache(orderInfo.dbId);
    lastMountedOrderId = orderInfo.dbId;
    try {
      await mountProductList(stripEl, orderInfo.dbId);
    } catch (e) {
      console.warn('[QPE] tryAutoMount failed:', e);
    }
  }

  function scheduleAutoMount() {
    if (window.__shopvdQpeMountTimer) {
      clearTimeout(window.__shopvdQpeMountTimer);
    }
    window.__shopvdQpeMountTimer = setTimeout(() => {
      window.__shopvdQpeMountTimer = 0;
      tryAutoMount();
    }, 240);
  }

  // Reset khi strip đổi trạng thái (re-render)
  function watchStripChanges() {
    const target = document.body;
    if (!target || typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(() => {
      scheduleAutoMount();
    });
    observer.observe(target, { childList: true, subtree: true });
    // Lần đầu
    scheduleAutoMount();
  }

  // Click vào chat khác / strip refresh → reset lastMountedOrderId
  const origFetch = window.fetch;
  if (typeof origFetch === 'function' && !window.__shopvdQpePatchedFetch) {
    window.__shopvdQpePatchedFetch = true;
    window.fetch = function patchedFetch(...args) {
      const url = String(args[0] || '');
      return origFetch.apply(this, args).then((resp) => {
        // Khi call các API liên quan tới strip thì schedule remount
        if (
          /action=getCustomerShippingStatus/.test(url) ||
          /action=checkCustomer/.test(url) ||
          /action=checkPhoneSavedState/.test(url)
        ) {
          setTimeout(() => {
            lastMountedOrderId = 0;
            scheduleAutoMount();
          }, 80);
        }
        return resp;
      });
    };
  }

  // Khởi động khi DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchStripChanges, { once: true });
  } else {
    watchStripChanges();
  }

  // Expose cho debug / kiểm tra từ console
  window.__shopvdQpe = {
    version: '1.0.0',
    invalidate: invalidateOrderCache,
    remount: () => {
      lastMountedOrderId = 0;
      document
        .querySelectorAll('.shopvd-qpe-list')
        .forEach((el) => el.remove());
      scheduleAutoMount();
    },
  };

  console.log('[QPE] quick product-name inline edit loaded');
})();

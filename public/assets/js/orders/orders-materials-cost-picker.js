/**
 * ShopVD Admin — Chọn nguyên liệu → tự điền giá vốn (SP tùy chỉnh desktop/mobile).
 * Đồng bộ UX với extension; cache API, event delegation.
 */
(function (global) {
  'use strict';

  const CACHE_TTL_MS = 10 * 60 * 1000;
  const EXCLUDED_CATEGORY = 'khac';
  const MODAL_ID = 'omc-mat-cost-modal';

  /**
   * Preset mẫu vòng — chỉ nạp khi bấm nút (không auto).
   * Thêm mẫu mới: push { id, productId, label, title }.
   */
  const MATERIAL_PRESETS = [
    {
      id: 'mix-sole',
      productId: 97,
      label: 'Mix sole',
      title: 'Nạp công thức Mix sole bi bạc 3ly (#97)'
    }
  ];

  const PRODUCT_RESULT_LIMIT = 12;

  let cache = { list: null, at: 0 };
  /** @type {Map<number, { rows: { item_name: string, quantity: number }[], at: number }>} */
  const formulaCacheByProduct = new Map();
  /** @type {{ item_name: string, quantity: number }[]} */
  let lastSelection = [];
  /** @type {null | Record<string, any>} */
  let active = null;

  function esc(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

  function formatVnd(amount) {
    const n = Math.round(Number(amount) || 0);
    return n.toLocaleString('vi-VN') + ' đ';
  }

  function displayName(m) {
    return (m.display_name || m.item_name || '').trim() || m.item_name;
  }

  function unitOf(m) {
    const cat = ((m.category_display_name || '') + ' ' + (m.category_name || '')).toLowerCase();
    if (cat.includes('dây') || cat.includes('day')) return 'sợi';
    return 'viên';
  }

  async function loadMaterials(apiBase) {
    if (cache.list && Date.now() - cache.at < CACHE_TTL_MS) return cache.list;

    const fetchFn = global.shopvdFetch || fetch;
    const res = await fetchFn(`${apiBase}?action=getAllMaterials&timestamp=${Date.now()}`);
    const data = await res.json();
    if (!data || !data.success) {
      throw new Error((data && data.error) || 'Không tải được nguyên liệu');
    }

    cache.list = (data.materials || []).filter((m) => {
      const cat = String(m.category_name || '').toLowerCase();
      return cat !== EXCLUDED_CATEGORY;
    });
    cache.at = Date.now();
    return cache.list;
  }

  function findPreset(presetId) {
    return MATERIAL_PRESETS.find((p) => p.id === presetId) || null;
  }

  async function loadProductFormula(apiBase, productId) {
    const pid = Number(productId);
    const cached = formulaCacheByProduct.get(pid);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return cached.rows;
    }
    const fetchFn = global.shopvdFetch || fetch;
    const res = await fetchFn(
      `${apiBase}?action=getProductMaterials&product_id=${pid}&timestamp=${Date.now()}`
    );
    const data = await res.json();
    if (!data || !data.success) {
      throw new Error((data && data.error) || `Không tải được công thức #${pid}`);
    }
    const rows = (data.materials || [])
      .filter((r) => r && r.material_name)
      .map((r) => ({
        item_name: String(r.material_name),
        quantity: Math.max(1, Math.round(Number(r.quantity) || 1))
      }));
    formulaCacheByProduct.set(pid, { rows, at: Date.now() });
    return rows;
  }

  function normalizeProducts(list) {
    if (!Array.isArray(list)) return [];
    return list.filter((p) => {
      if (!p || p.id == null) return false;
      const activeFlag = p.is_active;
      return activeFlag === undefined || activeFlag === null || activeFlag === 1 || activeFlag === true;
    });
  }

  function filterProducts(query) {
    if (!active) return [];
    const q = String(query || '').trim().toLowerCase();
    const list = active.products || [];
    if (!q) return list.slice(0, PRODUCT_RESULT_LIMIT);
    const scored = [];
    for (const p of list) {
      const name = String(p.name || '').toLowerCase();
      const sku = String(p.sku || '').toLowerCase();
      if (!name.includes(q) && !sku.includes(q)) continue;
      const rank = name.startsWith(q) ? 0 : name.includes(q) ? 1 : 2;
      scored.push({ p, rank });
    }
    scored.sort((a, b) => a.rank - b.rank || String(a.p.name || '').localeCompare(String(b.p.name || ''), 'vi'));
    return scored.slice(0, PRODUCT_RESULT_LIMIT).map((x) => x.p);
  }

  /**
   * Áp công thức preset vào selection.
   * merge=true: ghi đè SL các NL trong mẫu, giữ NL tự thêm ngoài mẫu.
   * merge=false: thay toàn bộ bằng mẫu.
   */
  function applyPresetRows(materials, presetRows, { merge = true, base } = {}) {
    const byName = new Map(materials.map((m) => [m.item_name, m]));
    const selected = merge && base instanceof Map
      ? new Map(base)
      : new Map();

    presetRows.forEach((row) => {
      const m = byName.get(row.item_name);
      if (!m) return;
      selected.set(m.item_name, {
        quantity: Math.max(1, Math.round(Number(row.quantity) || 1)),
        material: m
      });
    });
    return selected;
  }

  function selectionFromLast(materials) {
    const byName = new Map(materials.map((m) => [m.item_name, m]));
    const selected = new Map();
    lastSelection.forEach((row) => {
      const m = byName.get(row.item_name);
      if (!m) return;
      selected.set(m.item_name, {
        quantity: Math.max(1, Math.round(Number(row.quantity) || 1)),
        material: m
      });
    });
    return selected;
  }

  function renderPresetButtonsHtml() {
    return MATERIAL_PRESETS.map((p) => `
      <button type="button"
        class="shopvd-mat-preset-btn"
        data-mat-action="preset"
        data-preset-id="${esc(p.id)}"
        title="${esc(p.title || p.label)}">
        ⚡ ${esc(p.label)}
      </button>
    `).join('');
  }

  /**
   * Nạp công thức từ 1 product_id (preset hoặc SP chọn tay).
   * merge=false: thay bằng công thức SP (dùng khi chọn SP gốc).
   */
  async function applyProductFormula(productId, {
    label = 'sản phẩm',
    merge = false,
    announce = true,
    buttonEl = null,
    selectedProduct = null
  } = {}) {
    if (!active) return;
    const btn = buttonEl;
    if (btn) {
      btn.disabled = true;
      btn.classList.add('is-loading');
    }
    const bar = active.modal.querySelector('[data-mat-product-bar]');
    bar?.classList.add('is-loading');
    try {
      const rows = await loadProductFormula(active.apiBase, productId);
      if (!active) return;
      if (!rows.length) {
        active.showStatus?.(`⚠️ ${label} chưa có công thức nguyên liệu`, 'warning');
        return;
      }
      active.selected = applyPresetRows(active.materials, rows, {
        merge,
        base: active.selected
      });
      if (selectedProduct) {
        active.selectedProduct = selectedProduct;
        updateSelectedProductChip();
        fillNameFromSelectedProduct(selectedProduct);
      }
      renderBody();
      if (announce) {
        const total = calcTotal(active.selected);
        active.showStatus?.(
          `✅ Đã nạp ${label} · ${rows.length} NL · ${formatVnd(total)}`,
          'success',
          2000
        );
      }
    } catch (err) {
      console.error('[ShopvdMaterialsCostPicker] formula', err);
      active?.showStatus?.(`⚠️ Không nạp được công thức ${label}`, 'warning');
    } finally {
      bar?.classList.remove('is-loading');
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('is-loading');
      }
    }
  }

  async function applyPresetById(presetId, { merge = true, announce = true, buttonEl = null } = {}) {
    if (!active) return;
    const preset = findPreset(presetId);
    if (!preset) {
      active.showStatus?.('⚠️ Không tìm thấy preset', 'warning');
      return;
    }
    active.selectedProduct = null;
    updateSelectedProductChip();
    await applyProductFormula(preset.productId, {
      label: `mẫu ${preset.label}`,
      merge,
      announce,
      buttonEl: buttonEl
        || active.modal.querySelector(`[data-mat-action="preset"][data-preset-id="${preset.id}"]`)
    });
  }

  function updateSelectedProductChip() {
    if (!active) return;
    const chip = active.modal.querySelector('[data-mat-product-selected]');
    const labelEl = active.modal.querySelector('[data-mat-product-label]');
    const p = active.selectedProduct;
    if (!chip || !labelEl) return;
    if (!p) {
      chip.classList.add('hidden');
      labelEl.textContent = '';
      return;
    }
    chip.classList.remove('hidden');
    labelEl.textContent = p.name || `SP #${p.id}`;
  }

  /** Điền tên SP gốc vào ô tên SP tùy chỉnh (nếu có truyền nameInput) */
  function fillNameFromSelectedProduct(product) {
    const input = active?.nameInput;
    if (!input || !product) return;
    const name = String(product.name || '').trim();
    if (!name) return;
    input.value = name;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    active.onNameFilled?.(name, product);
  }

  function hideProductResults() {
    if (!active) return;
    active.modal.querySelector('[data-mat-product-results]')?.classList.add('hidden');
  }

  function renderProductResults(query) {
    if (!active) return;
    const box = active.modal.querySelector('[data-mat-product-results]');
    if (!box) return;
    const items = filterProducts(query);
    active.productResults = items;
    if (!items.length) {
      box.innerHTML = `<div class="shopvd-mat-product-empty">Không tìm thấy sản phẩm</div>`;
      box.classList.remove('hidden');
      return;
    }
    box.innerHTML = items.map((p) => `
      <button type="button" class="shopvd-mat-product-item" data-mat-action="pick-product" data-product-id="${esc(p.id)}">
        <span class="shopvd-mat-product-item-name">${esc(p.name || `SP #${p.id}`)}</span>
        <span class="shopvd-mat-product-item-meta">${p.cost_price != null && p.cost_price !== '' ? formatVnd(p.cost_price) : '—'}</span>
      </button>
    `).join('');
    box.classList.remove('hidden');
  }

  function calcTotal(selected) {
    let total = 0;
    selected.forEach((row) => {
      total += Math.round(row.quantity || 0) * (Number(row.material.item_cost) || 0);
    });
    return total;
  }

  function groupMaterials(materials) {
    const groups = new Map();
    materials.forEach((m) => {
      const key = m.category_display_name || m.category_name || 'Khác';
      if (!groups.has(key)) {
        groups.set(key, {
          name: key,
          icon: m.category_icon || '📦',
          sort: Number(m.category_sort_order) || 999,
          items: []
        });
      }
      groups.get(key).items.push(m);
    });
    return Array.from(groups.values()).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'vi'));
  }

  function productBarHtml() {
    return `
      <div class="shopvd-mat-product-bar" data-mat-product-bar>
        <div class="shopvd-mat-product-search-wrap">
          <span class="shopvd-mat-product-icon" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </span>
          <input type="search" class="shopvd-mat-product-search" data-mat-product-search
            placeholder="Chọn sản phẩm gốc để nạp công thức..." autocomplete="off">
          <div class="shopvd-mat-product-results hidden" data-mat-product-results></div>
        </div>
        <div class="shopvd-mat-product-selected hidden" data-mat-product-selected>
          <span class="shopvd-mat-product-chip-tag">Gốc</span>
          <span class="shopvd-mat-product-chip-name" data-mat-product-label></span>
          <button type="button" class="shopvd-mat-product-chip-clear" data-mat-action="clear-product" title="Bỏ chọn SP gốc" aria-label="Bỏ chọn">×</button>
        </div>
      </div>
    `;
  }

  function ensureModalShell(host) {
    let modal = document.getElementById(MODAL_ID);
    if (modal) {
      const wrap = modal.querySelector('[data-mat-presets]');
      if (wrap) wrap.innerHTML = renderPresetButtonsHtml();
      if (!modal.querySelector('[data-mat-product-bar]')) {
        const toolbar = modal.querySelector('.shopvd-mat-toolbar');
        toolbar?.insertAdjacentHTML('afterend', productBarHtml());
      }
      return modal;
    }

    modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'shopvd-mat-modal hidden';
    modal.innerHTML = `
      <div class="shopvd-mat-overlay" data-mat-action="close"></div>
      <div class="shopvd-mat-panel" role="dialog" aria-modal="true" aria-labelledby="shopvd-mat-title">
        <div class="shopvd-mat-header">
          <div class="shopvd-mat-header-text">
            <div class="shopvd-mat-title" id="shopvd-mat-title">Chọn nguyên liệu</div>
            <div class="shopvd-mat-subtitle" data-mat-meta>Tính giá vốn nhanh</div>
          </div>
          <button type="button" class="shopvd-mat-close" data-mat-action="close" aria-label="Đóng">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="shopvd-mat-toolbar">
          <div class="shopvd-mat-presets" data-mat-presets>${renderPresetButtonsHtml()}</div>
          <div class="shopvd-mat-total" data-mat-total>0 đ</div>
        </div>
        ${productBarHtml()}
        <div class="shopvd-mat-body" data-mat-body></div>
        <div class="shopvd-mat-footer">
          <button type="button" class="shopvd-mat-btn-secondary" data-mat-action="close">Hủy</button>
          <button type="button" class="shopvd-mat-btn-primary" data-mat-action="apply">
            Áp dụng giá vốn
          </button>
        </div>
      </div>
    `;

    modal.addEventListener('click', onModalClick);
    modal.addEventListener('input', onModalInput);
    modal.addEventListener('change', onModalInput);
    modal.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      const results = modal.querySelector('[data-mat-product-results]');
      if (results && !results.classList.contains('hidden')) {
        results.classList.add('hidden');
        return;
      }
      close();
    });

    // Gắn vào sidebar (cùng chỗ modal ưu đãi) — CSS dùng position:fixed nên vẫn center full màn hình
    const mount = host
      || document.getElementById('shopvd-sidebar')
      || document.body;
    mount.appendChild(modal);
    return modal;
  }

  function onModalClick(e) {
    if (!active) return;
    if (!e.target.closest('.shopvd-mat-product-search-wrap')) {
      hideProductResults();
    }
    const actionEl = e.target.closest('[data-mat-action]');
    if (!actionEl || !active.modal.contains(actionEl)) return;

    const action = actionEl.getAttribute('data-mat-action');
    const name = actionEl.getAttribute('data-mat-name');

    if (action === 'close') {
      close();
      return;
    }
    if (action === 'apply') {
      apply();
      return;
    }
    if (action === 'preset') {
      const presetId = actionEl.getAttribute('data-preset-id');
      applyPresetById(presetId, { merge: true, announce: true, buttonEl: actionEl });
      return;
    }
    if (action === 'pick-product') {
      const pid = Number(actionEl.getAttribute('data-product-id'));
      const product = (active.products || []).find((p) => Number(p.id) === pid)
        || (active.productResults || []).find((p) => Number(p.id) === pid);
      if (!product) return;
      const searchInput = active.modal.querySelector('[data-mat-product-search]');
      if (searchInput) searchInput.value = '';
      hideProductResults();
      applyProductFormula(pid, {
        label: product.name || `SP #${pid}`,
        merge: false,
        announce: true,
        selectedProduct: { id: product.id, name: product.name }
      });
      return;
    }
    if (action === 'clear-product') {
      active.selectedProduct = null;
      updateSelectedProductChip();
      return;
    }
    if (action === 'toggle' && name) {
      toggleMaterial(name);
      return;
    }
    if (action === 'qty-minus' && name) {
      bumpQty(name, -1);
      return;
    }
    if (action === 'qty-plus' && name) {
      bumpQty(name, 1);
    }
  }

  function onModalInput(e) {
    if (!active) return;
    const t = e.target;
    if (t.matches('[data-mat-product-search]')) {
      const q = String(t.value || '');
      active.productQuery = q;
      if (!q.trim()) {
        hideProductResults();
        return;
      }
      renderProductResults(q);
      return;
    }
    if (t.matches('[data-mat-qty]')) {
      const name = t.getAttribute('data-mat-name');
      const row = active.selected.get(name);
      if (!row) return;
      row.quantity = Math.max(1, Math.round(Number(t.value) || 1));
      t.value = String(row.quantity);
      updateTotals();
      updateCardSubtotal(name);
    }
  }

  function toggleMaterial(name) {
    const m = active.materials.find((x) => x.item_name === name);
    if (!m) return;
    if (active.selected.has(name)) {
      active.selected.delete(name);
    } else {
      active.selected.set(name, { quantity: 1, material: m });
    }
    renderBody();
  }

  function findByMatName(selector, name) {
    return Array.from(active.modal.querySelectorAll(selector))
      .find((el) => el.getAttribute('data-mat-name') === name || el.getAttribute('data-mat-sub') === name);
  }

  function bumpQty(name, delta) {
    const row = active.selected.get(name);
    if (!row) return;
    row.quantity = Math.max(1, Math.round(row.quantity + delta));
    const input = findByMatName('[data-mat-qty]', name);
    if (input) input.value = String(row.quantity);
    updateTotals();
    updateCardSubtotal(name);
  }

  function updateCardSubtotal(name) {
    const row = active.selected.get(name);
    const el = findByMatName('[data-mat-sub]', name);
    if (!el || !row) return;
    el.textContent = formatVnd(row.quantity * (Number(row.material.item_cost) || 0));
  }

  function updateTotals() {
    if (!active) return;
    const total = calcTotal(active.selected);
    const count = active.selected.size;
    const totalEl = active.modal.querySelector('[data-mat-total]');
    const metaEl = active.modal.querySelector('[data-mat-meta]');
    if (totalEl) totalEl.textContent = formatVnd(total);
    if (metaEl) metaEl.textContent = count ? `Đã chọn ${count} NL · ${formatVnd(total)}` : 'Chọn NL để tính giá vốn';
    const applyBtn = active.modal.querySelector('[data-mat-action="apply"]');
    if (applyBtn) applyBtn.disabled = count === 0;
  }

  function renderBody() {
    if (!active) return;
    const body = active.modal.querySelector('[data-mat-body]');
    if (!body) return;

    const materials = active.materials || [];
    if (!materials.length) {
      body.innerHTML = `<div class="shopvd-mat-empty">Không có nguyên liệu</div>`;
      updateTotals();
      return;
    }

    const groups = groupMaterials(materials);
    body.innerHTML = groups.map((group) => `
      <div class="shopvd-mat-group">
        <div class="shopvd-mat-group-title">
          <span>${esc(group.icon)}</span>
          <span>${esc(group.name)}</span>
          <span class="shopvd-mat-group-count">${group.items.length}</span>
        </div>
        <div class="shopvd-mat-grid">
          ${group.items.map((m) => {
            const selected = active.selected.get(m.item_name);
            const qty = selected ? selected.quantity : 1;
            const sub = qty * (Number(m.item_cost) || 0);
            return `
              <div class="shopvd-mat-card${selected ? ' is-selected' : ''}" data-mat-card="${esc(m.item_name)}">
                <button type="button" class="shopvd-mat-card-main" data-mat-action="toggle" data-mat-name="${esc(m.item_name)}">
                  <span class="shopvd-mat-check" aria-hidden="true">${selected ? '✓' : ''}</span>
                  <span class="shopvd-mat-card-info">
                    <span class="shopvd-mat-card-name">${esc(displayName(m))}</span>
                    <span class="shopvd-mat-card-price">${formatVnd(m.item_cost)}</span>
                  </span>
                  ${selected ? `<span class="shopvd-mat-card-sub" data-mat-sub="${esc(m.item_name)}">${formatVnd(sub)}</span>` : ''}
                </button>
                ${selected ? `
                  <div class="shopvd-mat-qty">
                    <button type="button" data-mat-action="qty-minus" data-mat-name="${esc(m.item_name)}" aria-label="Giảm">−</button>
                    <input type="number" min="1" step="1" value="${qty}" data-mat-qty data-mat-name="${esc(m.item_name)}">
                    <button type="button" data-mat-action="qty-plus" data-mat-name="${esc(m.item_name)}" aria-label="Tăng">+</button>
                    <span class="shopvd-mat-unit">${esc(unitOf(m))}</span>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `).join('');

    updateTotals();
  }

  function apply() {
    if (!active || !active.costInput) return;
    if (active.selected.size === 0) {
      active.showStatus?.('⚠️ Chọn ít nhất 1 nguyên liệu', 'warning');
      return;
    }

    const total = calcTotal(active.selected);
    writeCostValue(active.costInput, total, active.formatCost);
    active.costInput.classList.add('shopvd-cost-flash');
    setTimeout(() => active?.costInput?.classList.remove('shopvd-cost-flash'), 700);

    lastSelection = Array.from(active.selected.entries()).map(([item_name, row]) => ({
      item_name,
      quantity: row.quantity
    }));

    const count = active.selected.size;
    const payload = { total, count, selection: lastSelection.slice() };
    const onApplied = active.onApplied;
    const onCostApplied = active.onCostApplied;
    const showStatus = active.showStatus;
    const hintEl = active.hintEl;
    close();
    if (hintEl) {
      hintEl.hidden = false;
      hintEl.textContent = `💎 ${count} nguyên liệu · ${formatVnd(total)}`;
    }
    onCostApplied?.(total, payload);
    onApplied?.(payload);
    showStatus?.(`✅ Đã điền giá vốn ${formatVnd(total)} (${count} NL)`, 'success');
  }

  function writeCostValue(costInput, total, formatCost) {
    if (!costInput) return;
    if (typeof formatCost === 'function') {
      costInput.value = formatCost(total);
    } else if (typeof global.formatVnIntegerString === 'function') {
      costInput.value = global.formatVnIntegerString(total);
    } else {
      costInput.value = Math.round(Number(total) || 0).toLocaleString('vi-VN');
    }
    costInput.dispatchEvent(new Event('input', { bubbles: true }));
    // Một số form dùng oninput attribute — kích hoạt thêm change
    costInput.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function close() {
    const modal = document.getElementById(MODAL_ID);
    if (modal) modal.classList.add('hidden');
    active = null;
    // Mobile sheet vẫn cần khóa scroll; desktop modal tự xử lý overlay
    const prodSheet = document.getElementById('prodSheet');
    if (!(prodSheet && !prodSheet.classList.contains('hidden'))) {
      document.body.style.overflow = '';
    }
  }

  /**
   * @param {{
   *   apiBase: string,
   *   costInput: HTMLInputElement,
   *   host?: HTMLElement,
   *   onApplied?: Function,
   *   onCostApplied?: Function,
   *   formatCost?: (n:number)=>string,
   *   showStatus?: Function,
   *   products?: any[],
   *   ensureProducts?: () => Promise<any[]>,
   *   hintEl?: HTMLElement|null
   * }} opts
   */
  async function open(opts) {
    const {
      apiBase,
      costInput,
      host,
      onApplied,
      onCostApplied,
      onNameFilled,
      formatCost,
      showStatus,
      products,
      ensureProducts,
      hintEl,
      nameInput
    } = opts || {};
    if (!apiBase || !costInput) return;

    const modal = ensureModalShell(host || document.body);
    const body = modal.querySelector('[data-mat-body]');
    const productSearch = modal.querySelector('[data-mat-product-search]');
    if (body) body.innerHTML = `<div class="shopvd-mat-empty">Đang tải nguyên liệu…</div>`;
    if (productSearch) productSearch.value = '';
    hideProductResultsSafe(modal);
    modal.querySelector('[data-mat-search]')?.remove();
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    active = {
      apiBase,
      costInput,
      nameInput: nameInput || null,
      onApplied,
      onCostApplied,
      onNameFilled,
      formatCost,
      showStatus,
      hintEl: hintEl || null,
      materials: [],
      selected: new Map(),
      products: normalizeProducts(products),
      productResults: [],
      productQuery: '',
      selectedProduct: null,
      modal
    };
    updateSelectedProductChip();

    try {
      const materialsPromise = loadMaterials(apiBase);
      const productsPromise = (typeof ensureProducts === 'function' && !active.products.length)
        ? ensureProducts().catch(() => [])
        : Promise.resolve(active.products);

      const [materials, productList] = await Promise.all([materialsPromise, productsPromise]);
      if (!active || active.modal !== modal || modal.classList.contains('hidden')) return;

      if (productList && productList.length) {
        active.products = normalizeProducts(productList);
      }

      active.materials = materials;
      active.selected = lastSelection.length
        ? selectionFromLast(materials)
        : new Map();

      renderBody();
      productSearch?.focus();
    } catch (err) {
      console.error('[OrdersMaterialsCostPicker]', err);
      if (!active || active.modal !== modal) return;
      if (body) {
        body.innerHTML = `<div class="shopvd-mat-empty shopvd-mat-empty-error">Không tải được nguyên liệu. Thử lại.</div>`;
      }
      showStatus?.('⚠️ Không tải được nguyên liệu', 'warning');
    }
  }

  function hideProductResultsSafe(modal) {
    modal?.querySelector('[data-mat-product-results]')?.classList.add('hidden');
  }

  global.OrdersMaterialsCostPicker = {
    open,
    close,
    resetSession() {
      lastSelection = [];
      cache = { list: null, at: 0 };
      formulaCacheByProduct.clear();
    }
  };

  /**
   * Helper mở picker từ form SP tùy chỉnh (desktop/mobile).
   * @param {HTMLInputElement|string} costInputOrId
   * @param {object} [options]
   */
  global.openOrderMaterialsCostPicker = async function openOrderMaterialsCostPicker(costInputOrId, options = {}) {
    const costInput = typeof costInputOrId === 'string'
      ? document.getElementById(costInputOrId)
      : costInputOrId;
    if (!costInput) {
      notify('⚠️ Không tìm thấy ô giá vốn', 'warning');
      return;
    }

    const apiBase = (typeof CONFIG !== 'undefined' && CONFIG.API_URL)
      || (typeof global.API === 'function' ? global.API() : '')
      || '';
    if (!apiBase) {
      notify('⚠️ Thiếu cấu hình API', 'warning');
      return;
    }

    let products = options.products;
    if (!products || !products.length) {
      if (typeof allProductsList !== 'undefined' && Array.isArray(allProductsList) && allProductsList.length) {
        products = allProductsList;
      } else if (typeof allProductsCache !== 'undefined' && Array.isArray(allProductsCache) && allProductsCache.length) {
        products = allProductsCache;
      }
    }

    const ensureProducts = options.ensureProducts || (async () => {
      if (products && products.length) return products;
      if (typeof loadProductsAndCategories === 'function') {
        try { await loadProductsAndCategories(); } catch (_) { /* ignore */ }
      }
      if (typeof allProductsList !== 'undefined' && allProductsList.length) return allProductsList;
      if (typeof loadProductList === 'function') {
        try { await loadProductList(); } catch (_) { /* ignore */ }
      }
      if (typeof allProductsCache !== 'undefined' && allProductsCache.length) return allProductsCache;
      return [];
    });

    let nameInput = options.nameInput || null;
    if (typeof nameInput === 'string') {
      nameInput = document.getElementById(nameInput);
    }
    if (!nameInput) {
      nameInput = document.getElementById('modalCustomProductNameInput')
        || document.getElementById('orderEditCustomNameInput')
        || document.getElementById('custName')
        || null;
    }

    global.OrdersMaterialsCostPicker.open({
      apiBase,
      costInput,
      nameInput,
      products: products || [],
      ensureProducts,
      formatCost: options.formatCost || defaultFormatCost,
      onCostApplied: options.onCostApplied,
      onApplied: options.onApplied,
      onNameFilled: options.onNameFilled,
      hintEl: options.hintEl || null,
      showStatus: options.showStatus || notify
    });
  };

  function defaultFormatCost(n) {
    if (typeof global.formatVnIntegerString === 'function') {
      return global.formatVnIntegerString(n);
    }
    return Math.round(Number(n) || 0).toLocaleString('vi-VN');
  }

  function notify(message, type) {
    if (typeof global.showToast === 'function') {
      global.showToast(message, type || 'info');
      return;
    }
    if (typeof global.toast === 'function') {
      global.toast(message);
      return;
    }
    console.log(`[${type || 'info'}]`, message);
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);

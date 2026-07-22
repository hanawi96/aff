/**
 * Panel chuyển địa chỉ cũ → mới trong modal thêm đơn (desktop).
 * UX đồng bộ extension: tìm nhanh + chọn tay linh hoạt → apply vào DeskAddressCombobox.
 *
 * Dependencies:
 * - LegacyAddressConvertCore
 * - window.addressSelector
 * - window._deskAddressCombobox (DeskAddressCombobox)
 */
(function () {
  'use strict';

  const DEBOUNCE_MS = 140;

  let searchTimer = null;
  let searchActiveIndex = -1;
  let searchCurrentResults = [];
  let wardListMode = 'scoped';
  let docClickBound = false;

  const state = {
    province: '',
    district: '',
    ward: '',
  };

  function Core() {
    return window.LegacyAddressConvertCore;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, '&#39;');
  }

  function setStatus(message, type) {
    const el = document.getElementById('deskLegacyConvertStatus');
    if (!el) return;
    el.classList.toggle('hidden', !message);
    el.textContent = message || '';
    el.classList.remove('text-emerald-700', 'text-red-600', 'text-sky-700');
    if (type === 'ok') el.classList.add('text-emerald-700');
    else if (type === 'error') el.classList.add('text-red-600');
    else if (type === 'info') el.classList.add('text-sky-700');
  }

  function updateConvertButton() {
    const btn = document.getElementById('deskLegacyConvertApply');
    if (!btn) return;
    btn.disabled = !(state.province && state.district && state.ward);
  }

  function setLabel(textId, btnId, label, selected) {
    const text = document.getElementById(textId);
    const btn = document.getElementById(btnId);
    if (text) text.textContent = label;
    if (btn) btn.classList.toggle('is-selected', Boolean(selected));
  }

  function syncSelection(province, district, ward) {
    const C = Core();
    state.province = province || '';
    state.district = district || '';
    state.ward = ward || '';

    setLabel(
      'deskLegacyProvinceText',
      'deskLegacyProvinceBtn',
      state.province ? C.toDisplayLabel(state.province) : 'Chọn tỉnh/TP cũ',
      !!state.province
    );
    setLabel(
      'deskLegacyDistrictText',
      'deskLegacyDistrictBtn',
      state.district ? C.toDisplayLabel(state.district) : 'Chọn quận/huyện',
      !!state.district
    );
    setLabel(
      'deskLegacyWardText',
      'deskLegacyWardBtn',
      state.ward ? C.toDisplayLabel(state.ward) : 'Chọn phường/xã',
      !!state.ward
    );
    updateConvertButton();
  }

  function closeAllDropdowns() {
    ['Province', 'District', 'Ward'].forEach((name) => {
      document.getElementById(`deskLegacy${name}Dropdown`)?.classList.add('hidden');
      document.getElementById(`deskLegacy${name}Btn`)?.classList.remove('is-open');
    });
  }

  function hideQuickResults() {
    const box = document.getElementById('deskLegacyQuickResults');
    if (!box) return;
    box.classList.add('hidden');
    box.innerHTML = '';
    searchActiveIndex = -1;
    searchCurrentResults = [];
  }

  function clearQuickSearch() {
    const input = document.getElementById('deskLegacyQuickSearch');
    if (input) input.value = '';
    if (searchTimer) {
      clearTimeout(searchTimer);
      searchTimer = null;
    }
    hideQuickResults();
  }

  function filterList(listId, searchText) {
    const list = document.getElementById(listId);
    if (!list) return;
    const C = Core();
    const q = C.normalizeVn(searchText);
    list.querySelectorAll('[data-desk-legacy-item]').forEach((item) => {
      const text = C.normalizeVn(item.textContent);
      item.classList.toggle('hidden', Boolean(q) && !text.includes(q));
    });
  }

  function renderProvinceList() {
    const list = document.getElementById('deskLegacyProvinceList');
    const tree = Core().getTree();
    if (!list || !tree) return;
    list.innerHTML = tree.provinces
      .map(
        (p) =>
          `<button type="button" data-desk-legacy-item data-value="${escapeAttr(p)}" class="w-full text-left px-3 py-2 text-sm hover:bg-teal-50">${escapeHtml(Core().toDisplayLabel(p))}</button>`
      )
      .join('');
  }

  function renderDistrictList() {
    const list = document.getElementById('deskLegacyDistrictList');
    const tree = Core().getTree();
    if (!list || !tree) return;
    const C = Core();

    // Đã chọn tỉnh → chỉ huyện thuộc tỉnh, không kèm tên tỉnh
    if (state.province) {
      const districts = [...(tree.byProvince.get(state.province)?.keys() || [])].sort((a, b) =>
        a.localeCompare(b, 'vi', { sensitivity: 'base' })
      );
      list.innerHTML = districts
        .map(
          (d) =>
            `<button type="button" data-desk-legacy-item data-district="${escapeAttr(d)}" data-province="${escapeAttr(state.province)}" class="w-full text-left px-3 py-2 text-sm hover:bg-teal-50">${escapeHtml(C.toDisplayLabel(d))}</button>`
        )
        .join('');
      return;
    }

    const pairs = tree.districtPairs || [];
    list.innerHTML = pairs
      .map((pair) => {
        const label = `${C.toDisplayLabel(pair.district)} · ${C.abbreviateAdminLabel(pair.province)}`;
        return `<button type="button" data-desk-legacy-item data-district="${escapeAttr(pair.district)}" data-province="${escapeAttr(pair.province)}" class="w-full text-left px-3 py-2 text-sm hover:bg-teal-50">${escapeHtml(label)}</button>`;
      })
      .join('');
  }

  function renderWardListScoped() {
    const list = document.getElementById('deskLegacyWardList');
    const tree = Core().getTree();
    if (!list || !tree) return;
    const C = Core();
    const wards = tree.byProvince.get(state.province)?.get(state.district) || [];
    list.innerHTML = wards
      .map(
        (w) =>
          `<button type="button" data-desk-legacy-item data-ward="${escapeAttr(w)}" data-district="${escapeAttr(state.district)}" data-province="${escapeAttr(state.province)}" class="w-full text-left px-3 py-2 text-sm hover:bg-teal-50">${escapeHtml(C.toDisplayLabel(w))}</button>`
      )
      .join('');
  }

  function renderWardListSearch(query) {
    const list = document.getElementById('deskLegacyWardList');
    if (!list) return;
    const C = Core();
    const cleaned = C.cleanSearchQuery(query);
    if (cleaned.length < C.SEARCH_MIN_LEN) {
      list.innerHTML =
        '<div class="px-3 py-3 text-xs text-gray-500 text-center">Gõ ít nhất 2 ký tự để tìm phường/xã (tự nhận huyện + tỉnh)</div>';
      return;
    }
    const rows = C.searchWards(query, {
      province: state.province,
      district: state.district,
    });
    if (!rows.length) {
      list.innerHTML =
        '<div class="px-3 py-3 text-xs text-gray-500 text-center">Không tìm thấy phường/xã phù hợp</div>';
      return;
    }
    list.innerHTML = rows
      .map((rec) => {
        const label = `${C.toDisplayLabel(rec.ward)} · ${C.abbreviateAdminLabel(rec.district)} · ${C.abbreviateAdminLabel(rec.province)}`;
        return `<button type="button" data-desk-legacy-item data-ward="${escapeAttr(rec.ward)}" data-district="${escapeAttr(rec.district)}" data-province="${escapeAttr(rec.province)}" class="w-full text-left px-3 py-2 text-sm hover:bg-teal-50">${escapeHtml(label)}</button>`;
      })
      .join('');
  }

  function renderWardList(query) {
    const header = document.getElementById('deskLegacyWardListHeader');
    if (wardListMode === 'scoped') {
      if (header) header.textContent = 'Phường / Xã (cũ)';
      renderWardListScoped();
      filterList('deskLegacyWardList', query || '');
      return;
    }
    if (header) header.textContent = 'Gõ để tìm phường/xã';
    renderWardListSearch(query || '');
  }

  async function openDropdown(which) {
    const C = Core();
    try {
      await C.ensureLoaded();
    } catch (err) {
      setStatus('Không tải được bảng đổi địa chỉ', 'error');
      console.error('[DeskLegacyConvert] load failed:', err);
      return;
    }

    hideQuickResults();
    closeAllDropdowns();

    if (which === 'province') {
      renderProvinceList();
      document.getElementById('deskLegacyProvinceDropdown')?.classList.remove('hidden');
      document.getElementById('deskLegacyProvinceBtn')?.classList.add('is-open');
      const search = document.getElementById('deskLegacyProvinceSearch');
      if (search) {
        search.value = '';
        search.focus();
      }
      filterList('deskLegacyProvinceList', '');
    } else if (which === 'district') {
      renderDistrictList();
      document.getElementById('deskLegacyDistrictDropdown')?.classList.remove('hidden');
      document.getElementById('deskLegacyDistrictBtn')?.classList.add('is-open');
      const search = document.getElementById('deskLegacyDistrictSearch');
      if (search) {
        search.value = '';
        search.focus();
      }
      filterList('deskLegacyDistrictList', '');
      if (!state.province) setStatus('Chọn huyện — hệ thống tự điền tỉnh', 'info');
    } else if (which === 'ward') {
      wardListMode = state.province && state.district ? 'scoped' : 'search';
      document.getElementById('deskLegacyWardDropdown')?.classList.remove('hidden');
      document.getElementById('deskLegacyWardBtn')?.classList.add('is-open');
      const search = document.getElementById('deskLegacyWardSearch');
      if (search) {
        search.value = '';
        search.focus();
      }
      renderWardList('');
      if (wardListMode === 'search') {
        setStatus('Gõ tên xã — hệ thống tự điền huyện + tỉnh', 'info');
      }
    }
  }

  function selectProvince(value) {
    syncSelection(value, '', '');
    closeAllDropdowns();
    setStatus('', null);
    setTimeout(() => openDropdown('district'), 60);
  }

  function selectDistrict(district, province) {
    const nextProvince = province || state.province;
    if (!district || !nextProvince) {
      setStatus('Không xác định được tỉnh của huyện này', 'error');
      return;
    }
    syncSelection(nextProvince, district, '');
    closeAllDropdowns();
    setStatus('', null);
    setTimeout(() => openDropdown('ward'), 60);
  }

  function selectWard(ward, district, province) {
    const nextDistrict = district || state.district;
    const nextProvince = province || state.province;
    if (!ward || !nextDistrict || !nextProvince) {
      setStatus('Không xác định đủ địa chỉ của xã này', 'error');
      return;
    }
    syncSelection(nextProvince, nextDistrict, ward);
    closeAllDropdowns();
    setStatus('', null);
    applyCurrentSelection();
  }

  async function applyMappedValue(mapped, oldParts) {
    const C = Core();
    if (!window.addressSelector?.loaded) {
      await window.addressSelector.init();
    }
    const resolved = C.resolveNewAddress(mapped, window.addressSelector.data || []);
    if (!resolved.ok) {
      setStatus(resolved.error, 'error');
      return false;
    }

    if (oldParts) {
      syncSelection(oldParts.province, oldParts.district, oldParts.ward);
    }

    const combo = window._deskAddressCombobox;
    if (combo && typeof combo.hydrate === 'function') {
      combo.hydrate({
        province_id: resolved.province.Id,
        ward_id: resolved.ward.Id,
      });
    } else {
      const provinceSelect = document.getElementById('newOrderProvince');
      const wardSelect = document.getElementById('newOrderWard');
      if (provinceSelect) {
        provinceSelect.value = String(resolved.province.Id);
        if (wardSelect) {
          window.addressSelector.renderWards(wardSelect, String(resolved.province.Id));
          wardSelect.value = String(resolved.ward.Id);
          wardSelect.disabled = false;
        }
      }
      if (typeof syncDeskOrderStreetInputVisibility === 'function') {
        syncDeskOrderStreetInputVisibility();
      }
      provinceSelect?.dispatchEvent(new Event('change', { bubbles: true }));
      wardSelect?.dispatchEvent(new Event('change', { bubbles: true }));
    }

    setStatus(`Đã điền: ${resolved.label}`, 'ok');
    updateConvertButton();
    return true;
  }

  async function applyCurrentSelection() {
    if (!state.province || !state.district || !state.ward) {
      setStatus('Chọn đủ 3 cấp địa chỉ cũ', 'info');
      return;
    }
    try {
      const C = Core();
      await C.ensureLoaded();
      const mapped = C.lookupMapped(state.province, state.district, state.ward);
      if (!mapped) {
        setStatus('Không tìm thấy trong bảng đổi địa chỉ', 'error');
        return;
      }
      await applyMappedValue(mapped, { ...state });
    } catch (err) {
      console.error('[DeskLegacyConvert] apply failed:', err);
      setStatus(err?.message || 'Chuyển đổi thất bại', 'error');
    }
  }

  async function applySearchResult(rec) {
    if (!rec?.key) return;
    try {
      const C = Core();
      await C.ensureLoaded();
      const mapped = rec.newValue || C.getMapping()?.[rec.key];
      if (!mapped) {
        setStatus('Không tìm thấy trong bảng đổi địa chỉ', 'error');
        return;
      }
      hideQuickResults();
      await applyMappedValue(mapped, rec);
    } catch (err) {
      console.error('[DeskLegacyConvert] search apply failed:', err);
      setStatus(err?.message || 'Chuyển đổi thất bại', 'error');
    }
  }

  function renderQuickResults(results, query) {
    const box = document.getElementById('deskLegacyQuickResults');
    if (!box) return;
    const C = Core();
    searchCurrentResults = results;
    searchActiveIndex = results.length ? 0 : -1;

    const cleaned = C.cleanSearchQuery(query);
    if (cleaned.length < C.SEARCH_MIN_LEN) {
      hideQuickResults();
      return;
    }

    if (!results.length) {
      box.classList.remove('hidden');
      box.innerHTML =
        '<div class="px-3 py-3 text-xs text-gray-500">Không tìm thấy. Thử tên xã/huyện cụ thể hơn, hoặc chọn tay bên dưới.</div>';
      return;
    }

    box.classList.remove('hidden');
    box.innerHTML = results
      .map(
        (rec, idx) => `
        <button type="button" data-desk-legacy-search-idx="${idx}" class="w-full text-left px-3 py-2 border-b border-gray-50 last:border-0 hover:bg-teal-50 ${idx === 0 ? 'bg-teal-50/70' : ''}">
          <div class="text-sm font-semibold text-gray-900 leading-snug">${escapeHtml(C.formatOldLabel(rec))}</div>
          <div class="text-xs text-teal-700 mt-0.5">→ ${escapeHtml(C.formatNewLabel(rec.newValue))}</div>
        </button>`
      )
      .join('');
  }

  function setSearchActiveIndex(next) {
    const box = document.getElementById('deskLegacyQuickResults');
    if (!box || box.classList.contains('hidden') || !searchCurrentResults.length) return;
    const max = searchCurrentResults.length - 1;
    searchActiveIndex = Math.max(0, Math.min(max, next));
    box.querySelectorAll('[data-desk-legacy-search-idx]').forEach((el, idx) => {
      el.classList.toggle('bg-teal-50/70', idx === searchActiveIndex);
    });
    box.querySelector(`[data-desk-legacy-search-idx="${searchActiveIndex}"]`)?.scrollIntoView({
      block: 'nearest',
    });
  }

  async function runQuickSearch(query) {
    try {
      await Core().ensureLoaded();
    } catch (err) {
      setStatus('Không tải được bảng đổi địa chỉ', 'error');
      hideQuickResults();
      return;
    }
    renderQuickResults(Core().search(query), query);
  }

  function scheduleQuickSearch(query) {
    if (searchTimer) clearTimeout(searchTimer);
    const cleaned = Core().cleanSearchQuery(query);
    if (cleaned.length < Core().SEARCH_MIN_LEN) {
      hideQuickResults();
      return;
    }
    searchTimer = setTimeout(() => {
      searchTimer = null;
      runQuickSearch(query);
    }, DEBOUNCE_MS);
  }

  function setPanelOpen(open) {
    const panel = document.getElementById('deskLegacyConvertPanel');
    const toggle = document.getElementById('deskLegacyConvertToggle');
    if (!panel || !toggle) return;
    panel.classList.toggle('hidden', !open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.classList.toggle('is-open', open);
    if (open) {
      Core().ensureLoaded().catch(() => {});
      setTimeout(() => document.getElementById('deskLegacyQuickSearch')?.focus(), 40);
    } else {
      closeAllDropdowns();
      hideQuickResults();
    }
  }

  function resetDeskLegacyAddressConvert() {
    syncSelection('', '', '');
    clearQuickSearch();
    closeAllDropdowns();
    setStatus('', null);
    setPanelOpen(false);
  }

  function destroyDeskLegacyAddressConvert() {
    resetDeskLegacyAddressConvert();
  }

  function onDocumentClick(e) {
    const panel = document.getElementById('deskLegacyConvertPanel');
    const toggle = document.getElementById('deskLegacyConvertToggle');
    if (!panel || panel.classList.contains('hidden')) return;
    if (panel.contains(e.target) || toggle?.contains(e.target)) {
      const searchWrap = document.getElementById('deskLegacyQuickSearchWrap');
      if (searchWrap && !searchWrap.contains(e.target)) hideQuickResults();
      const inDropdown =
        e.target.closest('[id^="deskLegacy"][id$="Dropdown"]') ||
        e.target.closest('[id^="deskLegacy"][id$="Btn"]');
      if (!inDropdown) closeAllDropdowns();
      return;
    }
    closeAllDropdowns();
    hideQuickResults();
  }

  function bindEvents() {
    const root = document.getElementById('deskLegacyConvertRoot');
    if (!root || root.dataset.legacyBound === '1') return;
    root.dataset.legacyBound = '1';

    document.getElementById('deskLegacyConvertToggle')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const toggle = document.getElementById('deskLegacyConvertToggle');
      const open = toggle?.getAttribute('aria-expanded') !== 'true';
      setPanelOpen(open);
    });

    document.getElementById('deskLegacyProvinceBtn')?.addEventListener('click', () => openDropdown('province'));
    document.getElementById('deskLegacyDistrictBtn')?.addEventListener('click', () => openDropdown('district'));
    document.getElementById('deskLegacyWardBtn')?.addEventListener('click', () => openDropdown('ward'));

    document.getElementById('deskLegacyProvinceSearch')?.addEventListener('input', (e) => {
      filterList('deskLegacyProvinceList', e.target.value);
    });
    document.getElementById('deskLegacyDistrictSearch')?.addEventListener('input', (e) => {
      filterList('deskLegacyDistrictList', e.target.value);
    });
    document.getElementById('deskLegacyWardSearch')?.addEventListener('input', (e) => {
      if (wardListMode === 'search') renderWardList(e.target.value);
      else filterList('deskLegacyWardList', e.target.value);
    });

    document.getElementById('deskLegacyProvinceList')?.addEventListener('click', (e) => {
      const item = e.target.closest('[data-desk-legacy-item]');
      const value = item?.getAttribute('data-value');
      if (value) selectProvince(value);
    });
    document.getElementById('deskLegacyDistrictList')?.addEventListener('click', (e) => {
      const item = e.target.closest('[data-desk-legacy-item]');
      if (!item) return;
      const district = item.getAttribute('data-district');
      const province = item.getAttribute('data-province');
      if (district) selectDistrict(district, province);
    });
    document.getElementById('deskLegacyWardList')?.addEventListener('click', (e) => {
      const item = e.target.closest('[data-desk-legacy-item]');
      if (!item) return;
      const ward = item.getAttribute('data-ward');
      const district = item.getAttribute('data-district');
      const province = item.getAttribute('data-province');
      if (ward) selectWard(ward, district, province);
    });

    document.getElementById('deskLegacyConvertApply')?.addEventListener('click', applyCurrentSelection);

    const quickSearch = document.getElementById('deskLegacyQuickSearch');
    const quickResults = document.getElementById('deskLegacyQuickResults');

    quickSearch?.addEventListener('input', (e) => {
      closeAllDropdowns();
      scheduleQuickSearch(e.target.value);
    });

    quickSearch?.addEventListener('keydown', (e) => {
      const open = quickResults && !quickResults.classList.contains('hidden') && searchCurrentResults.length;
      if (e.key === 'ArrowDown' && open) {
        e.preventDefault();
        setSearchActiveIndex(searchActiveIndex < 0 ? 0 : searchActiveIndex + 1);
      } else if (e.key === 'ArrowUp' && open) {
        e.preventDefault();
        setSearchActiveIndex(searchActiveIndex < 0 ? 0 : searchActiveIndex - 1);
      } else if (e.key === 'Enter' && open && searchActiveIndex >= 0) {
        e.preventDefault();
        applySearchResult(searchCurrentResults[searchActiveIndex]);
      } else if (e.key === 'Escape') {
        hideQuickResults();
      }
    });

    quickResults?.addEventListener('click', (e) => {
      const item = e.target.closest('[data-desk-legacy-search-idx]');
      if (!item) return;
      const idx = Number(item.getAttribute('data-desk-legacy-search-idx'));
      const rec = searchCurrentResults[idx];
      if (rec) applySearchResult(rec);
    });

    if (!docClickBound) {
      document.addEventListener('click', onDocumentClick);
      docClickBound = true;
    }
  }

  function initDeskLegacyAddressConvert() {
    const root = document.getElementById('deskLegacyConvertRoot');
    if (!root || !Core()) return;
    bindEvents();
    syncSelection('', '', '');
    setStatus('', null);
    setPanelOpen(false);
  }

  window.initDeskLegacyAddressConvert = initDeskLegacyAddressConvert;
  window.resetDeskLegacyAddressConvert = resetDeskLegacyAddressConvert;
  window.destroyDeskLegacyAddressConvert = destroyDeskLegacyAddressConvert;
})();

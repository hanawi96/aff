/**
 * Chuyển địa chỉ cũ 3 cấp → 2 cấp (ward_mapping_2025.json)
 * CTV chọn thủ công Tỉnh → Quận/Huyện → Phường/Xã rồi bấm chuyển đổi.
 */
(function () {
  'use strict';

  const MAPPING_URL = 'https://shopvd.store/assets/data/ward_mapping_2025.json';
  const CENTRAL_PROVINCES = [
    'thành phố hồ chí minh',
    'thành phố hà nội',
    'thành phố hải phòng',
    'thành phố đà nẵng',
    'thành phố cần thơ',
    'thành phố huế',
  ];

  /** @type {Map<string, string>|null} */
  let mappingRaw = null;
  /** @type {{ provinces: string[], byProvince: Map<string, Map<string, string[]>>, keySet: Set<string> }|null} */
  let tree = null;
  let loaded = false;
  let loadingPromise = null;

  const state = {
    province: '',
    district: '',
    ward: '',
  };

  function normalizeVn(str) {
    return String(str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'd')
      .toLowerCase()
      .replace(/[''`´]/g, '')
      .replace(/\s*[-–—]\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function stripAdminPrefix(str) {
    return normalizeVn(str)
      .replace(/^(phuong|xa|thi tran|thi xa|quan|huyen|tinh|thanh pho|tp\.?)\s+/, '')
      .trim();
  }

  /** Title-case nhẹ để hiển thị dropdown */
  function toDisplayLabel(raw) {
    return String(raw || '')
      .split(' ')
      .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
      .join(' ');
  }

  function parseOldAddressKey(key) {
    const raw = String(key || '').trim().toLowerCase();
    if (!raw || raw === 'null-null-null') return null;

    let province = null;
    let rest = null;
    const tinh = raw.match(/-(tỉnh .+)$/);
    if (tinh) {
      province = tinh[1];
      rest = raw.slice(0, -tinh[0].length);
    } else {
      for (const city of CENTRAL_PROVINCES) {
        const suffix = `-${city}`;
        if (raw.endsWith(suffix)) {
          province = city;
          rest = raw.slice(0, -suffix.length);
          break;
        }
      }
    }
    if (!province || rest == null) return null;

    const distMatch = rest.match(/^(.*?)-(quận .+|huyện .+|thị xã .+|thành phố .+)$/);
    if (!distMatch) return null;

    return {
      ward: distMatch[1].trim(),
      district: distMatch[2].trim(),
      province: province.trim(),
      key: raw,
    };
  }

  function buildTree(mapping) {
    const byProvince = new Map();
    const keySet = new Set();

    for (const [key, value] of Object.entries(mapping)) {
      const parsed = parseOldAddressKey(key);
      if (!parsed || !value) continue;
      keySet.add(parsed.key);

      if (!byProvince.has(parsed.province)) {
        byProvince.set(parsed.province, new Map());
      }
      const byDistrict = byProvince.get(parsed.province);
      if (!byDistrict.has(parsed.district)) {
        byDistrict.set(parsed.district, []);
      }
      const wards = byDistrict.get(parsed.district);
      if (!wards.includes(parsed.ward)) wards.push(parsed.ward);
    }

    const provinces = [...byProvince.keys()].sort((a, b) =>
      a.localeCompare(b, 'vi', { sensitivity: 'base' })
    );

    for (const [, byDistrict] of byProvince) {
      for (const [district, wards] of byDistrict) {
        wards.sort((a, b) => a.localeCompare(b, 'vi', { sensitivity: 'base' }));
        byDistrict.set(
          district,
          wards
        );
      }
    }

    return { provinces, byProvince, keySet };
  }

  async function ensureMappingLoaded() {
    if (loaded && tree) return tree;
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
      const res = await (globalThis.shopvdFetch || fetch)(MAPPING_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      mappingRaw = await res.json();
      tree = buildTree(mappingRaw);
      loaded = true;
      console.log('[ShopVD] ward_mapping loaded:', tree.provinces.length, 'provinces,', tree.keySet.size, 'keys');
      return tree;
    })().catch((err) => {
      loadingPromise = null;
      throw err;
    });

    return loadingPromise;
  }

  function composeKey(province, district, ward) {
    return `${ward}-${district}-${province}`.toLowerCase().trim();
  }

  function splitNewAddress(value) {
    const raw = String(value || '').trim();
    const idx = raw.lastIndexOf('-');
    if (idx <= 0) return null;
    return {
      ward: raw.slice(0, idx).trim(),
      province: raw.slice(idx + 1).trim(),
    };
  }

  function findProvinceMatch(provinceName, addressData) {
    const targetFull = normalizeVn(provinceName);
    const targetShort = stripAdminPrefix(provinceName);
    const exact = [];
    const loose = [];

    for (const p of addressData || []) {
      const full = normalizeVn(p.Name);
      const short = stripAdminPrefix(p.Name);
      if (full === targetFull || short === targetShort) exact.push(p);
      else if (full.includes(targetShort) || targetShort.includes(short)) loose.push(p);
    }

    if (exact.length === 1) return exact[0];
    if (exact.length === 0 && loose.length === 1) return loose[0];
    return null;
  }

  function findWardMatch(wardName, province) {
    if (!province?.Wards?.length) return null;
    const targetFull = normalizeVn(wardName);
    const targetShort = stripAdminPrefix(wardName);
    const exact = [];
    const loose = [];

    for (const w of province.Wards) {
      const names = [w.Name, w.ShortName].filter(Boolean).map((n) => ({
        full: normalizeVn(n),
        short: stripAdminPrefix(n),
      }));
      const hitExact = names.some((n) => n.full === targetFull || n.short === targetShort);
      const hitLoose = names.some(
        (n) => n.full.includes(targetShort) || targetShort.includes(n.short)
      );
      if (hitExact) exact.push(w);
      else if (hitLoose) loose.push(w);
    }

    if (exact.length === 1) return exact[0];
    if (exact.length === 0 && loose.length === 1) return loose[0];
    return null;
  }

  function setStatus(message, type) {
    const el = document.getElementById('legacy-convert-status');
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || '';
    el.classList.remove('is-ok', 'is-error', 'is-info');
    if (type) el.classList.add(type);
  }

  function updateConvertButton() {
    const btn = document.getElementById('legacy-convert-btn');
    if (!btn) return;
    btn.disabled = !(state.province && state.district && state.ward);
  }

  function setComboboxLabel(textId, btnId, label, selected) {
    const text = document.getElementById(textId);
    const btn = document.getElementById(btnId);
    if (text) text.textContent = label;
    if (btn) btn.classList.toggle('selected', Boolean(selected));
  }

  function closeLegacyCombobox(which) {
    const map = {
      province: ['legacy-province-dropdown', 'legacy-province-btn'],
      district: ['legacy-district-dropdown', 'legacy-district-btn'],
      ward: ['legacy-ward-dropdown', 'legacy-ward-btn'],
    };
    const ids = map[which];
    if (!ids) return;
    document.getElementById(ids[0])?.classList.add('hidden');
    document.getElementById(ids[1])?.classList.remove('is-open');
  }

  function closeAllLegacyComboboxes() {
    closeLegacyCombobox('province');
    closeLegacyCombobox('district');
    closeLegacyCombobox('ward');
  }

  function filterList(listId, searchText) {
    const list = document.getElementById(listId);
    if (!list) return;
    const q = normalizeVn(searchText);
    list.querySelectorAll('.shopvd-combobox-item').forEach((item) => {
      const text = normalizeVn(item.textContent);
      item.style.display = !q || text.includes(q) ? 'block' : 'none';
    });
  }

  function renderProvinceList() {
    const list = document.getElementById('legacy-province-list');
    if (!list || !tree) return;
    list.innerHTML = tree.provinces
      .map(
        (p) =>
          `<div class="shopvd-combobox-item" data-value="${escapeAttr(p)}">${escapeHtml(toDisplayLabel(p))}</div>`
      )
      .join('');
  }

  function renderDistrictList() {
    const list = document.getElementById('legacy-district-list');
    if (!list || !tree) return;
    if (!state.province) {
      list.innerHTML = '';
      return;
    }
    const districts = [...(tree.byProvince.get(state.province)?.keys() || [])].sort((a, b) =>
      a.localeCompare(b, 'vi', { sensitivity: 'base' })
    );
    list.innerHTML = districts
      .map(
        (d) =>
          `<div class="shopvd-combobox-item" data-value="${escapeAttr(d)}">${escapeHtml(toDisplayLabel(d))}</div>`
      )
      .join('');
  }

  function renderWardList() {
    const list = document.getElementById('legacy-ward-list');
    if (!list || !tree) return;
    if (!state.province || !state.district) {
      list.innerHTML = '';
      return;
    }
    const wards = tree.byProvince.get(state.province)?.get(state.district) || [];
    list.innerHTML = wards
      .map(
        (w) =>
          `<div class="shopvd-combobox-item" data-value="${escapeAttr(w)}">${escapeHtml(toDisplayLabel(w))}</div>`
      )
      .join('');
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

  async function openLegacyCombobox(which) {
    try {
      await ensureMappingLoaded();
    } catch (err) {
      setStatus('Không tải được bảng đổi địa chỉ', 'is-error');
      console.error('[ShopVD] ward_mapping load failed:', err);
      return;
    }

    closeAllLegacyComboboxes();
    if (typeof window.closeAllComboboxes === 'function') {
      window.closeAllComboboxes();
    }

    if (which === 'province') {
      renderProvinceList();
      document.getElementById('legacy-province-dropdown')?.classList.remove('hidden');
      document.getElementById('legacy-province-btn')?.classList.add('is-open');
      const search = document.getElementById('legacy-province-search');
      if (search) {
        search.value = '';
        search.focus();
      }
      filterList('legacy-province-list', '');
    } else if (which === 'district') {
      if (!state.province) {
        setStatus('Chọn tỉnh/TP cũ trước', 'is-info');
        return;
      }
      renderDistrictList();
      document.getElementById('legacy-district-dropdown')?.classList.remove('hidden');
      document.getElementById('legacy-district-btn')?.classList.add('is-open');
      const search = document.getElementById('legacy-district-search');
      if (search) {
        search.value = '';
        search.focus();
      }
      filterList('legacy-district-list', '');
    } else if (which === 'ward') {
      if (!state.district) {
        setStatus('Chọn quận/huyện cũ trước', 'is-info');
        return;
      }
      renderWardList();
      document.getElementById('legacy-ward-dropdown')?.classList.remove('hidden');
      document.getElementById('legacy-ward-btn')?.classList.add('is-open');
      const search = document.getElementById('legacy-ward-search');
      if (search) {
        search.value = '';
        search.focus();
      }
      filterList('legacy-ward-list', '');
    }
  }

  function selectLegacyProvince(value) {
    state.province = value;
    state.district = '';
    state.ward = '';
    setComboboxLabel('legacy-province-text', 'legacy-province-btn', toDisplayLabel(value), true);
    setComboboxLabel('legacy-district-text', 'legacy-district-btn', 'Chọn quận/huyện', false);
    setComboboxLabel('legacy-ward-text', 'legacy-ward-btn', 'Chọn phường/xã', false);
    document.getElementById('legacy-district-btn')?.removeAttribute('disabled');
    document.getElementById('legacy-ward-btn')?.setAttribute('disabled', 'disabled');
    closeLegacyCombobox('province');
    setStatus('', null);
    updateConvertButton();
    setTimeout(() => openLegacyCombobox('district'), 80);
  }

  function selectLegacyDistrict(value) {
    state.district = value;
    state.ward = '';
    setComboboxLabel('legacy-district-text', 'legacy-district-btn', toDisplayLabel(value), true);
    setComboboxLabel('legacy-ward-text', 'legacy-ward-btn', 'Chọn phường/xã', false);
    document.getElementById('legacy-ward-btn')?.removeAttribute('disabled');
    closeLegacyCombobox('district');
    setStatus('', null);
    updateConvertButton();
    setTimeout(() => openLegacyCombobox('ward'), 80);
  }

  function selectLegacyWard(value) {
    state.ward = value;
    setComboboxLabel('legacy-ward-text', 'legacy-ward-btn', toDisplayLabel(value), true);
    closeLegacyCombobox('ward');
    setStatus('', null);
    updateConvertButton();
    // Đủ 3 cấp → tự chuyển sang 2 cấp (vẫn có thể bấm nút Áp dụng lại)
    convertLegacyAddress();
  }

  async function convertLegacyAddress() {
    const btn = document.getElementById('legacy-convert-btn');
    if (!state.province || !state.district || !state.ward) {
      setStatus('Chọn đủ 3 cấp địa chỉ cũ', 'is-info');
      return;
    }

    try {
      await ensureMappingLoaded();
      if (typeof window.ShopVDAddressAPI?.ensureLoaded === 'function') {
        await window.ShopVDAddressAPI.ensureLoaded();
      }

      const key = composeKey(state.province, state.district, state.ward);
      const mapped = mappingRaw[key];
      if (!mapped) {
        setStatus('Không tìm thấy trong bảng đổi địa chỉ', 'is-error');
        return;
      }

      const parts = splitNewAddress(mapped);
      if (!parts) {
        setStatus('Dữ liệu mới không hợp lệ', 'is-error');
        return;
      }

      const addressData = window.ShopVDAddressAPI?.getAddressData?.() || [];
      const province = findProvinceMatch(parts.province, addressData);
      if (!province) {
        setStatus(`Không khớp tỉnh mới: ${parts.province}`, 'is-error');
        return;
      }

      const ward = findWardMatch(parts.ward, province);
      if (!ward) {
        setStatus(`Không khớp phường/xã mới: ${parts.ward}`, 'is-error');
        return;
      }

      if (btn) btn.disabled = true;
      window.ShopVDAddressAPI.selectProvince(province.Id, { silent: true });
      window.ShopVDAddressAPI.selectWard(ward.Id, province.Id, { silent: true });

      setStatus(`Đã điền: ${ward.Name} · ${province.Name}`, 'is-ok');
    } catch (err) {
      console.error('[ShopVD] convert legacy address failed:', err);
      setStatus(err?.message || 'Chuyển đổi thất bại', 'is-error');
    } finally {
      updateConvertButton();
    }
  }

  function setPanelOpen(open) {
    const box = document.querySelector('#shopvd-sidebar .shopvd-address-box');
    const panel = document.getElementById('legacy-address-panel');
    const toggle = document.getElementById('legacy-toggle-btn');
    if (!panel || !toggle) return;

    box?.classList.toggle('legacy-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');

    if (open) {
      panel.hidden = false;
      ensureMappingLoaded().catch(() => {});
    } else {
      closeAllLegacyComboboxes();
      panel.hidden = true;
    }
  }

  function togglePanel() {
    const toggle = document.getElementById('legacy-toggle-btn');
    setPanelOpen(toggle?.getAttribute('aria-expanded') !== 'true');
  }

  function resetLegacyAddressConvert() {
    state.province = '';
    state.district = '';
    state.ward = '';
    setComboboxLabel('legacy-province-text', 'legacy-province-btn', 'Chọn tỉnh/TP cũ', false);
    setComboboxLabel('legacy-district-text', 'legacy-district-btn', 'Chọn quận/huyện', false);
    setComboboxLabel('legacy-ward-text', 'legacy-ward-btn', 'Chọn phường/xã', false);
    document.getElementById('legacy-district-btn')?.setAttribute('disabled', 'disabled');
    document.getElementById('legacy-ward-btn')?.setAttribute('disabled', 'disabled');
    closeAllLegacyComboboxes();
    setStatus('', null);
    updateConvertButton();
    setPanelOpen(false);
  }

  function bindEvents() {
    document.getElementById('legacy-toggle-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePanel();
    });

    document.getElementById('legacy-province-btn')?.addEventListener('click', () => openLegacyCombobox('province'));
    document.getElementById('legacy-district-btn')?.addEventListener('click', () => openLegacyCombobox('district'));
    document.getElementById('legacy-ward-btn')?.addEventListener('click', () => openLegacyCombobox('ward'));

    document.getElementById('legacy-province-search')?.addEventListener('input', (e) => {
      filterList('legacy-province-list', e.target.value);
    });
    document.getElementById('legacy-district-search')?.addEventListener('input', (e) => {
      filterList('legacy-district-list', e.target.value);
    });
    document.getElementById('legacy-ward-search')?.addEventListener('input', (e) => {
      filterList('legacy-ward-list', e.target.value);
    });

    document.getElementById('legacy-province-list')?.addEventListener('click', (e) => {
      const item = e.target.closest('.shopvd-combobox-item');
      const value = item?.getAttribute('data-value');
      if (value) selectLegacyProvince(value);
    });
    document.getElementById('legacy-district-list')?.addEventListener('click', (e) => {
      const item = e.target.closest('.shopvd-combobox-item');
      const value = item?.getAttribute('data-value');
      if (value) selectLegacyDistrict(value);
    });
    document.getElementById('legacy-ward-list')?.addEventListener('click', (e) => {
      const item = e.target.closest('.shopvd-combobox-item');
      const value = item?.getAttribute('data-value');
      if (value) selectLegacyWard(value);
    });

    document.getElementById('legacy-convert-btn')?.addEventListener('click', convertLegacyAddress);

    document.addEventListener('click', (e) => {
      const panel = document.getElementById('legacy-address-panel');
      const toggle = document.getElementById('legacy-toggle-btn');
      if ((panel && panel.contains(e.target)) || (toggle && toggle.contains(e.target))) return;
      closeAllLegacyComboboxes();
    });
  }

  function init() {
    if (!document.getElementById('legacy-toggle-btn') || !document.getElementById('legacy-address-panel')) return;
    bindEvents();
    resetLegacyAddressConvert();
  }

  window.ShopVDLegacyAddress = {
    init,
    reset: resetLegacyAddressConvert,
    closeAll: closeAllLegacyComboboxes,
    setOpen: setPanelOpen,
  };
})();

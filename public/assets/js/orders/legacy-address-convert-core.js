/**
 * Core chuyển địa chỉ cũ 3 cấp → mới 2 cấp (ward_mapping_2025.json)
 * Dùng chung cho modal thêm đơn (desktop). Logic search/index đồng bộ extension.
 */
(function (global) {
  'use strict';

  const MAPPING_URL = '../assets/data/ward_mapping_2025.json';
  const CENTRAL_PROVINCES = [
    'thành phố hồ chí minh',
    'thành phố hà nội',
    'thành phố hải phòng',
    'thành phố đà nẵng',
    'thành phố cần thơ',
    'thành phố huế',
  ];
  const SEARCH_LIMIT = 10;
  const SEARCH_MIN_LEN = 2;
  const SEARCH_MIN_SCORE = 50;
  const WARD_DROPDOWN_LIMIT = 40;
  const ADMIN_TOKEN_RE = /\b(phuong|xa|thi\s*tran|thi\s*xa|quan|huyen|tinh|thanh\s*pho|tp\.?)\b/g;

  let mappingRaw = null;
  let tree = null;
  let loaded = false;
  let loadingPromise = null;

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

  function cleanSearchQuery(str) {
    return normalizeVn(str)
      .replace(ADMIN_TOKEN_RE, ' ')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function toDisplayLabel(raw) {
    return String(raw || '')
      .split(' ')
      .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
      .join(' ');
  }

  function abbreviateAdminLabel(raw) {
    const s = String(raw || '').trim();
    return s
      .replace(/^phường\s+/i, 'P. ')
      .replace(/^xã\s+/i, 'X. ')
      .replace(/^thị trấn\s+/i, 'TT. ')
      .replace(/^thị xã\s+/i, 'TX. ')
      .replace(/^quận\s+/i, 'Q. ')
      .replace(/^huyện\s+/i, 'H. ')
      .replace(/^tỉnh\s+/i, '')
      .replace(/^thành phố\s+/i, 'TP. ');
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
    const searchRecords = [];
    const districtMap = new Map();

    for (const [key, value] of Object.entries(mapping)) {
      const parsed = parseOldAddressKey(key);
      if (!parsed || !value) continue;

      if (!byProvince.has(parsed.province)) {
        byProvince.set(parsed.province, new Map());
      }
      const byDistrict = byProvince.get(parsed.province);
      if (!byDistrict.has(parsed.district)) {
        byDistrict.set(parsed.district, []);
      }
      const wards = byDistrict.get(parsed.district);
      if (!wards.includes(parsed.ward)) wards.push(parsed.ward);

      const wardShort = stripAdminPrefix(parsed.ward);
      const districtShort = stripAdminPrefix(parsed.district);
      const provinceShort = stripAdminPrefix(parsed.province);
      searchRecords.push({
        key: parsed.key,
        ward: parsed.ward,
        district: parsed.district,
        province: parsed.province,
        newValue: value,
        wardShort,
        districtShort,
        provinceShort,
        haystack: `${wardShort} ${districtShort} ${provinceShort}`,
      });

      const dKey = `${parsed.district}\t${parsed.province}`;
      if (!districtMap.has(dKey)) {
        districtMap.set(dKey, {
          district: parsed.district,
          province: parsed.province,
          districtShort,
          provinceShort,
          haystack: `${districtShort} ${provinceShort}`,
        });
      }
    }

    const provinces = [...byProvince.keys()].sort((a, b) =>
      a.localeCompare(b, 'vi', { sensitivity: 'base' })
    );

    for (const [, byDistrict] of byProvince) {
      for (const [district, wards] of byDistrict) {
        wards.sort((a, b) => a.localeCompare(b, 'vi', { sensitivity: 'base' }));
        byDistrict.set(district, wards);
      }
    }

    const districtPairs = [...districtMap.values()].sort((a, b) => {
      const d = a.district.localeCompare(b.district, 'vi', { sensitivity: 'base' });
      if (d !== 0) return d;
      return a.province.localeCompare(b.province, 'vi', { sensitivity: 'base' });
    });

    return { provinces, byProvince, searchRecords, districtPairs };
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

  function fieldHasToken(field, token) {
    const words = String(field || '').split(' ').filter(Boolean);
    if (!token) return false;
    if (token.length <= 2) return words.includes(token);
    return words.some((w) => w === token || w.startsWith(token));
  }

  function fieldHasAllTokens(field, tokens) {
    return tokens.every((t) => fieldHasToken(field, t));
  }

  async function ensureLoaded() {
    if (loaded && tree) return tree;
    if (loadingPromise) return loadingPromise;

    loadingPromise = fetch(MAPPING_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        mappingRaw = data;
        tree = buildTree(data);
        loaded = true;
        return tree;
      })
      .catch((err) => {
        loadingPromise = null;
        throw err;
      });

    return loadingPromise;
  }

  function search(query, limit) {
    if (!tree?.searchRecords?.length) return [];
    const cleaned = cleanSearchQuery(query);
    if (cleaned.length < SEARCH_MIN_LEN) return [];

    const tokens = cleaned.split(' ').filter(Boolean);
    if (!tokens.length) return [];
    const max = limit || SEARCH_LIMIT;

    const scored = [];
    for (const rec of tree.searchRecords) {
      if (!fieldHasAllTokens(rec.haystack, tokens)) continue;

      const allInWard = fieldHasAllTokens(rec.wardShort, tokens);
      const allInDist = fieldHasAllTokens(rec.districtShort, tokens);
      const wardHit = tokens.some((t) => fieldHasToken(rec.wardShort, t));
      const distHit = tokens.some((t) => fieldHasToken(rec.districtShort, t));
      const provHit = tokens.some((t) => fieldHasToken(rec.provinceShort, t));
      const exactWard = rec.wardShort === cleaned;
      const exactDist = rec.districtShort === cleaned;
      const splitStrong = wardHit && distHit && tokens.length >= 3;

      if (!(exactWard || exactDist || allInWard || allInDist || splitStrong)) continue;

      let score = 0;
      if (exactWard) score += 100;
      else if (allInWard) score += 72;
      else if (wardHit) score += 20;

      if (exactDist) score += 85;
      else if (allInDist) score += 58;
      else if (distHit) score += 18;

      if (rec.provinceShort === cleaned) score += 12;
      else if (provHit) score += 6;

      if (splitStrong) score += 55;
      if (allInWard && provHit) score += 16;
      if (allInDist && provHit) score += 12;
      if ((' ' + rec.haystack + ' ').includes(' ' + cleaned + ' ')) score += 25;

      if (score < SEARCH_MIN_SCORE) continue;
      scored.push({ rec, score });
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.rec.ward.localeCompare(b.rec.ward, 'vi', { sensitivity: 'base' });
    });

    return scored.slice(0, max).map((s) => s.rec);
  }

  function searchWards(query, opts) {
    if (!tree?.searchRecords?.length) return [];
    const cleaned = cleanSearchQuery(query);
    if (cleaned.length < SEARCH_MIN_LEN) return [];

    const tokens = cleaned.split(' ').filter(Boolean);
    const preferProvince = opts?.province || '';
    const preferDistrict = opts?.district || '';
    const scored = [];

    for (const rec of tree.searchRecords) {
      if (!fieldHasAllTokens(rec.haystack, tokens)) continue;
      const allInWard = fieldHasAllTokens(rec.wardShort, tokens);
      const exactWard = rec.wardShort === cleaned;
      if (
        !(
          exactWard ||
          allInWard ||
          rec.wardShort.startsWith(cleaned) ||
          rec.wardShort.includes(cleaned)
        )
      ) {
        continue;
      }
      let score = 0;
      if (exactWard) score += 100;
      else if (allInWard) score += 72;
      else if (rec.wardShort.startsWith(cleaned)) score += 60;
      else score += 40;
      if (preferProvince && rec.province === preferProvince) score += 15;
      if (preferDistrict && rec.district === preferDistrict) score += 20;
      scored.push({ rec, score });
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.rec.ward.localeCompare(b.rec.ward, 'vi', { sensitivity: 'base' });
    });

    return scored.slice(0, WARD_DROPDOWN_LIMIT).map((s) => s.rec);
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

  /**
   * Map giá trị mới "Phường X-Tỉnh Y" → { province, ward } trong tree_2
   */
  function resolveNewAddress(mappedValue, addressData) {
    const parts = splitNewAddress(mappedValue);
    if (!parts) return { ok: false, error: 'Dữ liệu mới không hợp lệ' };

    const province = findProvinceMatch(parts.province, addressData);
    if (!province) {
      return { ok: false, error: `Không khớp tỉnh mới: ${parts.province}` };
    }

    const ward = findWardMatch(parts.ward, province);
    if (!ward) {
      return { ok: false, error: `Không khớp phường/xã mới: ${parts.ward}` };
    }

    return {
      ok: true,
      province,
      ward,
      parts,
      label: `${ward.Name} · ${province.Name}`,
    };
  }

  function lookupMapped(province, district, ward) {
    if (!mappingRaw) return null;
    return mappingRaw[composeKey(province, district, ward)] || null;
  }

  function formatOldLabel(rec) {
    return `${abbreviateAdminLabel(rec.ward)} · ${abbreviateAdminLabel(rec.district)} · ${abbreviateAdminLabel(rec.province)}`;
  }

  function formatNewLabel(value) {
    const parts = splitNewAddress(value);
    if (!parts) return toDisplayLabel(value);
    return `${abbreviateAdminLabel(parts.ward)} · ${abbreviateAdminLabel(parts.province)}`;
  }

  global.LegacyAddressConvertCore = {
    SEARCH_MIN_LEN,
    SEARCH_LIMIT,
    WARD_DROPDOWN_LIMIT,
    ensureLoaded,
    isLoaded: () => loaded,
    getTree: () => tree,
    getMapping: () => mappingRaw,
    search,
    searchWards,
    lookupMapped,
    resolveNewAddress,
    composeKey,
    splitNewAddress,
    normalizeVn,
    cleanSearchQuery,
    stripAdminPrefix,
    toDisplayLabel,
    abbreviateAdminLabel,
    formatOldLabel,
    formatNewLabel,
  };
})(typeof window !== 'undefined' ? window : globalThis);

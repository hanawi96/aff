/**
 * Chuyển địa chỉ 3 cấp → 2 cấp — tra cứu ward_mapping_2025.json
 */
(function (global) {
    'use strict';

    const MAPPING_URL = '../assets/data/ward_mapping_2025.json';
    const WARD_PREFIXES = ['thị trấn', 'phường', 'xã'];
    const DIST_PREFIXES = ['thị xã', 'quận', 'huyện'];
    const PROV_PREFIXES = ['thành phố', 'tỉnh', 'tp'];

    const PROVINCE_ALIASES = {
        'hn': 'thành phố hà nội',
        'ha noi': 'thành phố hà nội',
        'hà nội': 'thành phố hà nội',
        'hanoi': 'thành phố hà nội',
        'hcm': 'thành phố hồ chí minh',
        'tp hcm': 'thành phố hồ chí minh',
        'tp.hcm': 'thành phố hồ chí minh',
        'tphcm': 'thành phố hồ chí minh',
        'tp hồ chí minh': 'thành phố hồ chí minh',
        'hồ chí minh': 'thành phố hồ chí minh',
        'ho chi minh': 'thành phố hồ chí minh',
        'sài gòn': 'thành phố hồ chí minh',
        'sai gon': 'thành phố hồ chí minh',
        'đà nẵng': 'thành phố đà nẵng',
        'da nang': 'thành phố đà nẵng',
        'dn': 'thành phố đà nẵng',
        'hải phòng': 'thành phố hải phòng',
        'hai phong': 'thành phố hải phòng',
        'hp': 'thành phố hải phòng',
        'cần thơ': 'thành phố cần thơ',
        'can tho': 'thành phố cần thơ',
    };

    let _map = null;
    let _keys = [];
    let _loadPromise = null;

    function foldText(s) {
        return String(s || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'D')
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function normKey(s) {
        return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    }

    function loadMapping() {
        if (_map) return Promise.resolve(_map);
        if (_loadPromise) return _loadPromise;
        _loadPromise = fetch(MAPPING_URL)
            .then((r) => {
                if (!r.ok) throw new Error('Không tải được ward_mapping_2025.json');
                return r.json();
            })
            .then((data) => {
                _map = data;
                _keys = Object.keys(data);
                return _map;
            });
        return _loadPromise;
    }

    function isLoaded() {
        return !!_map;
    }

    function splitStreetAndAdmin(raw) {
        const text = String(raw || '').trim();
        if (!text) return { street: '', admin: '' };

        const re = /(?:^|[,\s]+)((?:thị trấn|phường|xã|quận|huyện|thị xã|tỉnh|thành phố|tp\.?\s)\s*[^,]+)/i;
        const m = text.match(re);
        if (!m || m.index == null) {
            return { street: '', admin: text };
        }
        const idx = m.index + (m[0].startsWith(',') || m[0].startsWith(' ') ? m[0].search(/\S/) : 0);
        const street = text.slice(0, idx).replace(/[,\s]+$/g, '').trim();
        const admin = text.slice(idx).replace(/^[,\s]+/g, '').trim();
        return { street, admin: admin || text };
    }

    function parseTypeAndName(segment, prefixes) {
        const s = normKey(segment);
        for (const p of prefixes) {
            if (s === p) return { type: p, name: '' };
            if (s.startsWith(p + ' ')) {
                return { type: p, name: s.slice(p.length + 1).trim() };
            }
        }
        return null;
    }

    function expandProvince(raw) {
        const s = normKey(raw);
        const parsed = parseTypeAndName(s, PROV_PREFIXES);
        if (parsed) {
            const body = parsed.name || '';
            const alias = PROVINCE_ALIASES[body] || PROVINCE_ALIASES[s];
            if (alias) return [alias];
            if (parsed.type === 'tp' && body) return [`thành phố ${body}`];
            if (parsed.type === 'tỉnh' && body) return [`tỉnh ${body}`];
            if (parsed.type === 'thành phố' && body) return [`thành phố ${body}`];
        }
        const aliasOnly = PROVINCE_ALIASES[s];
        if (aliasOnly) return [aliasOnly];
        if (/^tinh\s/.test(s)) return [s];
        if (/^thanh pho\s/.test(s)) return [s.replace(/^thanh pho\s/, 'thành phố ')];
        return [s.startsWith('tỉnh ') || s.startsWith('thành phố ') ? s : s];
    }

    function parseAdminUnits(adminText) {
        const text = String(adminText || '').trim();
        const result = { ward: null, district: null, province: null, display: { ward: '', district: '', province: '' } };
        if (!text) return result;

        const segments = text.split(/[,;]+/).map((x) => x.trim()).filter(Boolean);
        const unknown = [];

        for (const seg of segments) {
            const w = parseTypeAndName(seg, WARD_PREFIXES);
            if (w) {
                result.ward = w;
                result.display.ward = seg;
                continue;
            }
            const d = parseTypeAndName(seg, DIST_PREFIXES);
            if (d) {
                result.district = d;
                result.display.district = seg;
                continue;
            }
            const p = parseTypeAndName(seg, PROV_PREFIXES);
            if (p) {
                result.province = p;
                result.display.province = seg;
                continue;
            }
            unknown.push(seg);
        }

        if (!result.province && unknown.length) {
            const last = unknown.pop();
            const expanded = expandProvince(last);
            result.province = { type: expanded[0].split(' ')[0] === 'tỉnh' ? 'tỉnh' : 'thành phố', name: expanded[0].replace(/^(tỉnh|thành phố)\s+/, '') };
            result.display.province = last;
        }

        if (!result.ward || !result.district) {
            const blob = normKey(text);
            const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if (!result.ward) {
                for (const p of WARD_PREFIXES) {
                    const m = blob.match(new RegExp(`${esc(p)}\\s+(.+?)(?=\\s+(?:quận|huyện|thị xã|tỉnh|thành phố|tp\\b)|$)`));
                    if (m) {
                        result.ward = { type: p, name: m[1].trim() };
                        result.display.ward = text.match(new RegExp(`${esc(p)}\\s+[^,]+`, 'i'))?.[0] || m[0];
                        break;
                    }
                }
            }
            if (!result.district) {
                for (const p of DIST_PREFIXES) {
                    const m = blob.match(new RegExp(`${esc(p)}\\s+(.+?)(?=\\s+(?:tỉnh|thành phố|tp\\b)|$)`));
                    if (m) {
                        result.district = { type: p, name: m[1].trim() };
                        result.display.district = text.match(new RegExp(`${esc(p)}\\s+[^,]+`, 'i'))?.[0] || m[0];
                        break;
                    }
                }
            }
        }

        return result;
    }

    function buildLookupKeys(parsed) {
        if (!parsed.ward || !parsed.district) return [];
        const wType = parsed.ward.type;
        const wName = parsed.ward.name;
        const dType = parsed.district.type;
        const dName = parsed.district.name;

        let provRaw = parsed.province
            ? (parsed.province.type === 'tp' ? `tp ${parsed.province.name}` : `${parsed.province.type} ${parsed.province.name}`)
            : '';
        if (!provRaw && parsed.display.province) {
            provRaw = parsed.display.province;
        }
        const provinces = expandProvince(provRaw || '');

        const keys = [];
        for (const prov of provinces) {
            keys.push(normKey(`${wType} ${wName}-${dType} ${dName}-${prov}`));
            if (!prov.startsWith('tỉnh ') && !prov.startsWith('thành phố ')) {
                keys.push(normKey(`${wType} ${wName}-${dType} ${dName}-tỉnh ${prov}`));
                keys.push(normKey(`${wType} ${wName}-${dType} ${dName}-thành phố ${prov}`));
            }
        }
        return [...new Set(keys)];
    }

    function parseMappedValue(value) {
        const dash = String(value || '').indexOf('-');
        if (dash === -1) return { ward: value || '', province: '' };
        return {
            ward: value.slice(0, dash).trim(),
            province: value.slice(dash + 1).trim(),
        };
    }

    function composeFull(street, ward, province) {
        return [street, ward, province].filter(Boolean).join(', ');
    }

    function lookupExact(keys) {
        for (const k of keys) {
            if (_map[k]) return { key: k, value: _map[k] };
        }
        return null;
    }

    function scoreCandidate(key, parsed) {
        const fk = foldText(key);
        let score = 0;
        if (parsed.ward?.name && fk.includes(foldText(parsed.ward.name))) score += 3;
        if (parsed.district?.name && fk.includes(foldText(parsed.district.name))) score += 2;
        const prov = parsed.province?.name || parsed.display.province || '';
        if (prov && fk.includes(foldText(prov.replace(/^(tỉnh|thành phố|tp\.?)\s+/i, '')))) score += 2;
        return score;
    }

    function lookupFuzzy(parsed, limit = 6) {
        const minScore = parsed.ward ? 3 : 2;
        const scored = [];
        for (const key of _keys) {
            const sc = scoreCandidate(key, parsed);
            if (sc >= minScore) {
                scored.push({ key, value: _map[key], score: sc });
            }
        }
        scored.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key, 'vi'));
        const seen = new Set();
        const out = [];
        for (const item of scored) {
            if (seen.has(item.value)) continue;
            seen.add(item.value);
            out.push(item);
            if (out.length >= limit) break;
        }
        return out;
    }

    function buildResult(street, parsed, match, status) {
        const parts = parseMappedValue(match.value);
        const adminNew = [parts.ward, parts.province].filter(Boolean).join(', ');
        const fullNew = composeFull(street, parts.ward, parts.province);
        return {
            status,
            street,
            oldAdmin: {
                ward: parsed.display.ward,
                district: parsed.display.district,
                province: parsed.display.province,
            },
            newWard: parts.ward,
            newProvince: parts.province,
            adminNew,
            fullNew,
            matchKey: match.key,
        };
    }

    function convertAddress(rawInput) {
        if (!_map) {
            return { status: 'error', message: 'Dữ liệu mapping chưa tải xong' };
        }

        const input = String(rawInput || '').trim();
        if (!input) {
            return { status: 'error', message: 'Vui lòng dán địa chỉ cần chuyển đổi' };
        }

        const { street, admin } = splitStreetAndAdmin(input);
        const parsed = parseAdminUnits(admin || input);

        if (!parsed.ward && !parsed.district) {
            return {
                status: 'fail',
                message: 'Không nhận diện được phường/xã hoặc quận/huyện. Hãy dán địa chỉ có đủ 3 cấp.',
                street,
                oldAdmin: parsed.display,
            };
        }

        const keys = buildLookupKeys(parsed);
        const exact = lookupExact(keys);
        if (exact) {
            return buildResult(street, parsed, exact, 'exact');
        }

        const suggestions = lookupFuzzy(parsed);
        if (suggestions.length === 1) {
            return buildResult(street, parsed, suggestions[0], 'exact');
        }

        if (suggestions.length > 1) {
            return {
                status: 'suggest',
                street,
                oldAdmin: {
                    ward: parsed.display.ward,
                    district: parsed.display.district,
                    province: parsed.display.province,
                },
                suggestions: suggestions.map((s) => {
                    const p = parseMappedValue(s.value);
                    return {
                        key: s.key,
                        value: s.value,
                        label: `${parsed.display.ward || '?'}, ${parsed.display.district || '?'} → ${p.ward}, ${p.province}`,
                        newWard: p.ward,
                        newProvince: p.province,
                        adminNew: [p.ward, p.province].filter(Boolean).join(', '),
                        fullNew: composeFull(street, p.ward, p.province),
                    };
                }),
            };
        }

        return {
            status: 'fail',
            message: 'Không tìm thấy trong bảng mapping. Kiểm tra lại tên phường/xã, quận/huyện, tỉnh.',
            street,
            oldAdmin: {
                ward: parsed.display.ward,
                district: parsed.display.district,
                province: parsed.display.province,
            },
        };
    }

    function applySuggestion(street, suggestion) {
        return {
            status: 'exact',
            street,
            newWard: suggestion.newWard,
            newProvince: suggestion.newProvince,
            adminNew: suggestion.adminNew,
            fullNew: suggestion.fullNew,
            matchKey: suggestion.key,
        };
    }

    global.AddressConvertCore = {
        loadMapping,
        isLoaded,
        convertAddress,
        applySuggestion,
        splitStreetAndAdmin,
        parseAdminUnits,
    };
})(typeof window !== 'undefined' ? window : globalThis);

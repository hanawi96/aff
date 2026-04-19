
// ============================================
// PARSE ADDRESS v2 — Anchor-Cascade Algorithm
// Replaces previous global N-gram implementation
// Strategy: keyword anchors → constrained cascade → reverse inference → fallback
// ============================================

// Reverse indexes: built once per data-load
let _addrIdx = null;
function _buildAddrIdx(data) {
    if (_addrIdx) return _addrIdx;
    const distProv = new Map();
    const wardLoc  = new Map();
    for (const prov of data) {
        for (const dist of (prov.Districts || [])) {
            distProv.set(dist.Id, prov);
            for (const ward of (dist.Wards || [])) {
                wardLoc.set(ward.Id, { province: prov, district: dist });
            }
        }
    }
    _addrIdx = { distProv, wardLoc };
    return _addrIdx;
}

// Strip diacritics + lowercase + normalize whitespace
function _nn(s) {
    return removeVietnameseTones(s || '').toLowerCase()
        .replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Strip admin type prefix: "Quận Bình Thạnh" → "binh thanh"
function _bare(name) {
    return _nn(name)
        .replace(/^(tinh|thanh pho|tp|quan|q|huyen|thi xa|tx|phuong|p|f|xa|thi tran|tt)\s+/, '')
        .trim();
}

/** Hai chuỗi bare chỉ gồm chữ số: coi khớp theo giá trị (vd "6" vs "06"). */
function _bareNumericEqual(a, b) {
    if (!a || !b) return false;
    if (!/^\d+$/.test(a) || !/^\d+$/.test(b)) return false;
    return parseInt(a, 10) === parseInt(b, 10);
}

function _stripTrailingProvinceSuffix(seg, province) {
    if (!seg || !province) return seg;
    var sw = seg.trim().split(/\s+/).filter(Boolean);
    if (sw.length < 2) return seg;
    var pb = _bare(province.Name);
    if (!pb) return seg;
    for (var n = Math.min(3, sw.length - 1); n >= 1; n--) {
        var tail = sw.slice(-n).join(' ');
        if (_bare(tail) === pb) {
            var head = sw.slice(0, -n).join(' ').trim();
            return head || seg;
        }
    }
    return seg;
}

// Province abbreviation map: normalized abbrev → province.Id from tree.json
const _PA = {
    'hcm':'79','tphcm':'79','tp hcm':'79','tp.hcm':'79','sai gon':'79','saigon':'79','sg':'79',
    'hn':'01','ha noi':'01','hanoi':'01',
    'dn':'48','da nang':'48','danang':'48',
    'hp':'31','hai phong':'31',
    'ct':'92','can tho':'92',
    'ag':'89','an giang':'89',
    'bk':'06','bac kan':'06','bac can':'06',
    'bg':'24','bac giang':'24',
    'bn':'27','bac ninh':'27',
    'bd':'74','binh duong':'74',
    'bp':'70','binh phuoc':'70',
    'bt':'60','binh thuan':'60',
    'brvt':'77','br vt':'77','ba ria vung tau':'77','vung tau':'77','br-vt':'77',
    'bl':'95','bac lieu':'95',
    'ben tre':'83',
    'cb':'04','cao bang':'04',
    'cm':'96','ca mau':'96',
    'db':'11','dien bien':'11',
    'dl':'66','dak lak':'66','daklak':'66','dac lac':'66','dak lac':'66','dac lak':'66',
    'dno':'67','dak nong':'67',
    'dt':'87','dong thap':'87',
    'dong nai':'75','dnai':'75',
    'gl':'64','gia lai':'64',
    'hb':'17','hoa binh':'17',
    'hag':'02','ha giang':'02',
    'hnam':'35','ha nam':'35',
    'ht':'42','ha tinh':'42',
    'hd':'30','hai duong':'30',
    'haug':'93','hau giang':'93',
    'hy':'33','hung yen':'33',
    'kh':'56','khanh hoa':'56',
    'kg':'91','kien giang':'91',
    'kt':'62','kon tum':'62',
    'lc':'10','lao cai':'10',
    'lb':'12','lai chau':'12',
    'ld':'68','lam dong':'68',
    'ls':'20','lang son':'20',
    'la':'80','long an':'80',
    'nd':'36','nam dinh':'36',
    'na':'40','nghe an':'40',
    'nb':'37','ninh binh':'37',
    'nt':'58','ninh thuan':'58',
    'pt':'25','phu tho':'25',
    'py':'54','phu yen':'54',
    'qb':'44','quang binh':'44',
    'qnam':'49','quang nam':'49',
    'qng':'51','quang ngai':'51',
    'qn':'22','quang ninh':'22',
    'qt':'45','quang tri':'45',
    'sl':'14','son la':'14',
    'st':'94','soc trang':'94',
    'tn':'19','thai nguyen':'19',
    'tb':'34','thai binh':'34',
    'th':'38','thanh hoa':'38',
    'tth':'46','thua thien hue':'46','hue':'46',
    'tg':'82','tien giang':'82',
    'tninh':'72','tay ninh':'72',
    'tv':'84','tra vinh':'84',
    'tq':'08','tuyen quang':'08',
    'vl':'86','vinh long':'86',
    'vp':'26','vinh phuc':'26',
    'yb':'15','yen bai':'15',
    'binh dinh':'52','bdinh':'52',
};

// District slash/abbrev map
const _DA = {
    'g/vap':'go vap',
    'b/thanh':'binh thanh','b/th':'binh thanh',
    't/duc':'thu duc',
    'b/chanh':'binh chanh',
    'h/mon':'hoc mon',
    'c/gio':'can gio',
    'p/nhuan':'phu nhuan',
    'b/t':'binh tan','b/tan':'binh tan',
    'tdm':'thu dau mot',
    'bmt':'buon ma thuot',
};

const _NOISE_RE = /\b(noi dai|keo dai|mo rong|viet nam|vietnam|n\u1ed1i d\u00e0i|k\u00e9o d\u00e0i|m\u1edf r\u1ed9ng)\b/gi;

// [BUG 6+10] Only strip subward when identifier is numeric (ấp 3, xóm 4, thôn 2, khu phố 3, hẻm 12)
// Do NOT strip text identifiers (khu phố Hai Son, thôn Tân Dương)
const _SUBWARD_RE = /\b(\u1ea5p|\u1ea1p|ap|x\u00f3m|xom|th\u00f4n|thon|t\u1ed5 d\u00e2n ph\u1ed1|to dan pho|t\u1ed5|to|kh\u00f3m|khom|khu ph\u1ed1|khu pho|tdp|ng\u00f5|ngo|h\u1ebem|hem)\s+(\d[\w/]*)\b/gi;

function _expand(text, data) {
    text = text.normalize('NFC').replace(/\u00A0/g, ' ');
    text = text.replace(/,(\S)/g, ', $1');
    text = text.replace(/\s*[-\u2013\u2014|]\s*/g, ', ');

    // Slash abbreviations (\u1E00-\u1EFF: ký tự tiếng Việt ngoài \u024F — vd "Thạnh" sau dấu /)
    text = text.replace(/\b([\w\u00C0-\u024F\u1E00-\u1EFF]+)\/([\w\u00C0-\u024F\u1E00-\u1EFF]+)\b/g, function(m) {
        const k = _nn(m).replace(/\s/g, '/');
        const mapped = _DA[k] || _DA[m.toLowerCase()];
        if (mapped) {
            for (const prov of data) {
                const d = prov.Districts.find(function(d) { return _bare(d.Name) === mapped || _nn(d.Name).includes(mapped); });
                if (d) return d.Name;
            }
        }
        return m;
    });

    // P9Q10 dính liền — xử lý trước Q/P tách (không có \b giữa số phường và quận)
    text = text.replace(/\b([PF])\.?(\d{1,2})(?=[qQ]\.?\d{1,2}\b)/gi, 'Ph\u01b0\u1eddng $2 ');

    // Q.8 / Q8 / Q 8
    text = text.replace(/\bQ\.?\s*(\d{1,2})\b/gi, 'Qu\u1eadn $1');
    // P.15 / F.3 / P15 (numeric wards)
    text = text.replace(/\b[PF]\.?\s*(\d{1,2})\b/gi, 'Ph\u01b0\u1eddng $1');

    // [BUG 7] P./p. prefix for non-numeric ward names: "p.Phu Loi" → "Phường Phu Loi"
    text = text.replace(/\b[pP]\.\s?([A-Z][a-zA-Z\u00C0-\u024F]*(?:\s+[A-Z][a-zA-Z\u00C0-\u024F]*){0,2})\b/g,
        'Ph\u01b0\u1eddng $1');

    // Roman numerals in ward context
    const ROMAN = {'i':'1','ii':'2','iii':'3','iv':'4','v':'5','vi':'6','vii':'7','viii':'8','ix':'9','x':'10'};
    text = text.replace(/\b(ph\u01b0\u1eddng|phuong)\s+(x{0,1}i{0,3}|i?x|v?i{0,3})\b/gi, function(m, kw, rn) {
        const n = ROMAN[rn.toLowerCase()]; return n ? kw + ' ' + n : m;
    });

    text = text.replace(_NOISE_RE, ' ');
    text = text.replace(/\b\d{5,6}\b/g, ' ');

    // Province abbreviations: scan tokens longest-match
    const tokens = text.split(/\s+/);
    const out = []; let i = 0;
    while (i < tokens.length) {
        let matched = false;
        for (let n = Math.min(3, tokens.length - i); n >= 1; n--) {
            const key = _nn(tokens.slice(i, i + n).join(' '));
            const pid = _PA[key];
            if (pid) {
                const prov = data.find(function(p) { return p.Id === pid; });
                if (prov) { out.push(prov.Name); i += n; matched = true; break; }
            }
        }
        if (!matched) { out.push(tokens[i]); i++; }
    }
    text = out.join(' ');

    // District abbreviations (TDM, BMT — non-slash)
    for (const abbr of Object.keys(_DA)) {
        if (abbr.includes('/')) continue;
        const normName = _DA[abbr];
        const escaped = abbr.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        const re = new RegExp('\\b' + escaped + '\\b', 'gi');
        if (re.test(text)) {
            for (const prov of data) {
                const d = prov.Districts.find(function(dd) { return _bare(dd.Name) === normName || _nn(dd.Name).includes(normName); });
                if (d) { text = text.replace(re, d.Name); break; }
            }
        }
    }
    return text.replace(/\s+/g, ' ').trim();
}

function _extractSubward(text) {
    const parts = [];
    var cleaned = text.replace(_SUBWARD_RE, function(m) { parts.push(m.trim()); return ' '; })
                      .replace(/\s+/g, ' ').trim();
    return { cleaned: cleaned, subward: parts.join(', ') };
}

// [BUG 1] Comprehensive admin keyword lookahead — both diacritic AND non-diacritic variants
// Uses \s+ before keyword (left boundary) and (?:\s|$|[,.]) after (right boundary)
// instead of \b which is unreliable for non-ASCII characters in JS regex.
var _ADMIN_LA = '(?='
    + '\\s*(?:$|[,.])'
    + '|\\s+(?:'
    + 'tinh|t\u1ec9nh'
    + '|thanh\\s+pho|th\u00e0nh\\s+ph\u1ed1|tp\\.?'
    + '|quan|qu\u1eadn'
    + '|huyen|h\u01b0y\u1ec7n'
    + '|thi\\s+xa|th\u1ecb\\s+x\u00e3|tx\\.?'
    + '|phuong|ph\u01b0\u1eddng'
    + '|xa|x\u00e3'
    + '|thi\\s+tran|th\u1ecb\\s+tr\u1ea5n|tt\\.?'
    + ')(?:\\s|$|[,.])'
    + ')';

function _anchors(text) {
    const a = { province: null, district: null, ward: null };
    let m;

    // [BUG 2] Changed {2,...} to {1,...} to allow single-digit names (Quận 8, Phường 1)
    var reP = new RegExp('\\b(?:t\u1ec9nh|tinh)\\s+([^,\\n]{1,30}?)' + _ADMIN_LA, 'gi');
    reP.lastIndex = 0;
    while ((m = reP.exec(text))) a.province = m[1].trim();

    var tpCands = [];
    var reTP = new RegExp('\\b(?:th\u00e0nh\\s+ph\u1ed1|thanh\\s+pho|tp\\.?)\\s+([^,\\n]{1,25}?)' + _ADMIN_LA, 'gi');
    reTP.lastIndex = 0;
    while ((m = reTP.exec(text))) tpCands.push(m[1].trim().split(/\s*,/)[0].trim());

    var reD = new RegExp('\\b(?:qu\u1eadn|quan|h\u01b0y\u1ec7n|huyen|th\u1ecb\\s+x\u00e3|thi\\s+xa|tx\\.?)\\s+([^,\\n]{1,25}?)' + _ADMIN_LA, 'gi');
    reD.lastIndex = 0;
    while ((m = reD.exec(text))) a.district = m[1].trim().split(/\s*,/)[0].trim();

    var reW = new RegExp('\\b(?:ph\u01b0\u1eddng|phuong|th\u1ecb\\s+tr\u1ea5n|thi\\s+tran|tt\\.?|(?<!\\bthi\\s)(?<!\\bth\u1ecb\\s)(?:x\u00e3|xa))\\s+([^,\\n]{1,25}?)' + _ADMIN_LA, 'gi');
    reW.lastIndex = 0;
    while ((m = reW.exec(text))) a.ward = m[1].trim().split(/\s*,/)[0].trim();

    // Resolve "thành phố" candidates: province-level or district-level city?
    const provCities = new Set(['ho chi minh','ha noi','da nang','hai phong','can tho']);
    for (var ci = 0; ci < tpCands.length; ci++) {
        var cand = tpCands[ci];
        if (provCities.has(_bare(cand))) { a.province = cand; }
        else if (!a.district) { a.district = cand; }
        else if (!a.province) { a.province = cand; }
    }
    return a;
}

function _match(cand, items, thr) {
    if (!cand || !items || !items.length) return null;
    const cn = _bare(cand); if (!cn) return null;
    let best = null, bScore = 0;
    for (const item of items) {
        const iN = _bare(item.Name);
        if (cn === iN || _bareNumericEqual(cn, iN)) return item;
        let score = 0;
        if (cn.length >= 2 && iN.includes(cn)) score = cn.length / iN.length * 0.95;
        else if (iN.length >= 2 && cn.includes(iN)) score = iN.length / cn.length * 0.90;
        else {
            const maxL = Math.max(cn.length, iN.length);
            if (Math.abs(cn.length - iN.length) <= maxL * 0.5)
                score = 1 - levenshteinDistance(cn, iN) / maxL;
        }
        if (score > bScore && score >= thr) { best = item; bScore = score; }
    }
    return best;
}

// [BUG 5] Track the end-inference source text for cross-validation
var _provFromEndText = null;
function _inferProvFromEnd(text, data, thr) {
    _provFromEndText = null;
    const words = text.split(/[\s,]+/).filter(function(w) { return w.length > 1; });
    for (let n = Math.min(3, words.length); n >= 1; n--) {
        var candidate = words.slice(-n).join(' ');
        const p = _match(candidate, data, thr);
        if (p) {
            _provFromEndText = candidate;
            return p;
        }
    }
    return null;
}

let _lastDistProv = null;
function _globalDist(cand, data, province, thr) {
    if (!cand) return null;
    const cn = _bare(cand);
    let best = null, bScore = 0, bProv = null;
    const list = province ? [province] : data;
    for (const prov of list) {
        for (const dist of (prov.Districts || [])) {
            const dn = _bare(dist.Name);
            let score = (cn === dn || _bareNumericEqual(cn, dn)) ? 1 : 0;
            if (!score && (dn.includes(cn) || cn.includes(dn)))
                score = Math.min(cn.length, dn.length) / Math.max(cn.length, dn.length) * 0.92;
            if (!score) {
                const maxL = Math.max(cn.length, dn.length);
                if (Math.abs(cn.length - dn.length) <= maxL * 0.5)
                    score = 1 - levenshteinDistance(cn, dn) / maxL;
            }
            if (score > bScore && score >= thr) { best = dist; bScore = score; bProv = prov; }
        }
    }
    _lastDistProv = bProv;
    return best;
}

function _globalWard(cand, data, province, district, thr) {
    if (!cand) return null;
    const cn = _bare(cand);
    let best = null, bScore = 0, bProv = null, bDist = null;
    for (const prov of (province ? [province] : data)) {
        for (const dist of (district ? [district] : (prov.Districts || []))) {
            for (const ward of (dist.Wards || [])) {
                const wn = _bare(ward.Name);
                let score = (cn === wn || _bareNumericEqual(cn, wn)) ? 1 : 0;
                if (!score && (wn.includes(cn) || cn.includes(wn)))
                    score = Math.min(cn.length, wn.length) / Math.max(cn.length, wn.length) * 0.90;
                if (!score) {
                    const maxL = Math.max(cn.length, wn.length);
                    if (Math.abs(cn.length - wn.length) <= maxL * 0.5)
                        score = 1 - levenshteinDistance(cn, wn) / maxL;
                }
                if (score > bScore && score >= thr) { best = ward; bScore = score; bProv = prov; bDist = dist; }
            }
        }
    }
    return best ? { ward: best, district: bDist, province: bProv } : null;
}

// [BUG 4] Added Pass 3: district-first global search for addresses without province
function _fallback(text, data) {
    const out = { province: null, district: null, ward: null };
    const segs = text.split(',').map(function(s) { return s.trim(); }).filter(Boolean);

    // Pass 1: Comma-segment — province from segments (right-to-left)
    if (segs.length >= 2) {
        for (let pi = segs.length - 1; pi >= 0; pi--) {
            const p = _match(segs[pi], data, 0.80);
            if (!p) continue;
            out.province = p;
            if (pi > 0) {
                const d = _match(_stripTrailingProvinceSuffix(segs[pi - 1], p), p.Districts, 0.75);
                if (d) { out.district = d; if (pi > 1) out.ward = _match(segs[pi - 2], d.Wards, 0.73); }
            }
            return out;
        }
    }

    // Pass 2: Word n-gram — find province, then district/ward in remainder
    const words = text.split(/\s+/).filter(Boolean);
    for (let n = Math.min(3, words.length); n >= 1; n--) {
        for (let s = words.length - n; s >= 0; s--) {
            const p = _match(words.slice(s, s + n).join(' '), data, 0.82);
            if (!p) continue;
            out.province = p;
            const rem = words.slice(0, s).concat(words.slice(s + n));
            for (let dn = Math.min(3, rem.length); dn >= 1; dn--) {
                for (let ds = rem.length - dn; ds >= 0; ds--) {
                    const d = _match(_stripTrailingProvinceSuffix(rem.slice(ds, ds + dn).join(' '), p), p.Districts, 0.78);
                    if (!d) continue;
                    out.district = d;
                    const rem2 = rem.slice(0, ds).concat(rem.slice(ds + dn));
                    for (let wn = Math.min(3, rem2.length); wn >= 1; wn--) {
                        for (let ws = rem2.length - wn; ws >= 0; ws--) {
                            const w = _match(rem2.slice(ws, ws + wn).join(' '), d.Wards, 0.75);
                            if (w) { out.ward = w; return out; }
                        }
                    }
                    return out;
                }
            }
            return out;
        }
    }

    // Pass 3: District-first — global district search when no province found
    for (var dn = Math.min(3, words.length); dn >= 1; dn--) {
        for (var ds = words.length - dn; ds >= 0; ds--) {
            var dCand = words.slice(ds, ds + dn).join(' ');
            var d = _globalDist(dCand, data, null, 0.80);
            if (!d) continue;
            out.district = d;
            out.province = _lastDistProv;
            var rem3 = words.slice(0, ds).concat(words.slice(ds + dn));
            for (var wn = Math.min(3, rem3.length); wn >= 1; wn--) {
                for (var ws = rem3.length - wn; ws >= 0; ws--) {
                    var w = _match(rem3.slice(ws, ws + wn).join(' '), d.Wards, 0.75);
                    if (w) { out.ward = w; return out; }
                }
            }
            return out;
        }
    }

    return out;
}

// [IMPROVEMENT 1] Partial fallback — find district/ward within a known province or district
function _partialFallback(text, data, province, district) {
    var result = { district: district, ward: null };
    var segs = text.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    var words = text.split(/\s+/).filter(Boolean);

    function _sameBareAsProvince(seg) {
        return !!(province && seg && _bare(seg) === _bare(province.Name));
    }
    function _sameBareAsDistrict(seg, dist) {
        return !!(dist && seg && _bare(seg) === _bare(dist.Name));
    }

    if (province && !district) {
        // Scan right-to-left: district is usually closer to the province (at end)
        for (var si = segs.length - 1; si >= 0; si--) {
            if (_sameBareAsProvince(segs[si])) continue;
            var d = _match(_stripTrailingProvinceSuffix(segs[si], province), province.Districts, 0.78);
            if (d) { result.district = d; break; }
        }
        if (!result.district) {
            for (var n = Math.min(3, words.length); n >= 1; n--) {
                for (var i = 0; i <= words.length - n; i++) {
                    var cand = words.slice(i, i + n).join(' ');
                    if (_sameBareAsProvince(cand)) continue;
                    var d2 = _match(_stripTrailingProvinceSuffix(cand, province), province.Districts, 0.78);
                    if (d2) { result.district = d2; break; }
                }
                if (result.district) break;
            }
        }
    }

    var dist = result.district;
    if (dist) {
        for (var si2 = 0; si2 < segs.length; si2++) {
            if (_sameBareAsProvince(segs[si2])) continue;
            if (_sameBareAsDistrict(segs[si2], dist)) continue;
            var w = _match(segs[si2], dist.Wards, 0.73);
            if (w) { result.ward = w; break; }
        }
        if (!result.ward) {
            for (var n2 = Math.min(3, words.length); n2 >= 1; n2--) {
                for (var i2 = 0; i2 <= words.length - n2; i2++) {
                    var candW = words.slice(i2, i2 + n2).join(' ');
                    if (_sameBareAsProvince(candW)) continue;
                    if (_sameBareAsDistrict(candW, dist)) continue;
                    var w2 = _match(candW, dist.Wards, 0.75);
                    if (w2) { result.ward = w2; break; }
                }
                if (result.ward) break;
            }
        }
    }

    return result;
}

// [BUG 8] Deduplicate subward from street, clean up artifacts
function _extractStreet(expanded, province, district, ward, subward) {
    let s = expanded;
    s = s.replace(/\b(?:t\u1ec9nh|tinh)\s+[^,]+/gi, ' ');
    s = s.replace(/\b(?:th\u00e0nh ph\u1ed1|thanh pho|tp\.?)\s+[^,]+/gi, ' ');
    s = s.replace(/\b(?:qu\u1eadn|quan|h\u01b0y\u1ec7n|huyen|th\u1ecb x\u00e3|thi xa|tx\.?)\s+[^,]+/gi, ' ');
    s = s.replace(/\b(?:ph\u01b0\u1eddng|phuong|x\u00e3|xa|th\u1ecb tr\u1ea5n|thi tran|tt\.?)\s+[^,]+/gi, ' ');
    function safe(n) { return n ? n.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') : ''; }
    if (province) s = s.replace(new RegExp(safe(province.Name), 'gi'), ' ');
    if (district) s = s.replace(new RegExp(safe(district.Name), 'gi'), ' ');
    if (ward)     s = s.replace(new RegExp(safe(ward.Name), 'gi'), ' ');
    // Remove subward numeric patterns to avoid duplication with prepended subward
    if (subward) s = s.replace(_SUBWARD_RE, ' ');
    // Clean up lone Q./P./F. artifacts left after keyword stripping
    s = s.replace(/\b[QPF]\.\s*/gi, ' ');
    s = s.replace(/[,\s]+$/, '').replace(/^[,\s]+/, '').replace(/,\s*,+/g, ',').replace(/\s+/g, ' ').trim();
    return subward ? subward + (s ? ', ' + s : '') : s;
}

/**
 * parseAddress v2 — Anchor-Cascade Algorithm
 */
async function parseAddress(addressText, customerHint) {
    if (customerHint === undefined) customerHint = null;
    const result = { street:'', ward:null, district:null, province:null, confidence:'low', suggestions:[], warnings:[] };
    const data = getVietnamAddressData();
    if (!data || !data.length || !addressText || !addressText.trim()) return result;
    _buildAddrIdx(data);

    // Phase 1: Expand abbreviations, normalize separators, strip noise
    const expanded = _expand(addressText, data);

    // Phase 2: Strip numeric sub-ward tokens (ấp 3, xóm 4...) → save as street prefix
    const sw = _extractSubward(expanded);
    const cleaned = sw.cleaned;
    const subward = sw.subward;

    // Phase 3: Detect keyword anchors (tỉnh X, quận X, phường X...)
    const anc = _anchors(cleaned);

    let province = null, district = null, ward = null;

    // Phase 4a: Province from anchor keyword
    if (anc.province) {
        // Guard: if the captured "province" text starts with a district/ward keyword
        // (e.g. "Quận Bình Thạnh" from false "tinh" in street name "Xô Viết Nghệ Tĩnh"),
        // treat it as a district anchor instead.
        var _provNn = _nn(anc.province);
        if (/^(quan|huyen|thi xa|tx|phuong|xa|thi tran|tt)\s/.test(_provNn)) {
            if (!anc.district) anc.district = anc.province.replace(/^\S+\s+/, '');
            anc.province = null;
        }
    }
    if (anc.province) {
        province = _match(anc.province, data, 0.78);
        if (!province) {
            const d = _globalDist(anc.province, data, null, 0.80);
            if (d) { district = d; province = _lastDistProv; anc.province = null; }
        }
    }
    // [BUG 5] Higher threshold (0.90) for end-inference to reduce false positives
    if (!province) province = _inferProvFromEnd(cleaned, data, 0.90);

    // Phase 4b: District from anchor keyword
    if (anc.district) {
        if (province) district = _match(anc.district, province.Districts, 0.78);
        if (!district) {
            district = _globalDist(anc.district, data, province, 0.78);
            if (district && !province) province = _lastDistProv;
        }
    }

    // Phase 4c: Ward from anchor keyword
    if (anc.ward) {
        if (district) ward = _match(anc.ward, district.Wards, 0.75);
        if (!ward) {
            const r = _globalWard(anc.ward, data, province, district, 0.75);
            if (r) { ward = r.ward; if (!district) district = r.district; if (!province) province = r.province; }
        }
    }

    // Phase 5: Full fallback — segment-based cascade when anchors found nothing
    if (!province && !district && !ward) {
        const fb = _fallback(cleaned, data);
        province = fb.province; district = fb.district; ward = fb.ward;
    }

    // [BUG 3 + IMPROVEMENT 1] Partial fallback — find district/ward within known province
    if (province && (!district || !ward)) {
        var pf = _partialFallback(cleaned, data, province, district);
        if (!district && pf.district) district = pf.district;
        if (!ward && pf.ward) ward = pf.ward;
    }

    // Phase 6: Reverse inference — fill missing levels using reverse index
    if (ward && !district) {
        const r = _addrIdx.wardLoc.get(ward.Id);
        if (r) { district = r.district; if (!province) province = r.province; }
    }
    if (district && !province) {
        const p = _addrIdx.distProv.get(district.Id);
        if (p) province = p;
    }

    // [IMPROVEMENT 2] Cross-validation — if only province found via end-inference,
    // try re-interpreting the candidate as a district for better coverage
    if (province && !district && !ward && _provFromEndText) {
        var altDist = _globalDist(_provFromEndText, data, null, 0.80);
        if (altDist && _lastDistProv && _lastDistProv.Id !== province.Id) {
            var altPf = _partialFallback(cleaned, data, _lastDistProv, altDist);
            if (altPf.ward) {
                province = _lastDistProv;
                district = altDist;
                ward = altPf.ward;
            } else {
                province = _lastDistProv;
                district = altDist;
            }
        }
    }

    // Cross-validate: if result came from global ward search, check if unused
    // comma segments suggest a different district (e.g. "Thoi Binh" → Cà Mau not Thái Bình)
    if (province && district && ward) {
        var cvSegs = cleaned.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
        var lastSeg = cvSegs.length > 0 ? cvSegs[cvSegs.length - 1] : '';
        if (lastSeg) {
            var lsBare = _bare(lastSeg);
            var pBare = _bare(province.Name);
            var dBare = _bare(district.Name);
            if (lsBare !== pBare && lsBare !== dBare
                && levenshteinDistance(lsBare, pBare) > 2
                && levenshteinDistance(lsBare, dBare) > 2) {
                var cvDist = _globalDist(lastSeg, data, null, 0.78);
                if (cvDist) {
                    var cvProv = _lastDistProv;
                    var wardText = anc.ward || _bare(ward.Name);
                    var cvWard = _match(wardText, cvDist.Wards, 0.75);
                    if (cvWard) {
                        province = cvProv;
                        district = cvDist;
                        ward = cvWard;
                    }
                }
            }
        }
    }

    // Phase 7: Customer hint boost (from order history)
    if (!province && customerHint && customerHint.province_id) {
        province = data.find(function(p) { return p.Id === customerHint.province_id; }) || null;
        if (province && !district && customerHint.district_id)
            district = (province.Districts || []).find(function(d) { return d.Id === customerHint.district_id; }) || null;
    }

    // Phase 8: Extract street address (remainder after removing admin units)
    result.street   = _extractStreet(expanded, province, district, ward, subward);
    result.province = province;
    result.district = district;
    result.ward     = ward;
    result.confidence = province && district && ward ? 'high' : province && district ? 'medium' : 'low';

    console.log('\uD83D\uDCCD parseAddress v2:', {
        province: province ? province.Name : null,
        district: district ? district.Name : null,
        ward: ward ? ward.Name : null,
        street: result.street,
        confidence: result.confidence
    });
    return result;
}

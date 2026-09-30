/**
 * Address Selector Module
 * Quản lý cascade dropdown cho địa chỉ Việt Nam 2 cấp (Tỉnh/TP > Phường/Xã)
 * Tối ưu với Map lookup O(1)
 *
 * Dữ liệu: tree_2.json (địa chỉ hành chính 2 cấp - 2025)
 */

class AddressSelector {
    constructor() {
        this.data = [];
        this.provinceMap = new Map();
        this.wardMap = new Map();
        this.loaded = false;
    }

    async init() {
        if (this.loaded) return;

        try {
            const basePath = window.location.pathname.includes('/admin/')
                ? '../assets/data/tree_2.json?v=2025b'
                : '/assets/data/tree_2.json?v=2025b';

            const response = await fetch(basePath);
            const raw = await response.json();

            this.data = [];

            for (const province of raw) {
                const provinceObj = {
                    Id: province.code,
                    Name: province.fullName,
                    ShortName: province.name,
                    Wards: []
                };

                this.provinceMap.set(province.code, provinceObj);

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
                        this.wardMap.set(wardKey, wardObj);
                    }
                }

                this.data.push(provinceObj);
            }

            this.data.sort((a, b) => {
                const pri = (id) => id === '79' ? 0 : id === '01' ? 1 : 2;
                const pa = pri(a.Id), pb = pri(b.Id);
                if (pa !== pb) return pa - pb;
                return a.Name.localeCompare(b.Name, 'vi', { sensitivity: 'base' });
            });

            this._nameIndex = null;
            this.loaded = true;
            console.log('✅ Loaded tree_2.json:', {
                provinces: this.data.length,
                wards: this.wardMap.size
            });
        } catch (error) {
            console.error('❌ Lỗi load địa chỉ từ tree_2.json:', error);
            throw error;
        }
    }

    renderProvinces(selectElement) {
        selectElement.innerHTML = '<option value="">-- Chọn Tỉnh/Thành phố --</option>';
        this.data.forEach(province => {
            const option = document.createElement('option');
            option.value = province.Id;
            option.textContent = province.Name;
            selectElement.appendChild(option);
        });
    }

    renderWards(selectElement, provinceId) {
        selectElement.innerHTML = '<option value="">-- Chọn Phường/Xã --</option>';
        selectElement.disabled = false;

        if (!provinceId) return;

        const province = this.provinceMap.get(provinceId);
        if (province) {
            const sorted = [...province.Wards].sort((a, b) =>
                a.Name.localeCompare(b.Name, 'vi', { sensitivity: 'base' })
            );
            sorted.forEach(ward => {
                const option = document.createElement('option');
                option.value = ward.Id;
                option.textContent = ward.Name;
                selectElement.appendChild(option);
            });
        }
    }

    getProvinceName(provinceId) {
        return this.provinceMap.get(provinceId)?.Name || '';
    }

    getWardName(provinceId, wardId) {
        const key = `${provinceId}-${wardId}`;
        return this.wardMap.get(key)?.Name || '';
    }

    /**
     * Chuẩn hóa tên tỉnh/phường để so khớp.
     * Bỏ dấu và tiền tố Tỉnh/TP/Phường/Xã. Mã tree_2 đã đổi (vd. Thái Nguyên 19 → 41)
     * trong khi đơn vẫn lưu mã cũ kèm tên mới, nên so tên chứ không chỉ so mã.
     */
    _normPlaceName(name) {
        if (!name) return '';
        return String(name)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\u0111/g, 'd')
            .replace(/đ/g, 'd')
            .replace(/^(tinh|thanh pho|tp\.?|phuong|xa|thi tran|thi xa|quan|huyen)\s+/, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    _normAddrName(name) {
        return this._normPlaceName(name);
    }

    _ensureNameIndex() {
        if (this._nameIndex) return;
        const index = new Map();
        const add = (key, provinceId, wardId) => {
            if (!key || key.startsWith('|') || key.endsWith('|')) return;
            let list = index.get(key);
            if (!list) {
                list = [];
                index.set(key, list);
            }
            if (!list.some((x) => x.provinceId === provinceId && x.wardId === wardId)) {
                list.push({ provinceId, wardId });
            }
        };

        for (const province of this.data) {
            const provinceKeys = new Set([
                this._normPlaceName(province.Name),
                this._normPlaceName(province.ShortName)
            ]);
            for (const ward of province.Wards) {
                const wardKeys = new Set([
                    this._normPlaceName(ward.Name),
                    this._normPlaceName(ward.ShortName)
                ]);
                for (const provinceKey of provinceKeys) {
                    for (const wardKey of wardKeys) {
                        add(`${provinceKey}|${wardKey}`, province.Id, ward.Id);
                    }
                }
            }
        }
        this._nameIndex = index;
    }

    _namesMatchPlace(storedName, ...candidates) {
        const stored = this._normPlaceName(storedName);
        if (!stored) return true;
        return candidates.some((name) => name && this._normPlaceName(name) === stored);
    }

    /**
     * Địa chỉ 2 cấp còn nhận được trong tree_2 hiện tại.
     * Khớp mã thì dùng mã. Mã cũ không còn trong cây thì khớp tên tỉnh + phường, chỉ khi đúng một kết quả.
     * Có quận/huyện, hoặc tên không khớp một phường hiện tại → địa chỉ cũ, không đoán.
     */
    resolveStoredAddress(order) {
        const empty = { legacy: false, provinceId: '', wardId: '', matchedBy: 'none' };
        if (!order) return empty;
        if (order.district_id || order.district_name) {
            return { legacy: true, provinceId: '', wardId: '', matchedBy: 'district' };
        }
        if (!this.loaded) return empty;

        const provinceId = order.province_id != null && order.province_id !== ''
            ? String(order.province_id)
            : '';
        const wardId = order.ward_id != null && order.ward_id !== ''
            ? String(order.ward_id)
            : '';
        const wardObj = provinceId && wardId ? this.wardMap.get(`${provinceId}-${wardId}`) : null;
        const provinceObj = provinceId ? this.provinceMap.get(provinceId) : null;

        if (wardObj && provinceObj
            && this._namesMatchPlace(order.province_name, provinceObj.Name, provinceObj.ShortName)
            && this._namesMatchPlace(order.ward_name, wardObj.Name, wardObj.ShortName)) {
            return { legacy: false, provinceId, wardId, matchedBy: 'id' };
        }

        this._ensureNameIndex();
        const nameKey = `${this._normPlaceName(order.province_name)}|${this._normPlaceName(order.ward_name)}`;
        const hits = this._nameIndex.get(nameKey) || [];
        if (hits.length === 1) {
            return {
                legacy: false,
                provinceId: hits[0].provinceId,
                wardId: hits[0].wardId,
                matchedBy: 'name'
            };
        }

        const hasStoredPlace = !!(order.province_name || order.ward_name || provinceId || wardId);
        return {
            legacy: hasStoredPlace,
            provinceId: '',
            wardId: '',
            matchedBy: hits.length > 1 ? 'ambiguous' : 'none'
        };
    }

    /**
     * Đơn lưu theo hệ 3 cấp cũ, hoặc tên tỉnh/phường không còn khớp đúng một nơi trong tree_2.
     */
    isLegacyOrderAddress(order) {
        if (!order) return false;
        return this.resolveStoredAddress(order).legacy;
    }

    /** Ghép địa chỉ hiển thị: legacy dùng tên đã lưu DB, 2 cấp dùng tree_2 theo mã đã giải. */
    formatOrderDisplayAddress(order) {
        if (!order) return 'Chưa có địa chỉ';

        if (this.loaded) {
            const resolved = this.resolveStoredAddress(order);
            if (!resolved.legacy && resolved.provinceId) {
                const parts = [order.street_address || ''];
                const wardName = resolved.wardId
                    ? this.getWardName(resolved.provinceId, resolved.wardId)
                    : '';
                if (wardName) parts.push(wardName);
                else if (order.ward_name) parts.push(order.ward_name);
                const provinceName = this.getProvinceName(resolved.provinceId);
                if (provinceName) parts.push(provinceName);
                else if (order.province_name) parts.push(order.province_name);
                const built = parts.filter(Boolean).join(', ');
                if (built) return built;
            }
        }

        const addrStr = (order.address && String(order.address).trim()) || '';
        const legacy = [
            order.street_address,
            order.ward_name,
            order.district_name,
            order.province_name
        ].filter(Boolean).join(', ');
        return addrStr || legacy || 'Chưa có địa chỉ';
    }

    generateFullAddress(streetAddress, provinceId, wardId) {
        const parts = [
            streetAddress,
            this.getWardName(provinceId, wardId),
            this.getProvinceName(provinceId)
        ].filter(Boolean);

        return parts.join(', ');
    }

    setupCascade(provinceSelect, wardSelect, onChangeCallback) {
        provinceSelect.addEventListener('change', (e) => {
            const provinceId = e.target.value;
            this.renderWards(wardSelect, provinceId);
            if (onChangeCallback) onChangeCallback();
        });

        if (onChangeCallback) {
            wardSelect.addEventListener('change', onChangeCallback);
        }
    }

    setAddress({ province_id, ward_id }) {
        const provinceSelect = document.getElementById('newOrderProvince');
        const wardSelect = document.getElementById('newOrderWard');

        if (!provinceSelect || !wardSelect) {
            console.error('Address select elements not found');
            return;
        }

        if (province_id) {
            provinceSelect.value = province_id;
            this.renderWards(wardSelect, province_id);

            setTimeout(() => {
                if (ward_id) {
                    wardSelect.value = ward_id;
                }
            }, 100);
        }
    }
}

window.addressSelector = new AddressSelector();

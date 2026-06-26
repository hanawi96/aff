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
                ? '../assets/data/tree_2.json'
                : '/assets/data/tree_2.json';

            const response = await fetch(basePath);
            const raw = await response.json();

            this.data = [];

            for (const province of raw) {
                const provinceObj = {
                    Id: province.code,
                    Name: province.fullName,
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

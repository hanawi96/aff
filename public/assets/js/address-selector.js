/**
 * Address Selector Module
 * Quản lý cascade dropdown cho địa chỉ Việt Nam (Tỉnh > Quận > Phường)
 * Tối ưu với Map lookup O(1)
 */

class AddressSelector {
    constructor() {
        this.data = [];
        this.provinceMap = new Map();
        this.districtMap = new Map();
        this.wardMap = new Map();
        this.loaded = false;
    }

    /**
     * Load và index dữ liệu địa chỉ
     */
    async init() {
        if (this.loaded) return;

        try {
            // Detect correct path based on current location
            const basePath = window.location.pathname.includes('/admin/') 
                ? '../assets/data/vietnamAddress.json' 
                : '/assets/data/vietnamAddress.json';
            
            const response = await fetch(basePath);
            this.data = await response.json();
            
            // Index data để lookup nhanh O(1)
            this.data.forEach(province => {
                this.provinceMap.set(province.Id, province);
                
                province.Districts.forEach(district => {
                    const districtKey = `${province.Id}-${district.Id}`;
                    this.districtMap.set(districtKey, district);
                    
                    district.Wards.forEach(ward => {
                        const wardKey = `${province.Id}-${district.Id}-${ward.Id}`;
                        this.wardMap.set(wardKey, ward);
                    });
                });
            });
            
            this.loaded = true;
        } catch (error) {
            console.error('Lỗi load địa chỉ:', error);
            throw error;
        }
    }

    /**
     * Render dropdown tỉnh/thành
     */
    renderProvinces(selectElement) {
        selectElement.innerHTML = '<option value="">-- Chọn Tỉnh/Thành phố --</option>';
        this.data.forEach(province => {
            const option = document.createElement('option');
            option.value = province.Id;
            option.textContent = province.Name;
            selectElement.appendChild(option);
        });
    }

    /**
     * Render dropdown quận/huyện
     */
    renderDistricts(selectElement, provinceId) {
        selectElement.innerHTML = '<option value="">-- Chọn Quận/Huyện --</option>';
        
        if (!provinceId) {
            selectElement.disabled = true;
            return;
        }

        const province = this.provinceMap.get(provinceId);
        if (province) {
            province.Districts.forEach(district => {
                const option = document.createElement('option');
                option.value = district.Id;
                option.textContent = district.Name;
                selectElement.appendChild(option);
            });
            selectElement.disabled = false;
        }
    }

    /**
     * Render dropdown phường/xã
     */
    renderWards(selectElement, provinceId, districtId) {
        selectElement.innerHTML = '<option value="">-- Chọn Phường/Xã --</option>';
        
        if (!provinceId || !districtId) {
            selectElement.disabled = true;
            return;
        }

        const districtKey = `${provinceId}-${districtId}`;
        const district = this.districtMap.get(districtKey);
        
        if (district) {
            district.Wards.forEach(ward => {
                const option = document.createElement('option');
                option.value = ward.Id;
                option.textContent = ward.Name;
                selectElement.appendChild(option);
            });
            selectElement.disabled = false;
        }
    }

    /**
     * Lấy tên từ ID (O(1) lookup)
     */
    getProvinceName(provinceId) {
        return this.provinceMap.get(provinceId)?.Name || '';
    }

    getDistrictName(provinceId, districtId) {
        const key = `${provinceId}-${districtId}`;
        return this.districtMap.get(key)?.Name || '';
    }

    getWardName(provinceId, districtId, wardId) {
        const key = `${provinceId}-${districtId}-${wardId}`;
        return this.wardMap.get(key)?.Name || '';
    }

    /**
     * Tạo địa chỉ đầy đủ
     */
    generateFullAddress(streetAddress, provinceId, districtId, wardId) {
        const parts = [
            streetAddress,
            this.getWardName(provinceId, districtId, wardId),
            this.getDistrictName(provinceId, districtId),
            this.getProvinceName(provinceId)
        ].filter(Boolean);
        
        return parts.join(', ');
    }

    /**
     * Setup cascade cho form
     */
    setupCascade(provinceSelect, districtSelect, wardSelect, onChangeCallback) {
        // Province change
        provinceSelect.addEventListener('change', (e) => {
            const provinceId = e.target.value;
            this.renderDistricts(districtSelect, provinceId);
            wardSelect.innerHTML = '<option value="">-- Chọn Phường/Xã --</option>';
            wardSelect.disabled = true;
            if (onChangeCallback) onChangeCallback();
        });

        // District change
        districtSelect.addEventListener('change', (e) => {
            const provinceId = provinceSelect.value;
            const districtId = e.target.value;
            this.renderWards(wardSelect, provinceId, districtId);
            if (onChangeCallback) onChangeCallback();
        });

        // Ward change
        if (onChangeCallback) {
            wardSelect.addEventListener('change', onChangeCallback);
        }
    }

    /**
     * Set address programmatically (for auto-fill)
     */
    setAddress({ province_id, district_id, ward_id }) {
        const provinceSelect = document.getElementById('newOrderProvince');
        const districtSelect = document.getElementById('newOrderDistrict');
        const wardSelect = document.getElementById('newOrderWard');

        if (!provinceSelect || !districtSelect || !wardSelect) {
            console.error('Address select elements not found');
            return;
        }

        // Set province
        if (province_id) {
            provinceSelect.value = province_id;
            this.renderDistricts(districtSelect, province_id);

            // Set district after a short delay
            setTimeout(() => {
                if (district_id) {
                    districtSelect.value = district_id;
                    this.renderWards(wardSelect, province_id, district_id);

                    // Set ward after another short delay
                    setTimeout(() => {
                        if (ward_id) {
                            wardSelect.value = ward_id;
                        }
                    }, 100);
                }
            }, 100);
        }
    }
}

// Export singleton instance
window.addressSelector = new AddressSelector();

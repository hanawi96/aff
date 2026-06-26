// ============================================
// ADDRESS SERVICE - Vietnam Address Data (2 cấp)
// ============================================

class AddressService {
    constructor() {
        this.addressData = null;
        this.loaded = false;
    }

    /**
     * Load address data from tree_2.json (2 cấp: Tỉnh/TP → Phường/Xã)
     */
    async loadAddressData() {
        if (this.loaded) return this.addressData;

        try {
            let basePath;
            const pathname = window.location.pathname;

            if (pathname.includes('/shop/')) {
                basePath = '../assets/data/tree_2.json';
            } else if (pathname.includes('/admin/')) {
                basePath = '../assets/data/tree_2.json';
            } else {
                basePath = '/assets/data/tree_2.json';
            }

            const response = await fetch(basePath);
            if (!response.ok) {
                throw new Error('Failed to load address data');
            }
            const raw = await response.json();

            // Convert array to object keyed by province code for fast lookup
            this.addressData = {};
            for (const province of raw) {
                this.addressData[province.code] = province;
            }

            this.loaded = true;
            console.log('✅ Address data loaded:', Object.keys(this.addressData).length, 'provinces');
            return this.addressData;
        } catch (error) {
            console.error('Error loading address data:', error);
            this.addressData = {};
            return this.addressData;
        }
    }

    /**
     * Get all provinces/cities
     */
    getProvinces() {
        if (!this.addressData) return [];

        return Object.keys(this.addressData).map(code => {
            const p = this.addressData[code];
            return {
                code: code,
                name: p.name,
                nameWithType: p.fullName,
                type: p.type
            };
        });
    }

    /**
     * Get wards by province code (2 cấp — phường/xã nằm trực tiếp trong tỉnh)
     */
    getWards(provinceCode) {
        if (!this.addressData || !provinceCode) return [];

        const province = this.addressData[provinceCode];
        if (!province || !province.wards) return [];

        return province.wards.map(w => {
            const shortLabel = w.fullName && w.fullName.includes(',')
                ? w.fullName.split(',')[0].trim()
                : w.fullName;
            return {
                code: w.code,
                name: w.name,
                nameWithType: shortLabel,
                type: w.type
            };
        });
    }

    /**
     * Get full address string (2 cấp: street, ward, province)
     */
    getFullAddress(provinceCode, wardCode, street) {
        if (!this.addressData) return '';

        const parts = [];

        if (street) parts.push(street);

        if (wardCode && provinceCode) {
            const province = this.addressData[provinceCode];
            if (province && province.wards) {
                const ward = province.wards.find(w => w.code === wardCode);
                if (ward) {
                    const label = ward.fullName && ward.fullName.includes(',')
                        ? ward.fullName.split(',')[0].trim()
                        : ward.fullName;
                    parts.push(label);
                }
            }
        }

        if (provinceCode) {
            const province = this.addressData[provinceCode];
            if (province) parts.push(province.fullName);
        }

        return parts.join(', ');
    }
}

// Export singleton instance
export const addressService = new AddressService();

// ============================================
// ADDRESS SERVICE - Vietnam Address Data
// ============================================

class AddressService {
    constructor() {
        this.addressData = null;
        this.loaded = false;
    }
    
    /**
     * Load address data from tree.json
     */
    async loadAddressData() {
        if (this.loaded) return this.addressData;
        
        try {
            // Determine correct path based on current location
            let basePath;
            const pathname = window.location.pathname;
            
            if (pathname.includes('/shop/')) {
                // From shop directory
                basePath = '../assets/data/tree.json';
            } else if (pathname.includes('/admin/')) {
                // From admin directory
                basePath = '../assets/data/tree.json';
            } else {
                // From root or other locations
                basePath = '/assets/data/tree.json';
            }
            
            const response = await fetch(basePath);
            if (!response.ok) {
                throw new Error('Failed to load address data');
            }
            this.addressData = await response.json();
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
        
        return Object.keys(this.addressData).map(code => ({
            code: code,
            name: this.addressData[code].name,
            nameWithType: this.addressData[code].name_with_type,
            type: this.addressData[code].type
        }));
    }
    
    /**
     * Get districts by province code
     */
    getDistricts(provinceCode) {
        if (!this.addressData || !provinceCode) return [];
        
        const province = this.addressData[provinceCode];
        if (!province || !province['quan-huyen']) return [];
        
        return Object.keys(province['quan-huyen']).map(code => ({
            code: code,
            name: province['quan-huyen'][code].name,
            nameWithType: province['quan-huyen'][code].name_with_type,
            type: province['quan-huyen'][code].type
        }));
    }
    
    /**
     * Get wards by district code
     */
    getWards(provinceCode, districtCode) {
        if (!this.addressData || !provinceCode || !districtCode) return [];
        
        const province = this.addressData[provinceCode];
        if (!province || !province['quan-huyen']) return [];
        
        const district = province['quan-huyen'][districtCode];
        if (!district || !district['xa-phuong']) return [];
        
        return Object.keys(district['xa-phuong']).map(code => ({
            code: code,
            name: district['xa-phuong'][code].name,
            nameWithType: district['xa-phuong'][code].name_with_type,
            type: district['xa-phuong'][code].type
        }));
    }
    
    /**
     * Get full address string
     */
    getFullAddress(provinceCode, districtCode, wardCode, street) {
        if (!this.addressData) return '';
        
        const parts = [];
        
        if (street) parts.push(street);
        
        if (wardCode && provinceCode && districtCode) {
            const ward = this.addressData[provinceCode]?.['quan-huyen']?.[districtCode]?.['xa-phuong']?.[wardCode];
            if (ward) parts.push(ward.name_with_type);
        }
        
        if (districtCode && provinceCode) {
            const district = this.addressData[provinceCode]?.['quan-huyen']?.[districtCode];
            if (district) parts.push(district.name_with_type);
        }
        
        if (provinceCode) {
            const province = this.addressData[provinceCode];
            if (province) parts.push(province.name_with_type);
        }
        
        return parts.join(', ');
    }
}

// Export singleton instance
export const addressService = new AddressService();

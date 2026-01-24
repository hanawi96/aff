// ============================================
// ADDRESS SELECTOR COMPONENT
// ============================================

import { addressService } from '../shared/services/address.service.js';

/**
 * Address Selector Component
 */
export class AddressSelector {
    constructor(containerId) {
        this.containerId = containerId;
        this.provinceCode = '';
        this.districtCode = '';
        this.wardCode = '';
        this.street = '';
    }
    
    /**
     * Initialize address selector
     */
    async init() {
        await addressService.loadAddressData();
        this.render();
        this.setupEventListeners();
    }
    
    /**
     * Render address selector
     */
    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;
        
        let html = '<div class="address-selector-grid">';
        
        // Province/City
        html += '<div class="address-selector-item">';
        html += '<select class="checkout-form-select" id="provinceSelect">';
        html += '<option value="">-- Chọn Tỉnh/Thành phố --</option>';
        const provinces = addressService.getProvinces();
        provinces.forEach(province => {
            html += '<option value="' + province.code + '">' + province.nameWithType + '</option>';
        });
        html += '</select>';
        html += '</div>';
        
        // District
        html += '<div class="address-selector-item">';
        html += '<select class="checkout-form-select" id="districtSelect" disabled>';
        html += '<option value="">-- Chọn Quận/Huyện --</option>';
        html += '</select>';
        html += '</div>';
        
        // Ward
        html += '<div class="address-selector-item">';
        html += '<select class="checkout-form-select" id="wardSelect" disabled>';
        html += '<option value="">-- Chọn Phường/Xã --</option>';
        html += '</select>';
        html += '</div>';
        
        // Street
        html += '<div class="address-selector-item">';
        html += '<input type="text" class="checkout-form-input" id="streetInput" ';
        html += 'placeholder="Số nhà, tên đường" disabled>';
        html += '</div>';
        
        html += '</div>';
        
        // Full address display
        html += '<div class="address-display" id="addressDisplay">';
        html += '<div class="address-display-label">Địa chỉ đầy đủ:</div>';
        html += '<div class="address-display-text">Vui lòng chọn địa chỉ</div>';
        html += '</div>';
        
        container.innerHTML = html;
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        const provinceSelect = document.getElementById('provinceSelect');
        const districtSelect = document.getElementById('districtSelect');
        const wardSelect = document.getElementById('wardSelect');
        const streetInput = document.getElementById('streetInput');
        
        if (provinceSelect) {
            provinceSelect.addEventListener('change', (e) => {
                this.provinceCode = e.target.value;
                this.districtCode = '';
                this.wardCode = '';
                this.street = '';
                this.updateDistricts();
                this.updateFullAddress();
            });
        }
        
        if (districtSelect) {
            districtSelect.addEventListener('change', (e) => {
                this.districtCode = e.target.value;
                this.wardCode = '';
                this.street = '';
                this.updateWards();
                this.updateFullAddress();
            });
        }
        
        if (wardSelect) {
            wardSelect.addEventListener('change', (e) => {
                this.wardCode = e.target.value;
                this.updateFullAddress();
                
                // Enable street input
                if (streetInput) {
                    streetInput.disabled = false;
                    streetInput.focus();
                }
            });
        }
        
        if (streetInput) {
            streetInput.addEventListener('input', (e) => {
                this.street = e.target.value.trim();
                this.updateFullAddress();
            });
        }
    }
    
    /**
     * Update districts dropdown
     */
    updateDistricts() {
        const districtSelect = document.getElementById('districtSelect');
        const wardSelect = document.getElementById('wardSelect');
        const streetInput = document.getElementById('streetInput');
        
        if (!districtSelect) return;
        
        if (!this.provinceCode) {
            districtSelect.disabled = true;
            districtSelect.innerHTML = '<option value="">-- Chọn Quận/Huyện --</option>';
            wardSelect.disabled = true;
            wardSelect.innerHTML = '<option value="">-- Chọn Phường/Xã --</option>';
            streetInput.disabled = true;
            streetInput.value = '';
            return;
        }
        
        const districts = addressService.getDistricts(this.provinceCode);
        
        let html = '<option value="">-- Chọn Quận/Huyện --</option>';
        districts.forEach(district => {
            html += '<option value="' + district.code + '">' + district.nameWithType + '</option>';
        });
        
        districtSelect.innerHTML = html;
        districtSelect.disabled = false;
        
        // Reset wards and street
        wardSelect.disabled = true;
        wardSelect.innerHTML = '<option value="">-- Chọn Phường/Xã --</option>';
        streetInput.disabled = true;
        streetInput.value = '';
    }
    
    /**
     * Update wards dropdown
     */
    updateWards() {
        const wardSelect = document.getElementById('wardSelect');
        const streetInput = document.getElementById('streetInput');
        
        if (!wardSelect) return;
        
        if (!this.districtCode) {
            wardSelect.disabled = true;
            wardSelect.innerHTML = '<option value="">-- Chọn Phường/Xã --</option>';
            streetInput.disabled = true;
            streetInput.value = '';
            return;
        }
        
        const wards = addressService.getWards(this.provinceCode, this.districtCode);
        
        let html = '<option value="">-- Chọn Phường/Xã --</option>';
        wards.forEach(ward => {
            html += '<option value="' + ward.code + '">' + ward.nameWithType + '</option>';
        });
        
        wardSelect.innerHTML = html;
        wardSelect.disabled = false;
        
        // Reset street
        streetInput.disabled = true;
        streetInput.value = '';
    }
    
    /**
     * Update full address display
     */
    updateFullAddress() {
        const display = document.getElementById('addressDisplay');
        if (!display) return;
        
        const fullAddress = addressService.getFullAddress(
            this.provinceCode,
            this.districtCode,
            this.wardCode,
            this.street
        );
        
        const textElement = display.querySelector('.address-display-text');
        if (textElement) {
            textElement.textContent = fullAddress || 'Vui lòng chọn địa chỉ';
        }
    }
    
    /**
     * Get address data
     */
    getAddressData() {
        return {
            provinceCode: this.provinceCode,
            districtCode: this.districtCode,
            wardCode: this.wardCode,
            street: this.street,
            fullAddress: addressService.getFullAddress(
                this.provinceCode,
                this.districtCode,
                this.wardCode,
                this.street
            )
        };
    }
    
    /**
     * Validate address
     */
    validate() {
        if (!this.provinceCode) {
            return { isValid: false, message: 'Vui lòng chọn Tỉnh/Thành phố' };
        }
        if (!this.districtCode) {
            return { isValid: false, message: 'Vui lòng chọn Quận/Huyện' };
        }
        if (!this.wardCode) {
            return { isValid: false, message: 'Vui lòng chọn Phường/Xã' };
        }
        if (!this.street) {
            return { isValid: false, message: 'Vui lòng nhập số nhà, tên đường' };
        }
        return { isValid: true };
    }
    
    /**
     * Reset address selector
     */
    reset() {
        this.provinceCode = '';
        this.districtCode = '';
        this.wardCode = '';
        this.street = '';
        
        const provinceSelect = document.getElementById('provinceSelect');
        const districtSelect = document.getElementById('districtSelect');
        const wardSelect = document.getElementById('wardSelect');
        const streetInput = document.getElementById('streetInput');
        
        if (provinceSelect) provinceSelect.value = '';
        if (districtSelect) {
            districtSelect.value = '';
            districtSelect.disabled = true;
            districtSelect.innerHTML = '<option value="">-- Chọn Quận/Huyện --</option>';
        }
        if (wardSelect) {
            wardSelect.value = '';
            wardSelect.disabled = true;
            wardSelect.innerHTML = '<option value="">-- Chọn Phường/Xã --</option>';
        }
        if (streetInput) {
            streetInput.value = '';
            streetInput.disabled = true;
        }
        
        this.updateFullAddress();
    }
}

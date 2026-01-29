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
        
        // Detect if mobile device
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
                        || window.innerWidth <= 768;
        
        if (provinceSelect) {
            provinceSelect.addEventListener('change', (e) => {
                this.provinceCode = e.target.value;
                this.districtCode = '';
                this.wardCode = '';
                this.street = '';
                this.updateDistricts();
                this.updateFullAddress();
                
                // Auto-open district dropdown ONLY on desktop
                if (!isMobile && e.isTrusted && this.provinceCode) {
                    this.autoOpenDropdown(districtSelect);
                }
            });
        }
        
        if (districtSelect) {
            districtSelect.addEventListener('change', (e) => {
                this.districtCode = e.target.value;
                this.wardCode = '';
                this.street = '';
                this.updateWards();
                this.updateFullAddress();
                
                // Auto-open ward dropdown ONLY on desktop
                if (!isMobile && e.isTrusted && this.districtCode) {
                    this.autoOpenDropdown(wardSelect);
                }
            });
        }
        
        if (wardSelect) {
            wardSelect.addEventListener('change', (e) => {
                this.wardCode = e.target.value;
                this.updateFullAddress();
                
                // Enable and focus street input
                if (streetInput && this.wardCode) {
                    streetInput.disabled = false;
                    
                    // On mobile: just focus without scroll
                    // On desktop: scroll and focus
                    if (isMobile) {
                        // Simple focus for mobile
                        setTimeout(() => {
                            streetInput.focus();
                        }, 100);
                    } else {
                        // Scroll to street input if user interaction on desktop
                        if (e.isTrusted) {
                            streetInput.scrollIntoView({ 
                                behavior: 'smooth', 
                                block: 'center',
                                inline: 'nearest'
                            });
                            
                            // Focus after scroll
                            setTimeout(() => {
                                streetInput.focus();
                            }, 300);
                        } else {
                            // Just focus if programmatic
                            streetInput.focus();
                        }
                    }
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
     * Auto-open dropdown after options loaded
     * @param {HTMLSelectElement} selectElement 
     */
    autoOpenDropdown(selectElement) {
        if (!selectElement || selectElement.disabled) return;
        
        // Wait for DOM update and options to be populated
        requestAnimationFrame(() => {
            // Check if select has options (more than just placeholder)
            if (selectElement.options.length > 1) {
                // Scroll to element smoothly
                selectElement.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center',
                    inline: 'nearest'
                });
                
                // Focus the select after scroll starts
                setTimeout(() => {
                    selectElement.focus();
                    
                    // Try modern showPicker API (Chrome 99+, Edge 99+)
                    if (typeof selectElement.showPicker === 'function') {
                        try {
                            selectElement.showPicker();
                        } catch (e) {
                            // Fallback: simulate click
                            this.simulateClick(selectElement);
                        }
                    } else {
                        // Fallback for older browsers
                        this.simulateClick(selectElement);
                    }
                }, 300); // Wait for smooth scroll to complete
            }
        });
    }
    
    /**
     * Simulate click to open dropdown (fallback)
     * @param {HTMLSelectElement} selectElement 
     */
    simulateClick(selectElement) {
        const event = new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            view: window
        });
        selectElement.dispatchEvent(event);
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
        // Get names from addressService
        const provinceName = this.provinceCode ? 
            addressService.addressData?.[this.provinceCode]?.name_with_type || null : null;
        
        const districtName = (this.provinceCode && this.districtCode) ?
            addressService.addressData?.[this.provinceCode]?.['quan-huyen']?.[this.districtCode]?.name_with_type || null : null;
        
        const wardName = (this.provinceCode && this.districtCode && this.wardCode) ?
            addressService.addressData?.[this.provinceCode]?.['quan-huyen']?.[this.districtCode]?.['xa-phuong']?.[this.wardCode]?.name_with_type || null : null;
        
        return {
            provinceCode: this.provinceCode,
            provinceName: provinceName,
            districtCode: this.districtCode,
            districtName: districtName,
            wardCode: this.wardCode,
            wardName: wardName,
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
    
    /**
     * Fill demo data for testing
     */
    async fillDemoData() {
        // Demo: TP Hồ Chí Minh > Quận 1 > Phường Bến Nghé
        const provinceSelect = document.getElementById('provinceSelect');
        const districtSelect = document.getElementById('districtSelect');
        const wardSelect = document.getElementById('wardSelect');
        const streetInput = document.getElementById('streetInput');
        
        // Select TP Hồ Chí Minh (code: 79)
        if (provinceSelect) {
            provinceSelect.value = '79';
            this.provinceCode = '79';
            
            // Trigger change event to load districts
            const event = new Event('change', { bubbles: true });
            provinceSelect.dispatchEvent(event);
        }
        
        // Wait for districts to load
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Select Quận 1 (code: 760)
        if (districtSelect && !districtSelect.disabled) {
            districtSelect.value = '760';
            this.districtCode = '760';
            
            // Trigger change event to load wards
            const event = new Event('change', { bubbles: true });
            districtSelect.dispatchEvent(event);
        }
        
        // Wait for wards to load
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Select Phường Bến Nghé (code: 26734)
        if (wardSelect && !wardSelect.disabled) {
            wardSelect.value = '26734';
            this.wardCode = '26734';
            
            // Trigger change event
            const event = new Event('change', { bubbles: true });
            wardSelect.dispatchEvent(event);
        }
        
        // Fill street
        if (streetInput && !streetInput.disabled) {
            streetInput.value = '123 Nguyễn Huệ';
            this.street = '123 Nguyễn Huệ';
            this.updateFullAddress();
        }
    }
    
    /**
     * Restore address from saved data
     */
    async restoreAddress(addressData) {
        if (!addressData) return;
        
        try {
            const provinceSelect = document.getElementById('provinceSelect');
            const districtSelect = document.getElementById('districtSelect');
            const wardSelect = document.getElementById('wardSelect');
            const streetInput = document.getElementById('streetInput');
            
            // Restore province
            if (addressData.provinceCode && provinceSelect) {
                provinceSelect.value = addressData.provinceCode;
                this.provinceCode = addressData.provinceCode;
                
                // Trigger change event to load districts
                const provinceEvent = new Event('change', { bubbles: true });
                provinceSelect.dispatchEvent(provinceEvent);
                
                // Wait for districts to load
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            // Restore district
            if (addressData.districtCode && districtSelect) {
                districtSelect.value = addressData.districtCode;
                this.districtCode = addressData.districtCode;
                
                // Trigger change event to load wards
                const districtEvent = new Event('change', { bubbles: true });
                districtSelect.dispatchEvent(districtEvent);
                
                // Wait for wards to load
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            // Restore ward
            if (addressData.wardCode && wardSelect) {
                wardSelect.value = addressData.wardCode;
                this.wardCode = addressData.wardCode;
                
                // Trigger change event
                const wardEvent = new Event('change', { bubbles: true });
                wardSelect.dispatchEvent(wardEvent);
            }
            
            // Restore street
            if (addressData.street && streetInput) {
                streetInput.value = addressData.street;
                this.street = addressData.street;
            }
            
            this.updateFullAddress();
            
            console.log('✅ Address restored:', addressData);
        } catch (error) {
            console.error('Error restoring address:', error);
        }
    }
}
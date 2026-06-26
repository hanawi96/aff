// ============================================
// ADDRESS SELECTOR COMPONENT (2 cấp: Tỉnh/TP → Phường/Xã)
// ============================================

import { addressService } from '../shared/services/address.service.js';

export class AddressSelector {
    constructor(containerId) {
        this.containerId = containerId;
        this.provinceCode = '';
        this.wardCode = '';
        this.street = '';
    }

    async init() {
        await addressService.loadAddressData();
        this.render();
        this.setupEventListeners();
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        let html = '<div class="address-selector-grid">';

        html += '<div class="address-selector-item">';
        html += '<select class="checkout-form-select" id="provinceSelect">';
        html += '<option value="">-- Chọn Tỉnh/Thành phố --</option>';
        const provinces = addressService.getProvinces();
        provinces.forEach(province => {
            html += '<option value="' + province.code + '">' + province.nameWithType + '</option>';
        });
        html += '</select></div>';

        html += '<div class="address-selector-item">';
        html += '<select class="checkout-form-select" id="wardSelect" disabled>';
        html += '<option value="">-- Chọn Phường/Xã --</option>';
        html += '</select></div>';

        html += '<div class="address-selector-item">';
        html += '<input type="text" class="checkout-form-input" id="streetInput" placeholder="Số nhà, tên đường" disabled>';
        html += '</div>';

        html += '</div>';

        html += '<div class="address-display hidden" id="addressDisplay">';
        html += '<div class="address-display-label">Địa chỉ đầy đủ:</div>';
        html += '<div class="address-display-text">Vui lòng chọn địa chỉ</div>';
        html += '</div>';

        container.innerHTML = html;
    }

    setupEventListeners() {
        const provinceSelect = document.getElementById('provinceSelect');
        const wardSelect = document.getElementById('wardSelect');
        const streetInput = document.getElementById('streetInput');

        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
                        || window.innerWidth <= 768;

        if (provinceSelect) {
            provinceSelect.addEventListener('change', (e) => {
                this.provinceCode = e.target.value;
                this.wardCode = '';
                this.street = '';
                this.updateWards();
                this.updateFullAddress();

                const addressDisplay = document.getElementById('addressDisplay');
                if (addressDisplay) {
                    if (this.provinceCode) addressDisplay.classList.remove('hidden');
                    else addressDisplay.classList.add('hidden');
                }

                if (!isMobile && e.isTrusted && this.provinceCode) {
                    this.autoOpenDropdown(wardSelect);
                }
            });
        }

        if (wardSelect) {
            wardSelect.addEventListener('change', (e) => {
                this.wardCode = e.target.value;
                this.updateFullAddress();
                const streetItem = document.getElementById('streetItem');
                if (streetInput && this.wardCode) {
                    streetItem?.classList.remove('hidden');
                    streetInput.disabled = false;
                    if (isMobile) {
                        setTimeout(() => streetInput.focus(), 100);
                    } else {
                        if (e.isTrusted) {
                            streetInput.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                            setTimeout(() => streetInput.focus(), 300);
                        } else {
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

    autoOpenDropdown(selectElement) {
        if (!selectElement || selectElement.disabled) return;
        requestAnimationFrame(() => {
            if (selectElement.options.length > 1) {
                selectElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                setTimeout(() => {
                    selectElement.focus();
                    if (typeof selectElement.showPicker === 'function') {
                        try { selectElement.showPicker(); } catch (e) { this.simulateClick(selectElement); }
                    } else {
                        this.simulateClick(selectElement);
                    }
                }, 300);
            }
        });
    }

    simulateClick(selectElement) {
        const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window });
        selectElement.dispatchEvent(event);
    }

    updateWards() {
        const wardSelect = document.getElementById('wardSelect');
        const wardItem = document.getElementById('wardItem');
        const streetInput = document.getElementById('streetInput');
        const streetItem = document.getElementById('streetItem');
        if (!wardSelect) return;

        if (!this.provinceCode) {
            wardItem?.classList.add('hidden');
            streetItem?.classList.add('hidden');
            wardSelect.disabled = true;
            wardSelect.innerHTML = '<option value="">-- Chọn Phường/Xã --</option>';
            streetInput.disabled = true;
            streetInput.value = '';
            return;
        }

        const wards = addressService.getWards(this.provinceCode);
        let html = '<option value="">-- Chọn Phường/Xã --</option>';
        wards.forEach(ward => {
            html += '<option value="' + ward.code + '">' + ward.nameWithType + '</option>';
        });
        wardSelect.innerHTML = html;
        wardSelect.disabled = false;
        wardItem?.classList.remove('hidden');
        streetItem?.classList.add('hidden');
        streetInput.disabled = true;
        streetInput.value = '';
    }

    updateFullAddress() {
        const display = document.getElementById('addressDisplay');
        if (!display) return;
        const fullAddress = addressService.getFullAddress(this.provinceCode, this.wardCode, this.street);
        const textElement = display.querySelector('.address-display-text');
        if (textElement) textElement.textContent = fullAddress || 'Vui lòng chọn địa chỉ';
    }

    getAddressData() {
        const provinceName = this.provinceCode ?
            addressService.addressData?.[this.provinceCode]?.fullName || null : null;

        let wardName = null;
        if (this.provinceCode && this.wardCode) {
            const province = addressService.addressData?.[this.provinceCode];
            if (province?.wards) {
                const ward = province.wards.find(w => String(w.code) === String(this.wardCode));
                wardName = ward?.fullName || null;
            }
        }

        return {
            provinceCode: this.provinceCode,
            provinceName: provinceName,
            districtCode: null,
            districtName: null,
            wardCode: this.wardCode,
            wardName: wardName,
            street: this.street,
            fullAddress: addressService.getFullAddress(this.provinceCode, this.wardCode, this.street)
        };
    }

    validate() {
        if (!this.provinceCode) return { isValid: false, message: 'Vui lòng chọn Tỉnh/Thành phố' };
        if (!this.wardCode) return { isValid: false, message: 'Vui lòng chọn Phường/Xã' };
        if (!this.street) return { isValid: false, message: 'Vui lòng nhập số nhà, tên đường' };
        return { isValid: true };
    }

    reset() {
        this.provinceCode = '';
        this.wardCode = '';
        this.street = '';
        const provinceSelect = document.getElementById('provinceSelect');
        const wardSelect = document.getElementById('wardSelect');
        const streetInput = document.getElementById('streetInput');
        if (provinceSelect) provinceSelect.value = '';
        if (wardSelect) { wardSelect.value = ''; wardSelect.disabled = true; wardSelect.innerHTML = '<option value="">-- Chọn Phường/Xã --</option>'; }
        if (streetInput) { streetInput.value = ''; streetInput.disabled = true; }
        this.updateFullAddress();
    }

    async fillDemoData() {
        const provinceSelect = document.getElementById('provinceSelect');
        const wardSelect = document.getElementById('wardSelect');
        const streetInput = document.getElementById('streetInput');
        if (provinceSelect) {
            provinceSelect.value = '79';
            this.provinceCode = '79';
            const event = new Event('change', { bubbles: true });
            provinceSelect.dispatchEvent(event);
        }
        await new Promise(resolve => setTimeout(resolve, 300));
        if (wardSelect && !wardSelect.disabled) {
            const firstWard = wardSelect.options[1]?.value;
            if (firstWard) {
                wardSelect.value = firstWard;
                this.wardCode = firstWard;
                const event = new Event('change', { bubbles: true });
                wardSelect.dispatchEvent(event);
            }
        }
        if (streetInput && !streetInput.disabled) {
            streetInput.value = '123 Nguyễn Huệ';
            this.street = '123 Nguyễn Huệ';
            this.updateFullAddress();
        }
    }

    async restoreAddress(addressData) {
        if (!addressData) return;
        try {
            const provinceSelect = document.getElementById('provinceSelect');
            const wardSelect = document.getElementById('wardSelect');
            const streetInput = document.getElementById('streetInput');
            if (addressData.provinceCode && provinceSelect) {
                provinceSelect.value = addressData.provinceCode;
                this.provinceCode = addressData.provinceCode;
                const provinceEvent = new Event('change', { bubbles: true });
                provinceSelect.dispatchEvent(provinceEvent);
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            if (addressData.wardCode && wardSelect) {
                wardSelect.value = addressData.wardCode;
                this.wardCode = addressData.wardCode;
                const wardEvent = new Event('change', { bubbles: true });
                wardSelect.dispatchEvent(wardEvent);
            }
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

/**
 * Orders Address Selector (2 cấp: Tỉnh/TP → Phường/Xã)
 * Desktop: searchable combobox + hidden selects (smart-paste / submit tương thích)
 *
 * Dependencies:
 * - window.addressSelector from address-selector.js
 * - DeskAddressCombobox from orders-desk-address-combobox.js
 */

function syncOrderAddressPreview(fullAddress, previewEl) {
    const el = previewEl || document.getElementById('newOrderAddressPreview');
    if (!el) return;
    const body = (fullAddress && String(fullAddress).trim()) || '';
    if (!body) {
        el.textContent = '';
        el.classList.add('hidden');
        return;
    }
    el.textContent = `Địa chỉ đầy đủ: ${body}`;
    el.classList.remove('hidden');
}

function isOrderAddressPreviewEmpty(previewText) {
    if (!previewText) return true;
    const t = String(previewText).trim();
    if (!t) return true;
    return t === 'Vui lòng chọn địa chỉ' || t === 'Địa chỉ đầy đủ: Vui lòng chọn địa chỉ';
}

async function initAddressSelector(duplicateData = null) {
    if (typeof destroyDeskAddressCombobox === 'function') {
        destroyDeskAddressCombobox();
    }

    const streetInput = document.getElementById('newOrderStreetAddress');
    const addressPreview = document.getElementById('newOrderAddressPreview');
    const hiddenAddress = document.getElementById('newOrderAddress');
    const comboMount = document.getElementById('deskAddressCombobox');

    function updateAddressPreview() {
        const provinceSelect = document.getElementById('newOrderProvince');
        const wardSelect = document.getElementById('newOrderWard');
        const provinceId = provinceSelect?.value || '';
        const wardId = wardSelect?.value || '';
        const street = streetInput?.value?.trim() || '';

        const fullAddress = window.addressSelector.generateFullAddress(
            street,
            provinceId,
            wardId
        );

        syncOrderAddressPreview(fullAddress, addressPreview);
        if (hiddenAddress) {
            hiddenAddress.value = fullAddress;
        }
    }

    if (!comboMount || typeof DeskAddressCombobox === 'undefined') {
        console.warn('[Address] Combobox unavailable — fallback to native selects');
        if (!window.addressSelector.loaded) {
            await window.addressSelector.init();
        }
        const provinceSelect = document.getElementById('newOrderProvince');
        const wardSelect = document.getElementById('newOrderWard');
        window.addressSelector.renderProvinces(provinceSelect);
        if (duplicateData?.province_id) {
            const provinceId = String(duplicateData.province_id);
            provinceSelect.value = provinceId;
            window.addressSelector.renderWards(wardSelect, provinceId);
            if (duplicateData.ward_id) {
                wardSelect.value = String(duplicateData.ward_id);
            }
            if (duplicateData.street_address && streetInput) {
                streetInput.value = duplicateData.street_address;
            }
        }
        window.addressSelector.setupCascade(provinceSelect, wardSelect, updateAddressPreview);
        if (streetInput) streetInput.addEventListener('input', updateAddressPreview);
        updateAddressPreview();
        return;
    }

    const combo = new DeskAddressCombobox({
        container: comboMount,
        onChange: updateAddressPreview
    });

    await combo.mount();
    window._deskAddressCombobox = combo;

    if (duplicateData?.province_id) {
        combo.hydrate({
            province_id: duplicateData.province_id,
            ward_id: duplicateData.ward_id
        });
        if (duplicateData.street_address && streetInput) {
            streetInput.value = duplicateData.street_address;
        }
    }

    if (streetInput) {
        streetInput.addEventListener('input', updateAddressPreview);
    }

    updateAddressPreview();
}

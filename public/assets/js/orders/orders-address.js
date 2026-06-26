/**
 * Orders Address Selector (2 cấp: Tỉnh/TP → Phường/Xã)
 *
 * Dependencies:
 * - window.addressSelector from address-selector.js
 */

// ============================================
// ADDRESS SELECTOR INIT
// ============================================

async function initAddressSelector(duplicateData = null) {
    if (!window.addressSelector.loaded) {
        await window.addressSelector.init();
    }

    const provinceSelect = document.getElementById('newOrderProvince');
    const wardSelect = document.getElementById('newOrderWard');
    const streetInput = document.getElementById('newOrderStreetAddress');
    const addressPreview = document.getElementById('newOrderAddressPreview');
    const hiddenAddress = document.getElementById('newOrderAddress');

    window.addressSelector.renderProvinces(provinceSelect);

    if (duplicateData?.province_id) {
        const provinceId = String(duplicateData.province_id);
        const wardId = duplicateData.ward_id ? String(duplicateData.ward_id) : null;

        provinceSelect.value = provinceId;
        window.addressSelector.renderWards(wardSelect, provinceId);

        if (wardId) {
            setTimeout(() => {
                wardSelect.value = wardId;
                updateAddressPreview();
            }, 50);
        }

        if (duplicateData.street_address) {
            streetInput.value = duplicateData.street_address;
        }
    }

    function updateAddressPreview() {
        const provinceId = provinceSelect.value;
        const wardId = wardSelect.value;
        const street = streetInput.value;

        const fullAddress = window.addressSelector.generateFullAddress(
            street,
            provinceId,
            wardId
        );

        addressPreview.textContent = fullAddress || 'Vui lòng chọn địa chỉ';
        hiddenAddress.value = fullAddress;
    }

    window.addressSelector.setupCascade(
        provinceSelect,
        wardSelect,
        updateAddressPreview
    );

    streetInput.addEventListener('input', updateAddressPreview);
}

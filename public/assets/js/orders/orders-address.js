/**
 * Orders Address Selector
 * Extracted from orders.js
 * 
 * Dependencies:
 * - window.addressSelector from address-selector.js
 */

// ============================================
// ADDRESS SELECTOR INIT
// ============================================

async function initAddressSelector(duplicateData = null) {
    // Init address selector module
    if (!window.addressSelector.loaded) {
        await window.addressSelector.init();
    }

    const provinceSelect = document.getElementById('newOrderProvince');
    const districtSelect = document.getElementById('newOrderDistrict');
    const wardSelect = document.getElementById('newOrderWard');
    const streetInput = document.getElementById('newOrderStreetAddress');
    const addressPreview = document.getElementById('newOrderAddressPreview');
    const hiddenAddress = document.getElementById('newOrderAddress');

    // Render provinces
    window.addressSelector.renderProvinces(provinceSelect);

    // If duplicating/restoring order with address IDs, set them
    if (duplicateData?.province_id) {
        const provinceId = String(duplicateData.province_id);
        const districtId = duplicateData.district_id ? String(duplicateData.district_id) : null;
        const wardId = duplicateData.ward_id ? String(duplicateData.ward_id) : null;

        provinceSelect.value = provinceId;

        // Always render districts so the dropdown is enabled and populated
        window.addressSelector.renderDistricts(districtSelect, provinceId);

        if (districtId) {
            setTimeout(() => {
                districtSelect.value = districtId;
                window.addressSelector.renderWards(wardSelect, provinceId, districtId);
                if (wardId) {
                    setTimeout(() => {
                        wardSelect.value = wardId;
                        updateAddressPreview();
                    }, 50);
                }
            }, 50);
        }

        if (duplicateData.street_address) {
            streetInput.value = duplicateData.street_address;
        }
    }

    // Update preview function
    function updateAddressPreview() {
        const provinceId = provinceSelect.value;
        const districtId = districtSelect.value;
        const wardId = wardSelect.value;
        const street = streetInput.value;

        const fullAddress = window.addressSelector.generateFullAddress(
            street,
            provinceId,
            districtId,
            wardId
        );

        addressPreview.textContent = fullAddress || 'Vui lòng chọn địa chỉ';
        hiddenAddress.value = fullAddress;
    }

    // Setup cascade
    window.addressSelector.setupCascade(
        provinceSelect,
        districtSelect,
        wardSelect,
        updateAddressPreview
    );

    // Street address input
    streetInput.addEventListener('input', updateAddressPreview);

    // Note: updateAddressPreview() is called inside setTimeout after ward is set
}

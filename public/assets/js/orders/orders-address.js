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

    // If duplicating order with address IDs, set them
    if (duplicateData?.province_id) {
        // Convert IDs to strings (select values are always strings)
        const provinceId = String(duplicateData.province_id);
        const districtId = duplicateData.district_id ? String(duplicateData.district_id) : null;
        const wardId = duplicateData.ward_id ? String(duplicateData.ward_id) : null;

        // Set province
        provinceSelect.value = provinceId;

        // Render and set district
        if (districtId) {
            window.addressSelector.renderDistricts(districtSelect, provinceId);
            districtSelect.value = districtId;

            // Render and set ward
            if (wardId) {
                window.addressSelector.renderWards(wardSelect, provinceId, districtId);
                wardSelect.value = wardId;
            }
        }

        // Set street address
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

    // Update preview after setting address from duplicate
    if (duplicateData?.province_id) {
        updateAddressPreview();
    }
}

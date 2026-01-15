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
    console.log('🔧 Initializing address selector...');
    if (!window.addressSelector.loaded) {
        console.log('  - Loading address data...');
        await window.addressSelector.init();
        console.log('  - Address data loaded:', window.addressSelector.loaded);
    } else {
        console.log('  - Address data already loaded');
    }

    const provinceSelect = document.getElementById('newOrderProvince');
    const districtSelect = document.getElementById('newOrderDistrict');
    const wardSelect = document.getElementById('newOrderWard');
    const streetInput = document.getElementById('newOrderStreetAddress');
    const addressPreview = document.getElementById('newOrderAddressPreview');
    const hiddenAddress = document.getElementById('newOrderAddress');

    // Render provinces
    console.log('  - Rendering provinces...');
    window.addressSelector.renderProvinces(provinceSelect);
    console.log('  - Provinces in data:', window.addressSelector.data.provinces?.length || 0);

    // If duplicating order with address IDs, set them
    if (duplicateData?.province_id) {
        console.log('✅ Setting address from duplicate data:');
        console.log('  - Province ID:', duplicateData.province_id);
        console.log('  - District ID:', duplicateData.district_id);
        console.log('  - Ward ID:', duplicateData.ward_id);
        console.log('  - Street:', duplicateData.street_address);

        // Set province
        provinceSelect.value = duplicateData.province_id;

        // Render and set district
        if (duplicateData.district_id) {
            window.addressSelector.renderDistricts(districtSelect, duplicateData.province_id);
            districtSelect.value = duplicateData.district_id;

            // Render and set ward
            if (duplicateData.ward_id) {
                window.addressSelector.renderWards(wardSelect, duplicateData.province_id, duplicateData.district_id);
                wardSelect.value = duplicateData.ward_id;
            }
        }

        // Set street address
        if (duplicateData.street_address) {
            streetInput.value = duplicateData.street_address;
        }

        console.log('✅ Address set successfully from IDs!');
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

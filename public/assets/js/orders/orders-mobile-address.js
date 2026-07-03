/**
 * Mobile order form — address picker (đồng bộ desktop: chip combobox + hidden selects).
 * Phụ thuộc: address-selector.js, orders-desk-address-combobox.js
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

function setDeskOrderStreetInputVisible(visible) {
    const wrap = document.getElementById('newOrderStreetAddressWrap');
    if (wrap) wrap.classList.toggle('hidden', !visible);
}

function syncDeskOrderStreetInputVisibility() {
    const wardSelect = document.getElementById('newOrderWard');
    setDeskOrderStreetInputVisible(!!(wardSelect?.value));
}

window.setDeskOrderStreetInputVisible = setDeskOrderStreetInputVisible;
window.syncDeskOrderStreetInputVisibility = syncDeskOrderStreetInputVisibility;

function mAddrEscapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

function formatMobileLegacyOrderAddressDisplay(order) {
    if (!order) return 'Chưa có địa chỉ';
    if (window.addressSelector?.formatOrderDisplayAddress && window.addressSelector.isLegacyOrderAddress?.(order)) {
        return window.addressSelector.formatOrderDisplayAddress(order);
    }
    const addrStr = (order.address && String(order.address).trim()) || '';
    const structured = [
        order.street_address,
        order.ward_name,
        order.district_name,
        order.province_name
    ].filter(Boolean).join(', ');
    return addrStr || structured || 'Chưa có địa chỉ';
}

function showMobileLegacyAddressBlock(order) {
    const block = document.getElementById('deskLegacyAddressBlock');
    const wrap = document.getElementById('deskAddressSelectorWrap');
    if (!block || !order) return;

    const full = formatMobileLegacyOrderAddressDisplay(order);

    block.innerHTML =
        '<div class="rounded-xl border border-gray-200 bg-white px-3 py-2.5">' +
        '<p class="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Địa chỉ cũ 3 cấp</p>' +
        '<p class="text-sm font-medium text-gray-900 leading-relaxed break-words">' + mAddrEscapeHtml(full) + '</p>' +
        '</div>' +
        '<button type="button" onclick="beginMUpdateAddressTo2Level()" class="w-full px-4 py-2.5 text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl active:scale-[0.98] transition-transform">' +
        'Cập nhật địa chỉ mới (2 cấp)' +
        '</button>';
    block.classList.remove('hidden');
    wrap?.classList.add('hidden');
    destroyMobileAddressSelector();
}

function hideMobileLegacyAddressBlock() {
    document.getElementById('deskLegacyAddressBlock')?.classList.add('hidden');
    document.getElementById('deskAddressSelectorWrap')?.classList.remove('hidden');
}

function destroyMobileAddressSelector() {
    if (typeof destroyDeskAddressCombobox === 'function') {
        destroyDeskAddressCombobox();
    }
}

async function initMobileAddressSelector(orderForHydrate) {
    destroyMobileAddressSelector();

    const isEdit = typeof editOrderId !== 'undefined' && editOrderId != null;
    const dupPreview = typeof duplicatePreviewSourceId !== 'undefined' && duplicatePreviewSourceId != null;

    if (!window.addressSelector) {
        window.addressSelector = new AddressSelector();
    }
    if (!window.addressSelector.loaded) {
        await window.addressSelector.init();
    }

    const useLegacyBlock = isEdit && !dupPreview && orderForHydrate &&
        typeof mAddressMode !== 'undefined' && mAddressMode !== 'migrating' &&
        window.addressSelector.isLegacyOrderAddress(orderForHydrate);

    if (useLegacyBlock) {
        mAddressMode = 'legacy';
        mLegacyOrderRef = orderForHydrate;
        showMobileLegacyAddressBlock(orderForHydrate);
        document.getElementById('smartPasteBlock')?.classList.add('hidden');
        const hiddenAddress = document.getElementById('newOrderAddress');
        if (hiddenAddress) {
            hiddenAddress.value = formatMobileLegacyOrderAddressDisplay(orderForHydrate);
        }
        return;
    }

    hideMobileLegacyAddressBlock();
    if (typeof mAddressMode !== 'undefined' && mAddressMode !== 'migrating') {
        mLegacyOrderRef = null;
    }

    const hydrateData = (typeof mAddressMode !== 'undefined' && mAddressMode === 'migrating') ? null : orderForHydrate;

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

        if (!provinceId) {
            if (streetInput) streetInput.value = '';
            syncOrderAddressPreview('', addressPreview);
            if (hiddenAddress) hiddenAddress.value = '';
            return;
        }

        const fullAddress = window.addressSelector.generateFullAddress(street, provinceId, wardId);
        syncOrderAddressPreview(fullAddress, addressPreview);
        if (hiddenAddress) hiddenAddress.value = fullAddress;
    }

    if (!comboMount || typeof DeskAddressCombobox === 'undefined') {
        console.warn('[Mobile Address] Combobox unavailable — fallback to native selects');
        const provinceSelect = document.getElementById('newOrderProvince');
        const wardSelect = document.getElementById('newOrderWard');
        window.addressSelector.renderProvinces(provinceSelect);
        if (hydrateData?.province_id) {
            const provinceId = String(hydrateData.province_id);
            provinceSelect.value = provinceId;
            window.addressSelector.renderWards(wardSelect, provinceId);
            if (hydrateData.ward_id) wardSelect.value = String(hydrateData.ward_id);
            if (hydrateData.street_address && streetInput) {
                streetInput.value = hydrateData.street_address;
            }
        }
        window.addressSelector.setupCascade(provinceSelect, wardSelect, () => {
            syncDeskOrderStreetInputVisibility();
            updateAddressPreview();
            if (typeof clearFieldError === 'function') clearFieldError('mAddressFormBlock');
        });
        wardSelect?.addEventListener('change', syncDeskOrderStreetInputVisibility);
        if (streetInput) streetInput.addEventListener('input', updateAddressPreview);
        syncDeskOrderStreetInputVisibility();
        updateAddressPreview();
        return;
    }

    const combo = new DeskAddressCombobox({
        container: comboMount,
        onChange: () => {
            updateAddressPreview();
            if (typeof clearFieldError === 'function') clearFieldError('mAddressFormBlock');
        }
    });

    await combo.mount();
    window._deskAddressCombobox = combo;

    if (hydrateData?.province_id) {
        combo.hydrate({
            province_id: hydrateData.province_id,
            ward_id: hydrateData.ward_id
        });
        if (hydrateData.street_address && streetInput) {
            streetInput.value = hydrateData.street_address;
        }
    }

    if (streetInput) {
        streetInput.addEventListener('input', updateAddressPreview);
    }

    syncDeskOrderStreetInputVisibility();
    updateAddressPreview();
}

function getMobileAddressFormData() {
    const provinceSelect = document.getElementById('newOrderProvince');
    const wardSelect = document.getElementById('newOrderWard');
    const streetInput = document.getElementById('newOrderStreetAddress');
    const provinceId = provinceSelect?.value || '';
    const wardId = wardSelect?.value || '';
    const street = streetInput?.value?.trim() || '';

    let provinceName = '';
    let wardName = '';
    if (window.addressSelector?.loaded && provinceId) {
        provinceName = window.addressSelector.getProvinceName(provinceId) || '';
        if (wardId) wardName = window.addressSelector.getWardName(provinceId, wardId) || '';
    }

    const fullAddress = provinceId && window.addressSelector?.loaded
        ? window.addressSelector.generateFullAddress(street, provinceId, wardId)
        : '';

    return {
        provinceCode: provinceId,
        wardCode: wardId,
        provinceName,
        wardName,
        street,
        fullAddress
    };
}

window.initMobileAddressSelector = initMobileAddressSelector;
window.destroyMobileAddressSelector = destroyMobileAddressSelector;
window.getMobileAddressFormData = getMobileAddressFormData;
window.showMobileLegacyAddressBlock = showMobileLegacyAddressBlock;
window.hideMobileLegacyAddressBlock = hideMobileLegacyAddressBlock;
window.formatMobileLegacyOrderAddressDisplay = formatMobileLegacyOrderAddressDisplay;

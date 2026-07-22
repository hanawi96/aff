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

/** Hiện/ẩn ô số nhà — chỉ sau khi đã chọn phường/xã hoặc phân tích nhanh có phường. */
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

/** 'normal' | 'legacy' (3 cấp read-only) | 'migrating' (đang chuyển sang 2 cấp) */
let deskAddressMode = 'normal';
let deskLegacyOrderRef = null;

function resetDeskAddressMode() {
    deskAddressMode = 'normal';
    deskLegacyOrderRef = null;
}

function formatLegacyOrderAddressDisplay(order) {
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

function showDeskLegacyAddressBlock(order) {
    const block = document.getElementById('deskLegacyAddressBlock');
    const wrap = document.getElementById('deskAddressSelectorWrap');
    if (!block || !order) return;

    const full = formatLegacyOrderAddressDisplay(order);

    block.innerHTML = `
        <div class="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
            <p class="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Địa chỉ cũ 3 cấp</p>
            <p class="text-sm font-medium text-gray-900 leading-relaxed break-words">${escapeHtml(full)}</p>
        </div>
        <button type="button" onclick="beginDeskUpdateAddressTo2Level()" class="w-full px-4 py-2 text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors">
            Cập nhật địa chỉ mới (2 cấp)
        </button>`;
    block.classList.remove('hidden');
    wrap?.classList.add('hidden');
}

function hideDeskLegacyAddressBlock() {
    document.getElementById('deskLegacyAddressBlock')?.classList.add('hidden');
    document.getElementById('deskAddressSelectorWrap')?.classList.remove('hidden');
}

async function beginDeskUpdateAddressTo2Level() {
    const order = deskLegacyOrderRef;
    deskAddressMode = 'migrating';
    hideDeskLegacyAddressBlock();
    document.getElementById('deskSmartPasteBlock')?.classList.remove('hidden');
    const sp = document.getElementById('smartPasteInput');
    if (sp && !sp.value.trim() && order) {
        sp.value = [
            order.customer_name,
            order.customer_phone,
            formatLegacyOrderAddressDisplay(order)
        ].filter(Boolean).join('\n');
    }
    await initAddressSelector(null);
    document.getElementById('deskAddressFormBlock')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

window.beginDeskUpdateAddressTo2Level = beginDeskUpdateAddressTo2Level;
window.resetDeskAddressMode = resetDeskAddressMode;

async function initAddressSelector(duplicateData = null) {
    if (typeof destroyDeskAddressCombobox === 'function') {
        destroyDeskAddressCombobox();
    }

    const isEdit = !!document.getElementById('orderFormEditDbId')?.value?.trim();

    if (!window.addressSelector?.loaded) {
        await window.addressSelector.init();
    }

    const useLegacyBlock = isEdit && duplicateData &&
        deskAddressMode !== 'migrating' &&
        window.addressSelector.isLegacyOrderAddress(duplicateData);

    if (useLegacyBlock) {
        deskAddressMode = 'legacy';
        deskLegacyOrderRef = duplicateData;
        showDeskLegacyAddressBlock(duplicateData);
        document.getElementById('deskSmartPasteBlock')?.classList.add('hidden');
        const hiddenAddress = document.getElementById('newOrderAddress');
        if (hiddenAddress) {
            hiddenAddress.value = formatLegacyOrderAddressDisplay(duplicateData);
        }
        return;
    }

    hideDeskLegacyAddressBlock();
    if (deskAddressMode !== 'migrating') {
        deskLegacyOrderRef = null;
    }

    const hydrateData = deskAddressMode === 'migrating' ? null : duplicateData;

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
        if (hydrateData?.province_id) {
            const provinceId = String(hydrateData.province_id);
            provinceSelect.value = provinceId;
            window.addressSelector.renderWards(wardSelect, provinceId);
            if (hydrateData.ward_id) {
                wardSelect.value = String(hydrateData.ward_id);
            }
            if (hydrateData.street_address && streetInput) {
                streetInput.value = hydrateData.street_address;
            }
        }
        window.addressSelector.setupCascade(provinceSelect, wardSelect, () => {
            syncDeskOrderStreetInputVisibility();
            updateAddressPreview();
        });
        wardSelect?.addEventListener('change', syncDeskOrderStreetInputVisibility);
        if (streetInput) streetInput.addEventListener('input', updateAddressPreview);
        syncDeskOrderStreetInputVisibility();
        updateAddressPreview();
        if (typeof initDeskLegacyAddressConvert === 'function') {
            initDeskLegacyAddressConvert();
        }
        return;
    }

    const combo = new DeskAddressCombobox({
        container: comboMount,
        onChange: updateAddressPreview
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

    if (typeof initDeskLegacyAddressConvert === 'function') {
        initDeskLegacyAddressConvert();
    }
}

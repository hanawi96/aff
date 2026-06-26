// ============================================
// EDIT PAYMENT SUMMARY — tổng tiền + cọc + thanh toán (một modal)
// ============================================

function editOrderPaymentSummary(orderId, orderCode) {
    const order = allOrdersData.find(o => o.id === orderId);
    if (!order) {
        showToast('Không tìm thấy đơn hàng', 'error');
        return;
    }
    closeEditPaymentSummaryModal();

    const isBank = isOrderBankPayment(order.payment_method);
    const pmValue = isBank ? 'bank' : 'cod';
    const currentAmount = order.total_amount || 0;
    const currentDeposit = getOrderDepositAmount(order);
    const referralCode = order.referral_code || '';
    const hasReferral = !!referralCode;

    const modal = document.createElement('div');
    modal.id = 'editPaymentSummaryModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';

    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div class="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 rounded-t-xl sticky top-0 z-10">
                <div class="flex items-start justify-between gap-3">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                            <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>
                        <div class="min-w-0">
                            <h3 class="text-lg font-bold text-white leading-tight">Thanh toán &amp; giá trị</h3>
                            <span class="inline-block mt-1.5 px-2.5 py-0.5 rounded-md bg-white/20 text-white text-xs font-mono font-semibold tracking-wide">${escapeHtml(orderCode)}</span>
                        </div>
                    </div>
                    <button type="button" onclick="closeEditPaymentSummaryModal()" class="flex-shrink-0 text-white/80 hover:text-white transition-colors p-1" aria-label="Đóng">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            <div class="p-6 space-y-5">
                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">Hình thức thanh toán</label>
                    <div class="bg-gray-100 p-1 rounded-xl grid grid-cols-2 gap-1">
                        <label class="cursor-pointer">
                            <input type="radio" name="paymentSummaryMethod" value="cod" class="sr-only" ${pmValue === 'cod' ? 'checked' : ''} onchange="syncPaymentSummaryForm()">
                            <div id="paymentSummaryCodToggle" class="text-center py-2.5 rounded-lg text-sm font-semibold transition-all">COD</div>
                        </label>
                        <label class="cursor-pointer">
                            <input type="radio" name="paymentSummaryMethod" value="bank" class="sr-only" ${pmValue === 'bank' ? 'checked' : ''} onchange="syncPaymentSummaryForm()">
                            <div id="paymentSummaryBankToggle" class="text-center py-2.5 rounded-lg text-sm font-semibold transition-all">Đã CK</div>
                        </label>
                    </div>
                </div>

                <div>
                    <label class="block text-sm font-semibold text-gray-700 mb-2">Giá trị đơn hàng <span class="text-red-500">*</span></label>
                    <div class="relative">
                        <input type="text" id="paymentSummaryAmountInput" inputmode="numeric" autocomplete="off"
                            value="${currentAmount > 0 ? formatVnIntegerString(currentAmount) : ''}"
                            class="w-full pl-3 pr-12 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-medium"
                            placeholder="VD: 459.000"
                            oninput="formatVnMoneyInput(this); updatePaymentSummaryPreview()" />
                        <span class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 text-sm font-medium pointer-events-none">đ</span>
                    </div>
                </div>

                <div id="paymentSummaryDepositWrap" class="${isBank ? 'hidden' : ''}">
                    <label class="block text-sm font-semibold text-gray-700 mb-2">Tiền cọc trước</label>
                    <div id="paymentSummaryDepositPresets" class="hidden mb-2"></div>
                    <div class="relative">
                        <input type="text" id="paymentSummaryDepositInput" inputmode="numeric" autocomplete="off"
                            value="${currentDeposit > 0 ? formatVnIntegerString(currentDeposit) : ''}"
                            class="w-full pl-3 pr-12 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                            placeholder="0"
                            oninput="formatVnMoneyInput(this); updatePaymentSummaryPreview()" />
                        <span class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 text-sm pointer-events-none">đ</span>
                    </div>
                    <p class="mt-1.5 text-xs text-gray-500">Để trống hoặc 0 nếu khách chưa cọc</p>
                </div>

                <div class="space-y-2">
                    <div id="paymentSummaryCodWrap" class="flex justify-between items-center rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 ${isBank ? 'hidden' : ''}">
                        <span class="text-sm font-medium text-orange-800">Thu COD khi giao</span>
                        <span id="paymentSummaryCodPreview" class="text-lg font-bold text-orange-600">${formatCurrency(Math.max(0, currentAmount - currentDeposit))}</span>
                    </div>
                    <div id="paymentSummaryCommissionWrap" class="flex justify-between items-center rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm ${hasReferral ? '' : 'hidden'}" data-has-referral="${hasReferral ? '1' : '0'}">
                        <span class="text-amber-800">Hoa hồng CTV (ước tính)</span>
                        <span id="paymentSummaryCommissionPreview" class="font-semibold text-amber-700">${formatCurrency((order.commission || 0))}</span>
                    </div>
                </div>
            </div>

            <div class="px-6 py-4 bg-gray-50 rounded-b-xl flex items-center justify-end gap-3 border-t border-gray-200">
                <button type="button" onclick="closeEditPaymentSummaryModal()" class="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium">Hủy</button>
                <button type="button" onclick="saveOrderPaymentSummary(${orderId}, '${escapeHtml(orderCode)}')" class="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg shadow-lg transition-all font-semibold">Lưu thay đổi</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    syncPaymentSummaryForm();
    document.getElementById('paymentSummaryAmountInput')?.focus();

    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeEditPaymentSummaryModal();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
}

function closeEditPaymentSummaryModal() {
    document.getElementById('editPaymentSummaryModal')?.remove();
}

function syncPaymentSummaryToggles() {
    const pm = document.querySelector('#editPaymentSummaryModal input[name="paymentSummaryMethod"]:checked')?.value || 'cod';
    const codDiv = document.getElementById('paymentSummaryCodToggle');
    const bankDiv = document.getElementById('paymentSummaryBankToggle');
    const base = 'text-center py-2.5 rounded-lg text-sm font-semibold transition-all';
    const off = 'text-gray-500';
    const codOn = 'bg-orange-500 text-white shadow-md font-bold';
    const bankOn = 'bg-green-600 text-white shadow-md font-bold';
    if (codDiv) codDiv.className = `${base} ${pm === 'cod' ? codOn : off}`;
    if (bankDiv) bankDiv.className = `${base} ${pm === 'bank' ? bankOn : off}`;
}

function syncPaymentSummaryForm() {
    const pm = document.querySelector('#editPaymentSummaryModal input[name="paymentSummaryMethod"]:checked')?.value || 'cod';
    const isBank = isOrderBankPayment(pm);
    const wrap = document.getElementById('paymentSummaryDepositWrap');
    if (wrap) wrap.classList.toggle('hidden', isBank);
    syncPaymentSummaryToggles();
    updatePaymentSummaryPreview();
}

function updatePaymentSummaryPreview() {
    const modal = document.getElementById('editPaymentSummaryModal');
    if (!modal) return;

    const amount = parsePrice(document.getElementById('paymentSummaryAmountInput')?.value) || 0;
    const pm = document.querySelector('#editPaymentSummaryModal input[name="paymentSummaryMethod"]:checked')?.value || 'cod';
    const isBank = isOrderBankPayment(pm);
    const deposit = isBank ? 0 : (parsePrice(document.getElementById('paymentSummaryDepositInput')?.value) || 0);
    const cod = Math.max(0, amount - deposit);

    const codWrap = document.getElementById('paymentSummaryCodWrap');
    const codEl = document.getElementById('paymentSummaryCodPreview');
    if (codWrap) codWrap.classList.toggle('hidden', isBank);
    if (codEl) codEl.textContent = formatCurrency(cod);

    if (!isBank && amount > 0) {
        updateDepositPresetButtons({
            containerId: 'paymentSummaryDepositPresets',
            inputId: 'paymentSummaryDepositInput',
            total: amount,
            onChange: updatePaymentSummaryPreview
        });
    } else {
        const presetWrap = document.getElementById('paymentSummaryDepositPresets');
        if (presetWrap) {
            presetWrap.innerHTML = '';
            presetWrap.classList.add('hidden');
        }
    }

    const commWrap = document.getElementById('paymentSummaryCommissionWrap');
    const commEl = document.getElementById('paymentSummaryCommissionPreview');
    if (commWrap?.dataset.hasReferral === '1' && commEl) {
        commEl.textContent = formatCurrency(amount * 0.1);
    }
}

async function saveOrderPaymentSummary(orderId, orderCode) {
    const pm = document.querySelector('#editPaymentSummaryModal input[name="paymentSummaryMethod"]:checked')?.value || 'cod';
    const newAmount = parsePrice(document.getElementById('paymentSummaryAmountInput')?.value) || 0;
    const newDeposit = isOrderBankPayment(pm) ? 0 : (parsePrice(document.getElementById('paymentSummaryDepositInput')?.value) || 0);

    if (newAmount <= 0) {
        showToast('Giá trị đơn hàng phải lớn hơn 0', 'error');
        return;
    }
    if (newAmount > 1000000000) {
        showToast('Giá trị đơn hàng quá lớn', 'error');
        return;
    }
    if (!isOrderBankPayment(pm) && newDeposit > 0 && newDeposit >= newAmount) {
        showToast('Tiền cọc phải nhỏ hơn giá trị đơn hàng', 'error');
        return;
    }

    const orderIndex = allOrdersData.findIndex(o => o.id === orderId);
    if (orderIndex === -1) {
        showToast('Không tìm thấy đơn hàng', 'error');
        return;
    }
    const order = allOrdersData[orderIndex];
    const origPm = orderPaymentApiKey(order.payment_method);
    const origAmount = order.total_amount || 0;
    const origDeposit = getOrderDepositAmount(order);
    const referralCode = order.referral_code;
    const pmChanged = pm !== origPm;
    const amountChanged = newAmount !== origAmount;
    const depositChanged = !isOrderBankPayment(pm) && newDeposit !== (isOrderBankPayment(origPm) ? 0 : origDeposit);

    if (!pmChanged && !amountChanged && !depositChanged) {
        closeEditPaymentSummaryModal();
        return;
    }

    closeEditPaymentSummaryModal();
    const saveId = `save-payment-summary-${orderId}`;
    showToast('Đang lưu...', 'info', 0, saveId);

    try {
        if (pmChanged) {
            const r = await fetch(`${CONFIG.API_URL}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'updatePaymentMethod', orderId, paymentMethod: pm })
            });
            const d = await r.json();
            if (!d.success) throw new Error(d.error || 'Không thể cập nhật thanh toán');
            order.payment_method = pm;
            if (isOrderBankPayment(pm)) order.deposit_amount = 0;
        }

        if (amountChanged) {
            const newCommission = referralCode ? newAmount * 0.1 : 0;
            const r = await fetch(`${CONFIG.API_URL}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'updateAmount',
                    orderId,
                    totalAmount: newAmount,
                    commission: newCommission
                })
            });
            const d = await r.json();
            if (!d.success) throw new Error(d.error || 'Không thể cập nhật giá trị');
            order.total_amount = newAmount;
            order.commission = newCommission;
        }

        if (depositChanged && !isOrderBankPayment(pm)) {
            const r = await fetch(`${CONFIG.API_URL}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'updateDepositAmount', orderId, depositAmount: newDeposit })
            });
            const d = await r.json();
            if (!d.success) throw new Error(d.error || 'Không thể cập nhật tiền cọc');
            order.deposit_amount = d.deposit_amount ?? newDeposit;
        }

        const filteredIndex = filteredOrdersData.findIndex(o => o.id === orderId);
        if (filteredIndex !== -1) {
            filteredOrdersData[filteredIndex] = { ...order };
        }

        updateStats();
        renderOrdersTable();
        showToast(`Đã cập nhật đơn ${orderCode}`, 'success', null, saveId);
    } catch (error) {
        console.error('Error saving payment summary:', error);
        showToast('Không thể lưu: ' + error.message, 'error', null, saveId);
    }
}

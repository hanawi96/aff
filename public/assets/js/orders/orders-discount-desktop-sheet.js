/**
 * Desktop add-order form: discount dialog (modal căn giữa — không dùng bottom sheet như mobile).
 * Thuật toán / payload đồng bộ m.html: tab mã · tùy chỉnh, %/đ, gợi ý chẵn, làm chẵn tiền, validateDiscount, GG_THU_CONG.
 */

let dDiscSheetMounted = false;
let dDiscManualQuickSel = null;
let dDiscManualFixSel = null;
let dDiscManualInputMode = 'percent';

function dDiscClampDisc(amt, base) {
    const b = Math.max(0, Math.round(base));
    return Math.max(0, Math.min(Math.round(amt), b));
}

function dDiscApplyRoundPayToThousand(base, disc) {
    const b = Math.max(0, Math.round(base));
    const d = dDiscClampDisc(disc, b);
    if (b <= 0) return d;
    const pay = Math.max(0, b - d);
    const target = Math.floor(pay / 1000) * 1000;
    return dDiscClampDisc(b - target, b);
}

function getDesktopDiscBaseTotal() {
    if (typeof currentOrderProducts === 'undefined') return 0;
    const productTotal = currentOrderProducts.reduce((s, p) => {
        const price = parsePrice(p.price != null ? p.price : 0);
        const qty = parseInt(p.quantity, 10) || 1;
        return s + price * qty;
    }, 0);
    const freeShip = document.getElementById('freeShippingCheckbox')?.checked;
    const shippingFee = freeShip ? 0 : (parseFloat(document.getElementById('newOrderShippingFee')?.value) || 0);
    return productTotal + shippingFee;
}

function dDiscComputeCashSuggestDiscounts(base) {
    const b = Math.max(0, Math.round(base));
    if (b < 1000) return [];
    const k = Math.floor(b / 1000) % 10;
    const n0 = k === 0 ? 10 : k;
    return [n0, n0 + 10, n0 + 20].map((n) => {
        const amt = n * 1000;
        return { label: `-${formatCurrency(amt)}`, amt };
    });
}

function dDiscParseMoneyInput(val) {
    const n = String(val || '').replace(/\./g, '').replace(/,/g, '').replace(/\s/g, '');
    const x = parseInt(n, 10);
    return Number.isFinite(x) && x >= 0 ? x : 0;
}

function dDiscSyncChipRow() {
    const row = document.getElementById('dDiscChipRow');
    if (!row) return;
    const pctMode = dDiscManualInputMode === 'percent';
    const clsOn =
        'manual-chip min-w-[2.5rem] justify-center flex px-3 py-2 rounded-lg text-sm font-semibold border-2 border-violet-500 bg-violet-50 text-violet-800 active:scale-[0.98]';
    const clsOff =
        'manual-chip min-w-[2.5rem] justify-center flex px-3 py-2 rounded-lg text-sm font-semibold border border-gray-200 bg-white text-gray-700 hover:border-violet-300 hover:bg-violet-50/50 transition-colors active:scale-[0.98]';
    row.querySelectorAll('.manual-chip').forEach((b) => {
        const v = b.getAttribute('data-mp');
        const n = v === '0' ? 0 : parseInt(v, 10);
        let on = false;
        if (n !== 0) on = pctMode && dDiscManualQuickSel === n;
        b.className = on ? clsOn : clsOff;
    });
}

function dDiscSetManualInputMode(mode) {
    if (mode === 'percent') dDiscManualFixSel = null;
    dDiscManualInputMode = mode === 'fixed' ? 'fixed' : 'percent';
    const a = dDiscManualInputMode === 'percent';
    const onP = 'px-3 py-2 text-xs font-bold rounded-md bg-white shadow-sm text-violet-700 ring-1 ring-black/5';
    const off = 'px-3 py-2 text-xs font-bold rounded-md text-gray-500';
    const bp = document.getElementById('dDiscBtnPct');
    const bv = document.getElementById('dDiscBtnVnd');
    if (bp) bp.className = a ? onP : off;
    if (bv) bv.className = !a ? onP : off;
    const ph = document.getElementById('dDiscManualValInput');
    if (ph) ph.placeholder = a ? 'VD: 8' : 'VD: 50000';
    dDiscSyncChipRow();
    dDiscUpdateOrderSummary();
}

function dDiscOnManualInput() {
    dDiscManualQuickSel = null;
    dDiscManualFixSel = null;
    dDiscSyncChipRow();
    dDiscUpdateOrderSummary();
}

function dDiscGetManualDraftPreview(base) {
    if (base <= 0) return null;
    const b = Math.max(0, Math.round(base));
    if (dDiscManualInputMode === 'percent') {
        const raw = (document.getElementById('dDiscManualValInput')?.value || '').trim();
        let pct = null;
        if (raw) {
            const p = parseFloat(raw.replace(/,/g, '.').replace(/\s/g, ''));
            if (Number.isFinite(p) && p > 0 && p <= 100) pct = p;
        } else if (dDiscManualQuickSel) pct = dDiscManualQuickSel;
        if (pct == null) return null;
        const disc = dDiscClampDisc((pct / 100) * b, b);
        return { mode: 'percent', pct, disc, remain: Math.max(0, b - disc) };
    }
    if (dDiscManualFixSel != null) {
        const disc = dDiscClampDisc(dDiscManualFixSel, b);
        if (disc <= 0) return null;
        return { mode: 'fixed', pct: null, disc, remain: Math.max(0, b - disc) };
    }
    const raw = (document.getElementById('dDiscManualValInput')?.value || '').trim();
    if (!raw) return null;
    const v = dDiscParseMoneyInput(raw);
    if (v <= 0) return null;
    const disc = dDiscClampDisc(v, b);
    return { mode: 'fixed', pct: null, disc, remain: Math.max(0, b - disc) };
}

function dDiscRenderCashSuggestChips() {
    const row = document.getElementById('dDiscCashSuggestRow');
    if (!row) return;
    const b = Math.max(0, Math.round(getDesktopDiscBaseTotal()));
    const opts = dDiscComputeCashSuggestDiscounts(b);
    if (!opts.length) {
        row.innerHTML = '';
        return;
    }
    const clsOn =
        'manual-cash-sug px-3 py-2 rounded-lg text-sm font-semibold border-2 border-violet-500 bg-violet-50 text-violet-800 active:scale-[0.98]';
    const clsOff =
        'manual-cash-sug px-3 py-2 rounded-lg text-sm font-semibold border border-gray-200 bg-white text-gray-700 hover:border-violet-300 hover:bg-violet-50/50 transition-colors active:scale-[0.98]';
    row.innerHTML = opts
        .map((o) => {
            const dis = o.amt >= b;
            const sel = dDiscManualFixSel === o.amt && !dis;
            const cls = (sel ? clsOn : clsOff) + (dis ? ' opacity-40 cursor-not-allowed' : '');
            if (dis) return `<button type="button" disabled class="${cls}">${escapeHtml(o.label)}</button>`;
            return `<button type="button" onclick="dDiscPickCashSuggest(${o.amt})" class="${cls}">${escapeHtml(o.label)}</button>`;
        })
        .join('');
}

function dDiscPickCashSuggest(amt) {
    const b = Math.max(0, Math.round(getDesktopDiscBaseTotal()));
    if (amt >= b) {
        showToast('Chọn mức nhỏ hơn tổng đơn', 'warning');
        return;
    }
    dDiscManualFixSel = amt;
    dDiscManualQuickSel = null;
    const inp = document.getElementById('dDiscManualValInput');
    if (inp) inp.value = '';
    dDiscSetManualInputMode('fixed');
}

function dDiscUpdateOrderSummary() {
    const wrap = document.getElementById('dDiscOrderSummary');
    if (!wrap) return;
    const base = getDesktopDiscBaseTotal();
    const b = Math.max(0, Math.round(base));
    const want = document.getElementById('dDiscRoundChk')?.checked;
    const pv = dDiscGetManualDraftPreview(base);
    let preview = '';
    if (pv && pv.disc > 0) {
        const remain0 = pv.remain;
        const remainR = want ? Math.floor(remain0 / 1000) * 1000 : remain0;
        const extra = want && remain0 > remainR ? remain0 - remainR : 0;
        const pctLab =
            pv.mode === 'percent'
                ? Number.isInteger(pv.pct)
                    ? String(pv.pct)
                    : String(pv.pct)
                : '';
        const line1 =
            pv.mode === 'percent'
                ? `<div class="flex justify-between items-center text-xs"><span class="text-gray-500">Giảm (${pctLab}%)</span><span class="font-semibold text-violet-600 tabular-nums">−${formatCurrency(pv.disc)}</span></div>`
                : `<div class="flex justify-between items-center text-xs"><span class="text-gray-500">Giảm</span><span class="font-semibold text-violet-600 tabular-nums">−${formatCurrency(pv.disc)}</span></div>`;
        const lineCh =
            extra > 0
                ? `<div class="flex justify-between items-center text-xs mt-0.5"><span class="text-gray-500">Chẵn thêm</span><span class="font-semibold text-violet-600 tabular-nums">−${formatCurrency(extra)}</span></div>`
                : '';
        preview = `<div class="mt-2 pt-2 border-t border-gray-100 space-y-0.5">${line1}${lineCh}<div class="flex justify-between items-center text-xs pt-0.5"><span class="text-gray-500">Đơn còn</span><span class="font-bold text-gray-900 tabular-nums">${formatCurrency(remainR)}</span></div></div>`;
    }
    wrap.innerHTML = `<div class="flex items-center justify-between gap-3">
    <span class="text-xs text-gray-500">Tổng đơn</span>
    <span class="text-lg font-bold text-gray-900 tabular-nums tracking-tight">${formatCurrency(b)}</span>
  </div>${preview}`;
    dDiscRenderCashSuggestChips();
}

function dDiscManualQuick(pct) {
    if (pct === 0) {
        dDiscManualQuickSel = null;
        dDiscManualFixSel = null;
        const chk = document.getElementById('dDiscRoundChk');
        if (chk) chk.checked = false;
        const inp = document.getElementById('dDiscManualValInput');
        if (inp) inp.value = '';
        const src = document.getElementById('appliedDiscountSource')?.value;
        if (src === 'manual') {
            removeDiscountCode();
        }
        dDiscSyncChipRow();
        dDiscUpdateOrderSummary();
        return;
    }
    const base = getDesktopDiscBaseTotal();
    if (base <= 0) {
        showToast('Thêm sản phẩm trước khi giảm giá', 'warning');
        return;
    }
    dDiscManualQuickSel = pct;
    dDiscManualFixSel = null;
    const inp = document.getElementById('dDiscManualValInput');
    if (inp) inp.value = '';
    dDiscSetManualInputMode('percent');
    dDiscSyncChipRow();
    dDiscUpdateOrderSummary();
}

function dDiscSetTab(tab) {
    const isManual = tab !== 'codes';
    const c = document.getElementById('dDiscTabCodes');
    const m = document.getElementById('dDiscTabManual');
    const active =
        'discount-sheet-tab flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 bg-white text-violet-700 shadow-sm ring-1 ring-black/5';
    const idle =
        'discount-sheet-tab flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 text-gray-500 hover:text-gray-700';
    if (c) {
        c.setAttribute('aria-selected', !isManual);
        c.className = !isManual ? active : idle;
    }
    if (m) {
        m.setAttribute('aria-selected', isManual);
        m.className = isManual ? active : idle;
    }
    document.getElementById('dDiscSearchWrap')?.classList.toggle('hidden', isManual);
    document.getElementById('dDiscPanelCodes')?.classList.toggle('hidden', isManual);
    document.getElementById('dDiscPanelManual')?.classList.toggle('hidden', !isManual);
    if (isManual) {
        dDiscHydrateManualDraft();
        if (!dDiscManualQuickSel && dDiscManualFixSel == null) {
            setTimeout(() => document.getElementById('dDiscManualValInput')?.focus(), 50);
        }
    } else {
        const list = document.getElementById('dDiscSheetList');
        const emptyList = !Array.isArray(allDiscountsList) || allDiscountsList.length === 0;
        const needFetch = typeof loadActiveDiscounts === 'function' && emptyList;
        if (list && needFetch) {
            list.innerHTML =
                '<p class="text-center text-sm text-gray-400 py-8 px-4">Đang tải danh sách mã…</p>';
        }
        const afterLoad = () => {
            if (typeof dDiscRenderCodesList === 'function') dDiscRenderCodesList();
        };
        if (needFetch) {
            void loadActiveDiscounts()
                .then(afterLoad)
                .catch(() => {
                    if (list) {
                        list.innerHTML =
                            '<p class="text-center text-sm text-red-500 py-8 px-4">Không tải được danh sách mã. Thử lại sau.</p>';
                    }
                });
        } else {
            afterLoad();
        }
    }
}

function dDiscHydrateManualDraft() {
    dDiscManualQuickSel = null;
    dDiscManualFixSel = null;
    const inp = document.getElementById('dDiscManualValInput');
    if (inp) inp.value = '';
    const src = document.getElementById('appliedDiscountSource')?.value;
    const rchk = document.getElementById('dDiscRoundChk');
    if (rchk) rchk.checked = src === 'manual' && document.getElementById('appliedDiscountRoundPay')?.value === '1';
    if (src === 'manual') {
        const kind = document.getElementById('appliedDiscountManualKind')?.value;
        const mv = document.getElementById('appliedDiscountManualValue')?.value;
        if (kind === 'fixed') {
            dDiscSetManualInputMode('fixed');
            if (inp && mv) inp.value = String(mv);
        } else {
            const v = Number(mv);
            if ([5, 10, 15].includes(v)) {
                dDiscManualQuickSel = v;
                dDiscSetManualInputMode('percent');
            } else {
                dDiscSetManualInputMode('percent');
                if (inp && mv) inp.value = String(mv);
            }
        }
    } else dDiscSetManualInputMode('percent');
    dDiscSyncChipRow();
    dDiscUpdateOrderSummary();
}

function dDiscDiscountBadgeColor(type) {
    return (
        {
            fixed: 'bg-blue-50 text-blue-700 border-blue-100',
            percentage: 'bg-green-50 text-green-700 border-green-100',
            freeship: 'bg-orange-50 text-orange-700 border-orange-100',
            gift: 'bg-pink-50 text-pink-700 border-pink-100',
        }[type] || 'bg-gray-50 text-gray-700 border-gray-100'
    );
}

function dDiscDiscountValueText(d) {
    if (!d) return '';
    if (d.type === 'fixed') return `-${formatCurrency(d.discount_value)}`;
    if (d.type === 'percentage') {
        let t = `-${d.discount_value}%`;
        if (d.max_discount_amount) t += ` (max ${formatCurrency(d.max_discount_amount)})`;
        return t;
    }
    if (d.type === 'freeship') return 'Miễn ship';
    if (d.type === 'gift') return 'Quà tặng';
    return '';
}

function dDiscRenderCodesList() {
    const q = (document.getElementById('dDiscSearch')?.value || '').toLowerCase();
    const list = document.getElementById('dDiscSheetList');
    if (!list) return;
    let items = typeof allDiscountsList !== 'undefined' ? allDiscountsList : [];
    if (q) {
        items = items.filter(
            (d) =>
                (d.code || '').toLowerCase().includes(q) || (d.title || '').toLowerCase().includes(q)
        );
    }
    list.innerHTML = items.length
        ? items
              .map((d) => {
                  const badge = dDiscDiscountBadgeColor(d.type);
                  const valTxt = dDiscDiscountValueText(d);
                  const minTxt = d.min_order_amount ? `Tối thiểu ${formatCurrency(d.min_order_amount)}` : '';
                  const useTxt = d.max_total_uses
                      ? `Còn ${d.max_total_uses - (d.usage_count || 0)} lượt`
                      : '';
                  return `<button type="button" onclick='dDiscPickCode(${JSON.stringify(String(d.code || ''))})' class="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-gray-100 shadow-sm hover:border-violet-200 hover:bg-violet-50/50 text-left transition-all duration-200 active:scale-[0.995]">
      <div class="shrink-0 w-10 h-10 rounded-xl ${badge} border flex items-center justify-center" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-bold text-gray-900 text-sm font-mono">${escapeHtml(d.code || '')}</span>
          <span class="text-xs px-2 py-0.5 rounded-full border font-medium ${badge}">${escapeHtml(valTxt)}</span>
        </div>
        <p class="text-xs text-gray-600 truncate mt-0.5">${escapeHtml(d.title || '')}</p>
        ${minTxt || useTxt ? `<p class="text-xs text-gray-400 mt-0.5">${[minTxt, useTxt].filter(Boolean).join(' · ')}</p>` : ''}
      </div>
    </button>`;
              })
              .join('')
        : `<p class="text-center text-sm text-gray-500 py-8 px-4">${q ? 'Không tìm thấy mã phù hợp.' : 'Chưa có mã giảm giá hoạt động.'}</p>`;
}

function dDiscPickCode(code) {
    const input = document.getElementById('newOrderDiscountCode');
    if (input) input.value = String(code || '').toUpperCase();
    closeDesktopDiscountSheet();
    applyDiscountCode();
}

function dDiscCommitManual() {
    const base = getDesktopDiscBaseTotal();
    if (base <= 0) {
        showToast('Thêm sản phẩm trước', 'warning');
        return;
    }
    const raw = (document.getElementById('dDiscManualValInput')?.value || '').trim();
    if (!raw && !dDiscManualQuickSel && dDiscManualFixSel == null) {
        showToast('Chọn gợi ý hoặc nhập số', 'warning');
        return;
    }
    const want = document.getElementById('dDiscRoundChk')?.checked;
    let amt;
    let manualKind;
    let manualValue;
    if (raw) {
        if (dDiscManualInputMode === 'percent') {
            const p = parseFloat(raw.replace(/,/g, '.').replace(/\s/g, ''));
            if (!Number.isFinite(p) || p <= 0 || p > 100) {
                showToast('% từ 0,01 đến 100', 'warning');
                return;
            }
            amt = dDiscClampDisc((p / 100) * base, base);
            if (want) amt = dDiscApplyRoundPayToThousand(base, amt);
            manualKind = 'percent';
            manualValue = p;
        } else {
            const v = dDiscParseMoneyInput(raw);
            if (v <= 0) {
                showToast('Số tiền không hợp lệ', 'warning');
                return;
            }
            amt = dDiscClampDisc(v, base);
            if (want) amt = dDiscApplyRoundPayToThousand(base, amt);
            manualKind = 'fixed';
            manualValue = v;
        }
    } else if (dDiscManualQuickSel) {
        const pct = dDiscManualQuickSel;
        amt = dDiscClampDisc((pct / 100) * base, base);
        if (want) amt = dDiscApplyRoundPayToThousand(base, amt);
        manualKind = 'percent';
        manualValue = pct;
    } else {
        const v = dDiscManualFixSel;
        amt = dDiscClampDisc(v, base);
        if (want) amt = dDiscApplyRoundPayToThousand(base, amt);
        manualKind = 'fixed';
        manualValue = v;
    }
    dDiscManualQuickSel = null;
    dDiscManualFixSel = null;
    const input = document.getElementById('newOrderDiscountCode');
    if (input) input.value = '';
    document.getElementById('appliedDiscountId').value = '';
    document.getElementById('appliedDiscountCode').value = DESK_MANUAL_DISCOUNT_CODE;
    document.getElementById('appliedDiscountAmount').value = String(amt);
    document.getElementById('appliedDiscountType').value = 'manual';
    const srcEl = document.getElementById('appliedDiscountSource');
    if (srcEl) srcEl.value = 'manual';
    document.getElementById('appliedDiscountManualKind').value = manualKind;
    document.getElementById('appliedDiscountManualValue').value = String(manualValue);
    document.getElementById('appliedDiscountRoundPay').value = want ? '1' : '0';
    const ch = want ? ' · chẵn' : '';
    const desc =
        manualKind === 'percent'
            ? `Giảm ${manualValue}% · thủ công${ch}`
            : `Giảm cố định · thủ công${ch}`;
    showDiscountSuccess({ code: DESK_MANUAL_DISCOUNT_CODE, type: 'manual', title: desc }, amt);
    updateOrderSummary();
    closeDesktopDiscountSheet();
    showToast('Đã áp dụng giảm thủ công', 'success');
}

function ensureDesktopDiscountSheetMounted() {
    if (dDiscSheetMounted) return;
    const wrap = document.createElement('div');
    wrap.id = 'desktopDiscountSheet';
    wrap.className = 'fixed inset-0 z-[100] hidden flex items-center justify-center p-3 sm:p-6 lg:p-8';
    wrap.innerHTML = `
  <div class="absolute inset-0 bg-slate-900/45" onclick="closeDesktopDiscountSheet()" aria-hidden="true"></div>
  <div class="relative z-10 flex w-full max-w-lg max-h-[min(85vh,640px)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="dDiscModalTitle">
    <div class="shrink-0 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h3 id="dDiscModalTitle" class="text-lg font-bold text-gray-900 tracking-tight">Chọn ưu đãi</h3>
          <p class="text-xs text-gray-500 mt-1 leading-snug">Cùng quy tắc tính giảm với mobile; chỉ khác giao diện.</p>
        </div>
        <button type="button" onclick="closeDesktopDiscountSheet()" class="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors" title="Đóng" aria-label="Đóng">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="flex p-0.5 rounded-xl bg-gray-100 gap-0.5 mt-4" role="tablist">
        <button type="button" id="dDiscTabManual" role="tab" onclick="dDiscSetTab('manual')" class="discount-sheet-tab flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 bg-white text-violet-700 shadow-sm ring-1 ring-black/5">Tùy chỉnh</button>
        <button type="button" id="dDiscTabCodes" role="tab" onclick="dDiscSetTab('codes')" class="discount-sheet-tab flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 text-gray-500 hover:text-gray-700">Mã giảm giá</button>
      </div>
      <div id="dDiscSearchWrap" class="hidden mt-3">
        <input id="dDiscSearch" type="search" placeholder="Tìm mã, tên…" autocomplete="off" class="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/25 focus:border-violet-300" oninput="dDiscRenderCodesList()" />
      </div>
    </div>
    <div class="flex-1 min-h-0 flex flex-col overflow-hidden bg-gray-50">
      <div id="dDiscPanelCodes" class="hidden flex-1 min-h-0 min-h-[min(48vh,400px)] overflow-y-auto overscroll-contain p-4 sm:p-5">
        <div id="dDiscSheetList" class="space-y-2"></div>
      </div>
      <div id="dDiscPanelManual" class="flex-1 min-h-0 flex flex-col min-h-[min(52vh,480px)]">
        <div class="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-3">
          <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div class="flex items-start justify-between gap-2 mb-2">
              <div class="flex items-center gap-2 min-w-0 flex-1">
                <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-600 shrink-0">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                </span>
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-gray-900">Giảm nhanh</p>
                  <p class="text-xs text-gray-500 leading-snug mt-0.5">Chọn % hoặc mức gợi ý, rồi bấm <span class="font-medium text-gray-700">Áp dụng giảm giá</span> bên dưới.</p>
                </div>
              </div>
              <button type="button" onclick="dDiscManualQuick(0)" title="Đặt lại" class="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-violet-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </button>
            </div>
            <div class="flex flex-wrap gap-2" id="dDiscChipRow">
              <button type="button" onclick="dDiscManualQuick(5)" data-mp="5" class="manual-chip min-w-[2.5rem] justify-center flex px-3 py-2 rounded-lg text-sm font-semibold border border-gray-200 bg-white text-gray-700 hover:border-violet-300 hover:bg-violet-50/50 transition-colors active:scale-[0.98]">-5%</button>
              <button type="button" onclick="dDiscManualQuick(10)" data-mp="10" class="manual-chip min-w-[2.5rem] justify-center flex px-3 py-2 rounded-lg text-sm font-semibold border border-gray-200 bg-white text-gray-700 hover:border-violet-300 hover:bg-violet-50/50 transition-colors active:scale-[0.98]">-10%</button>
              <button type="button" onclick="dDiscManualQuick(15)" data-mp="15" class="manual-chip min-w-[2.5rem] justify-center flex px-3 py-2 rounded-lg text-sm font-semibold border border-gray-200 bg-white text-gray-700 hover:border-violet-300 hover:bg-violet-50/50 transition-colors active:scale-[0.98]">-15%</button>
            </div>
            <p class="text-xs text-gray-500 mt-3 leading-snug">Gợi ý chẵn chục nghìn (theo tổng đơn)</p>
            <div class="flex flex-wrap gap-2 mt-2" id="dDiscCashSuggestRow"></div>
          </div>
          <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p class="text-sm font-semibold text-gray-900 mb-0.5">Nhập theo ý bạn</p>
            <p class="text-xs text-gray-500 mb-3">% hoặc đ — áp dụng bằng nút bên dưới.</p>
            <div class="flex gap-2 items-stretch">
              <div class="flex rounded-lg border border-gray-200 p-0.5 bg-gray-50 shrink-0">
                <button type="button" id="dDiscBtnPct" onclick="dDiscSetManualInputMode('percent')" class="px-3 py-2 text-xs font-bold rounded-md bg-white shadow-sm text-violet-700 ring-1 ring-black/5">%</button>
                <button type="button" id="dDiscBtnVnd" onclick="dDiscSetManualInputMode('fixed')" class="px-3 py-2 text-xs font-bold rounded-md text-gray-500">đ</button>
              </div>
              <input type="text" id="dDiscManualValInput" inputmode="decimal" autocomplete="off" placeholder="VD: 8 hoặc 50000" class="flex-1 min-w-0 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/25 focus:border-violet-300" oninput="dDiscOnManualInput()" onkeydown="if(event.key==='Enter'){event.preventDefault();dDiscCommitManual();}" />
            </div>
          </div>
          <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div id="dDiscOrderSummary"></div>
            <div class="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-gray-100">
              <div class="min-w-0 pr-2">
                <p class="text-sm font-medium text-gray-800">Làm chẵn tiền</p>
                <p class="text-xs text-gray-500 leading-snug">Đơn còn xuống chục nghìn (350.550→350.000)</p>
              </div>
              <label class="inline-flex shrink-0 cursor-pointer items-center">
                <input type="checkbox" id="dDiscRoundChk" class="peer sr-only" onchange="dDiscUpdateOrderSummary()" aria-label="Làm chẵn tiền khách trả (xuống chục nghìn)" />
                <span aria-hidden="true" class="relative h-5 w-9 shrink-0 rounded-full bg-gray-200 shadow-inner transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-violet-400 peer-checked:bg-violet-600 after:pointer-events-none after:absolute after:left-[2px] after:top-[2px] after:h-3.5 after:w-3.5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:content-[''] peer-checked:after:translate-x-[18px]"></span>
              </label>
            </div>
          </div>
        </div>
        <div class="shrink-0 border-t border-gray-200 bg-white px-4 py-3 sm:px-5">
          <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button type="button" onclick="closeDesktopDiscountSheet()" class="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Đóng</button>
            <button type="button" onclick="dDiscCommitManual()" class="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold hover:from-violet-700 hover:to-indigo-700 shadow-sm transition-all">Áp dụng giảm giá</button>
          </div>
        </div>
      </div>
    </div>
  </div>`;
    document.body.appendChild(wrap);
    dDiscSheetMounted = true;
}

/** @param {Event} [event] @param {'codes'|'manual'} [prefTab] */
async function openDesktopDiscountSheet(event, prefTab) {
    if (event) event.stopPropagation();
    ensureDesktopDiscountSheetMounted();
    const sheet = document.getElementById('desktopDiscountSheet');
    if (!document.getElementById('newOrderDiscountCode')) {
        showToast('Mở form đơn hàng trước', 'warning');
        return;
    }
    dDiscSetTab(prefTab === 'codes' ? 'codes' : 'manual');
    const search = document.getElementById('dDiscSearch');
    if (search) search.value = '';
    if (prefTab === 'codes' || prefTab === 'manual') {
        /* tab already set */
    }
    if (prefTab === 'codes') {
        const list = document.getElementById('dDiscSheetList');
        if (list) list.innerHTML = '<p class="text-center text-sm text-gray-400 py-6">Đang tải...</p>';
        if (typeof allDiscountsList !== 'undefined' && allDiscountsList.length === 0 && typeof loadActiveDiscounts === 'function') {
            await loadActiveDiscounts();
        }
        dDiscRenderCodesList();
    } else {
        dDiscHydrateManualDraft();
    }
    sheet.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeDesktopDiscountSheet() {
    const sheet = document.getElementById('desktopDiscountSheet');
    if (sheet) sheet.classList.add('hidden');
    document.body.style.overflow = '';
}

function maybeRefreshDesktopDiscountSheet() {
    const sh = document.getElementById('desktopDiscountSheet');
    if (!sh || sh.classList.contains('hidden')) return;
    const mp = document.getElementById('dDiscPanelManual');
    if (mp && !mp.classList.contains('hidden')) dDiscUpdateOrderSummary();
}

/** Gọi từ updateOrderSummary khi đang áp dụng giảm thủ công — đồng bộ mobile recalcManualDiscount */
function recalcDesktopManualDiscount() {
    const src = document.getElementById('appliedDiscountSource')?.value;
    if (src !== 'manual') return;
    const kind = document.getElementById('appliedDiscountManualKind')?.value;
    const rawVal = document.getElementById('appliedDiscountManualValue')?.value;
    const round = document.getElementById('appliedDiscountRoundPay')?.value === '1';
    const base = getDesktopDiscBaseTotal();
    if (base <= 0) {
        document.getElementById('appliedDiscountAmount').value = '0';
        return;
    }
    let amt = 0;
    const mv = parseFloat(rawVal);
    if (kind === 'percent' && Number.isFinite(mv) && mv > 0) {
        amt = dDiscClampDisc((mv / 100) * base, base);
    } else if (kind === 'fixed' && Number.isFinite(mv) && mv >= 0) {
        amt = dDiscClampDisc(mv, base);
    }
    if (round) amt = dDiscApplyRoundPayToThousand(base, amt);
    document.getElementById('appliedDiscountAmount').value = String(amt);
    const ch = round ? ' · chẵn' : '';
    const desc =
        kind === 'percent'
            ? `Giảm ${mv}% · thủ công${ch}`
            : `Giảm cố định · thủ công${ch}`;
    showDiscountSuccess({ code: DESK_MANUAL_DISCOUNT_CODE, type: 'manual', title: desc }, amt);
}

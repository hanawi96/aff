/**
 * Admin — Mã theo dõi (Pixel / GTM / Google Ads).
 */
(function () {
  'use strict';

  let tracking = null;
  let saving = false;

  function apiUrl(action) {
    return `${CONFIG.API_URL}?action=${encodeURIComponent(action)}&timestamp=${Date.now()}`;
  }

  function toast(msg, type) {
    if (typeof showToast === 'function') showToast(msg, type || 'info');
    else console.log(`[${type}]`, msg);
  }

  function fillTrackingForm(t) {
    tracking = t || {};
    const gtm = document.getElementById('mktGtmId');
    const meta = document.getElementById('mktMetaId');
    const ads = document.getElementById('mktAdsId');
    const gtmEn = document.getElementById('mktGtmEnabled');
    const metaEn = document.getElementById('mktMetaEnabled');
    const adsEn = document.getElementById('mktAdsEnabled');
    if (gtm) gtm.value = tracking.gtm_id || '';
    if (meta) meta.value = tracking.meta_pixel_id || '';
    if (ads) ads.value = tracking.google_ads_id || '';
    if (gtmEn) gtmEn.checked = tracking.gtm_enabled !== false;
    if (metaEn) metaEn.checked = tracking.meta_enabled !== false;
    if (adsEn) adsEn.checked = tracking.google_ads_enabled !== false;
    updateTrackingHints();
  }

  function updateTrackingHints() {
    const gtm = (document.getElementById('mktGtmId')?.value || '').trim();
    const hint = document.getElementById('mktAdsHint');
    if (!hint) return;
    if (gtm) {
      hint.textContent = 'Đang có GTM: nên cấu hình Google Ads / Pixel bên trong GTM. ID Ads trực tiếp chỉ dùng khi không dùng GTM.';
    } else {
      hint.textContent = 'Chưa có GTM: site sẽ gắn Google Ads / Meta Pixel trực tiếp từ các ID bên dưới.';
    }
  }

  async function loadTracking() {
    const status = document.getElementById('mktTrackingStatus');
    if (status) status.textContent = 'Đang tải…';
    try {
      const res = await fetch(apiUrl('getMarketingTracking'));
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Không tải được cấu hình');
      fillTrackingForm(data.tracking);
      if (status) status.textContent = 'Đã đồng bộ';
    } catch (err) {
      console.error(err);
      if (status) status.textContent = 'Lỗi tải';
      toast(err.message || 'Không tải được mã theo dõi', 'error');
    }
  }

  async function saveTracking(e) {
    e?.preventDefault();
    if (saving) return;
    saving = true;
    const btn = document.getElementById('mktSaveTrackingBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Đang lưu…';
    }
    try {
      const body = {
        action: 'updateMarketingTracking',
        gtm_id: document.getElementById('mktGtmId')?.value || '',
        meta_pixel_id: document.getElementById('mktMetaId')?.value || '',
        google_ads_id: document.getElementById('mktAdsId')?.value || '',
        gtm_enabled: !!document.getElementById('mktGtmEnabled')?.checked,
        meta_enabled: !!document.getElementById('mktMetaEnabled')?.checked,
        google_ads_enabled: !!document.getElementById('mktAdsEnabled')?.checked
      };
      const res = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Lưu thất bại');
      fillTrackingForm(data.tracking);
      toast('Đã lưu mã theo dõi', 'success');
    } catch (err) {
      toast(err.message || 'Không lưu được', 'error');
    } finally {
      saving = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Lưu cấu hình';
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('mktTrackingForm')?.addEventListener('submit', saveTracking);
    document.getElementById('mktGtmId')?.addEventListener('input', updateTrackingHints);
    loadTracking();
  });
})();

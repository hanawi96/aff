/**
 * Admin — Mã theo dõi + Trang bán (landing).
 */
(function () {
  'use strict';

  let activeTab = 'tracking';
  let tracking = null;
  let pages = [];
  let editingId = null;
  let saving = false;

  const SHOP_ORIGIN = (() => {
    try {
      if (typeof CONFIG !== 'undefined' && CONFIG.SHOP_URL) return CONFIG.SHOP_URL.replace(/\/$/, '');
    } catch (e) { /* ignore */ }
    const host = location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return `${location.protocol}//${location.host}`;
    }
    return 'https://shopvd.store';
  })();

  function apiUrl(action) {
    return `${CONFIG.API_URL}?action=${encodeURIComponent(action)}&timestamp=${Date.now()}`;
  }

  function toast(msg, type) {
    if (typeof showToast === 'function') showToast(msg, type || 'info');
    else console.log(`[${type}]`, msg);
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function slugify(input) {
    return String(input || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64);
  }

  function publicPageUrl(slug) {
    return `${SHOP_ORIGIN}/p/?page=${encodeURIComponent(slug)}`;
  }

  function setTab(tab) {
    activeTab = tab;
    document.querySelectorAll('[data-mkt-tab]').forEach((btn) => {
      const on = btn.getAttribute('data-mkt-tab') === tab;
      btn.classList.toggle('mkt-tab--active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.getElementById('mktPanelTracking')?.classList.toggle('hidden', tab !== 'tracking');
    document.getElementById('mktPanelPages')?.classList.toggle('hidden', tab !== 'pages');
    if (tab === 'pages' && pages.length === 0) loadPages();
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

  function renderPages() {
    const list = document.getElementById('mktPagesList');
    const empty = document.getElementById('mktPagesEmpty');
    if (!list) return;

    if (!pages.length) {
      list.innerHTML = '';
      empty?.classList.remove('hidden');
      return;
    }
    empty?.classList.add('hidden');

    list.innerHTML = pages.map((p) => {
      const url = publicPageUrl(p.slug);
      const active = p.is_active;
      return `
        <article class="mkt-page-card" data-id="${p.id}">
          <div class="mkt-page-card-main">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="text-base font-semibold text-slate-900 truncate">${esc(p.name)}</h3>
                  <span class="mkt-badge ${active ? 'mkt-badge--on' : 'mkt-badge--off'}">${active ? 'Đang bật' : 'Đã tắt'}</span>
                </div>
                <p class="mt-1 text-sm text-slate-500 truncate">${esc(p.headline || 'Chưa có tiêu đề hero')}</p>
              </div>
            </div>
            <div class="mkt-page-link-row">
              <code class="mkt-page-url">${esc(url)}</code>
              <button type="button" class="mkt-icon-btn" data-copy="${esc(url)}" title="Sao chép link">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
              </button>
            </div>
          </div>
          <div class="mkt-page-card-actions">
            <button type="button" class="mkt-btn-ghost" data-edit="${p.id}">Sửa</button>
            <button type="button" class="mkt-btn-ghost mkt-btn-danger" data-delete="${p.id}">Xóa</button>
          </div>
        </article>
      `;
    }).join('');
  }

  async function loadPages() {
    const status = document.getElementById('mktPagesStatus');
    if (status) status.textContent = 'Đang tải…';
    try {
      const res = await fetch(apiUrl('listLandingPages'));
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Không tải được danh sách');
      pages = data.pages || [];
      renderPages();
      if (status) status.textContent = `${pages.length} trang`;
    } catch (err) {
      console.error(err);
      if (status) status.textContent = 'Lỗi';
      toast(err.message || 'Không tải được trang bán', 'error');
    }
  }

  function openPageModal(page) {
    editingId = page?.id || null;
    const title = document.getElementById('mktPageModalTitle');
    if (title) title.textContent = editingId ? 'Sửa trang bán' : 'Tạo trang bán';

    document.getElementById('mktPageName').value = page?.name || '';
    document.getElementById('mktPageSlug').value = page?.slug || '';
    document.getElementById('mktPageHeadline').value = page?.headline || '';
    document.getElementById('mktPageSub').value = page?.subheadline || '';
    document.getElementById('mktPageCtaText').value = page?.cta_text || 'Xem sản phẩm';
    document.getElementById('mktPageCtaUrl').value = page?.cta_url || '/#products';
    document.getElementById('mktPageImage').value = page?.hero_image_url || '';
    document.getElementById('mktPageNotes').value = page?.notes || '';
    document.getElementById('mktPageActive').checked = page ? !!page.is_active : true;
    updateSlugPreview();

    document.getElementById('mktPageModal')?.classList.remove('hidden');
    document.getElementById('mktPageName')?.focus();
  }

  function closePageModal() {
    document.getElementById('mktPageModal')?.classList.add('hidden');
    editingId = null;
  }

  function updateSlugPreview() {
    const slugInput = document.getElementById('mktPageSlug');
    const name = document.getElementById('mktPageName')?.value || '';
    if (slugInput && !slugInput.dataset.touched) {
      slugInput.value = slugify(name);
    }
    const slug = slugify(slugInput?.value || name);
    const preview = document.getElementById('mktSlugPreview');
    if (preview) preview.textContent = slug ? publicPageUrl(slug) : '—';
  }

  async function savePage(e) {
    e?.preventDefault();
    if (saving) return;
    saving = true;
    const btn = document.getElementById('mktSavePageBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Đang lưu…';
    }
    try {
      const body = {
        action: 'saveLandingPage',
        id: editingId || undefined,
        name: document.getElementById('mktPageName')?.value || '',
        slug: document.getElementById('mktPageSlug')?.value || '',
        headline: document.getElementById('mktPageHeadline')?.value || '',
        subheadline: document.getElementById('mktPageSub')?.value || '',
        cta_text: document.getElementById('mktPageCtaText')?.value || '',
        cta_url: document.getElementById('mktPageCtaUrl')?.value || '',
        hero_image_url: document.getElementById('mktPageImage')?.value || '',
        notes: document.getElementById('mktPageNotes')?.value || '',
        is_active: !!document.getElementById('mktPageActive')?.checked
      };
      const res = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Lưu thất bại');
      toast(data.message || 'Đã lưu', 'success');
      closePageModal();
      await loadPages();
    } catch (err) {
      toast(err.message || 'Không lưu được trang', 'error');
    } finally {
      saving = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Lưu trang';
      }
    }
  }

  async function deletePage(id) {
    const page = pages.find((p) => Number(p.id) === Number(id));
    if (!confirm(`Xóa trang "${page?.name || id}"? Không hoàn tác được.`)) return;
    try {
      const res = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteLandingPage', id })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Xóa thất bại');
      toast('Đã xóa trang bán', 'success');
      await loadPages();
    } catch (err) {
      toast(err.message || 'Không xóa được', 'error');
    }
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast('Đã sao chép link', 'success');
    } catch (e) {
      toast('Không sao chép được', 'warning');
    }
  }

  function bind() {
    document.querySelectorAll('[data-mkt-tab]').forEach((btn) => {
      btn.addEventListener('click', () => setTab(btn.getAttribute('data-mkt-tab')));
    });

    document.getElementById('mktTrackingForm')?.addEventListener('submit', saveTracking);
    document.getElementById('mktGtmId')?.addEventListener('input', updateTrackingHints);

    document.getElementById('mktCreatePageBtn')?.addEventListener('click', () => {
      const slugInput = document.getElementById('mktPageSlug');
      if (slugInput) delete slugInput.dataset.touched;
      openPageModal(null);
    });
    document.getElementById('mktPageModalClose')?.addEventListener('click', closePageModal);
    document.getElementById('mktPageModalBackdrop')?.addEventListener('click', closePageModal);
    document.getElementById('mktPageForm')?.addEventListener('submit', savePage);

    document.getElementById('mktPageName')?.addEventListener('input', updateSlugPreview);
    document.getElementById('mktPageSlug')?.addEventListener('input', (e) => {
      e.target.dataset.touched = '1';
      updateSlugPreview();
    });

    document.getElementById('mktPagesList')?.addEventListener('click', (e) => {
      const copyBtn = e.target.closest('[data-copy]');
      if (copyBtn) {
        copyText(copyBtn.getAttribute('data-copy'));
        return;
      }
      const editBtn = e.target.closest('[data-edit]');
      if (editBtn) {
        const id = Number(editBtn.getAttribute('data-edit'));
        const page = pages.find((p) => Number(p.id) === id);
        if (page) {
          const slugInput = document.getElementById('mktPageSlug');
          if (slugInput) slugInput.dataset.touched = '1';
          openPageModal(page);
        }
        return;
      }
      const delBtn = e.target.closest('[data-delete]');
      if (delBtn) deletePage(delBtn.getAttribute('data-delete'));
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closePageModal();
    });

    const hash = (location.hash || '').replace('#', '');
    if (hash === 'pages') setTab('pages');
    else setTab('tracking');
  }

  document.addEventListener('DOMContentLoaded', () => {
    bind();
    loadTracking();
  });
})();

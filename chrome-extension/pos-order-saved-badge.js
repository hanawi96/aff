/**
 * ShopVD — badge "Đã lưu" cạnh SĐT trên trang đơn Pancake POS
 * https://pos.pancake.vn/shop/{id}/order
 *
 * Nhẹ: không load sidebar. Virtual table AntD → observer + cache.
 */
(function () {
  const API_BASE_URL = 'https://ctv-api.yendev96.workers.dev';
  const CACHE_TTL_MS = 5 * 60 * 1000;
  const SCAN_DEBOUNCE_MS = 220;
  const CHECK_CONCURRENCY = 4;
  const BADGE_CLASS = 'shopvd-pos-saved-badge';
  const MARK_ATTR = 'data-shopvd-saved-phone';

  /** phone → { saved, reason, at } */
  const savedCache = new Map();
  const inflight = new Map();
  let scanTimer = 0;
  let observer = null;
  let urlWatchBound = false;

  function isPosOrderPage() {
    const { hostname, pathname } = window.location;
    return hostname === 'pos.pancake.vn' && /\/shop\/\d+\/order\/?$/i.test(pathname);
  }

  function sanitizePhone(raw) {
    let digits = String(raw || '').replace(/\D/g, '');
    if (digits.startsWith('84') && digits.length >= 11) digits = `0${digits.slice(2)}`;
    return digits;
  }

  function isValidPhone(phone) {
    return /^0\d{8,10}$/.test(phone);
  }

  function shopvdFetch(url, init) {
    const fn = globalThis.shopvdFetch || fetch;
    return fn(url, init);
  }

  async function fetchSavedState(phone) {
    const cached = savedCache.get(phone);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached;

    if (inflight.has(phone)) return inflight.get(phone);

    const p = (async () => {
      try {
        const url = `${API_BASE_URL}/?action=checkPhoneSavedState&phone=${encodeURIComponent(phone)}&timestamp=${Date.now()}`;
        const res = await shopvdFetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
        const data = await res.json();
        const entry = {
          saved: !!(data?.success && data.saved),
          reason: data?.reason || '',
          at: Date.now(),
        };
        savedCache.set(phone, entry);
        return entry;
      } catch (_) {
        return { saved: false, reason: 'error', at: Date.now() - CACHE_TTL_MS + 15000 };
      } finally {
        inflight.delete(phone);
      }
    })();

    inflight.set(phone, p);
    return p;
  }

  function reasonLabel(reason) {
    switch (reason) {
      case 'unshipped': return 'Còn đơn chờ gửi trên ShopVD';
      case 'recent_ship': return 'Vừa gửi hàng (trong 7 ngày) trên ShopVD';
      case 'stale_intent': return 'Đã có đơn gửi hàng trên ShopVD';
      default: return 'Đã lưu trên ShopVD';
    }
  }

  function ensureBadge(cell, phone, state) {
    let badge = cell.querySelector(`.${BADGE_CLASS}`);
    if (!state.saved) {
      badge?.remove();
      cell.setAttribute(MARK_ATTR, phone);
      return;
    }

    if (!badge) {
      badge = document.createElement('span');
      badge.className = BADGE_CLASS;
      badge.textContent = 'Đã lưu';

      const align = cell.querySelector('.align-center');
      const slot = align?.querySelector('span.align-center');
      if (slot) {
        slot.appendChild(badge);
      } else if (align) {
        align.appendChild(badge);
      } else {
        cell.appendChild(badge);
      }
    }

    badge.title = reasonLabel(state.reason);
    badge.dataset.reason = state.reason || '';
    cell.setAttribute(MARK_ATTR, phone);
  }

  function extractPhoneFromCell(cell) {
    const title = sanitizePhone(cell.getAttribute('title') || '');
    if (isValidPhone(title)) return title;

    const link = cell.querySelector('a');
    const fromLink = sanitizePhone(link?.textContent || '');
    if (isValidPhone(fromLink)) return fromLink;

    return '';
  }

  function collectPhoneCells(root = document) {
    const cells = root.querySelectorAll?.('.ant-table-row .ant-table-cell[title]') || [];
    const out = [];
    cells.forEach((cell) => {
      if (cell.closest?.('#shopvd-sidebar')) return;
      const phone = extractPhoneFromCell(cell);
      if (!phone) return;
      out.push({ cell, phone });
    });
    return out;
  }

  async function mapPool(items, limit, worker) {
    let idx = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (idx < items.length) {
        const i = idx;
        idx += 1;
        await worker(items[i], i);
      }
    });
    await Promise.all(runners);
  }

  async function scanAndBadge() {
    if (!isPosOrderPage()) return;

    const pairs = collectPhoneCells();
    if (!pairs.length) return;

    // Chỉ check SĐT chưa cache / hết hạn
    const unique = [];
    const seen = new Set();
    for (const { phone } of pairs) {
      if (seen.has(phone)) continue;
      seen.add(phone);
      const cached = savedCache.get(phone);
      if (cached && Date.now() - cached.at < CACHE_TTL_MS) continue;
      unique.push(phone);
    }

    if (unique.length) {
      await mapPool(unique, CHECK_CONCURRENCY, async (phone) => {
        await fetchSavedState(phone);
      });
    }

    for (const { cell, phone } of pairs) {
      const state = savedCache.get(phone) || { saved: false, reason: '' };
      // Virtual row tái sử dụng DOM — luôn sync theo phone hiện tại
      if (cell.getAttribute(MARK_ATTR) === phone) {
        const hasBadge = !!cell.querySelector(`.${BADGE_CLASS}`);
        if (hasBadge === !!state.saved) continue;
      }
      ensureBadge(cell, phone, state);
    }
  }

  function scheduleScan(delay = SCAN_DEBOUNCE_MS) {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => {
      scanAndBadge().catch(() => {});
    }, delay);
  }

  function findTableRoot() {
    return document.querySelector('.ant-table-tbody-virtual, .ant-table-tbody, .ant-table') || document.body;
  }

  function bindObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (!isPosOrderPage()) return;

    const root = findTableRoot();
    observer = new MutationObserver(() => scheduleScan());
    observer.observe(root, { childList: true, subtree: true });
    scheduleScan(80);
  }

  function bindUrlWatch() {
    if (urlWatchBound) return;
    urlWatchBound = true;

    let last = location.href;
    const onNav = () => {
      if (location.href === last) return;
      last = location.href;
      if (isPosOrderPage()) {
        bindObserver();
      } else {
        observer?.disconnect();
        observer = null;
        document.querySelectorAll(`.${BADGE_CLASS}`).forEach((el) => el.remove());
      }
    };

    window.addEventListener('popstate', onNav);
    const wrap = (fn) => function (...args) {
      const r = fn.apply(this, args);
      onNav();
      return r;
    };
    history.pushState = wrap(history.pushState.bind(history));
    history.replaceState = wrap(history.replaceState.bind(history));
  }

  function init() {
    bindUrlWatch();
    if (!isPosOrderPage()) return;
    bindObserver();
    // POS hydrate chậm
    setTimeout(() => scheduleScan(0), 600);
    setTimeout(() => scheduleScan(0), 1800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

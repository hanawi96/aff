// ShopVD — proxy fetch qua service worker (tránh CSP Zalo chặn content-script fetch)

/** Chỉ cho phép đọc file JSON đóng gói trong extension. */
const LOCAL_ASSET_ALLOW = new Set([
  'data/tree_2.json',
  'data/ward_mapping_2025.json',
]);

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return false;

  // Đọc JSON local trong package (không phụ thuộc domain / không cần web_accessible_resources).
  if (msg.type === 'SHOPVD_LOAD_ASSET') {
    const path = String(msg.path || '').replace(/^\/+/, '');
    if (!LOCAL_ASSET_ALLOW.has(path)) {
      sendResponse({ error: 'Asset not allowed' });
      return false;
    }

    (async () => {
      try {
        const url = chrome.runtime.getURL(path);
        const res = await fetch(url);
        if (!res.ok) {
          sendResponse({ error: `HTTP ${res.status}` });
          return;
        }
        const body = await res.text();
        sendResponse({ ok: true, status: res.status, body });
      } catch (err) {
        sendResponse({ error: String(err?.message || err || 'Failed to load asset') });
      }
    })();

    return true;
  }

  if (msg.type !== 'SHOPVD_FETCH') return false;

  const url = String(msg.url || '');
  if (!/^https:\/\//i.test(url)) {
    sendResponse({ error: 'Invalid URL' });
    return false;
  }

  const init = msg.init && typeof msg.init === 'object' ? { ...msg.init } : {};
  delete init.signal;

  (async () => {
    try {
      const res = await fetch(url, init);
      const body = await res.text();
      const headers = {};
      res.headers.forEach((value, key) => {
        headers[key] = value;
      });
      sendResponse({
        ok: res.ok,
        status: res.status,
        statusText: res.statusText,
        headers,
        body,
      });
    } catch (err) {
      sendResponse({ error: String(err?.message || err || 'Failed to fetch') });
    }
  })();

  return true; // async response
});

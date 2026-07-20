// ShopVD — proxy fetch qua service worker (tránh CSP Zalo chặn content-script fetch)

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== 'SHOPVD_FETCH') return false;

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

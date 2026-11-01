// ShopVD — fetch qua background (Zalo/CSP không chặn được SW)
(function () {
  const nativeFetch = globalThis.fetch.bind(globalThis);

  /**
   * Load JSON đóng gói trong extension qua service worker.
   * Content script không fetch được chrome-extension:// (CSP / package isolation).
   */
  async function shopvdLoadAsset(path) {
    const assetPath = String(path || '').replace(/^\/+/, '');
    if (!assetPath) throw new TypeError('Missing asset path');

    if (typeof chrome === 'undefined' || !chrome.runtime?.id) {
      const res = await nativeFetch(assetPath);
      if (!res.ok) throw new TypeError(`Failed to load asset HTTP ${res.status}`);
      return res.json();
    }

    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(
          { type: 'SHOPVD_LOAD_ASSET', path: assetPath },
          (resp) => {
            const runtimeErr = chrome.runtime.lastError?.message;
            if (runtimeErr) {
              reject(new Error(runtimeErr));
              return;
            }
            if (!resp || resp.error) {
              reject(new TypeError(resp?.error || 'Failed to load asset'));
              return;
            }
            try {
              resolve(JSON.parse(resp.body || 'null'));
            } catch (err) {
              reject(err);
            }
          }
        );
      } catch (err) {
        reject(err);
      }
    });
  }

  async function shopvdFetch(url, init = {}) {
    const options = init && typeof init === 'object' ? { ...init } : {};
    const { signal } = options;
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const canProxy = typeof chrome !== 'undefined' && !!chrome.runtime?.id;
    if (canProxy) {
      const proxyPromise = new Promise((resolve, reject) => {
        try {
          chrome.runtime.sendMessage(
            {
              type: 'SHOPVD_FETCH',
              url: String(url),
              init: {
                method: options.method || 'GET',
                headers: options.headers,
                body: options.body,
                cache: options.cache,
                credentials: options.credentials,
                mode: options.mode,
                redirect: options.redirect,
              },
            },
            (resp) => {
              const runtimeErr = chrome.runtime.lastError?.message;
              if (runtimeErr) {
                reject(new Error(runtimeErr));
                return;
              }
              if (!resp) {
                reject(new TypeError('Failed to fetch'));
                return;
              }
              if (resp.error) {
                reject(new TypeError(resp.error));
                return;
              }
              resolve(
                new Response(resp.body ?? '', {
                  status: resp.status || 0,
                  statusText: resp.statusText || '',
                  headers: resp.headers || {},
                })
              );
            }
          );
        } catch (err) {
          reject(err);
        }
      });

      try {
        if (!signal) return await proxyPromise;
        return await Promise.race([
          proxyPromise,
          new Promise((_, reject) => {
            const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
            signal.addEventListener('abort', onAbort, { once: true });
          }),
        ]);
      } catch (err) {
        const msg = String(err?.message || err || '');
        // Context chết / chưa có SW — fallback native (Pancake vẫn OK)
        if (!/extension context|receiving end does not exist|message port closed/i.test(msg)) {
          throw err;
        }
      }
    }

    return nativeFetch(url, init);
  }

  globalThis.shopvdFetch = shopvdFetch;
  globalThis.shopvdLoadAsset = shopvdLoadAsset;
})();

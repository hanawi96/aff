/**
 * ShopVD — inject GTM / Meta Pixel / Google Ads từ API.
 * Gắn sớm trong <head> trên trang khách. Không chạy trên /admin.
 */
(function (global) {
  'use strict';

  if (global.__vdMarketingLoaderStarted) return;
  global.__vdMarketingLoaderStarted = true;

  var LANDING_KEY = 'vd_landing_page';
  var CACHE_KEY = 'vd_marketing_tracking_v1';
  var DURABLE_CACHE_KEY = 'vd_marketing_tracking_durable_v1';
  var CACHE_TTL_MS = 5 * 60 * 1000;
  var readyResolve;
  var readyPromise = new Promise(function (resolve) {
    readyResolve = resolve;
  });

  function toNumber(v) {
    var n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function normalizeContents(list) {
    if (!Array.isArray(list)) return [];
    return list.map(function (item) {
      return {
        id: String(item.id != null ? item.id : item.item_id || ''),
        quantity: Math.max(1, Math.round(toNumber(item.quantity) || 1)),
        item_price: toNumber(item.item_price != null ? item.item_price : item.price)
      };
    }).filter(function (c) { return c.id; });
  }

  function markReady() {
    try { readyResolve(); } catch (e) { /* ignore */ }
  }

  function resolveApiBase() {
    try {
      if (global.CONFIG && global.CONFIG.API_URL) return global.CONFIG.API_URL;
      if (global.localStorage && global.localStorage.getItem('force_remote_api') === '1') {
        return 'https://ctv-api.yendev96.workers.dev';
      }
      var host = global.location && global.location.hostname;
      if (host === 'localhost' || host === '127.0.0.1') {
        return 'http://127.0.0.1:8787';
      }
    } catch (e) { /* ignore */ }
    return 'https://ctv-api.yendev96.workers.dev';
  }

  function readCache() {
    try {
      var raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.at || Date.now() - parsed.at > CACHE_TTL_MS) return null;
      return parsed.tracking || null;
    } catch (e) {
      return null;
    }
  }

  function readDurableCache() {
    try {
      var raw = localStorage.getItem(DURABLE_CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return (parsed && parsed.tracking) ? parsed.tracking : null;
    } catch (e) {
      return null;
    }
  }

  function writeCache(tracking) {
    try {
      var payload = JSON.stringify({ at: Date.now(), tracking: tracking || {} });
      sessionStorage.setItem(CACHE_KEY, payload);
      localStorage.setItem(DURABLE_CACHE_KEY, payload);
    } catch (e) { /* ignore */ }
  }

  function detectPageKey() {
    try {
      var params = new URLSearchParams(global.location.search || '');
      var fromQuery = (params.get('page') || params.get('lp') || '').trim();
      if (fromQuery) return fromQuery.toLowerCase();

      var path = (global.location.pathname || '').replace(/\/+$/, '');
      var parts = path.split('/').filter(Boolean);
      // /p/vong-dau.html hoặc /p/tet — lấy tên file (bỏ .html)
      if (parts[0] === 'p' && parts[1] && parts[1] !== 'index.html') {
        var key = decodeURIComponent(parts[1]).toLowerCase().replace(/\.html?$/i, '');
        return key || '';
      }

      var stored = sessionStorage.getItem(LANDING_KEY);
      return stored ? String(stored).toLowerCase() : '';
    } catch (e) {
      return '';
    }
  }

  function rememberPageKey(pageKey) {
    if (!pageKey) return;
    try {
      sessionStorage.setItem(LANDING_KEY, pageKey);
    } catch (e) { /* ignore */ }
  }

  function pushDataLayer(obj) {
    global.dataLayer = global.dataLayer || [];
    global.dataLayer.push(obj);
  }

  function injectGtm(gtmId) {
    if (!gtmId || global.__vdGtmInjected) return;
    global.__vdGtmInjected = true;

    pushDataLayer({ 'gtm.start': Date.now(), event: 'gtm.js' });

    var first = document.getElementsByTagName('script')[0];
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(gtmId);
    if (first && first.parentNode) first.parentNode.insertBefore(s, first);
    else document.head.appendChild(s);

    // noscript iframe — append to body when ready
    function addNoscript() {
      if (document.getElementById('vd-gtm-noscript')) return;
      var ns = document.createElement('noscript');
      ns.id = 'vd-gtm-noscript';
      ns.innerHTML = '<iframe src="https://www.googletagmanager.com/ns.html?id=' +
        encodeURIComponent(gtmId) +
        '" height="0" width="0" style="display:none;visibility:hidden"></iframe>';
      if (document.body) document.body.insertBefore(ns, document.body.firstChild);
      else document.addEventListener('DOMContentLoaded', function () {
        if (document.body) document.body.insertBefore(ns, document.body.firstChild);
      });
    }
    addNoscript();
  }

  function injectMetaPixel(pixelId) {
    if (!pixelId || global.__vdMetaInjected) return;
    global.__vdMetaInjected = true;
    global.__vdMetaPixelId = String(pixelId);

    if (!global.fbq) {
      /* eslint-disable */
      !(function (f, b, e, v, n, t, s) {
        if (f.fbq) return;
        n = f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = !0;
        n.version = '2.0';
        n.queue = [];
        t = b.createElement(e);
        t.async = !0;
        t.src = v;
        s = b.getElementsByTagName(e)[0];
        if (s && s.parentNode) s.parentNode.insertBefore(t, s);
        else (b.head || b.documentElement).appendChild(t);
      })(global, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      /* eslint-enable */
    }

    try {
      global.fbq('init', pixelId);
      global.fbq('track', 'PageView');
    } catch (e) {
      console.warn('[marketing-loader] meta init failed', e);
    }

    // noscript fallback — Meta khuyến nghị; giúp một số tool nhận diện Pixel rõ hơn
    function addNoscriptPixel() {
      if (document.getElementById('vd-meta-pixel-noscript')) return;
      var ns = document.createElement('noscript');
      ns.id = 'vd-meta-pixel-noscript';
      ns.innerHTML = '<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=' +
        encodeURIComponent(pixelId) +
        '&ev=PageView&noscript=1" alt="" />';
      if (document.body) document.body.appendChild(ns);
      else document.addEventListener('DOMContentLoaded', function () {
        if (document.body && !document.getElementById('vd-meta-pixel-noscript')) {
          document.body.appendChild(ns);
        }
      });
    }
    addNoscriptPixel();
  }

  function injectGoogleAds(adsId) {
    if (!adsId || global.__vdGtagAdsInjected) return;
    // Nếu đã có GTM, Ads nên cấu hình trong GTM — tránh double-load trừ khi chưa có GTM
    if (global.__vdGtmInjected) return;
    global.__vdGtagAdsInjected = true;

    global.dataLayer = global.dataLayer || [];
    if (typeof global.gtag !== 'function') {
      global.gtag = function () {
        global.dataLayer.push(arguments);
      };
    }

    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(adsId);
    document.head.appendChild(s);

    global.gtag('js', new Date());
    global.gtag('config', adsId);
  }

  function applyTracking(tracking, pageKey) {
    if (!tracking) return;

    if (pageKey) {
      rememberPageKey(pageKey);
      pushDataLayer({
        event: 'vd_page_context',
        page_key: pageKey,
        page_path: (global.location && global.location.pathname) || ''
      });
    }

    if (tracking.gtm_id) injectGtm(tracking.gtm_id);
    if (tracking.meta_pixel_id) injectMetaPixel(tracking.meta_pixel_id);
    if (tracking.google_ads_id) injectGoogleAds(tracking.google_ads_id);
  }

  async function fetchTracking(apiBase) {
    var url = apiBase + '?action=getPublicMarketingTracking&timestamp=' + Date.now();
    try {
      var res = await fetch(url);
      var data = await res.json();
      if (!data || !data.success) throw new Error((data && data.error) || 'load tracking failed');
      writeCache(data.tracking || {});
      return data.tracking || {};
    } catch (err) {
      var fallback = readCache() || readDurableCache();
      if (fallback) return fallback;
      throw err;
    }
  }

  async function boot() {
    var pageKey = detectPageKey();
    if (pageKey) rememberPageKey(pageKey);

    // Gắn ngay từ cache (session/local) trước khi chờ API — tránh Helper báo "hasn't fired"
    var early = readCache() || readDurableCache();
    if (early) applyTracking(early, pageKey);

    try {
      var tracking = await fetchTracking(resolveApiBase());
      // Chỉ gắn thêm kênh chưa inject (applyTracking có guard __vd*Injected)
      applyTracking(tracking, pageKey);
      writeCache(tracking);
    } catch (err) {
      console.warn('[marketing-loader]', err && err.message ? err.message : err);
    } finally {
      markReady();
    }
  }

  function fireFbq(standardEvent, payload) {
    if (typeof global.fbq !== 'function') return;
    try {
      global.fbq('track', standardEvent, payload || {});
    } catch (e) { /* ignore */ }
  }

  function fireGtag(eventName, payload) {
    if (typeof global.gtag !== 'function') return;
    try {
      global.gtag('event', eventName, payload || {});
    } catch (e) { /* ignore */ }
  }

  function currentLandingKey() {
    try {
      return sessionStorage.getItem(LANDING_KEY) || detectPageKey() || '';
    } catch (e) {
      return detectPageKey() || '';
    }
  }

  function trackAddToCart(input) {
    var data = input || {};
    var value = toNumber(data.value);
    var currency = data.currency || 'VND';
    var contents = normalizeContents(data.contents);
    var pageKey = currentLandingKey();

    pushDataLayer({
      event: 'add_to_cart',
      currency: currency,
      value: value,
      items: contents,
      page_key: pageKey || undefined
    });

    fireFbq('AddToCart', {
      value: value,
      currency: currency,
      content_ids: contents.map(function (c) { return c.id; }),
      content_type: 'product',
      contents: contents.map(function (c) {
        return { id: c.id, quantity: c.quantity, item_price: c.item_price };
      })
    });

    fireGtag('add_to_cart', {
      currency: currency,
      value: value,
      items: contents.map(function (c) {
        return { item_id: c.id, quantity: c.quantity, price: c.item_price };
      })
    });
  }

  function trackBeginCheckout(input) {
    var data = input || {};
    var value = toNumber(data.value);
    var currency = data.currency || 'VND';
    var contents = normalizeContents(data.contents);
    var numItems = data.num_items != null ? toNumber(data.num_items) : contents.reduce(function (s, c) { return s + c.quantity; }, 0);
    var pageKey = currentLandingKey();

    pushDataLayer({
      event: 'begin_checkout',
      currency: currency,
      value: value,
      items: contents,
      num_items: numItems,
      page_key: pageKey || undefined
    });

    fireFbq('InitiateCheckout', {
      value: value,
      currency: currency,
      num_items: numItems,
      content_ids: contents.map(function (c) { return c.id; }),
      content_type: 'product'
    });

    fireGtag('begin_checkout', {
      currency: currency,
      value: value,
      items: contents.map(function (c) {
        return { item_id: c.id, quantity: c.quantity, price: c.item_price };
      })
    });
  }

  function trackPurchase(input) {
    var data = input || {};
    var orderId = String(data.order_id || data.orderId || '').trim();
    var value = toNumber(data.value);
    var currency = data.currency || 'VND';
    var contents = normalizeContents(data.contents);
    var numItems = data.num_items != null ? toNumber(data.num_items) : contents.reduce(function (s, c) { return s + c.quantity; }, 0);
    var pageKey = currentLandingKey();

    if (!orderId && value <= 0) return Promise.resolve(false);

    return readyPromise.then(function () {
      if (orderId) {
        try {
          var dedupeKey = 'vd_purchase_fired_' + orderId;
          if (sessionStorage.getItem(dedupeKey) === '1') return false;
          sessionStorage.setItem(dedupeKey, '1');
        } catch (e) { /* ignore */ }
      }

      pushDataLayer({
        event: 'purchase',
        ecommerce: {
          transaction_id: orderId || undefined,
          value: value,
          currency: currency,
          items: contents.map(function (c) {
            return { item_id: c.id, quantity: c.quantity, price: c.item_price };
          })
        },
        page_key: pageKey || undefined
      });

      fireFbq('Purchase', {
        value: value,
        currency: currency,
        content_ids: contents.map(function (c) { return c.id; }),
        content_type: 'product',
        num_items: numItems || undefined,
        contents: contents.map(function (c) {
          return { id: c.id, quantity: c.quantity, item_price: c.item_price };
        })
      });

      fireGtag('purchase', {
        transaction_id: orderId || undefined,
        value: value,
        currency: currency,
        items: contents.map(function (c) {
          return { item_id: c.id, quantity: c.quantity, price: c.item_price };
        })
      });

      return true;
    });
  }

  global.ShopvdMarketing = {
    ready: readyPromise,
    getLandingPageKey: function () {
      try {
        return sessionStorage.getItem(LANDING_KEY) || detectPageKey() || '';
      } catch (e) {
        return detectPageKey() || '';
      }
    },
    setLandingPageKey: rememberPageKey,
    trackEvent: function (eventName, payload) {
      pushDataLayer(Object.assign({ event: eventName }, payload || {}));
      if (typeof global.fbq === 'function' && eventName) {
        try {
          global.fbq('trackCustom', eventName, payload || {});
        } catch (e) { /* ignore */ }
      }
    },
    trackAddToCart: trackAddToCart,
    trackBeginCheckout: trackBeginCheckout,
    trackPurchase: trackPurchase,
    reload: function () {
      try { sessionStorage.removeItem(CACHE_KEY); } catch (e) { /* ignore */ }
      global.__vdGtmInjected = false;
      global.__vdMetaInjected = false;
      global.__vdGtagAdsInjected = false;
      global.__vdMarketingLoaderStarted = false;
      readyPromise = new Promise(function (resolve) { readyResolve = resolve; });
      return boot();
    }
  };

  boot();
})(typeof window !== 'undefined' ? window : globalThis);
